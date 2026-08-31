//! Merge and conflict-resolution commands.
//!
//! This module also owns [`conflicted_files`], the single conflict-listing
//! helper reused by the remote, rebase and cherry-pick paths.

use super::git::{blocking, validate_pathspec, validate_ref, validate_repo_path, GitCmd};
use crate::models::{ConflictFile, MergeContent, MergeResult};
use std::path::{Component, Path, PathBuf};

/// Repository-relative paths of every file with an unresolved conflict.
///
/// Uses `status --porcelain=v2 -z` so paths containing spaces, quotes or
/// non-ASCII characters survive verbatim (the v1 format quotes and escapes
/// them, and its fixed column offsets break on renames).
pub(super) fn conflicted_files(path: &str) -> Result<Vec<String>, String> {
    let out = GitCmd::in_repo(path)
        .args(["status", "--porcelain=v2", "-z", "--untracked-files=no"])
        .output()?;
    if !out.status.success() {
        return Ok(vec![]);
    }
    Ok(parse_unmerged(&out.stdout))
}

/// Extract the `u` (unmerged) records from `status --porcelain=v2 -z` bytes.
pub(super) fn parse_unmerged(data: &[u8]) -> Vec<String> {
    let mut files = Vec::new();
    let mut tokens = data.split(|&b| b == b'\0');
    while let Some(token) = tokens.next() {
        match token.first() {
            // "2 XY … path\0origPath\0" — the rename source is a separate token.
            Some(b'2') => {
                tokens.next();
            }
            // "u XY sub m1 m2 m3 mW h1 h2 h3 path"
            Some(b'u') => {
                let parts: Vec<&[u8]> = token.splitn(11, |&b| b == b' ').collect();
                if parts.len() == 11 {
                    if let Ok(p) = std::str::from_utf8(parts[10]) {
                        files.push(p.to_string());
                    }
                }
            }
            _ => {}
        }
    }
    files
}

/// Absolute path of `file` inside `repo_path`, rejecting traversal.
///
/// The file need not exist yet: a conflict side may be a deletion.
pub(super) fn resolve_in_repo(repo_path: &str, file: &str) -> Result<PathBuf, String> {
    validate_pathspec(file)?;
    let root = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| format!("cannot resolve repo path: {e}"))?;

    let mut normalised = PathBuf::new();
    for component in root.join(file).components() {
        match component {
            Component::ParentDir => {
                if !normalised.pop() {
                    return Err("file path escapes the repository".to_string());
                }
            }
            Component::CurDir => {}
            other => normalised.push(other),
        }
    }
    if !normalised.starts_with(&root) {
        return Err("file path escapes the repository".to_string());
    }
    Ok(normalised)
}

/// `git show :<stage>:<file>`; empty when the stage does not exist.
fn stage_content(path: &str, stage: u8, file: &str) -> String {
    GitCmd::in_repo(path)
        .args(["show", &format!(":{stage}:{file}")])
        .run()
        .unwrap_or_default()
}

fn merge_branch_inner(
    path: &str,
    branch: &str,
    squash: bool,
    no_ff: bool,
) -> Result<MergeResult, String> {
    validate_repo_path(path)?;
    validate_ref(branch)?;

    let mut cmd = GitCmd::in_repo(path)
        .args(["merge", "--no-edit"])
        .env("GIT_EDITOR", "true");
    if squash {
        cmd = cmd.arg("--squash");
    }
    if no_ff {
        cmd = cmd.arg("--no-ff");
    }
    let output = cmd.arg(branch).output()?;

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    if combined.contains("CONFLICT") {
        return Ok(MergeResult::Conflicts {
            files: conflicted_files(path)?,
        });
    }
    if !output.status.success() {
        return Err(combined.trim().to_string());
    }
    if combined.contains("Already up to date") || combined.contains("Already up-to-date") {
        return Ok(MergeResult::UpToDate);
    }
    if squash {
        return Ok(MergeResult::Squashed);
    }
    if combined.contains("Fast-forward") || combined.contains("Fast forward") {
        return Ok(MergeResult::FastForward);
    }
    Ok(MergeResult::Success)
}

fn get_conflicts_inner(path: &str) -> Result<Vec<ConflictFile>, String> {
    validate_repo_path(path)?;

    let files = conflicted_files(path)?;
    let mut result = Vec::with_capacity(files.len());
    for file in files {
        let abs = Path::new(path).join(&file);
        let conflict_count = std::fs::read_to_string(&abs)
            .unwrap_or_default()
            .lines()
            .filter(|l| l.starts_with("<<<<<<<"))
            .count();
        result.push(ConflictFile {
            path: file,
            conflict_count,
        });
    }
    Ok(result)
}

fn get_merge_content_inner(path: &str, file: &str) -> Result<MergeContent, String> {
    validate_repo_path(path)?;
    let abs = resolve_in_repo(path, file)?;

    Ok(MergeContent {
        base: stage_content(path, 1, file),
        ours: stage_content(path, 2, file),
        theirs: stage_content(path, 3, file),
        current: std::fs::read_to_string(&abs).unwrap_or_default(),
    })
}

fn resolve_conflict_inner(path: &str, file: &str, resolved_content: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    let target = resolve_in_repo(path, file)?;

    std::fs::write(&target, resolved_content).map_err(|e| format!("cannot write {file}: {e}"))?;
    GitCmd::in_repo(path)
        .args(["add", "--"])
        .arg(file)
        .run()
        .map(|_| ())
}

fn resolve_conflict_take_inner(path: &str, file: &str, side: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;
    let flag = match side {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => return Err("side must be \"ours\" or \"theirs\"".to_string()),
    };

    GitCmd::in_repo(path)
        .args(["checkout", flag, "--"])
        .arg(file)
        .run()?;
    GitCmd::in_repo(path)
        .args(["add", "--"])
        .arg(file)
        .run()
        .map(|_| ())
}

fn resolve_conflict_delete_inner(path: &str, file: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;

    GitCmd::in_repo(path)
        .args(["rm", "-f", "--"])
        .arg(file)
        .run()
        .map(|_| ())
}

fn abort_merge_inner(path: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    GitCmd::in_repo(path)
        .args(["merge", "--abort"])
        .run()
        .map(|_| ())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Merge `branch` into the current HEAD (`--no-edit`, optional squash / no-ff).
#[tauri::command]
pub async fn merge_branch(
    path: String,
    branch: String,
    squash: bool,
    no_ff: bool,
) -> Result<MergeResult, String> {
    blocking(move || merge_branch_inner(&path, &branch, squash, no_ff)).await
}

/// Every file that currently has unresolved merge conflicts.
#[tauri::command]
pub async fn get_conflicts(path: String) -> Result<Vec<ConflictFile>, String> {
    blocking(move || get_conflicts_inner(&path)).await
}

/// The four views of a conflicted file for a three-way merge editor.
#[tauri::command]
pub async fn get_merge_content(path: String, file: String) -> Result<MergeContent, String> {
    blocking(move || get_merge_content_inner(&path, &file)).await
}

/// Write `resolved_content` to disk and stage the file.
#[tauri::command]
pub async fn resolve_conflict(
    path: String,
    file: String,
    resolved_content: String,
) -> Result<(), String> {
    blocking(move || resolve_conflict_inner(&path, &file, &resolved_content)).await
}

/// Resolve a conflict by keeping one whole side (`ours` or `theirs`).
#[tauri::command]
pub async fn resolve_conflict_take(path: String, file: String, side: String) -> Result<(), String> {
    blocking(move || resolve_conflict_take_inner(&path, &file, &side)).await
}

/// Resolve a conflict by deleting the file.
#[tauri::command]
pub async fn resolve_conflict_delete(path: String, file: String) -> Result<(), String> {
    blocking(move || resolve_conflict_delete_inner(&path, &file)).await
}

/// Abort an in-progress merge.
#[tauri::command]
pub async fn abort_merge(path: String) -> Result<(), String> {
    blocking(move || abort_merge_inner(&path)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git, init_repo, write_file};

    /// Two branches that both rewrite `a.txt`, positioned on `main`.
    fn make_conflict_repo() -> (tempfile::TempDir, String) {
        let (dir, path) = init_repo();

        git(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "a.txt", "feature side\n");
        git(&path, &["commit", "-am", "feature side"]);

        git(&path, &["checkout", "main"]);
        write_file(&path, "a.txt", "main side\n");
        git(&path, &["commit", "-am", "main side"]);

        (dir, path)
    }

    #[test]
    fn no_conflicts_in_a_fresh_repo() {
        let (_dir, path) = init_repo();
        assert!(get_conflicts_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn merge_reports_up_to_date() {
        let (_dir, path) = init_repo();
        assert_eq!(
            merge_branch_inner(&path, "main", false, false).unwrap(),
            MergeResult::UpToDate
        );
    }

    #[test]
    fn merge_reports_fast_forward() {
        let (_dir, path) = init_repo();
        git(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "new\n");
        git(&path, &["add", "b.txt"]);
        git(&path, &["commit", "-m", "add b"]);
        git(&path, &["checkout", "main"]);

        assert_eq!(
            merge_branch_inner(&path, "feature", false, false).unwrap(),
            MergeResult::FastForward
        );
    }

    #[test]
    fn merge_no_ff_creates_a_merge_commit() {
        let (_dir, path) = init_repo();
        git(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "noff\n");
        git(&path, &["add", "b.txt"]);
        git(&path, &["commit", "-m", "add b"]);
        git(&path, &["checkout", "main"]);

        assert_eq!(
            merge_branch_inner(&path, "feature", false, true).unwrap(),
            MergeResult::Success
        );
    }

    #[test]
    fn merge_squash_stages_without_committing() {
        let (_dir, path) = init_repo();
        git(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "squash me\n");
        git(&path, &["add", "b.txt"]);
        git(&path, &["commit", "-m", "add b"]);
        git(&path, &["checkout", "main"]);

        assert_eq!(
            merge_branch_inner(&path, "feature", true, false).unwrap(),
            MergeResult::Squashed
        );
    }

    #[test]
    fn abort_clears_the_conflicted_state() {
        let (_dir, path) = make_conflict_repo();

        assert!(matches!(
            merge_branch_inner(&path, "feature", false, false).unwrap(),
            MergeResult::Conflicts { .. }
        ));
        abort_merge_inner(&path).unwrap();

        assert!(get_conflicts_inner(&path).unwrap().is_empty());
        assert!(!Path::new(&path).join(".git").join("MERGE_HEAD").exists());
    }

    #[test]
    fn conflicts_are_listed_for_non_ascii_paths() {
        let (_dir, path) = init_repo();
        write_file(&path, "señal ñ.txt", "base\n");
        git(&path, &["add", "."]);
        git(&path, &["commit", "-m", "base"]);

        git(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "señal ñ.txt", "feature\n");
        git(&path, &["commit", "-am", "feature"]);

        git(&path, &["checkout", "main"]);
        write_file(&path, "señal ñ.txt", "main\n");
        git(&path, &["commit", "-am", "main"]);

        assert_eq!(
            merge_branch_inner(&path, "feature", false, false).unwrap(),
            MergeResult::Conflicts {
                files: vec!["señal ñ.txt".to_string()]
            }
        );

        let conflicts = get_conflicts_inner(&path).unwrap();
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].path, "señal ñ.txt");
        assert!(conflicts[0].conflict_count >= 1);
    }

    #[test]
    fn resolve_conflict_writes_and_stages() {
        let (_dir, path) = make_conflict_repo();
        merge_branch_inner(&path, "feature", false, false).unwrap();

        resolve_conflict_inner(&path, "a.txt", "resolved\n").unwrap();

        assert!(get_conflicts_inner(&path).unwrap().is_empty());
        let staged = git(&path, &["diff", "--cached", "--name-only"]);
        assert!(String::from_utf8_lossy(&staged.stdout).contains("a.txt"));
    }

    #[test]
    fn take_theirs_keeps_the_incoming_side() {
        let (_dir, path) = make_conflict_repo();
        merge_branch_inner(&path, "feature", false, false).unwrap();

        resolve_conflict_take_inner(&path, "a.txt", "theirs").unwrap();

        let content = std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap();
        assert_eq!(content.trim_end_matches(['\r', '\n']), "feature side");
        assert!(get_conflicts_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn take_rejects_an_unknown_side() {
        let (_dir, path) = init_repo();
        assert!(resolve_conflict_take_inner(&path, "a.txt", "mine").is_err());
    }

    #[test]
    fn delete_resolves_by_removing_the_file() {
        let (_dir, path) = make_conflict_repo();
        merge_branch_inner(&path, "feature", false, false).unwrap();

        resolve_conflict_delete_inner(&path, "a.txt").unwrap();

        assert!(!Path::new(&path).join("a.txt").exists());
        assert!(get_conflicts_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn branch_names_with_ampersands_are_accepted() {
        let (_dir, path) = init_repo();
        git(&path, &["checkout", "-b", "tom&jerry"]);
        write_file(&path, "b.txt", "x\n");
        git(&path, &["add", "b.txt"]);
        git(&path, &["commit", "-m", "b"]);
        git(&path, &["checkout", "main"]);

        assert_eq!(
            merge_branch_inner(&path, "tom&jerry", false, false).unwrap(),
            MergeResult::FastForward
        );
    }

    #[test]
    fn option_like_branch_names_are_rejected() {
        let (_dir, path) = init_repo();
        assert!(merge_branch_inner(&path, "--exec=calc", false, false).is_err());
    }

    #[test]
    fn traversal_out_of_the_repo_is_refused() {
        let (_dir, path) = init_repo();
        assert!(get_merge_content_inner(&path, "../escape.txt").is_err());
    }
}
