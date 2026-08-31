//! Continue / skip / abort for the multi-step operations git can pause on.
//!
//! Every step runs with the editors disabled: a `--continue` must never block
//! the app waiting for a `$EDITOR` that will never open.

use super::git::{stderr_or, validate_repo_path, GitCmd};
use super::repo_state::read_repo_state;
use crate::models::{RepoState, SequencerResult};

fn run_step(path: &str, args: &[&str]) -> SequencerResult {
    let output = GitCmd::in_repo(path)
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .args(args)
        .output();

    let output = match output {
        Ok(output) => output,
        Err(message) => return SequencerResult::Error { message },
    };
    let success = output.status.success();
    let message = stderr_or(&output, "git command failed");

    let state = read_repo_state(path).ok();
    let in_progress = state
        .as_ref()
        .is_some_and(|info| info.state != RepoState::Clean);
    let files = state.map(|info| info.conflicted_files).unwrap_or_default();

    if in_progress && !files.is_empty() {
        SequencerResult::Conflicts { files }
    } else if success {
        SequencerResult::Completed
    } else {
        SequencerResult::Error { message }
    }
}

macro_rules! sequencer_command {
    ($(#[$doc:meta])* $name:ident, $($arg:literal),+) => {
        $(#[$doc])*
        #[tauri::command]
        pub async fn $name(path: String) -> Result<SequencerResult, String> {
            validate_repo_path(&path)?;
            tauri::async_runtime::spawn_blocking(move || run_step(&path, &[$($arg),+]))
                .await
                .map_err(|e| e.to_string())
        }
    };
}

sequencer_command!(
    /// Resume a rebase once the conflicts of the current step are staged.
    rebase_continue,
    "rebase",
    "--continue"
);
sequencer_command!(
    /// Drop the current step and move on to the next one.
    rebase_skip,
    "rebase",
    "--skip"
);
sequencer_command!(
    /// Restore the branch to the state it had before the rebase started.
    rebase_abort,
    "rebase",
    "--abort"
);
sequencer_command!(
    /// Commit the resolved cherry-pick and continue with the remaining commits.
    cherry_pick_continue,
    "cherry-pick",
    "--continue"
);
sequencer_command!(
    /// Drop the conflicting commit and continue with the remaining ones.
    cherry_pick_skip,
    "cherry-pick",
    "--skip"
);
sequencer_command!(cherry_pick_abort, "cherry-pick", "--abort");
sequencer_command!(revert_continue, "revert", "--continue");
sequencer_command!(
    /// Drop the conflicting revert and continue with the remaining ones.
    revert_skip,
    "revert",
    "--skip"
);
sequencer_command!(revert_abort, "revert", "--abort");
sequencer_command!(
    /// A resolved merge is finished by committing what git already staged.
    merge_continue,
    "commit",
    "--no-edit"
);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{
        commit_file, conflict_repo, git, git_ok, init_empty_repo, init_repo, write_file,
    };

    fn resolve(repo: &str, file: &str) {
        write_file(repo, file, "resolved\n");
        git_ok(repo, &["add", "--", file]);
    }

    #[test]
    fn merge_continue_commits_a_resolved_merge() {
        let (_dir, repo) = conflict_repo();
        assert!(!git(&repo, &["merge", "feature"]).status.success());
        resolve(&repo, "file.txt");

        assert_eq!(
            run_step(&repo, &["commit", "--no-edit"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
    }

    #[test]
    fn continue_with_unresolved_conflicts_reports_them() {
        let (_dir, repo) = conflict_repo();
        assert!(!git(&repo, &["rebase", "feature"]).status.success());

        assert_eq!(
            run_step(&repo, &["rebase", "--continue"]),
            SequencerResult::Conflicts {
                files: vec!["file.txt".to_string()]
            }
        );
    }

    #[test]
    fn rebase_continue_finishes_once_resolved() {
        let (_dir, repo) = conflict_repo();
        assert!(!git(&repo, &["rebase", "feature"]).status.success());
        resolve(&repo, "file.txt");

        assert_eq!(
            run_step(&repo, &["rebase", "--continue"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
    }

    #[test]
    fn rebase_abort_restores_the_original_head() {
        let (_dir, repo) = conflict_repo();
        let before = git_ok(&repo, &["rev-parse", "HEAD"]);
        assert!(!git(&repo, &["rebase", "feature"]).status.success());

        assert_eq!(
            run_step(&repo, &["rebase", "--abort"]),
            SequencerResult::Completed
        );
        let state = read_repo_state(&repo).unwrap();
        assert_eq!(state.state, RepoState::Clean);
        assert!(state.conflicted_files.is_empty());
        assert_eq!(git_ok(&repo, &["rev-parse", "HEAD"]), before);
    }

    #[test]
    fn rebase_skip_drops_the_conflicting_commit() {
        let (_dir, repo) = conflict_repo();
        assert!(!git(&repo, &["rebase", "feature"]).status.success());

        assert_eq!(
            run_step(&repo, &["rebase", "--skip"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
        assert_eq!(
            std::fs::read_to_string(std::path::Path::new(&repo).join("file.txt")).unwrap(),
            "feature side\n"
        );
    }

    #[test]
    fn cherry_pick_abort_restores_a_clean_tree() {
        let (_dir, repo) = conflict_repo();
        assert!(!git(&repo, &["cherry-pick", "feature"]).status.success());

        assert_eq!(
            run_step(&repo, &["cherry-pick", "--abort"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
    }

    #[test]
    fn cherry_pick_skip_drops_the_conflicting_commit() {
        let (_dir, repo) = conflict_repo();
        let before = git_ok(&repo, &["rev-parse", "HEAD"]);
        assert!(!git(&repo, &["cherry-pick", "feature"]).status.success());

        assert_eq!(
            run_step(&repo, &["cherry-pick", "--skip"]),
            SequencerResult::Completed
        );
        let state = read_repo_state(&repo).unwrap();
        assert_eq!(state.state, RepoState::Clean);
        assert_eq!(git_ok(&repo, &["rev-parse", "HEAD"]), before);
    }

    #[test]
    fn revert_skip_drops_the_conflicting_revert() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "one");
        commit_file(&repo, "file.txt", "two\n", "two");
        commit_file(&repo, "file.txt", "three\n", "three");
        let before = git_ok(&repo, &["rev-parse", "HEAD"]);
        assert!(
            !git(&repo, &["revert", "--no-edit", "HEAD~1"])
                .status
                .success(),
            "revert was expected to conflict"
        );

        assert_eq!(
            run_step(&repo, &["revert", "--skip"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
        assert_eq!(git_ok(&repo, &["rev-parse", "HEAD"]), before);
    }

    #[test]
    fn revert_abort_restores_a_clean_tree() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "one");
        commit_file(&repo, "file.txt", "two\n", "two");
        commit_file(&repo, "file.txt", "three\n", "three");
        // Undoing "two" no longer applies cleanly on top of "three".
        assert!(
            !git(&repo, &["revert", "--no-edit", "HEAD~1"])
                .status
                .success(),
            "revert was expected to conflict"
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Reverting);

        assert_eq!(
            run_step(&repo, &["revert", "--abort"]),
            SequencerResult::Completed
        );
        assert_eq!(read_repo_state(&repo).unwrap().state, RepoState::Clean);
    }

    #[test]
    fn continue_without_an_operation_is_an_error() {
        let (_dir, repo) = init_repo();
        assert!(matches!(
            run_step(&repo, &["rebase", "--continue"]),
            SequencerResult::Error { .. }
        ));
    }
}
