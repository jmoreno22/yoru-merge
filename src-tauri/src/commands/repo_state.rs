//! In-progress operation detection: merge, rebase, cherry-pick, revert, bisect.
//!
//! Everything is derived from the marker files git keeps in the git dir, so the
//! answer stays correct for linked worktrees (where `.git` is a file).

use std::path::{Path, PathBuf};

use git2::Repository;

use super::git::validate_repo_path;
use crate::models::{RepoState, RepoStateInfo};

/// Absolute path of the git dir, which is not `<repo>/.git` in linked worktrees.
///
/// libgit2 keeps a trailing separator that `rev-parse --absolute-git-dir` does
/// not print; strip it so the value reads the same in errors and assertions.
fn git_dir(repo: &Repository) -> PathBuf {
    let dir = repo.path();
    match dir.to_str() {
        Some(text) => PathBuf::from(text.trim_end_matches(std::path::is_separator)),
        None => dir.to_path_buf(),
    }
}

/// Paths git reports as unmerged (conflicted) right now.
///
/// Index paths are raw bytes on Linux, so they get the same lossy decode the
/// `git` CLI output went through before.
fn conflicted_files(repo: &Repository) -> Vec<String> {
    let Ok(index) = repo.index() else {
        return Vec::new();
    };
    let Ok(conflicts) = index.conflicts() else {
        return Vec::new();
    };
    conflicts
        .flatten()
        .filter_map(|c| c.our.or(c.their).or(c.ancestor))
        .map(|entry| String::from_utf8_lossy(&entry.path).into_owned())
        .collect()
}

fn read_count(file: &Path) -> Option<u32> {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

/// Commit HEAD resolves to, or an empty string on an unborn branch.
fn head_sha(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|head| head.target())
        .map(|oid| oid.to_string())
        .unwrap_or_default()
}

/// Read the current repository state. Shared with `sequencer.rs`, which needs
/// to know whether an operation is still running after `--continue`.
pub(crate) fn read_repo_state(path: &str) -> Result<RepoStateInfo, String> {
    let repo = Repository::open(path).map_err(|e| e.message().to_string())?;
    let dir = git_dir(&repo);
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
        head_detached: repo.head_detached().unwrap_or(false),
        head_sha: head_sha(&repo),
        rebase_step,
        rebase_total,
        conflicted_files: conflicted_files(&repo),
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
        commit_file, conflict_repo, conflict_repo_named, git, git_ok, init_empty_repo, init_repo,
    };
    use tempfile::TempDir;

    /// Git dir, detached flag, HEAD sha and conflicted paths as the `git` CLI
    /// reports them, which is what this module used to shell out for.
    fn git_cli_state(repo: &str) -> (PathBuf, bool, String, Vec<String>) {
        let dir = String::from_utf8_lossy(&git(repo, &["rev-parse", "--absolute-git-dir"]).stdout)
            .trim_end_matches(['\r', '\n', ' '])
            .to_string();
        let detached = !git(repo, &["symbolic-ref", "-q", "HEAD"]).status.success();
        let head = git(repo, &["rev-parse", "HEAD"]);
        let head_sha = if head.status.success() {
            String::from_utf8_lossy(&head.stdout).trim().to_string()
        } else {
            String::new()
        };
        let unmerged = git(repo, &["diff", "--name-only", "--diff-filter=U", "-z"]);
        let conflicted = String::from_utf8_lossy(&unmerged.stdout)
            .split('\0')
            .map(|s| s.trim_end_matches(['\r', '\n']))
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
        (PathBuf::from(dir), detached, head_sha, conflicted)
    }

    fn assert_matches_the_git_cli(repo: &str) {
        let (dir, detached, head_sha, conflicted) = git_cli_state(repo);
        assert_eq!(git_dir(&Repository::open(repo).unwrap()), dir);

        let info = read_repo_state(repo).unwrap();
        assert_eq!(info.head_detached, detached);
        assert_eq!(info.head_sha, head_sha);
        assert_eq!(info.conflicted_files, conflicted);
    }

    #[test]
    fn a_clean_repo_matches_the_git_cli() {
        let (_dir, repo) = init_repo();
        assert_matches_the_git_cli(&repo);
    }

    #[test]
    fn a_detached_head_matches_the_git_cli() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["checkout", "--detach", "HEAD"]);
        assert_matches_the_git_cli(&repo);
    }

    #[test]
    fn a_merge_conflict_matches_the_git_cli() {
        let (_dir, repo) = conflict_repo();
        assert!(
            !git(&repo, &["merge", "feature"]).status.success(),
            "merge was expected to conflict"
        );
        assert_matches_the_git_cli(&repo);
    }

    #[test]
    fn a_repo_without_commits_matches_the_git_cli() {
        let (_dir, repo) = init_empty_repo();
        assert_matches_the_git_cli(&repo);
    }

    /// `zz.txt` is deleted on `main`, so its conflict has no "ours" stage, and
    /// it must still come after `aa.txt` like git prints it.
    #[test]
    fn conflicts_without_every_stage_match_the_git_cli() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "aa.txt", "base\n", "base aa");
        commit_file(&repo, "zz.txt", "base\n", "base zz");

        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "aa.txt", "feature\n", "feature aa");
        commit_file(&repo, "zz.txt", "feature\n", "feature zz");

        git_ok(&repo, &["checkout", "main"]);
        commit_file(&repo, "aa.txt", "main\n", "main aa");
        git_ok(&repo, &["rm", "--", "zz.txt"]);
        git_ok(&repo, &["commit", "-m", "drop zz"]);

        assert!(
            !git(&repo, &["merge", "feature"]).status.success(),
            "merge was expected to conflict"
        );
        let info = read_repo_state(&repo).unwrap();
        assert_eq!(info.conflicted_files, vec!["aa.txt", "zz.txt"]);
        assert_matches_the_git_cli(&repo);
    }

    /// The git dir of a linked worktree is `<main>/.git/worktrees/<name>`, and
    /// that is the dir the sequencer markers live in.
    #[test]
    fn a_linked_worktree_matches_the_git_cli() {
        let (_dir, repo) = init_repo();
        let elsewhere = TempDir::new().expect("create worktree dir");
        let linked = elsewhere.path().join("linked");
        let linked = linked.to_str().expect("non-UTF-8 tempdir path");
        git_ok(&repo, &["worktree", "add", "--detach", linked]);

        assert_matches_the_git_cli(linked);
    }

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
    fn unicode_conflict_paths_survive_the_index_read() {
        let (_dir, repo) = conflict_repo_named("señal ñ.txt");
        git(&repo, &["merge", "feature"]);
        let handle = Repository::open(&repo).unwrap();
        assert_eq!(conflicted_files(&handle), vec!["señal ñ.txt".to_string()]);
    }

    #[test]
    fn git_dir_is_absolute_and_has_no_trailing_separator() {
        let (_dir, repo) = init_repo();
        let dir = git_dir(&Repository::open(&repo).unwrap());
        assert!(dir.is_absolute());
        assert!(dir.ends_with(".git"));
        assert!(!dir.to_str().unwrap().ends_with(std::path::is_separator));
    }
}
