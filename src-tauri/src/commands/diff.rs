//! Unified diffs for working-tree files and commits.

use std::path::Path;

use git2::Repository;
use tauri::ipc::Response;

use super::git::{
    blocking, validate_pathspec, validate_repo_path, validate_sha, GitCmd, NO_EXT_DIFF, NO_TEXTCONV,
};
use crate::models::DiffStats;

const SIZE_LIMIT: usize = 10 * 1024 * 1024;

/// The "nothing" side of a `diff --no-index`, which is how an untracked file
/// gets a patch: there is no index or HEAD entry to diff it against.
#[cfg(windows)]
const NULL_DEVICE: &str = "NUL";
#[cfg(not(windows))]
const NULL_DEVICE: &str = "/dev/null";

/// Whether the index knows `file`.
///
/// Stage 0 is the merged entry, but a conflicted path only has stages 1-3 and
/// is still tracked, so every stage counts. An unreadable repository or index
/// means "not tracked", the answer `ls-files` gave when git could not run.
fn is_tracked(path: &str, file: &str) -> bool {
    let Ok(repo) = Repository::open(path) else {
        return false;
    };
    let Ok(index) = repo.index() else {
        return false;
    };
    (0..=3).any(|stage| index.get_path(Path::new(file), stage).is_some())
}

fn capped(stdout: Vec<u8>) -> String {
    if stdout.len() > SIZE_LIMIT {
        return "[binary or too large to display]".to_string();
    }
    String::from_utf8_lossy(&stdout).into_owned()
}

pub(super) fn get_diff_inner(
    path: &str,
    file: Option<&str>,
    staged: bool,
) -> Result<String, String> {
    validate_repo_path(path)?;
    if let Some(f) = file {
        validate_pathspec(f)?;
    }

    // An untracked file has no counterpart to diff against, so git would print
    // nothing at all; `--no-index` against the null device produces the "all
    // lines added" patch the UI expects.
    if let Some(f) = file {
        if !staged && !is_tracked(path, f) {
            let out = GitCmd::in_repo(path)
                .args([
                    "diff",
                    NO_EXT_DIFF,
                    NO_TEXTCONV,
                    "--no-color",
                    "--patch",
                    "--no-index",
                    "--",
                ])
                .arg(NULL_DEVICE)
                .arg(f)
                .output()?;
            // `--no-index` exits 1 when the files differ, which is the normal case.
            return match out.status.code() {
                Some(0) | Some(1) => Ok(capped(out.stdout)),
                _ => Err(super::git::stderr_or(&out, "git diff failed")),
            };
        }
    }

    let mut cmd =
        GitCmd::in_repo(path).args(["diff", NO_EXT_DIFF, NO_TEXTCONV, "--no-color", "--patch"]);
    if staged {
        cmd = cmd.arg("--cached");
    }
    if let Some(f) = file {
        cmd = cmd.arg("--").arg(f);
    }

    let out = cmd.output()?;
    match out.status.code() {
        Some(0) | Some(1) => Ok(capped(out.stdout)),
        _ => Err(super::git::stderr_or(&out, "git diff failed")),
    }
}

pub(super) fn get_commit_diff_inner(path: &str, sha: &str) -> Result<String, String> {
    validate_repo_path(path)?;
    validate_sha(sha)?;

    // Plain `git show` prints nothing for a merge; `--diff-merges=first-parent`
    // (git 2.31+) makes it print the diff against the first parent, which is
    // what every git GUI shows and what a separate `git diff <parent> <sha>`
    // produced here before.
    let out = GitCmd::in_repo(path)
        .args([
            "show",
            NO_EXT_DIFF,
            NO_TEXTCONV,
            "--diff-merges=first-parent",
            "--no-color",
            "--patch",
            "--format=",
            sha,
        ])
        .output()?;

    match out.status.code() {
        Some(0) | Some(1) => Ok(capped(out.stdout)),
        _ => Err(super::git::stderr_or(&out, "git diff failed")),
    }
}

/// Line counts of everything staged, from `--numstat -z` instead of the whole
/// patch (up to 10 MB) the composer used to fetch only to count it.
pub(super) fn staged_stats_inner(path: &str) -> Result<DiffStats, String> {
    validate_repo_path(path)?;

    let out = GitCmd::in_repo(path)
        .args([
            "diff",
            NO_EXT_DIFF,
            NO_TEXTCONV,
            "--cached",
            "--numstat",
            "-z",
        ])
        .output()?;
    if !matches!(out.status.code(), Some(0) | Some(1)) {
        return Err(super::git::stderr_or(&out, "git diff failed"));
    }

    let payload = String::from_utf8_lossy(&out.stdout);
    let mut stats = DiffStats {
        additions: 0,
        deletions: 0,
    };
    let mut tokens = payload.split('\0').filter(|token| !token.is_empty());
    while let Some(record) = tokens.next() {
        let mut fields = record.splitn(3, '\t');
        // A binary file reports `-`, which counts as nothing, as it did in the patch.
        stats.additions += fields.next().unwrap_or_default().parse().unwrap_or(0);
        stats.deletions += fields.next().unwrap_or_default().parse().unwrap_or(0);
        // A rename leaves the path field empty and sends both paths as tokens of
        // their own; they must not be read as records.
        if fields.next().unwrap_or_default().is_empty() {
            tokens.next();
            tokens.next();
        }
    }
    Ok(stats)
}

/// Diff of one working-tree file (or the whole tree when `file` is `None`).
///
/// Patches are sent as raw UTF-8 rather than as a JSON string, which would
/// escape every quote, tab and newline of up to 10 MB only for the UI to undo
/// it; `tauri-git.service.ts` decodes them.
#[tauri::command]
pub async fn get_diff(
    path: String,
    file: Option<String>,
    staged: bool,
) -> Result<Response, String> {
    let diff = blocking(move || get_diff_inner(&path, file.as_deref(), staged)).await?;
    Ok(Response::new(diff.into_bytes()))
}

#[tauri::command]
pub async fn get_staged_stats(path: String) -> Result<DiffStats, String> {
    blocking(move || staged_stats_inner(&path)).await
}

/// Diff introduced by `sha`; merges are compared against their first parent.
#[tauri::command]
pub async fn get_commit_diff(path: String, sha: String) -> Result<Response, String> {
    let diff = blocking(move || get_commit_diff_inner(&path, &sha)).await?;
    Ok(Response::new(diff.into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{
        arm_external_diff, arm_textconv, git, git_ok, init_repo, write_file,
    };

    #[test]
    fn invalid_input_is_rejected() {
        assert!(get_diff_inner("", None, false).is_err());
        assert!(get_diff_inner("--exec=calc", None, false).is_err());
        assert!(get_commit_diff_inner(".", "ZZZ").is_err());
        assert!(get_commit_diff_inner(".", "abc").is_err());
        assert!(get_commit_diff_inner(".", &"a".repeat(41)).is_err());
    }

    #[test]
    fn a_clean_tree_produces_an_empty_diff() {
        let (_dir, path) = init_repo();
        assert!(get_diff_inner(&path, None, false).unwrap().is_empty());
    }

    #[test]
    fn an_untracked_file_gets_a_patch() {
        let (_dir, path) = init_repo();
        write_file(&path, "señal ñ.txt", "línea uno\nlínea dos\n");

        let diff = get_diff_inner(&path, Some("señal ñ.txt"), false).unwrap();
        assert!(diff.contains("+línea uno"), "got: {diff}");
        assert!(diff.contains("+línea dos"), "got: {diff}");
    }

    #[test]
    fn a_staged_change_only_shows_up_with_staged_true() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "v2\n");
        git_ok(&path, &["add", "a.txt"]);

        assert!(get_diff_inner(&path, Some("a.txt"), false)
            .unwrap()
            .is_empty());
        assert!(get_diff_inner(&path, Some("a.txt"), true)
            .unwrap()
            .contains("+v2"));
    }

    #[test]
    fn a_merge_commit_diffs_against_its_first_parent() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "feature\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "feature"]);

        git_ok(&path, &["checkout", "main"]);
        write_file(&path, "c.txt", "main\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "main"]);
        git_ok(&path, &["merge", "--no-ff", "--no-edit", "feature"]);

        let sha = git_ok(&path, &["rev-parse", "HEAD"]);
        let first_parent = git_ok(&path, &["rev-parse", "HEAD^1"]);
        // `HEAD^2` only resolves when the fixture really produced a merge.
        git_ok(&path, &["rev-parse", "HEAD^2"]);

        let diff = get_commit_diff_inner(&path, &sha).unwrap();
        assert!(
            diff.contains("b.txt"),
            "merge diff must not be empty; got: {diff}"
        );
        // The explicit `diff <first parent> <merge>` this used to run.
        let previous = git(
            &path,
            &["diff", "--no-color", "--patch", &first_parent, &sha],
        );
        assert_eq!(diff, String::from_utf8_lossy(&previous.stdout));
    }

    #[test]
    fn a_conflicted_file_is_tracked_and_gets_the_combined_diff() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "a.txt", "feature\n");
        git_ok(&path, &["commit", "-am", "feature"]);

        git_ok(&path, &["checkout", "main"]);
        write_file(&path, "a.txt", "main\n");
        git_ok(&path, &["commit", "-am", "main"]);
        assert!(!git(&path, &["merge", "--no-edit", "feature"])
            .status
            .success());

        assert!(is_tracked(&path, "a.txt"));
        let diff = get_diff_inner(&path, Some("a.txt"), false).unwrap();
        assert!(diff.contains("diff --cc a.txt"), "got: {diff}");
    }

    #[test]
    fn a_file_deleted_from_the_work_tree_is_still_tracked() {
        let (_dir, path) = init_repo();
        std::fs::remove_file(Path::new(&path).join("a.txt")).unwrap();

        assert!(is_tracked(&path, "a.txt"));
        let diff = get_diff_inner(&path, Some("a.txt"), false).unwrap();
        assert!(diff.contains("deleted file"), "got: {diff}");
        assert!(diff.contains("-v1"), "got: {diff}");
    }

    #[test]
    fn a_tracked_file_in_a_non_ascii_subdirectory_resolves() {
        let (_dir, path) = init_repo();
        write_file(&path, "documentación/año ñ.txt", "uno\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "nested"]);
        write_file(&path, "documentación/año ñ.txt", "uno\ndos\n");

        assert!(is_tracked(&path, "documentación/año ñ.txt"));
        let diff = get_diff_inner(&path, Some("documentación/año ñ.txt"), false).unwrap();
        assert!(diff.contains("+dos"), "got: {diff}");
        assert!(
            !diff.contains("+uno"),
            "not an untracked patch; got: {diff}"
        );
    }

    #[test]
    fn a_root_commit_shows_its_whole_tree() {
        let (_dir, path) = init_repo();
        let sha = git_ok(&path, &["rev-parse", "HEAD"]);

        let diff = get_commit_diff_inner(&path, &sha).unwrap();
        assert!(diff.contains("a.txt"), "got: {diff}");
        assert!(diff.contains("+v1"), "got: {diff}");
    }

    #[test]
    fn a_diff_driver_configured_by_the_repository_is_never_executed() {
        let (_dir, path) = init_repo();
        let sha = git_ok(&path, &["rev-parse", "HEAD"]);
        write_file(&path, "a.txt", "v2\n");
        write_file(&path, "untracked.txt", "nuevo\n");
        let marker = arm_external_diff(&path);

        // Every diff the UI can ask for, with the driver armed: unstaged,
        // untracked, a commit and staged.
        let unstaged = get_diff_inner(&path, Some("a.txt"), false).unwrap();
        let untracked = get_diff_inner(&path, Some("untracked.txt"), false).unwrap();
        let commit = get_commit_diff_inner(&path, &sha).unwrap();
        git_ok(&path, &["add", "a.txt"]);
        let staged = get_diff_inner(&path, Some("a.txt"), true).unwrap();

        assert!(!marker.exists(), "the repository's diff.external ran");
        assert!(unstaged.contains("+v2"), "got: {unstaged}");
        assert!(untracked.contains("+nuevo"), "got: {untracked}");
        assert!(commit.contains("+v1"), "got: {commit}");
        assert!(staged.contains("+v2"), "got: {staged}");
    }

    /// Unlike an external driver, textconv also runs under `git show`, so the
    /// commit diff is as exposed as the work-tree ones.
    #[test]
    fn a_textconv_driver_configured_by_the_repository_is_never_executed() {
        let (_dir, path) = init_repo();
        let sha = git_ok(&path, &["rev-parse", "HEAD"]);
        write_file(&path, "a.txt", "v2\n");
        write_file(&path, "untracked.txt", "nuevo\n");
        let marker = arm_textconv(&path);

        let unstaged = get_diff_inner(&path, Some("a.txt"), false).unwrap();
        let untracked = get_diff_inner(&path, Some("untracked.txt"), false).unwrap();
        let commit = get_commit_diff_inner(&path, &sha).unwrap();
        git_ok(&path, &["add", "a.txt"]);
        let staged = get_diff_inner(&path, Some("a.txt"), true).unwrap();

        assert!(!marker.exists(), "the repository's textconv ran");
        assert!(unstaged.contains("+v2"), "got: {unstaged}");
        assert!(untracked.contains("+nuevo"), "got: {untracked}");
        assert!(commit.contains("+v1"), "got: {commit}");
        assert!(staged.contains("+v2"), "got: {staged}");
    }

    /// What the composer used to compute from the whole staged patch (the TS
    /// `countDiffStats` this command replaced): `+`/`-` lines minus the
    /// `+++`/`---` headers.
    fn count_patch_lines(patch: &str) -> DiffStats {
        let mut stats = DiffStats {
            additions: 0,
            deletions: 0,
        };
        for line in patch.split('\n') {
            if line.starts_with('+') && !line.starts_with("+++") {
                stats.additions += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                stats.deletions += 1;
            }
        }
        stats
    }

    #[test]
    fn staged_stats_match_the_counted_staged_patch() {
        let (_dir, path) = init_repo();
        write_file(&path, "keep.txt", "uno\ndos\ntres\ncuatro\ncinco\nseis\n");
        write_file(&path, "gone.txt", "a\nb\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "base"]);

        write_file(&path, "a.txt", "v2\nv3\n");
        write_file(&path, "año ñ/nuevo.txt", "x\ny\nz\n");
        std::fs::remove_file(Path::new(&path).join("gone.txt")).unwrap();
        std::fs::write(Path::new(&path).join("blob.bin"), [0u8, 1, 2, 0, 3]).unwrap();
        git_ok(&path, &["mv", "keep.txt", "moved.txt"]);
        write_file(
            &path,
            "moved.txt",
            "uno\ndos\ntres\ncuatro\ncinco\nseis\nsiete\n",
        );
        git_ok(&path, &["add", "-A"]);
        // Unstaged work must not count.
        write_file(&path, "a.txt", "unstaged\n");

        let patch = get_diff_inner(&path, None, true).unwrap();
        assert!(patch.contains("rename from keep.txt"), "got: {patch}");
        assert!(patch.contains("Binary files"), "got: {patch}");

        let stats = staged_stats_inner(&path).unwrap();
        assert_eq!(stats, count_patch_lines(&patch));
        assert_eq!(
            stats,
            DiffStats {
                additions: 2 + 3 + 1,
                deletions: 1 + 2
            }
        );
    }

    #[test]
    fn staged_stats_of_nothing_staged_are_zero() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "unstaged\n");
        assert_eq!(
            staged_stats_inner(&path).unwrap(),
            DiffStats {
                additions: 0,
                deletions: 0
            }
        );
        assert!(staged_stats_inner("--exec=calc").is_err());
    }

    #[test]
    fn traversal_in_the_file_argument_is_refused() {
        let (_dir, path) = init_repo();
        assert!(get_diff_inner(&path, Some("../escape"), false).is_err());
    }
}
