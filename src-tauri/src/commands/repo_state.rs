//! In-progress operation detection: merge, rebase, cherry-pick, revert, bisect.
//!
//! Everything is derived from the marker files git keeps in the git dir, so the
//! answer stays correct for linked worktrees (where `.git` is a file).

use std::path::{Path, PathBuf};

use super::git::{validate_repo_path, GitCmd};
use crate::models::{RepoState, RepoStateInfo};

/// Split a `-z` / `%x00` separated git payload into non-empty entries.
pub(crate) fn split_nul(raw: &str) -> Vec<String> {
    raw.split('\0')
        .map(|s| s.trim_end_matches(['\r', '\n']))
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

/// Absolute path of the git dir, which is not `<repo>/.git` in linked worktrees.
pub(crate) fn git_dir(path: &str) -> Result<PathBuf, String> {
    let out = GitCmd::in_repo(path)
        .args(["rev-parse", "--absolute-git-dir"])
        .run()?;
    Ok(PathBuf::from(out.trim_end_matches(['\r', '\n', ' '])))
}

/// Paths git reports as unmerged (conflicted) right now.
pub(crate) fn conflicted_files(path: &str) -> Vec<String> {
    GitCmd::in_repo(path)
        .args(["diff", "--name-only", "--diff-filter=U", "-z"])
        .run()
        .map(|out| split_nul(&out))
        .unwrap_or_default()
}

fn read_count(file: &Path) -> Option<u32> {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

/// Commit HEAD resolves to, or an empty string on an unborn branch.
fn head_sha(path: &str) -> String {
    GitCmd::in_repo(path)
        .args(["rev-parse", "HEAD"])
        .run()
        .map(|out| out.trim().to_string())
        .unwrap_or_default()
}

fn head_is_detached(path: &str) -> bool {
    GitCmd::in_repo(path)
        .args(["symbolic-ref", "-q", "HEAD"])
        .output()
        .map(|out| !out.status.success())
        .unwrap_or(false)
}

/// Read the current repository state. Shared with `sequencer.rs`, which needs
/// to know whether an operation is still running after `--continue`.
pub(crate) fn read_repo_state(path: &str) -> Result<RepoStateInfo, String> {
    let dir = git_dir(path)?;
    let rebase_merge = dir.join("rebase-merge");
    let rebase_apply = dir.join("rebase-apply");

    let (state, rebase_step, rebase_total) = if rebase_merge.is_dir() {
        (
            RepoState::Rebasing,
            read_count(&rebase_merge.join("msgnum")),
            read_count(&rebase_merge.join("end")),
        )
    } else if rebase_apply.is_dir() {
        (
            RepoState::Rebasing,
            read_count(&rebase_apply.join("next")),
            read_count(&rebase_apply.join("last")),
        )
    } else if dir.join("MERGE_HEAD").exists() {
        (RepoState::Merging, None, None)
    } else if dir.join("CHERRY_PICK_HEAD").exists() {
        (RepoState::CherryPicking, None, None)
    } else if dir.join("REVERT_HEAD").exists() {
        (RepoState::Reverting, None, None)
    } else if dir.join("BISECT_LOG").exists() {
        (RepoState::Bisecting, None, None)
    } else {
        (RepoState::Clean, None, None)
    };

    Ok(RepoStateInfo {
        state,
        head_detached: head_is_detached(path),
        head_sha: head_sha(path),
        rebase_step,
        rebase_total,
        conflicted_files: conflicted_files(path),
    })
}

#[tauri::command]
pub async fn get_repo_state(path: String) -> Result<RepoStateInfo, String> {
    validate_repo_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || read_repo_state(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{
        conflict_repo, conflict_repo_named, git, git_ok, init_empty_repo, init_repo,
    };

    #[test]
    fn clean_repo_reports_clean() {
        let (_dir, repo) = init_repo();
        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.state, RepoState::Clean);
        assert!(!info.head_detached);
        assert!(info.conflicted_files.is_empty());
    }

    #[test]
    fn detached_head_is_reported() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["checkout", "--detach", "HEAD"]);
        let info = read_repo_state(&repo).unwrap();
        assert!(info.head_detached);
        assert_eq!(info.state, RepoState::Clean);
        assert_eq!(info.head_sha.len(), 40);
    }

    #[test]
    fn head_sha_matches_rev_parse() {
        let (_dir, repo) = init_repo();
        let expected = String::from_utf8_lossy(&git(&repo, &["rev-parse", "HEAD"]).stdout)
            .trim()
            .to_string();
        assert_eq!(read_repo_state(&repo).unwrap().head_sha, expected);
    }

    #[test]
    fn unborn_branch_has_no_head_sha() {
        let (_dir, repo) = init_empty_repo();
        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.head_sha, "");
        assert!(!info.head_detached);
    }

    #[test]
    fn merge_conflict_reports_merging_with_files() {
        let (_dir, repo) = conflict_repo();
        assert!(
            !git(&repo, &["merge", "feature"]).status.success(),
            "merge was expected to conflict"
        );

        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.state, RepoState::Merging);
        assert_eq!(info.conflicted_files, vec!["file.txt".to_string()]);
    }

    #[test]
    fn rebase_conflict_reports_rebasing_with_step() {
        let (_dir, repo) = conflict_repo();
        assert!(
            !git(&repo, &["rebase", "feature"]).status.success(),
            "rebase was expected to conflict"
        );

        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.state, RepoState::Rebasing);
        assert_eq!(info.rebase_step, Some(1));
        assert_eq!(info.rebase_total, Some(1));
        assert_eq!(info.conflicted_files, vec!["file.txt".to_string()]);
    }

    #[test]
    fn cherry_pick_conflict_reports_cherry_picking() {
        let (_dir, repo) = conflict_repo();
        assert!(
            !git(&repo, &["cherry-pick", "feature"]).status.success(),
            "cherry-pick was expected to conflict"
        );

        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.state, RepoState::CherryPicking);
        assert_eq!(info.conflicted_files, vec!["file.txt".to_string()]);
    }

    #[test]
    fn unicode_conflict_paths_survive_the_nul_split() {
        let (_dir, repo) = conflict_repo_named("señal ñ.txt");
        git(&repo, &["merge", "feature"]);
        assert_eq!(conflicted_files(&repo), vec!["señal ñ.txt".to_string()]);
    }

    #[test]
    fn git_dir_is_absolute_and_forward_slashed_by_git() {
        let (_dir, repo) = init_repo();
        let dir = git_dir(&repo).unwrap();
        assert!(dir.is_absolute());
        assert!(dir.ends_with(".git"));
    }
}
