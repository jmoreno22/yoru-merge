//! Commit messages written by whichever AI CLI the user already has.
//!
//! YoruMerge never talks to a model. It spawns the CLI the user configured —
//! the same way it already spawns `git`, an editor and a terminal — hands it
//! the staged diff on stdin, and reads a commit message back. There is no API
//! key to store, no account to create and no request that leaves this machine
//! except the one the user's own CLI makes with the user's own subscription.
//!
//! The provider is a command string, exactly like `externalEditor` and
//! `terminal`. Nothing here knows the name of a single vendor: what a provider
//! is, in this module, is "a program that reads a prompt and prints an answer".
//!
//! The pure half of the work — parsing that command, building the prompt and
//! cleaning up the answer — lives in [`super::ai_message`].

use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use super::ai_message::{
    build_prompt, extract_text, parse_provider_command, sanitize_instructions, sanitize_message,
    truncate_diff, uses_conventional_commits, wants_body, PromptInput, ProviderCommand,
};
use super::git::{blocking, validate_repo_path, GitCmd};

/// How much of the staged diff reaches the prompt, and the bounds the caller's
/// preference is clamped to. The ceiling is about context cost, not capability:
/// past this the model is summarising a refactor it cannot see the end of.
const DEFAULT_MAX_DIFF_KB: usize = 48;
const MIN_MAX_DIFF_KB: usize = 1;
const MAX_MAX_DIFF_KB: usize = 256;

const DEFAULT_TIMEOUT_SECS: u64 = 60;
const MIN_TIMEOUT_SECS: u64 = 5;
const MAX_TIMEOUT_SECS: u64 = 300;

/// Ceiling on what is read back from the child, per stream. A commit message is
/// a few hundred bytes; anything past this is a CLI that has lost its mind, and
/// it must not become this process's memory problem.
const MAX_OUTPUT_BYTES: usize = 256 * 1024;

/// Subjects handed to the model as the repository's house style.
const RECENT_SUBJECTS: usize = 10;

/// How often the child is checked while waiting. `std::process` has no wait
/// with a deadline, and 50 ms of latency on a call that takes seconds is free.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// Lines of the provider's stderr kept for the error message.
const STDERR_TAIL_LINES: usize = 6;

/// Diff shown to the provider by [`test_ai_provider`].
///
/// A fixed, meaningless change on purpose: the point of the test button is to
/// prove the CLI is installed, authenticated and answering, and nothing about
/// the user's actual code needs to leave the machine to establish that.
const PROBE_DIFF: &str = "\
diff --git a/greeting.txt b/greeting.txt
index 1234567..89abcde 100644
--- a/greeting.txt
+++ b/greeting.txt
@@ -1 +1 @@
-hello
+hello world
";

/// The staged change set, summarised for the prompt.
struct StagedSummary {
    files: usize,
    lines: usize,
    /// One `path | +a -d` line per file, which is what the model reads.
    stat: String,
}

/// `git config --get yoru.ai`, the per-repository opt-out.
///
/// A repository can refuse to have its diffs sent anywhere by setting
/// `yoru.ai` to false, which is checked here as well as hidden in the UI: the
/// setting is the guarantee, and a guarantee enforced only by a disabled button
/// is not one.
fn ai_allowed(path: &str) -> bool {
    let value = GitCmd::in_repo(path)
        .args(["config", "--get", "yoru.ai"])
        .run()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    !matches!(value.as_str(), "false" | "0" | "no" | "off")
}

/// Recent subjects, newest first. An empty history is not an error.
fn recent_subjects(path: &str) -> Vec<String> {
    GitCmd::in_repo(path)
        .args([
            "log",
            "--no-merges",
            "--format=%s",
            &format!("-n{RECENT_SUBJECTS}"),
        ])
        .run()
        .unwrap_or_default()
        .lines()
        .map(str::trim)
        .filter(|subject| !subject.is_empty())
        .map(str::to_string)
        .collect()
}

/// Reads `--numstat` rather than `--stat`: it gives exact counts (which decide
/// whether to ask for a body at all) instead of proportional bars, and the
/// readable summary is cheap to build from it.
fn staged_summary(path: &str) -> Result<StagedSummary, String> {
    let raw = GitCmd::in_repo(path)
        .args(["diff", "--cached", "--numstat"])
        .run()?;

    let mut files = 0usize;
    let mut lines = 0usize;
    let mut stat = String::new();
    for entry in raw.lines() {
        let mut parts = entry.split('\t');
        let added = parts.next().unwrap_or("");
        let removed = parts.next().unwrap_or("");
        let Some(file) = parts.next() else {
            continue;
        };
        files += 1;
        // Binary files are reported as `-` on both sides.
        match (added.parse::<usize>(), removed.parse::<usize>()) {
            (Ok(a), Ok(d)) => {
                lines += a + d;
                stat.push_str(&format!("  {file} | +{a} -{d}\n"));
            }
            _ => stat.push_str(&format!("  {file} | binary\n")),
        }
    }
    Ok(StagedSummary { files, lines, stat })
}

fn current_branch(path: &str) -> String {
    GitCmd::in_repo(path)
        .args(["symbolic-ref", "--quiet", "--short", "HEAD"])
        .run()
        .unwrap_or_default()
        .trim()
        .to_string()
}

// ── Running the provider ─────────────────────────────────────────────────────

/// Reads a stream to EOF, keeping at most `cap` bytes.
///
/// Draining past the cap rather than stopping is the point: a full pipe blocks
/// the child, so a reader that gives up early deadlocks the very process it is
/// trying to limit.
fn read_capped(mut source: impl Read, cap: usize) -> Vec<u8> {
    let mut kept: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        match source.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(read) => {
                if kept.len() < cap {
                    let room = cap - kept.len();
                    kept.extend_from_slice(&chunk[..read.min(room)]);
                }
            }
        }
    }
    kept
}

/// Waits for `child`, killing it once `timeout` has passed.
///
/// On Windows this kills the process but not any grandchildren it spawned; the
/// CLIs this runs are single processes in `--print` mode, and a node shim that
/// outlives its parent would exit on its own once the pipes close.
fn wait_with_timeout(child: &mut Child, timeout: Duration) -> Result<bool, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Err(e) => return Err(format!("failed to wait for the provider: {e}")),
            Ok(Some(status)) => return Ok(status.success()),
            Ok(None) => {}
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "the provider did not answer within {} seconds",
                timeout.as_secs()
            ));
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

/// The last few lines of a failing provider's stderr, as the error message.
fn failure_message(stderr: &[u8], stdout: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let tail: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .rev()
        .take(STDERR_TAIL_LINES)
        .collect();
    if !tail.is_empty() {
        return tail.into_iter().rev().collect::<Vec<_>>().join("\n");
    }
    // Some CLIs report their errors on stdout and say nothing on stderr.
    let out = String::from_utf8_lossy(stdout).trim().to_string();
    if !out.is_empty() {
        return out;
    }
    "the provider failed without a message".to_string()
}

/// Spawns the provider, feeds it the prompt and returns its raw stdout.
///
/// The environment is fixed the way [`super::git::GitCmd`] fixes git's: no
/// colour, no spinners, no console window, and none of the AppImage's bundled
/// library paths — these CLIs are node or bun binaries and would break on them
/// exactly as `git-remote-https` did.
fn run_provider(
    provider: &ProviderCommand,
    prompt: &str,
    cwd: Option<&str>,
    timeout: Duration,
) -> Result<String, String> {
    let mut command = Command::new(&provider.program);
    command
        .args(provider.args_with_prompt(prompt))
        .env("NO_COLOR", "1")
        .env("CLICOLOR", "0")
        .env("FORCE_COLOR", "0")
        .env("TERM", "dumb")
        // These CLIs run git themselves; a credential prompt in a child of a
        // GUI app would hang forever with nobody to answer it.
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    // With the prompt in an argument there is nothing to send, and an open
    // stdin is one more thing an interactive CLI could decide to wait on.
    command.stdin(if provider.prompt_in_args {
        Stdio::null()
    } else {
        Stdio::piped()
    });
    super::git::strip_appimage_libs(&mut command);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let mut child = command.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!(
                "'{}' was not found. Install it, or set another provider in Settings › AI.",
                provider.program
            )
        } else {
            format!("could not start {}: {e}", provider.program)
        }
    })?;

    // The prompt can be tens of kilobytes and a pipe buffer is 64 KB at best,
    // so writing it from this thread could block before the child starts
    // reading. The writer is deliberately not joined: its only job is to write
    // and close, and if the child dies first the broken pipe ends it.
    if let Some(mut stdin) = child.stdin.take() {
        let payload = prompt.as_bytes().to_vec();
        std::thread::spawn(move || {
            let _ = stdin.write_all(&payload);
            let _ = stdin.flush();
        });
    }

    let stdout = child
        .stdout
        .take()
        .map(|pipe| std::thread::spawn(move || read_capped(pipe, MAX_OUTPUT_BYTES)));
    let stderr = child
        .stderr
        .take()
        .map(|pipe| std::thread::spawn(move || read_capped(pipe, MAX_OUTPUT_BYTES)));

    let wait = wait_with_timeout(&mut child, timeout);

    let collect = |handle: Option<std::thread::JoinHandle<Vec<u8>>>| {
        handle.and_then(|h| h.join().ok()).unwrap_or_default()
    };
    let out = collect(stdout);
    let err = collect(stderr);

    match wait {
        Err(timeout_message) => Err(timeout_message),
        Ok(true) => Ok(String::from_utf8_lossy(&out).into_owned()),
        Ok(false) => Err(failure_message(&err, &out)),
    }
}

// ── The pipeline ─────────────────────────────────────────────────────────────

fn clamp_diff_bytes(max_diff_kb: Option<usize>) -> usize {
    max_diff_kb
        .unwrap_or(DEFAULT_MAX_DIFF_KB)
        .clamp(MIN_MAX_DIFF_KB, MAX_MAX_DIFF_KB)
        * 1024
}

fn clamp_timeout(timeout_secs: Option<u64>) -> Duration {
    Duration::from_secs(
        timeout_secs
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(MIN_TIMEOUT_SECS, MAX_TIMEOUT_SECS),
    )
}

/// Everything up to the point of spawning anything: the prompt for what is
/// staged in `path`.
///
/// Split out so the Settings dialog can show the user exactly what would be
/// sent — the prompt is the only place the user's code appears, and "trust me"
/// is not an answer when the question is what leaves the machine.
fn prompt_for_repo(
    path: &str,
    provider: &ProviderCommand,
    max_diff_bytes: usize,
    instructions: &str,
) -> Result<String, String> {
    validate_repo_path(path)?;
    if !ai_allowed(path) {
        return Err("AI is turned off for this repository (yoru.ai is false)".to_string());
    }

    let summary = staged_summary(path)?;
    if summary.files == 0 {
        return Err("nothing is staged".to_string());
    }

    let diff = super::diff::get_diff_inner(path, None, true)?;
    let subjects = recent_subjects(path);
    let truncated = truncate_diff(&diff, provider.diff_budget(max_diff_bytes));
    Ok(build_prompt(&PromptInput {
        branch: &current_branch(path),
        stat: &summary.stat,
        diff: &truncated,
        recent_subjects: &subjects,
        conventional: uses_conventional_commits(&subjects),
        want_body: wants_body(summary.files, summary.lines),
        instructions,
    }))
}

fn generate_inner(
    path: &str,
    provider: &ProviderCommand,
    max_diff_bytes: usize,
    timeout: Duration,
    instructions: &str,
) -> Result<String, String> {
    let prompt = prompt_for_repo(path, provider, max_diff_bytes, instructions)?;
    let raw = run_provider(provider, &prompt, Some(path), timeout)?;
    sanitize_message(&extract_text(&raw))
}

/// A commit message for whatever is staged in `path`.
///
/// `command` is the provider command as configured by the user; everything
/// about which CLI that is, and which model it runs, lives in that string.
/// `instructions` is the user's own layer of the prompt — house style, a
/// language, a ticket convention — and refines the built-in rules rather than
/// replacing them.
#[tauri::command]
pub async fn generate_commit_message(
    path: String,
    command: String,
    instructions: Option<String>,
    max_diff_kb: Option<usize>,
    timeout_secs: Option<u64>,
) -> Result<String, String> {
    let provider = parse_provider_command(&command)?;
    let max_diff_bytes = clamp_diff_bytes(max_diff_kb);
    let timeout = clamp_timeout(timeout_secs);
    let house = sanitize_instructions(&instructions.unwrap_or_default());
    blocking(move || generate_inner(&path, &provider, max_diff_bytes, timeout, &house)).await
}

/// The exact prompt [`generate_commit_message`] would send, without sending it.
///
/// This is what Settings shows behind "See what gets sent": the user can read
/// their own diff, their own instructions and our rules in one place, and check
/// their wording before spending a request on it.
#[tauri::command]
pub async fn preview_ai_prompt(
    path: String,
    command: String,
    instructions: Option<String>,
    max_diff_kb: Option<usize>,
) -> Result<String, String> {
    let provider = parse_provider_command(&command)?;
    let max_diff_bytes = clamp_diff_bytes(max_diff_kb);
    let house = sanitize_instructions(&instructions.unwrap_or_default());
    blocking(move || prompt_for_repo(&path, &provider, max_diff_bytes, &house)).await
}

/// Runs the configured provider against a fixed one-line diff.
///
/// This is the Settings "Test" button: it answers "is this command installed,
/// authenticated and returning something usable?" without needing a repository
/// or showing the user's code to anyone.
#[tauri::command]
pub async fn test_ai_provider(
    command: String,
    timeout_secs: Option<u64>,
) -> Result<String, String> {
    let provider = parse_provider_command(&command)?;
    let timeout = clamp_timeout(timeout_secs);
    blocking(move || {
        let prompt = build_prompt(&PromptInput {
            branch: "main",
            stat: "  greeting.txt | +1 -1\n",
            diff: &truncate_diff(PROBE_DIFF, provider.diff_budget(4096)),
            recent_subjects: &[],
            conventional: true,
            want_body: false,
            // The user's instructions are left out: the question here is
            // whether the CLI answers at all, not whether it follows a style.
            instructions: "",
        });
        let raw = run_provider(&provider, &prompt, None, timeout)?;
        sanitize_message(&extract_text(&raw))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

    /// A provider that needs no network, no account and no AI CLI: the shape
    /// every test here leans on, and the reason this feature has a CI story.
    ///
    /// `git config --get` on a value passed with `-c` prints exactly that value
    /// and exits 0 — a provider that answers, with no shell in sight. git is
    /// always installed, since the whole app requires it.
    fn echo_provider(message: &str) -> ProviderCommand {
        ProviderCommand {
            program: "git".to_string(),
            args: vec![
                "-c".to_string(),
                format!("yoru.fake={message}"),
                "config".to_string(),
                "--get".to_string(),
                "yoru.fake".to_string(),
            ],
            prompt_in_args: false,
        }
    }

    fn failing_provider() -> ProviderCommand {
        parse_provider_command("git --this-flag-does-not-exist").unwrap()
    }

    fn staged_repo() -> (tempfile::TempDir, String) {
        let (dir, path) = init_repo();
        write_file(&path, "a.txt", "v1\nv2\nv3\n");
        git_ok(&path, &["add", "."]);
        (dir, path)
    }

    #[test]
    fn a_missing_program_says_how_to_fix_it() {
        let provider = parse_provider_command("yoru-no-such-ai-cli").unwrap();
        let error = run_provider(&provider, "hi", None, Duration::from_secs(5)).unwrap_err();
        assert!(error.contains("was not found"), "got: {error}");
        assert!(error.contains("Settings"), "got: {error}");
    }

    #[test]
    fn a_provider_that_answers_produces_its_text() {
        let provider = echo_provider("feat: add a thing");
        let out = run_provider(&provider, "prompt", None, Duration::from_secs(30)).unwrap();
        assert!(out.contains("feat: add a thing"), "got: {out}");
    }

    #[test]
    fn a_failing_provider_reports_its_own_stderr() {
        let error =
            run_provider(&failing_provider(), "prompt", None, Duration::from_secs(30)).unwrap_err();
        assert!(!error.is_empty());
        assert!(!error.contains("failed without a message"), "got: {error}");
    }

    /// The guarantee that a hung CLI cannot hold the app.
    ///
    /// `git cat-file --batch` reads commands off stdin; with the pipe held open
    /// and nothing written to it, it waits forever — which is exactly the
    /// failure mode of a CLI sitting on a login prompt.
    #[test]
    fn a_child_that_never_finishes_is_killed_at_the_deadline() {
        let mut child = Command::new("git")
            .args(["cat-file", "--batch"])
            .stdin(Stdio::piped()) // held open by `child`, never written to
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn git cat-file");

        let started = Instant::now();
        let error = wait_with_timeout(&mut child, Duration::from_millis(300)).unwrap_err();

        assert!(error.contains("did not answer within"), "got: {error}");
        // Killed at the deadline, not after some multiple of it.
        assert!(started.elapsed() < Duration::from_secs(5));
        // And it really is gone, not merely abandoned.
        assert!(child.try_wait().unwrap().is_some());
    }

    #[test]
    fn a_child_that_finishes_in_time_reports_its_status() {
        let mut ok = Command::new("git")
            .arg("--version")
            .stdout(Stdio::null())
            .spawn()
            .expect("spawn git --version");
        assert!(wait_with_timeout(&mut ok, Duration::from_secs(30)).unwrap());

        let mut bad = Command::new("git")
            .arg("--this-flag-does-not-exist")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn git");
        assert!(!wait_with_timeout(&mut bad, Duration::from_secs(30)).unwrap());
    }

    /// A prompt far larger than a pipe buffer must not deadlock the writer.
    #[test]
    fn a_prompt_larger_than_a_pipe_buffer_does_not_deadlock() {
        let provider = echo_provider("chore: big prompt");
        let prompt = "x".repeat(512 * 1024);
        let out = run_provider(&provider, &prompt, None, Duration::from_secs(60)).unwrap();
        assert!(out.contains("chore: big prompt"));
    }

    #[test]
    fn a_torrent_of_output_is_capped() {
        let kept = read_capped(
            std::io::repeat(b'x').take(4 * 1024 * 1024),
            MAX_OUTPUT_BYTES,
        );
        assert_eq!(kept.len(), MAX_OUTPUT_BYTES);
    }

    // ── generate_inner ───────────────────────────────────────────────────────

    #[test]
    fn nothing_staged_is_refused_before_the_provider_runs() {
        let (_dir, path) = init_repo();
        let error = generate_inner(
            &path,
            &echo_provider("feat: unused"),
            4096,
            Duration::from_secs(30),
            "",
        )
        .unwrap_err();
        assert_eq!(error, "nothing is staged");
    }

    #[test]
    fn a_staged_change_produces_a_sanitised_message() {
        let (_dir, path) = staged_repo();
        let message = generate_inner(
            &path,
            &echo_provider("feat: add the lines"),
            48 * 1024,
            Duration::from_secs(30),
            "",
        )
        .unwrap();
        assert_eq!(message, "feat: add the lines");
    }

    /// The per-repository opt-out is enforced here, not only in the UI.
    #[test]
    fn a_repository_can_turn_ai_off() {
        let (_dir, path) = staged_repo();
        git_ok(&path, &["config", "yoru.ai", "false"]);
        assert!(!ai_allowed(&path));

        let error = generate_inner(
            &path,
            &echo_provider("feat: should never run"),
            4096,
            Duration::from_secs(30),
            "",
        )
        .unwrap_err();
        assert!(
            error.contains("turned off for this repository"),
            "got: {error}"
        );

        git_ok(&path, &["config", "yoru.ai", "true"]);
        assert!(ai_allowed(&path));
    }

    #[test]
    fn a_repository_without_the_setting_allows_ai() {
        let (_dir, path) = init_repo();
        assert!(ai_allowed(&path));
    }

    #[test]
    fn an_invalid_repository_path_is_refused() {
        assert!(generate_inner(
            "",
            &echo_provider("feat: x"),
            4096,
            Duration::from_secs(5),
            ""
        )
        .is_err());
    }

    // ── summaries ────────────────────────────────────────────────────────────

    #[test]
    fn the_staged_summary_counts_files_and_lines() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "one\ntwo\nthree\n");
        write_file(&path, "b.txt", "nuevo\n");
        git_ok(&path, &["add", "."]);

        let summary = staged_summary(&path).unwrap();
        assert_eq!(summary.files, 2);
        assert!(summary.lines >= 4, "got {}", summary.lines);
        assert!(summary.stat.contains("a.txt | +"), "got: {}", summary.stat);
        assert!(
            summary.stat.contains("b.txt | +1 -0"),
            "got: {}",
            summary.stat
        );
    }

    #[test]
    fn a_binary_file_is_summarised_without_line_counts() {
        let (_dir, path) = init_repo();
        std::fs::write(
            std::path::Path::new(&path).join("logo.bin"),
            [0u8, 159, 146, 150],
        )
        .unwrap();
        git_ok(&path, &["add", "."]);

        let summary = staged_summary(&path).unwrap();
        assert_eq!(summary.files, 1);
        assert!(
            summary.stat.contains("logo.bin | binary"),
            "got: {}",
            summary.stat
        );
    }

    #[test]
    fn recent_subjects_come_back_newest_first() {
        let (_dir, path) = init_repo();
        write_file(&path, "b.txt", "x\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "feat: second"]);

        let subjects = recent_subjects(&path);
        assert_eq!(subjects.first().map(String::as_str), Some("feat: second"));
        assert!(subjects.contains(&"init".to_string()));
    }

    #[test]
    fn an_empty_repository_has_no_subjects_and_no_branch_error() {
        let (_dir, path) = crate::commands::git::test_support::init_empty_repo();
        assert!(recent_subjects(&path).is_empty());
        assert_eq!(current_branch(&path), "main");
    }

    // ── against a real provider ──────────────────────────────────────────────

    /// End-to-end smoke test through an actual AI CLI.
    ///
    /// Ignored by default: it needs a provider installed and signed in, it
    /// spends the user's quota, and CI has neither. It exists because every
    /// other test here stubs the provider out, and the things only a real one
    /// can tell you — that the preset's flags are accepted, that the CLI reads
    /// a piped prompt, that its JSON envelope is the shape `extract_text`
    /// expects — are exactly the ones that break.
    ///
    /// ```text
    /// cargo test --lib a_real_provider -- --ignored --nocapture
    /// YORU_AI_TEST_COMMAND="gemini --output-format json" cargo test --lib \
    ///     a_real_provider -- --ignored --nocapture
    /// ```
    ///
    /// Worth running against a provider of each kind, since they exercise
    /// different halves of [`ProviderCommand`]: one that reads stdin (Claude
    /// Code, Codex, Gemini) and one that takes the prompt as an argument
    /// (`copilot -p {prompt} -s --no-color --deny-tool=shell`). Both have been
    /// confirmed to pass, including the house-rule layer — asked for a Spanish
    /// subject, both obliged over an English history.
    #[test]
    #[ignore = "needs an AI CLI installed and signed in; spends real quota"]
    fn a_real_provider_drafts_a_usable_message() {
        const DEFAULT_COMMAND: &str = "claude -p --model haiku --effort low \
             --output-format json --restricted --no-session-persistence";

        let command =
            std::env::var("YORU_AI_TEST_COMMAND").unwrap_or_else(|_| DEFAULT_COMMAND.to_string());
        let provider = parse_provider_command(&command).expect("the command should parse");

        // A repository whose history is conventional, so the prompt asks for a
        // conventional subject and the detection is exercised too.
        let (_dir, path) = init_repo();
        for subject in ["feat(ui): add the toolbar", "fix(graph): clamp the lanes"] {
            write_file(&path, "history.txt", subject);
            git_ok(&path, &["add", "."]);
            git_ok(&path, &["commit", "-m", subject]);
        }
        write_file(
            &path,
            "src/parser.rs",
            "pub fn parse(input: &str) -> Option<u32> {\n    input.trim().parse().ok()\n}\n",
        );
        write_file(&path, "README.md", "# Parser\n\nParses numbers.\n");
        git_ok(&path, &["add", "."]);

        let message = generate_inner(
            &path,
            &provider,
            48 * 1024,
            Duration::from_secs(180),
            // A representative sample of the shipped house rules rather than a
            // copy of them: the real text lives in `ai-presets.ts`, and two
            // copies would drift apart. What matters here is that the layer
            // reaches the model at all, and these are the lines whose effect
            // shows up in the output.
            "Write in English, whatever language the repository history uses.
             The subject is the one line that gets read: lead with a precise verb and name what it acts on.
             Weak verbs waste it — update, improve, change, handle, support. Name the specific thing instead.
             Every body line must add something the subject could not fit.
             Never a motive the diff does not show.",
        )
        .expect("the provider should answer");

        println!("\n--- {command}\n{message}\n---");

        let subject = message.lines().next().expect("a subject");
        assert!(!subject.is_empty(), "the subject must not be empty");
        assert!(
            subject.chars().count() <= 72,
            "subject is {} chars: {subject}",
            subject.chars().count()
        );
        // Everything the sanitiser promises, verified against real output
        // rather than against a fixture someone wrote by hand.
        assert!(!message.contains("```"), "fences leaked: {message}");
        assert!(
            !message.to_lowercase().contains("co-authored-by"),
            "attribution leaked: {message}"
        );
        assert!(!message.contains('\r'), "CRLF leaked: {message}");
        assert!(!message.starts_with("Here"), "a preamble leaked: {message}");
    }

    // ── clamps ───────────────────────────────────────────────────────────────

    #[test]
    fn the_caller_cannot_ask_for_an_absurd_budget_or_timeout() {
        assert_eq!(clamp_diff_bytes(None), DEFAULT_MAX_DIFF_KB * 1024);
        assert_eq!(clamp_diff_bytes(Some(0)), MIN_MAX_DIFF_KB * 1024);
        assert_eq!(clamp_diff_bytes(Some(99_999)), MAX_MAX_DIFF_KB * 1024);

        assert_eq!(clamp_timeout(None).as_secs(), DEFAULT_TIMEOUT_SECS);
        assert_eq!(clamp_timeout(Some(0)).as_secs(), MIN_TIMEOUT_SECS);
        assert_eq!(clamp_timeout(Some(9_999)).as_secs(), MAX_TIMEOUT_SECS);
    }
}
