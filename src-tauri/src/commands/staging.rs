//! Staging, committing, discarding and per-file work-tree flags.

use super::git::{blocking, validate_message, validate_pathspec, validate_repo_path, GitCmd};
use std::collections::HashSet;
use std::path::Path;

/// Windows caps a command line at ~32 000 characters, so long file lists are
/// either fed through stdin or split into batches well under that.
const MAX_ARG_BYTES: usize = 16 * 1024;

fn validate_files(files: &[String]) -> Result<(), String> {
    files.iter().try_for_each(|f| validate_pathspec(f))
}

/// `true` when HEAD does not resolve yet (a repository with no commits).
fn is_unborn(path: &str) -> bool {
    !GitCmd::in_repo(path)
        .args(["rev-parse", "--verify", "--quiet", "HEAD"])
        .succeeds()
}

/// NUL-separated pathspec list for `--pathspec-from-file=-`.
fn pathspec_stdin(files: &[String]) -> Vec<u8> {
    let mut buf = Vec::new();
    for file in files {
        buf.extend_from_slice(file.as_bytes());
        buf.push(0);
    }
    buf
}

/// Split `files` into batches whose joined length stays under [`MAX_ARG_BYTES`].
fn arg_batches(files: &[String]) -> Vec<Vec<&str>> {
    let mut batches: Vec<Vec<&str>> = Vec::new();
    let mut current: Vec<&str> = Vec::new();
    let mut size = 0usize;

    for file in files {
        if !current.is_empty() && size + file.len() + 1 > MAX_ARG_BYTES {
            batches.push(std::mem::take(&mut current));
            size = 0;
        }
        size += file.len() + 1;
        current.push(file.as_str());
    }
    if !current.is_empty() {
        batches.push(current);
    }
    batches
}

fn stage_files_inner(path: &str, files: &[String]) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_files(files)?;
    if files.is_empty() {
        return Ok(());
    }
    GitCmd::in_repo(path)
        .args(["add", "--pathspec-from-file=-", "--pathspec-file-nul"])
        .run_with_stdin(&pathspec_stdin(files))
        .map(|_| ())
}

fn unstage_files_inner(path: &str, files: &[String]) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_files(files)?;
    if files.is_empty() {
        return Ok(());
    }

    // `restore --staged` needs a HEAD to restore from; before the first commit
    // the only way to unstage is to drop the entry from the index.
    let args: &[&str] = if is_unborn(path) {
        &[
            "rm",
            "--cached",
            "-r",
            "-f",
            "--pathspec-from-file=-",
            "--pathspec-file-nul",
        ]
    } else {
        &[
            "restore",
            "--staged",
            "--pathspec-from-file=-",
            "--pathspec-file-nul",
        ]
    };

    GitCmd::in_repo(path)
        .args(args)
        .run_with_stdin(&pathspec_stdin(files))
        .map(|_| ())
}

fn head_message(path: &str) -> Result<String, String> {
    Ok(GitCmd::in_repo(path)
        .args(["log", "-1", "--format=%B"])
        .run()?
        .trim_end_matches(['\r', '\n'])
        .to_string())
}

fn create_commit_inner(
    path: &str,
    message: &str,
    amend: bool,
    signoff: bool,
    no_verify: bool,
) -> Result<String, String> {
    validate_repo_path(path)?;
    validate_message(message)?;

    let trimmed = message.trim();
    let mut cmd = GitCmd::in_repo(path)
        .arg("commit")
        .env("GIT_EDITOR", "true");
    if amend {
        cmd = cmd.arg("--amend");
    }
    if signoff {
        cmd = cmd.arg("--signoff");
    }
    if no_verify {
        cmd = cmd.arg("--no-verify");
    }

    if trimmed.is_empty() {
        if !amend {
            return Err("commit message empty".to_string());
        }
        // Amending without a message keeps the one HEAD already has.
        cmd = cmd.arg("--no-edit");
    } else {
        cmd = cmd.arg("-m").arg(trimmed);
    }

    cmd.run()?;
    GitCmd::in_repo(path)
        .args(["rev-parse", "HEAD"])
        .run()
        .map(|sha| sha.trim().to_string())
}

/// Every path git currently reports as dirty (tracked changes and untracked).
fn dirty_paths(path: &str) -> Result<Vec<String>, String> {
    let out = GitCmd::in_repo(path)
        .args(["status", "--porcelain=v2", "-z", "--untracked-files=all"])
        .output()?;
    if !out.status.success() {
        return Ok(vec![]);
    }
    let changes = super::changes::parse_porcelain_v2(&out.stdout);
    let mut paths: Vec<String> = changes
        .staged
        .into_iter()
        .chain(changes.unstaged)
        .map(|c| c.path)
        .chain(changes.untracked)
        .chain(changes.conflicted)
        .collect();
    paths.sort();
    paths.dedup();
    Ok(paths)
}

/// The subset of `files` that git has in its index.
///
/// `git ls-files` has no `--pathspec-from-file`, so the pathspecs are passed as
/// arguments in batches that stay under the command-line limit.
fn tracked_subset(path: &str, files: &[String]) -> Result<HashSet<String>, String> {
    let mut tracked = HashSet::new();
    for batch in arg_batches(files) {
        let listed = GitCmd::in_repo(path)
            .args(["ls-files", "-z", "--"])
            .args(batch)
            .run()?;
        tracked.extend(
            listed
                .split('\u{0}')
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        );
    }
    Ok(tracked)
}

fn discard_changes_inner(path: &str, files: &[String]) -> Result<Vec<String>, String> {
    validate_repo_path(path)?;
    validate_files(files)?;

    if files.is_empty() {
        let discarded = dirty_paths(path)?;
        GitCmd::in_repo(path).args(["checkout", "--", ":/"]).run()?;
        GitCmd::in_repo(path).args(["clean", "-fd"]).run()?;
        return Ok(discarded);
    }

    let tracked = tracked_subset(path, files)?;
    let (restore, untracked): (Vec<String>, Vec<String>) =
        files.iter().cloned().partition(|f| tracked.contains(f));

    // One `checkout` for all tracked paths: a per-file loop would turn a
    // 300-file discard into 300 process spawns.
    if !restore.is_empty() {
        GitCmd::in_repo(path)
            .args([
                "checkout",
                "--pathspec-from-file=-",
                "--pathspec-file-nul",
                "--",
            ])
            .run_with_stdin(&pathspec_stdin(&restore))?;
    }
    // `git clean` has no `--pathspec-from-file`, so batch the arguments instead.
    for batch in arg_batches(&untracked) {
        GitCmd::in_repo(path)
            .args(["clean", "-fd", "--"])
            .args(batch)
            .run()?;
    }

    Ok(files.to_vec())
}

fn ignore_path_inner(path: &str, pattern: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    if pattern.trim().is_empty() {
        return Err("ignore pattern is empty".to_string());
    }
    if pattern.contains('\n') || pattern.contains('\0') {
        return Err("ignore pattern must be a single line".to_string());
    }

    let gitignore = Path::new(path).join(".gitignore");
    let existing = std::fs::read_to_string(&gitignore).unwrap_or_default();
    if existing.lines().any(|line| line.trim() == pattern.trim()) {
        return Ok(());
    }

    let mut updated = existing;
    if !updated.is_empty() && !updated.ends_with('\n') {
        updated.push('\n');
    }
    updated.push_str(pattern.trim());
    updated.push('\n');
    std::fs::write(&gitignore, updated).map_err(|e| format!("cannot write .gitignore: {e}"))?;

    // A tracked file keeps being tracked no matter what .gitignore says, so it
    // has to leave the index for the rule to take effect.
    let tracked = GitCmd::in_repo(path)
        .args(["ls-files", "--error-unmatch", "--"])
        .arg(pattern)
        .succeeds();
    if tracked {
        GitCmd::in_repo(path)
            .args(["rm", "--cached", "-r", "--"])
            .arg(pattern)
            .run()?;
    }
    Ok(())
}

fn set_assume_unchanged_inner(path: &str, file: &str, flag: bool) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;

    let switch = if flag {
        "--assume-unchanged"
    } else {
        "--no-assume-unchanged"
    };
    GitCmd::in_repo(path)
        .args(["update-index", switch, "--"])
        .arg(file)
        .run()
        .map(|_| ())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Stage `files`.
#[tauri::command]
pub async fn stage_files(path: String, files: Vec<String>) -> Result<(), String> {
    blocking(move || stage_files_inner(&path, &files)).await
}

/// Unstage `files`, including before the first commit.
#[tauri::command]
pub async fn unstage_files(path: String, files: Vec<String>) -> Result<(), String> {
    blocking(move || unstage_files_inner(&path, &files)).await
}

/// Commit the index. An empty `message` is only valid together with `amend`,
/// where it keeps HEAD's current message.
#[tauri::command]
pub async fn create_commit(
    path: String,
    message: String,
    amend: bool,
    signoff: bool,
    no_verify: bool,
) -> Result<String, String> {
    blocking(move || create_commit_inner(&path, &message, amend, signoff, no_verify)).await
}

/// HEAD's full commit message, for prefilling the composer on amend.
#[tauri::command]
pub async fn get_head_commit_message(path: String) -> Result<String, String> {
    blocking(move || {
        validate_repo_path(&path)?;
        head_message(&path)
    })
    .await
}

/// Discard work-tree changes; an empty `files` means everything.
#[tauri::command]
pub async fn discard_changes(path: String, files: Vec<String>) -> Result<Vec<String>, String> {
    blocking(move || discard_changes_inner(&path, &files)).await
}

/// Append `pattern` to `.gitignore` and untrack it when needed.
#[tauri::command]
pub async fn ignore_path(path: String, pattern: String) -> Result<(), String> {
    blocking(move || ignore_path_inner(&path, &pattern)).await
}

/// Set or clear the assume-unchanged bit on `file`.
#[tauri::command]
pub async fn set_assume_unchanged(path: String, file: String, flag: bool) -> Result<(), String> {
    blocking(move || set_assume_unchanged_inner(&path, &file, flag)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_empty_repo, init_repo, write_file};

    #[test]
    fn invalid_paths_are_rejected() {
        assert!(stage_files_inner("", &[]).is_err());
        assert!(unstage_files_inner("", &[]).is_err());
        assert!(create_commit_inner("", "msg", false, false, false).is_err());
        assert!(discard_changes_inner("", &[]).is_err());
    }

    #[test]
    fn traversal_in_a_file_argument_is_rejected() {
        let (_dir, path) = init_repo();
        let bad = vec!["../escape".to_string()];
        assert!(stage_files_inner(&path, &bad).is_err());
        assert!(unstage_files_inner(&path, &bad).is_err());
        assert!(discard_changes_inner(&path, &bad).is_err());
    }

    #[test]
    fn files_starting_with_a_dash_are_still_stageable() {
        // `--pathspec-from-file` removes the option-injection hazard entirely.
        let (_dir, path) = init_repo();
        write_file(&path, "-weird-name.txt", "x\n");

        stage_files_inner(&path, &["-weird-name.txt".to_string()]).unwrap();
        let staged = git_ok(&path, &["diff", "--cached", "--name-only"]);
        assert!(staged.contains("-weird-name.txt"), "got: {staged}");
    }

    #[test]
    fn stage_and_unstage_round_trip() {
        let (_dir, path) = init_repo();
        write_file(&path, "señal ñ.txt", "v2\n");

        stage_files_inner(&path, &["señal ñ.txt".to_string()]).unwrap();
        assert!(git_ok(&path, &["diff", "--cached", "--name-only"]).contains("señal ñ.txt"));

        unstage_files_inner(&path, &["señal ñ.txt".to_string()]).unwrap();
        assert!(git_ok(&path, &["diff", "--cached", "--name-only"]).is_empty());
    }

    #[test]
    fn unstaging_works_before_the_first_commit() {
        let (_dir, path) = init_empty_repo();
        write_file(&path, "a.txt", "first\n");
        stage_files_inner(&path, &["a.txt".to_string()]).unwrap();
        assert!(is_unborn(&path));

        unstage_files_inner(&path, &["a.txt".to_string()]).unwrap();

        assert!(git_ok(&path, &["ls-files"]).is_empty());
        assert!(Path::new(&path).join("a.txt").exists(), "file must survive");
    }

    #[test]
    fn commit_amend_signoff_and_no_verify() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "v2\n");
        stage_files_inner(&path, &["a.txt".to_string()]).unwrap();

        let sha = create_commit_inner(&path, "feat: x", false, true, true).unwrap();
        assert_eq!(sha.len(), 40);
        assert!(head_message(&path).unwrap().contains("Signed-off-by:"));

        let before = git_ok(&path, &["rev-list", "--count", "HEAD"]);
        write_file(&path, "b.txt", "extra\n");
        stage_files_inner(&path, &["b.txt".to_string()]).unwrap();
        create_commit_inner(&path, "feat: x v2", true, false, false).unwrap();

        assert_eq!(git_ok(&path, &["rev-list", "--count", "HEAD"]), before);
        assert!(head_message(&path).unwrap().starts_with("feat: x v2"));
    }

    #[test]
    fn amending_with_an_empty_message_keeps_the_previous_one() {
        let (_dir, path) = init_repo();
        write_file(&path, "b.txt", "x\n");
        stage_files_inner(&path, &["b.txt".to_string()]).unwrap();

        create_commit_inner(&path, "   ", true, false, false).unwrap();

        assert_eq!(head_message(&path).unwrap(), "init");
    }

    #[test]
    fn an_empty_message_is_refused_for_a_new_commit() {
        let (_dir, path) = init_repo();
        let err = create_commit_inner(&path, "  ", false, false, false).unwrap_err();
        assert!(err.contains("empty"), "got: {err}");
    }

    #[test]
    fn multiline_messages_survive() {
        let (_dir, path) = init_repo();
        write_file(&path, "b.txt", "x\n");
        stage_files_inner(&path, &["b.txt".to_string()]).unwrap();

        create_commit_inner(
            &path,
            "subject line\n\nbody paragraph\n",
            false,
            false,
            false,
        )
        .unwrap();

        let message = head_message(&path).unwrap();
        assert!(message.starts_with("subject line"));
        assert!(message.contains("body paragraph"));
    }

    #[test]
    fn discarding_one_file_leaves_the_others_alone() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "v2\n");
        write_file(&path, "b.txt", "untracked\n");

        let discarded = discard_changes_inner(&path, &["a.txt".to_string()]).unwrap();

        assert_eq!(discarded, vec!["a.txt".to_string()]);
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "v1\n"
        );
        assert!(Path::new(&path).join("b.txt").exists());
    }

    #[test]
    fn discarding_everything_restores_and_cleans() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "v2\n");
        write_file(&path, "señal ñ.txt", "untracked\n");

        let mut discarded = discard_changes_inner(&path, &[]).unwrap();
        discarded.sort();

        assert_eq!(discarded, vec!["a.txt", "señal ñ.txt"]);
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "v1\n"
        );
        assert!(!Path::new(&path).join("señal ñ.txt").exists());
    }

    #[test]
    fn discarding_three_hundred_files_is_one_batch_of_work() {
        let (_dir, path) = init_repo();
        let tracked: Vec<String> = (0..300)
            .map(|i| format!("dir{i}/tracked {i}.txt"))
            .collect();
        for file in &tracked {
            write_file(&path, file, "committed\n");
        }
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "bulk"]);
        for file in &tracked {
            write_file(&path, file, "dirty\n");
        }
        let untracked: Vec<String> = (0..300).map(|i| format!("dir{i}/new {i}.txt")).collect();
        for file in &untracked {
            write_file(&path, file, "new\n");
        }

        let all: Vec<String> = tracked.iter().chain(untracked.iter()).cloned().collect();
        let discarded = discard_changes_inner(&path, &all).unwrap();

        assert_eq!(discarded.len(), 600);
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join(&tracked[299])).unwrap(),
            "committed\n"
        );
        assert!(!Path::new(&path).join(&untracked[299]).exists());
        assert!(git_ok(&path, &["status", "--porcelain"]).is_empty());
    }

    #[test]
    fn arg_batches_stay_under_the_command_line_limit() {
        let files: Vec<String> = (0..2000)
            .map(|i| format!("some/long/path/file{i}.txt"))
            .collect();
        let batches = arg_batches(&files);
        assert!(batches.len() > 1);
        assert_eq!(batches.iter().map(|b| b.len()).sum::<usize>(), 2000);
        for batch in &batches {
            let size: usize = batch.iter().map(|f| f.len() + 1).sum();
            assert!(size <= MAX_ARG_BYTES, "batch of {size} bytes is too large");
        }
    }

    #[test]
    fn ignoring_a_path_creates_the_rule_and_untracks_it() {
        let (_dir, path) = init_repo();
        write_file(&path, "secret.env", "token\n");
        git_ok(&path, &["add", "secret.env"]);
        git_ok(&path, &["commit", "-m", "oops"]);

        ignore_path_inner(&path, "secret.env").unwrap();

        let gitignore = std::fs::read_to_string(Path::new(&path).join(".gitignore")).unwrap();
        assert!(gitignore.contains("secret.env"));
        assert!(!git_ok(&path, &["ls-files"]).contains("secret.env"));
        assert!(Path::new(&path).join("secret.env").exists());
    }

    #[test]
    fn ignoring_the_same_pattern_twice_does_not_duplicate_it() {
        let (_dir, path) = init_repo();
        ignore_path_inner(&path, "*.log").unwrap();
        ignore_path_inner(&path, "*.log").unwrap();

        let gitignore = std::fs::read_to_string(Path::new(&path).join(".gitignore")).unwrap();
        assert_eq!(gitignore.matches("*.log").count(), 1);
    }

    #[test]
    fn assume_unchanged_hides_and_restores_a_file() {
        let (_dir, path) = init_repo();

        set_assume_unchanged_inner(&path, "a.txt", true).unwrap();
        write_file(&path, "a.txt", "invisible\n");
        assert!(git_ok(&path, &["status", "--porcelain"]).is_empty());

        set_assume_unchanged_inner(&path, "a.txt", false).unwrap();
        assert!(git_ok(&path, &["status", "--porcelain"]).contains("a.txt"));
    }
}
