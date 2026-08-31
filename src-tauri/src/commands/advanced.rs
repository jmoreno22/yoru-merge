//! Cherry-pick, revert, rebase, reset, blame and file history.

use super::commits::{parse_log_output, LOG_FORMAT};
use super::git::{
    blocking, git_path, validate_message, validate_pathspec, validate_repo_path, validate_revision,
    validate_sha, GitCmd,
};
use super::merge::conflicted_files;
use crate::models::{
    BlameLine, CommitInfo, PatchApplyResult, RebaseResult, RebaseTodoEntry, ResetResult,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Actions the interactive-rebase editor accepts. Anything else is rejected
/// before a todo file is written, so nothing arbitrary reaches git.
const REBASE_ACTIONS: &[&str] = &["pick", "reword", "squash", "fixup", "drop", "edit"];

// ── Shared helpers ────────────────────────────────────────────────────────────

fn combined_output(output: &std::process::Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

/// Whether git left a rebase running (conflict, `edit` or `break`).
fn rebase_in_progress(path: &str) -> bool {
    ["rebase-merge", "rebase-apply"].iter().any(|dir| {
        GitCmd::in_repo(path)
            .args(["rev-parse", "--git-path", dir])
            .run()
            .map(|p| Path::new(path).join(p.trim()).exists())
            .unwrap_or(false)
    })
}

/// Parent SHAs of `rev`, oldest first.
fn parents(path: &str, rev: &str) -> Result<Vec<String>, String> {
    Ok(GitCmd::in_repo(path)
        .args(["show", "--no-patch", "--format=%P", rev])
        .run()?
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

/// Classify the outcome of a sequencer command that already ran.
///
/// A conflicted index is left exactly as git wrote it: the user resolves and
/// continues (or aborts) from the repository-state banner, which is why nothing
/// here rolls anything back.
fn patch_outcome(path: &str, output: &std::process::Output) -> Result<PatchApplyResult, String> {
    if output.status.success() {
        return Ok(PatchApplyResult::Applied);
    }
    let files = conflicted_files(path)?;
    if !files.is_empty() {
        return Ok(PatchApplyResult::Conflicts { files });
    }
    Ok(PatchApplyResult::Error {
        message: combined_output(output).trim().to_string(),
    })
}

// ── cherry-pick / revert ──────────────────────────────────────────────────────

fn cherry_pick_inner(path: &str, sha: &str) -> Result<PatchApplyResult, String> {
    validate_repo_path(path)?;
    validate_sha(sha)?;

    let output = GitCmd::in_repo(path)
        .args(["cherry-pick", "--no-edit"])
        .env("GIT_EDITOR", "true")
        .arg(sha)
        .output()?;
    patch_outcome(path, &output)
}

fn revert_commit_inner(path: &str, sha: &str) -> Result<PatchApplyResult, String> {
    validate_repo_path(path)?;
    validate_sha(sha)?;

    let mut cmd = GitCmd::in_repo(path)
        .args(["revert", "--no-edit"])
        .env("GIT_EDITOR", "true");
    // A merge has no single "previous state" to return to, so git refuses
    // unless told which parent to treat as the mainline.
    if parents(path, sha)?.len() > 1 {
        cmd = cmd.args(["-m", "1"]);
    }

    let output = cmd.arg(sha).output()?;
    patch_outcome(path, &output)
}

/// Apply `sha` on top of the current branch.
#[tauri::command]
pub async fn cherry_pick(path: String, sha: String) -> Result<PatchApplyResult, String> {
    blocking(move || cherry_pick_inner(&path, &sha)).await
}

/// Create a commit that undoes `sha`.
#[tauri::command]
pub async fn revert_commit(path: String, sha: String) -> Result<PatchApplyResult, String> {
    blocking(move || revert_commit_inner(&path, &sha)).await
}

// ── rebase / reset ────────────────────────────────────────────────────────────

fn rebase_branch_inner(path: &str, branch: &str, onto: &str) -> RebaseResult {
    let prepared = (|| {
        validate_repo_path(path)?;
        validate_revision(branch)?;
        validate_revision(onto)
    })();
    if let Err(message) = prepared {
        return RebaseResult::Error { message };
    }

    let output = match GitCmd::in_repo(path)
        .arg("rebase")
        .env("GIT_EDITOR", "true")
        .arg(onto)
        .arg(branch)
        .output()
    {
        Ok(output) => output,
        Err(message) => return RebaseResult::Error { message },
    };
    let combined = combined_output(&output);

    if let Ok(files) = conflicted_files(path) {
        if !files.is_empty() {
            return RebaseResult::Conflicts { files };
        }
    }

    if !output.status.success() {
        let message = combined.trim().to_string();
        if message.contains("cannot rebase")
            || message.contains("Please commit or stash")
            || message.contains("already a rebase")
            || message.contains("invalid upstream")
            || message.contains("no such branch")
        {
            return RebaseResult::NotPossible;
        }
        return RebaseResult::Error { message };
    }

    let lower = combined.to_ascii_lowercase();
    if lower.contains("up to date") || lower.contains("up-to-date") {
        return RebaseResult::UpToDate;
    }
    RebaseResult::Rebased
}

fn reset_to_commit_inner(path: &str, sha: &str, mode: &str) -> ResetResult {
    let prepared = (|| {
        validate_repo_path(path)?;
        validate_sha(sha)?;
        match mode {
            "soft" | "mixed" | "hard" => Ok(()),
            _ => Err("mode must be \"soft\", \"mixed\" or \"hard\"".to_string()),
        }
    })();
    if let Err(message) = prepared {
        return ResetResult::Error { message };
    }

    match GitCmd::in_repo(path)
        .args(["reset", &format!("--{mode}"), sha])
        .run()
    {
        Ok(_) => ResetResult::Reset {
            mode: mode.to_string(),
        },
        Err(message) => ResetResult::Error { message },
    }
}

/// Rebase `branch` onto `onto`.
#[tauri::command]
pub async fn rebase_branch(path: String, branch: String, onto: String) -> RebaseResult {
    blocking(move || Ok(rebase_branch_inner(&path, &branch, &onto)))
        .await
        .unwrap_or_else(|message| RebaseResult::Error { message })
}

/// Move HEAD to `sha` with the given reset mode.
#[tauri::command]
pub async fn reset_to_commit(path: String, sha: String, mode: String) -> ResetResult {
    blocking(move || Ok(reset_to_commit_inner(&path, &sha, &mode)))
        .await
        .unwrap_or_else(|message| ResetResult::Error { message })
}

// ── Interactive rebase ────────────────────────────────────────────────────────

fn get_rebase_todo_inner(path: &str, base: &str) -> Result<Vec<RebaseTodoEntry>, String> {
    validate_repo_path(path)?;
    validate_revision(base)?;

    let output = GitCmd::in_repo(path)
        .args(["log", "--format=%H%x00%s", &format!("{base}..HEAD")])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("unknown revision") || stderr.contains("bad revision") {
            return Ok(vec![]);
        }
        return Err(stderr.trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<RebaseTodoEntry> = stdout
        .lines()
        .filter_map(|line| line.split_once('\u{0}'))
        .map(|(sha, message)| RebaseTodoEntry {
            action: "pick".to_string(),
            sha: sha.trim().to_string(),
            message: message.to_string(),
        })
        .collect();

    // `git log` is newest-first; a rebase todo is oldest-first.
    entries.reverse();
    Ok(entries)
}

/// A temp directory that removes itself, so a failed rebase leaves no litter.
struct Scratch(PathBuf);

impl Scratch {
    fn new(prefix: &str) -> Result<Self, String> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        // pid + nanos: two rebases started at the same moment must not share
        // a todo file, and a stale file from a crashed run must never be reused.
        let dir = std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("cannot create temporary directory: {e}"))?;
        Ok(Self(dir))
    }

    fn write(&self, name: &str, contents: &str) -> Result<String, String> {
        let file = self.0.join(name);
        std::fs::write(&file, contents).map_err(|e| format!("cannot write {name}: {e}"))?;
        Ok(git_path(&file))
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Quote a path for the single-quoted argument of a `sh -c` command line.
fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Build the rebase todo plus the message files it references.
///
/// `reword` and `squash` need a commit message that no todo line can carry, so
/// each becomes an `exec git commit --amend -F <file>`: the message lives in a
/// file, which means it may span multiple lines and contain any character git
/// accepts, and no editor is ever launched.
fn build_todo(scratch: &Scratch, entries: &[RebaseTodoEntry]) -> Result<String, String> {
    let mut todo = String::new();
    for (index, entry) in entries.iter().enumerate() {
        if !REBASE_ACTIONS.contains(&entry.action.as_str()) {
            return Err(format!("unsupported rebase action: {}", entry.action));
        }
        validate_sha(&entry.sha)?;
        validate_message(&entry.message)?;

        let line_action = match entry.action.as_str() {
            "reword" => "pick",
            "squash" => "fixup",
            other => other,
        };
        // The message is deliberately left off the todo line: git ignores it,
        // and keeping it out removes any way for it to inject a second line.
        todo.push_str(line_action);
        todo.push(' ');
        todo.push_str(&entry.sha);
        todo.push('\n');

        if matches!(entry.action.as_str(), "reword" | "squash") {
            let file = scratch.write(&format!("msg-{index:04}.txt"), &entry.message)?;
            todo.push_str(&format!(
                "exec git commit --amend --no-edit -F {}\n",
                sh_quote(&file)
            ));
        }
    }
    Ok(todo)
}

fn apply_rebase_inner(
    path: &str,
    base: &str,
    entries: &[RebaseTodoEntry],
) -> Result<RebaseResult, String> {
    validate_repo_path(path)?;
    validate_revision(base)?;
    if entries.is_empty() {
        return Err("the rebase todo is empty".to_string());
    }

    let scratch = Scratch::new("yorumerge-rebase")?;
    let todo = build_todo(&scratch, entries)?;
    let todo_file = scratch.write("todo.txt", &todo)?;

    let output = GitCmd::in_repo(path)
        .args(["rebase", "-i", base])
        // git runs both editors through a shell, so a forward-slashed, quoted
        // path works identically on Windows and Linux.
        .env(
            "GIT_SEQUENCE_EDITOR",
            format!("cp {}", sh_quote(&todo_file)),
        )
        .env("GIT_EDITOR", "true")
        .output()?;

    let combined = combined_output(&output);

    let files = conflicted_files(path)?;
    if !files.is_empty() {
        return Ok(RebaseResult::Conflicts { files });
    }
    // `edit` and `break` stop a rebase without failing; the sequencer commands
    // take over from here.
    if rebase_in_progress(path) {
        return Ok(RebaseResult::Paused {
            message: combined.trim().to_string(),
        });
    }
    if !output.status.success() {
        return Ok(RebaseResult::Error {
            message: combined.trim().to_string(),
        });
    }
    Ok(RebaseResult::Rebased)
}

/// Commits between `base` and `HEAD`, oldest first, all set to `pick`.
#[tauri::command]
pub async fn get_rebase_todo(path: String, base: String) -> Result<Vec<RebaseTodoEntry>, String> {
    blocking(move || get_rebase_todo_inner(&path, &base)).await
}

/// Run an interactive rebase from `base` with the supplied todo.
#[tauri::command]
pub async fn apply_rebase(
    path: String,
    base: String,
    entries: Vec<RebaseTodoEntry>,
) -> Result<RebaseResult, String> {
    blocking(move || apply_rebase_inner(&path, &base, &entries)).await
}

// ── blame ─────────────────────────────────────────────────────────────────────

/// Parse `git blame --porcelain` into per-line annotations.
fn parse_blame_porcelain(output: &str) -> Vec<BlameLine> {
    let mut result = Vec::new();
    // Porcelain output repeats a commit's metadata only the first time.
    let mut seen: HashMap<String, (String, i64, String)> = HashMap::new();
    let mut lines = output.lines();

    while let Some(header) = lines.next() {
        let parts: Vec<&str> = header.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let sha = parts[0];
        if sha.len() != 40 || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
            continue;
        }
        let sha = sha.to_string();
        let line_no: usize = parts[2].parse().unwrap_or(0);

        let mut author = String::new();
        let mut time = 0i64;
        let mut summary = String::new();
        let mut content = String::new();
        let mut found = false;

        for meta in &mut lines {
            if let Some(rest) = meta.strip_prefix('\t') {
                content = rest.to_string();
                found = true;
                break;
            } else if let Some(value) = meta.strip_prefix("author ") {
                author = value.to_string();
            } else if let Some(value) = meta.strip_prefix("author-time ") {
                time = value.parse().unwrap_or(0);
            } else if let Some(value) = meta.strip_prefix("summary ") {
                summary = value.to_string();
            }
        }
        if !found {
            break;
        }

        if author.is_empty() || summary.is_empty() {
            if let Some((a, t, s)) = seen.get(&sha) {
                if author.is_empty() {
                    author = a.clone();
                }
                if time == 0 {
                    time = *t;
                }
                if summary.is_empty() {
                    summary = s.clone();
                }
            }
        } else {
            seen.insert(sha.clone(), (author.clone(), time, summary.clone()));
        }

        result.push(BlameLine {
            sha,
            author,
            time,
            message: summary,
            line_no,
            content,
        });
    }

    result
}

fn blame_file_inner(path: &str, file: &str, rev: Option<&str>) -> Result<Vec<BlameLine>, String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;
    if let Some(rev) = rev {
        validate_revision(rev)?;
    }

    let mut cmd = GitCmd::in_repo(path).args(["blame", "--porcelain"]);
    if let Some(rev) = rev {
        cmd = cmd.arg(rev);
    }
    let output = cmd.arg("--").arg(file).run()?;
    let mut lines = parse_blame_porcelain(&output);
    lines.sort_by_key(|l| l.line_no);
    Ok(lines)
}

/// Per-line blame annotations for `file`, in the work tree or at `rev`.
#[tauri::command]
pub async fn blame_file(
    path: String,
    file: String,
    rev: Option<String>,
) -> Result<Vec<BlameLine>, String> {
    blocking(move || blame_file_inner(&path, &file, rev.as_deref())).await
}

// ── file history ──────────────────────────────────────────────────────────────

fn file_history_inner(path: &str, file: &str) -> Result<Vec<CommitInfo>, String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;

    let stdout = GitCmd::in_repo(path)
        .args(["log", "--follow", "--decorate=full", LOG_FORMAT, "--"])
        .arg(file)
        .run()?;
    Ok(parse_log_output(&stdout))
}

/// Commits touching `file`, following renames.
#[tauri::command]
pub async fn file_history(path: String, file: String) -> Result<Vec<CommitInfo>, String> {
    blocking(move || file_history_inner(&path, &file)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

    fn commit_file(path: &str, file: &str, content: &str, message: &str) {
        write_file(path, file, content);
        git_ok(path, &["add", "."]);
        git_ok(path, &["commit", "-m", message]);
    }

    fn head(path: &str) -> String {
        git_ok(path, &["rev-parse", "HEAD"])
    }

    fn subjects(path: &str) -> Vec<String> {
        git_ok(path, &["log", "--format=%s"])
            .lines()
            .map(|s| s.to_string())
            .collect()
    }

    // ── cherry-pick / revert ─────────────────────────────────────────────────

    #[test]
    fn cherry_pick_applies_a_commit_from_another_branch() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "b.txt", "feature content\n", "add b");
        let sha = head(&path);
        git_ok(&path, &["checkout", "main"]);

        assert_eq!(
            cherry_pick_inner(&path, &sha).unwrap(),
            PatchApplyResult::Applied
        );
        assert!(Path::new(&path).join("b.txt").exists());
    }

    #[test]
    fn a_cherry_pick_conflict_is_left_for_the_user_to_resolve() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "a.txt", "feature\n", "feature edits a");
        let sha = head(&path);
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, "a.txt", "main\n", "main edits a");

        let result = cherry_pick_inner(&path, &sha).unwrap();

        assert_eq!(
            result,
            PatchApplyResult::Conflicts {
                files: vec!["a.txt".to_string()]
            }
        );
        // The sequencer must still be running: nothing was aborted behind the
        // user's back.
        assert!(Path::new(&path)
            .join(".git")
            .join("CHERRY_PICK_HEAD")
            .exists());
    }

    #[test]
    fn revert_creates_an_inverse_commit() {
        let (_dir, path) = init_repo();
        commit_file(&path, "b.txt", "to be reverted\n", "add b");
        let sha = head(&path);
        let before = subjects(&path).len();

        assert_eq!(
            revert_commit_inner(&path, &sha).unwrap(),
            PatchApplyResult::Applied
        );
        assert_eq!(subjects(&path).len(), before + 1);
        assert!(!Path::new(&path).join("b.txt").exists());
    }

    #[test]
    fn reverting_a_merge_picks_the_first_parent() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "b.txt", "feature\n", "feature");
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, "c.txt", "main\n", "main");
        git_ok(&path, &["merge", "--no-ff", "--no-edit", "feature"]);

        let merge_sha = head(&path);
        assert_eq!(parents(&path, &merge_sha).unwrap().len(), 2);

        assert_eq!(
            revert_commit_inner(&path, &merge_sha).unwrap(),
            PatchApplyResult::Applied
        );
        // The feature side is undone; the mainline commit stays.
        assert!(!Path::new(&path).join("b.txt").exists());
        assert!(Path::new(&path).join("c.txt").exists());
    }

    // ── rebase / reset ───────────────────────────────────────────────────────

    #[test]
    fn rebase_moves_a_branch_onto_another() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "feature.txt", "feature\n", "feature work");
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, "main.txt", "main\n", "main work");

        assert_eq!(
            rebase_branch_inner(&path, "feature", "main"),
            RebaseResult::Rebased
        );
        assert_eq!(git_ok(&path, &["branch", "--show-current"]), "feature");
        assert!(Path::new(&path).join("main.txt").exists());
    }

    #[test]
    fn rebase_reports_up_to_date_and_conflicts() {
        let (_dir, path) = init_repo();
        assert_eq!(
            rebase_branch_inner(&path, "main", "main"),
            RebaseResult::UpToDate
        );

        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "a.txt", "feature\n", "feature edits a");
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, "a.txt", "main\n", "main edits a");

        assert_eq!(
            rebase_branch_inner(&path, "feature", "main"),
            RebaseResult::Conflicts {
                files: vec!["a.txt".to_string()]
            }
        );
    }

    #[test]
    fn rebase_reports_validation_errors() {
        let (_dir, path) = init_repo();
        assert!(matches!(
            rebase_branch_inner(&path, "-bad", "main"),
            RebaseResult::Error { .. }
        ));
    }

    #[test]
    fn reset_accepts_every_mode_and_rejects_the_rest() {
        for mode in ["soft", "mixed", "hard"] {
            let (_dir, path) = init_repo();
            let base = head(&path);
            commit_file(&path, "b.txt", mode, "mode commit");

            assert_eq!(
                reset_to_commit_inner(&path, &base, mode),
                ResetResult::Reset {
                    mode: mode.to_string()
                }
            );
            assert_eq!(head(&path), base);
        }

        let (_dir, path) = init_repo();
        assert!(matches!(
            reset_to_commit_inner(&path, &head(&path), "merge"),
            ResetResult::Error { .. }
        ));
        assert!(matches!(
            reset_to_commit_inner(&path, "not-a-sha", "hard"),
            ResetResult::Error { .. }
        ));
    }

    // ── interactive rebase ───────────────────────────────────────────────────

    fn three_commit_repo() -> (tempfile::TempDir, String) {
        let (dir, path) = init_repo();
        commit_file(&path, "b.txt", "b\n", "commit two");
        commit_file(&path, "c.txt", "c\n", "commit three");
        (dir, path)
    }

    #[test]
    fn the_todo_starts_as_all_picks_oldest_first() {
        let (_dir, path) = three_commit_repo();

        let todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();

        assert_eq!(todo.len(), 2);
        assert!(todo.iter().all(|e| e.action == "pick"));
        assert_eq!(todo[0].message, "commit two");
        assert_eq!(todo[1].message, "commit three");
        assert_eq!(todo[0].sha.len(), 40);
    }

    #[test]
    fn applying_an_unchanged_todo_keeps_every_commit() {
        let (_dir, path) = three_commit_repo();
        let todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();

        assert_eq!(
            apply_rebase_inner(&path, "HEAD~2", &todo).unwrap(),
            RebaseResult::Rebased
        );
        assert_eq!(subjects(&path), ["commit three", "commit two", "init"]);
    }

    #[test]
    fn dropping_an_entry_removes_that_commit() {
        let (_dir, path) = three_commit_repo();
        let mut todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();
        todo[0].action = "drop".to_string();

        assert_eq!(
            apply_rebase_inner(&path, "HEAD~2", &todo).unwrap(),
            RebaseResult::Rebased
        );
        assert_eq!(subjects(&path), ["commit three", "init"]);
        assert!(!Path::new(&path).join("b.txt").exists());
    }

    #[test]
    fn rewording_replaces_the_message_including_a_body() {
        let (_dir, path) = three_commit_repo();
        let mut todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();
        todo[0].action = "reword".to_string();
        todo[0].message = "feat: mensaje reescrito\n\nCon cuerpo en español.\n".to_string();

        assert_eq!(
            apply_rebase_inner(&path, "HEAD~2", &todo).unwrap(),
            RebaseResult::Rebased
        );

        let message = git_ok(&path, &["log", "--format=%B", "-1", "HEAD~1"]);
        assert!(
            message.starts_with("feat: mensaje reescrito"),
            "got: {message}"
        );
        assert!(message.contains("Con cuerpo en español."), "got: {message}");
        assert_eq!(subjects(&path).len(), 3);
    }

    #[test]
    fn squashing_merges_the_commit_into_its_parent() {
        let (_dir, path) = three_commit_repo();
        let mut todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();
        todo[1].action = "squash".to_string();
        todo[1].message = "commit two and three".to_string();

        assert_eq!(
            apply_rebase_inner(&path, "HEAD~2", &todo).unwrap(),
            RebaseResult::Rebased
        );
        assert_eq!(subjects(&path), ["commit two and three", "init"]);
        assert!(Path::new(&path).join("b.txt").exists());
        assert!(Path::new(&path).join("c.txt").exists());
    }

    #[test]
    fn an_edit_entry_pauses_the_rebase_instead_of_failing() {
        let (_dir, path) = three_commit_repo();
        let mut todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();
        todo[0].action = "edit".to_string();

        let result = apply_rebase_inner(&path, "HEAD~2", &todo).unwrap();

        assert!(
            matches!(result, RebaseResult::Paused { .. }),
            "expected Paused, got {result:?}"
        );
        assert!(rebase_in_progress(&path));
        git_ok(&path, &["rebase", "--abort"]);
    }

    #[test]
    fn an_interactive_rebase_conflict_is_reported_without_aborting() {
        let (_dir, path) = init_repo();
        commit_file(&path, "a.txt", "second\n", "second");
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, "a.txt", "feature\n", "feature");

        // Rewrite the commit the feature branch is based on so replaying it
        // conflicts.
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, "a.txt", "diverged\n", "diverged");
        git_ok(&path, &["checkout", "feature"]);

        let entries = vec![RebaseTodoEntry {
            action: "pick".to_string(),
            sha: head(&path),
            message: "feature".to_string(),
        }];
        let result = apply_rebase_inner(&path, "main", &entries).unwrap();

        assert!(
            matches!(result, RebaseResult::Conflicts { .. }),
            "expected Conflicts, got {result:?}"
        );
        assert!(rebase_in_progress(&path));
        git_ok(&path, &["rebase", "--abort"]);
    }

    #[test]
    fn unknown_actions_and_bad_shas_never_reach_git() {
        let (_dir, path) = three_commit_repo();
        let mut todo = get_rebase_todo_inner(&path, "HEAD~2").unwrap();

        let mut evil = todo.clone();
        evil[0].action = "exec rm -rf /".to_string();
        let err = apply_rebase_inner(&path, "HEAD~2", &evil).unwrap_err();
        assert!(err.contains("unsupported rebase action"), "got: {err}");

        todo[0].sha = "not-a-sha".to_string();
        assert!(apply_rebase_inner(&path, "HEAD~2", &todo).is_err());

        assert!(apply_rebase_inner(&path, "HEAD~2", &[]).is_err());
    }

    #[test]
    fn a_message_cannot_inject_a_second_todo_line() {
        let scratch = Scratch::new("yorumerge-test").unwrap();
        let entries = vec![RebaseTodoEntry {
            action: "pick".to_string(),
            sha: "a".repeat(40),
            message: "innocent\nexec touch pwned".to_string(),
        }];

        let todo = build_todo(&scratch, &entries).unwrap();

        assert_eq!(todo, format!("pick {}\n", "a".repeat(40)));
        assert!(!todo.contains("pwned"));
    }

    #[test]
    fn sh_quoting_survives_an_apostrophe() {
        assert_eq!(sh_quote("/tmp/it's here"), "'/tmp/it'\\''s here'");
    }

    #[test]
    fn the_scratch_directory_is_removed_afterwards() {
        let dir = {
            let scratch = Scratch::new("yorumerge-test").unwrap();
            scratch.write("todo.txt", "pick abc\n").unwrap();
            scratch.0.clone()
        };
        assert!(!dir.exists());
    }

    // ── blame / history ──────────────────────────────────────────────────────

    #[test]
    fn blame_annotates_every_line() {
        let (_dir, path) = init_repo();
        let lines = blame_file_inner(&path, "a.txt", None).unwrap();

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].line_no, 1);
        assert_eq!(lines[0].content, "v1");
        assert_eq!(lines[0].author, "Test User");
        assert_eq!(lines[0].sha.len(), 40);
    }

    #[test]
    fn blame_at_a_revision_reads_that_revision() {
        let (_dir, path) = init_repo();
        let first = head(&path);
        commit_file(&path, "a.txt", "v1\nv2\n", "second");

        let old = blame_file_inner(&path, "a.txt", Some(&first)).unwrap();
        assert_eq!(old.len(), 1);
        assert_eq!(old[0].content, "v1");

        let current = blame_file_inner(&path, "a.txt", None).unwrap();
        assert_eq!(current.len(), 2);
        assert_eq!(current[1].content, "v2");

        assert!(blame_file_inner(&path, "a.txt", Some("--exec=calc")).is_err());
    }

    #[test]
    fn file_history_follows_a_rename() {
        let (_dir, path) = init_repo();
        commit_file(
            &path,
            "a.txt",
            "v2 with enough content to match\n",
            "update a",
        );
        git_ok(&path, &["mv", "a.txt", "señal ñ.txt"]);
        git_ok(&path, &["commit", "-m", "rename a"]);

        let history = file_history_inner(&path, "señal ñ.txt").unwrap();

        assert!(history.len() >= 3, "got {} entries", history.len());
        assert_eq!(history[0].message, "rename a");
        assert!(history.iter().any(|c| c.message == "init"));
    }

    #[test]
    fn history_and_blame_reject_traversal() {
        let (_dir, path) = init_repo();
        assert!(file_history_inner(&path, "../escape").is_err());
        assert!(blame_file_inner(&path, "../escape", None).is_err());
    }
}
