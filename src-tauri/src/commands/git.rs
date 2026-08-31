//! Shared git subprocess builder and input validation.
//!
//! Every command module spawns `git` through [`GitCmd`] so the environment is
//! identical everywhere: no terminal prompts, English messages (our parsers
//! depend on them), no optional index locks on read paths, no console window
//! flashing on Windows, and `stdin` closed so nothing can block waiting for
//! input.

use std::collections::VecDeque;
use std::ffi::OsStr;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Output, Stdio};

pub struct GitCmd {
    cmd: Command,
}

impl GitCmd {
    /// A git command without repository context (`clone`, `init`, `--version`).
    pub fn bare() -> Self {
        let mut cmd = Command::new("git");
        // `core.quotePath=false` keeps non-ASCII paths as raw UTF-8 instead of
        // C-style octal escapes, which the diff viewer would render literally.
        cmd.args(["-c", "core.quotePath=false"])
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .env("LANG", "C")
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_PAGER", "cat")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: a GUI app must never flash a console.
            cmd.creation_flags(0x0800_0000);
        }
        Self { cmd }
    }

    /// A git command executed inside `repo` (`git -C <repo> …`).
    pub fn in_repo(repo: &str) -> Self {
        let mut g = Self::bare();
        g.cmd.args(["-C", repo]);
        g
    }

    pub fn arg(mut self, a: impl AsRef<OsStr>) -> Self {
        self.cmd.arg(a);
        self
    }

    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.cmd.args(args);
        self
    }

    pub fn env(mut self, key: impl AsRef<OsStr>, value: impl AsRef<OsStr>) -> Self {
        self.cmd.env(key, value);
        self
    }

    pub fn current_dir(mut self, dir: impl AsRef<Path>) -> Self {
        self.cmd.current_dir(dir);
        self
    }

    /// Raw output; `Err` only when the process could not be spawned.
    pub fn output(mut self) -> Result<Output, String> {
        self.cmd
            .output()
            .map_err(|e| format!("failed to run git: {e}"))
    }

    /// `true` when git exited 0. A spawn failure counts as `false`, which is
    /// what every caller of this helper wants (it only asks yes/no questions
    /// such as "is this path tracked?").
    pub fn succeeds(self) -> bool {
        self.output().map(|o| o.status.success()).unwrap_or(false)
    }

    /// Stdout (lossy UTF-8) on success, trimmed stderr (or `fallback`) on failure.
    pub fn run(self) -> Result<String, String> {
        let out = self.output()?;
        result_from_output(out)
    }

    /// Like [`run`](Self::run) but feeds `input` on stdin (e.g. `--pathspec-from-file=-`).
    pub fn run_with_stdin(mut self, input: &[u8]) -> Result<String, String> {
        self.cmd.stdin(Stdio::piped());
        let mut child = self
            .cmd
            .spawn()
            .map_err(|e| format!("failed to run git: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(input)
                .map_err(|e| format!("failed to write git stdin: {e}"))?;
        }
        let out = child
            .wait_with_output()
            .map_err(|e| format!("failed to wait for git: {e}"))?;
        result_from_output(out)
    }

    /// Run a long transfer (`clone`, `fetch`) and hand every progress line to
    /// `on_line` as it arrives.
    ///
    /// Git writes `--progress` output to stderr and separates in-place updates
    /// with `\r` rather than `\n`, so both are treated as line terminators.
    /// On failure the last few lines are returned as the error message.
    pub fn run_streaming(mut self, mut on_line: impl FnMut(&str)) -> Result<(), String> {
        const TAIL_LINES: usize = 8;

        self.cmd.stdout(Stdio::null());
        let mut child = self
            .cmd
            .spawn()
            .map_err(|e| format!("failed to run git: {e}"))?;
        let mut stderr = child
            .stderr
            .take()
            .ok_or_else(|| "git produced no output stream".to_string())?;

        let mut pending: Vec<u8> = Vec::new();
        let mut chunk = [0u8; 4096];
        let mut tail: VecDeque<String> = VecDeque::with_capacity(TAIL_LINES);
        let mut emit = |line: &str, tail: &mut VecDeque<String>| {
            if line.is_empty() {
                return;
            }
            if tail.len() == TAIL_LINES {
                tail.pop_front();
            }
            tail.push_back(line.to_string());
            on_line(line);
        };

        loop {
            let read = stderr
                .read(&mut chunk)
                .map_err(|e| format!("failed to read git output: {e}"))?;
            if read == 0 {
                break;
            }
            pending.extend_from_slice(&chunk[..read]);
            while let Some(pos) = pending.iter().position(|&b| b == b'\n' || b == b'\r') {
                let line: Vec<u8> = pending.drain(..=pos).collect();
                let text = String::from_utf8_lossy(&line[..line.len() - 1]);
                emit(text.trim(), &mut tail);
            }
        }
        let rest = String::from_utf8_lossy(&pending);
        emit(rest.trim(), &mut tail);

        let status = child
            .wait()
            .map_err(|e| format!("failed to wait for git: {e}"))?;
        if status.success() {
            return Ok(());
        }
        let message = tail.iter().cloned().collect::<Vec<_>>().join("\n");
        Err(if message.is_empty() {
            "git command failed".to_string()
        } else {
            message
        })
    }
}

/// Run blocking git work on the blocking pool.
///
/// Every `#[tauri::command]` in this crate is `async` and does its real work
/// through this helper, so a slow repository can never stall the IPC thread.
pub async fn blocking<T, F>(work: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("git task failed: {e}"))?
}

fn result_from_output(out: Output) -> Result<String, String> {
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(stderr_or(&out, "git command failed"))
    }
}

/// Trimmed stderr, falling back to stdout, then to `fallback`.
pub fn stderr_or(out: &Output, fallback: &str) -> String {
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !err.is_empty() {
        return err;
    }
    let std = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !std.is_empty() {
        return std;
    }
    fallback.to_string()
}

/// Path string safe to hand to git on every platform (forward slashes).
pub fn git_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

// ── Validation ───────────────────────────────────────────────────────────────
//
// Arguments never pass through a shell, so the only real hazards are option
// injection (a leading `-`) and NUL bytes. Everything else — spaces, `&`,
// unicode — is legitimate in paths, branch names and messages.

fn reject_nul(s: &str, what: &str) -> Result<(), String> {
    if s.contains('\0') {
        return Err(format!("{what} contains a NUL byte"));
    }
    Ok(())
}

fn reject_option_like(s: &str, what: &str) -> Result<(), String> {
    if s.starts_with('-') {
        return Err(format!("{what} must not start with '-'"));
    }
    Ok(())
}

/// Absolute path to an existing directory.
pub fn validate_repo_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("path is empty".into());
    }
    reject_nul(path, "path")?;
    reject_option_like(path, "path")?;
    let p = Path::new(path);
    if !p.is_dir() {
        return Err("path does not exist".into());
    }
    Ok(())
}

/// Repository-relative file path (as printed by git). Rejects traversal.
pub fn validate_pathspec(file: &str) -> Result<(), String> {
    if file.is_empty() {
        return Err("file path is empty".into());
    }
    reject_nul(file, "file path")?;
    if Path::new(file)
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("file path must not contain '..'".into());
    }
    Ok(())
}

/// Branch / tag / remote-branch name. Mirrors the parts of
/// `git check-ref-format` that matter for safety; unicode is allowed.
pub fn validate_ref(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("ref name is empty".into());
    }
    reject_nul(name, "ref name")?;
    reject_option_like(name, "ref name")?;
    if name.contains("..")
        || name.contains("@{")
        || name.ends_with('/')
        || name.ends_with(".lock")
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, ' ' | '~' | '^' | ':' | '?' | '*' | '[' | '\\'))
    {
        return Err(format!("invalid ref name: {name}"));
    }
    Ok(())
}

/// 4–40 hex characters, any case.
pub fn validate_sha(sha: &str) -> Result<(), String> {
    let ok = (4..=40).contains(&sha.len()) && sha.chars().all(|c| c.is_ascii_hexdigit());
    if ok {
        Ok(())
    } else {
        Err(format!("invalid sha: {sha}"))
    }
}

/// Anything `git rev-parse` accepts: sha, ref, `HEAD~2`, `origin/main`.
pub fn validate_revision(rev: &str) -> Result<(), String> {
    if rev.is_empty() {
        return Err("revision is empty".into());
    }
    reject_nul(rev, "revision")?;
    reject_option_like(rev, "revision")?;
    if rev.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(format!("invalid revision: {rev}"));
    }
    Ok(())
}

pub fn validate_remote_name(name: &str) -> Result<(), String> {
    validate_ref(name).map_err(|_| format!("invalid remote name: {name}"))
}

/// Transports git may be asked to speak. Everything else is refused, so a
/// remote can never name a transport helper (`ext::`, `fd::`, …) — git runs
/// `git-remote-<helper>` for those, which turns a URL into command execution.
const ALLOWED_URL_SCHEMES: [&str; 5] = ["http", "https", "ssh", "git", "file"];

/// Clone / remote URL. Accepts https, ssh, git, file, scp-like `user@host:path`
/// and local paths; any other scheme is refused.
pub fn validate_url(url: &str) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("url is empty".into());
    }
    reject_nul(url, "url")?;
    reject_option_like(url, "url")?;
    if url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("url must not contain whitespace".into());
    }

    // Only the *first* colon decides how git reads the string, which is why the
    // `::` and `://` tests below never fire on `https://[::1]/x` or on a path
    // that happens to contain a colon further along.
    let Some(colon) = url.find(':') else {
        // No colon at all: a local path (`/repos/x`, `../x`, `repos/x`).
        return Ok(());
    };
    let (head, rest) = url.split_at(colon);

    if rest.starts_with("::") {
        return Err(format!("unsupported url transport: {head}::"));
    }
    if rest.starts_with("://") {
        let known = ALLOWED_URL_SCHEMES
            .iter()
            .any(|s| head.eq_ignore_ascii_case(s));
        if !known {
            return Err(format!("unsupported url scheme: {head}://"));
        }
        return Ok(());
    }
    // A single colon: Windows drive letter (`C:\repos\x`), scp-like
    // (`git@host:path`) or a local path carrying a colon. Only a leading colon
    // is nonsense to git.
    if head.is_empty() {
        return Err(format!("invalid url: {url}"));
    }
    Ok(())
}

/// Free text (commit / stash message): only NUL is forbidden.
pub fn validate_message(msg: &str) -> Result<(), String> {
    reject_nul(msg, "message")
}

/// Temporary repositories for tests.
///
/// Every helper pins `main` and a local identity so results never depend on the
/// developer's `init.defaultBranch`, global `user.*` or signing configuration.
#[cfg(test)]
pub mod test_support {
    use std::path::Path;
    use std::process::{Command, Output};
    use tempfile::TempDir;

    /// Run git inside `path`, panicking only when the binary cannot be spawned.
    ///
    /// `core.quotePath=false` mirrors [`super::GitCmd`], so assertions can use
    /// the real `señal ñ.txt` instead of git's octal escapes.
    pub fn git(path: &str, args: &[&str]) -> Output {
        Command::new("git")
            .args(["-c", "core.quotePath=false", "-C"])
            .arg(path)
            .args(args)
            .output()
            .unwrap_or_else(|e| panic!("git spawn failed: {e}"))
    }

    /// Clone `remote` into a fresh temp dir configured like [`init_repo`].
    ///
    /// The clone forces `core.autocrlf=false`: with the Windows default the
    /// checkout would rewrite every LF into CRLF and the work tree would look
    /// dirty against blobs written by these helpers.
    pub fn clone_repo(remote: &Path) -> (TempDir, String) {
        let dir = TempDir::new().expect("create clone dir");
        let path = dir.path().to_str().expect("non-UTF-8 path").to_string();

        let out = Command::new("git")
            .args(["-c", "core.autocrlf=false", "clone"])
            .arg(remote)
            .arg(&path)
            .output()
            .expect("git clone");
        assert!(
            out.status.success(),
            "git clone failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        for (key, value) in [
            ("user.email", "t@example.com"),
            ("user.name", "Test User"),
            ("commit.gpgsign", "false"),
            ("core.autocrlf", "false"),
        ] {
            git_ok(&path, &["config", key, value]);
        }
        (dir, path)
    }

    /// Run git and panic when it exits non-zero.
    pub fn git_ok(path: &str, args: &[&str]) -> String {
        let out = git(path, args);
        assert!(
            out.status.success(),
            "git {args:?} failed: {}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    pub fn write_file(repo: &str, name: &str, contents: &str) {
        let target = Path::new(repo).join(name);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).expect("create parent dir");
        }
        std::fs::write(target, contents).expect("write file");
    }

    /// An empty repository on branch `main` with no commits.
    pub fn init_empty_repo() -> (TempDir, String) {
        let dir = TempDir::new().expect("create tempdir");
        let path = dir
            .path()
            .to_str()
            .expect("non-UTF-8 tempdir path")
            .to_string();

        let out = Command::new("git")
            .args(["init", "-b", "main"])
            .arg(&path)
            .output()
            .expect("git init");
        assert!(
            out.status.success(),
            "git init failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        for (key, value) in [
            ("user.email", "t@example.com"),
            ("user.name", "Test User"),
            ("commit.gpgsign", "false"),
            ("core.autocrlf", "false"),
            ("tag.gpgsign", "false"),
        ] {
            git_ok(&path, &["config", key, value]);
        }
        (dir, path)
    }

    /// A repository on `main` with a single commit touching `a.txt`.
    pub fn init_repo() -> (TempDir, String) {
        let (dir, path) = init_empty_repo();
        write_file(&path, "a.txt", "v1\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "init"]);
        (dir, path)
    }

    /// A bare remote plus a clone of it, both configured for tests.
    pub fn init_remote_and_clone() -> (TempDir, TempDir, String) {
        let remote = TempDir::new().expect("create remote dir");
        let remote_path = remote.path().to_str().expect("non-UTF-8 path").to_string();
        let out = Command::new("git")
            .args(["init", "--bare", "-b", "main"])
            .arg(&remote_path)
            .output()
            .expect("git init --bare");
        assert!(out.status.success());

        let (seed_dir, seed) = init_repo();
        git_ok(&seed, &["remote", "add", "origin", &remote_path]);
        git_ok(&seed, &["push", "-u", "origin", "main"]);
        drop(seed_dir);

        let (clone, clone_path) = clone_repo(remote.path());
        (remote, clone, clone_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_runs_with_hardened_env() {
        let out = GitCmd::bare().arg("--version").run().unwrap();
        assert!(out.starts_with("git version"));
    }

    #[test]
    fn failure_surfaces_stderr() {
        let err = GitCmd::bare()
            .args(["definitely-not-a-git-command"])
            .run()
            .unwrap_err();
        assert!(err.contains("definitely-not-a-git-command"));
    }

    #[test]
    fn ref_validation_allows_unicode_and_slashes() {
        assert!(validate_ref("feature/añadir-login").is_ok());
        assert!(validate_ref("release@2").is_ok());
        assert!(validate_ref("-x").is_err());
        assert!(validate_ref("a..b").is_err());
        assert!(validate_ref("a b").is_err());
        assert!(validate_ref("a.lock").is_err());
    }

    #[test]
    fn pathspec_allows_spaces_and_ampersand() {
        assert!(validate_pathspec("Tom & Jerry/señal ñ.txt").is_ok());
        assert!(validate_pathspec("../escape").is_err());
        assert!(validate_pathspec("").is_err());
    }

    #[test]
    fn sha_is_case_insensitive_and_short_ok() {
        assert!(validate_sha("ABCDEF1").is_ok());
        assert!(validate_sha("abc").is_err());
        assert!(validate_sha("xyz1234").is_err());
    }

    #[test]
    fn url_rejects_option_injection() {
        assert!(validate_url("--upload-pack=calc.exe").is_err());
        assert!(validate_url("git@github.com:o/r.git").is_ok());
        assert!(validate_url("https://x/y.git").is_ok());
    }

    #[test]
    fn url_accepts_known_transports_and_local_paths() {
        for url in [
            "https://github.com/o/r.git",
            "HTTPS://GitHub.com/o/r.git",
            "http://localhost:3000/r.git",
            "ssh://git@host:22/o/r.git",
            "git://host/o/r.git",
            "file:///c/repos/r",
            "https://[::1]:8080/r.git",
            "git@github.com:owner/repo.git",
            "github.com:owner/repo.git",
            "C:\\repos\\r",
            "C:/repos/r",
            "/home/u/repos/r",
            "../sibling",
            "./r",
            "repos/r",
        ] {
            assert!(validate_url(url).is_ok(), "should accept {url}");
        }
    }

    #[test]
    fn url_rejects_unknown_schemes_and_transport_helpers() {
        for url in [
            "ext::",
            "ext::sh",
            "ext::sh-c%20calc.exe",
            "fd::7,8",
            "::1",
            "javascript://x",
            "data://text/html",
            "ftp://host/r.git",
            "rsync://host/r.git",
            "://host/r",
            ":r",
            "-ext::sh",
        ] {
            assert!(validate_url(url).is_err(), "should reject {url}");
        }
    }

    #[test]
    fn git_path_uses_forward_slashes() {
        assert_eq!(git_path(Path::new("C:\\a\\b")), "C:/a/b");
    }

    #[test]
    fn streaming_reports_progress_lines_and_succeeds() {
        let (remote, _clone, _path) = test_support::init_remote_and_clone();
        let dest = tempfile::TempDir::new().unwrap();
        let target = git_path(&dest.path().join("streamed"));

        let mut lines: Vec<String> = Vec::new();
        GitCmd::bare()
            .args(["clone", "--progress"])
            .arg(git_path(remote.path()))
            .arg(&target)
            .run_streaming(|line| lines.push(line.to_string()))
            .unwrap();

        assert!(Path::new(&target).join(".git").exists());
        // Progress updates are `\r`-separated, so a working reader sees several
        // lines even for a tiny repository.
        assert!(!lines.is_empty(), "no progress lines were captured");
        assert!(
            lines.iter().any(|l| l.contains("Cloning into")),
            "got: {lines:?}"
        );
    }

    #[test]
    fn streaming_surfaces_the_failure_message() {
        let dest = tempfile::TempDir::new().unwrap();
        let err = GitCmd::bare()
            .args(["clone", "--progress"])
            .arg(git_path(&dest.path().join("missing-source")))
            .arg(git_path(&dest.path().join("target")))
            .run_streaming(|_| {})
            .unwrap_err();

        assert!(!err.is_empty());
        assert!(
            err.contains("does not exist") || err.contains("repository"),
            "got: {err}"
        );
    }
}
