//! Unified diffs for working-tree files and commits.

use super::git::{blocking, validate_pathspec, validate_repo_path, validate_sha, GitCmd};

const SIZE_LIMIT: usize = 10 * 1024 * 1024;

/// The "nothing" side of a `diff --no-index`, which is how an untracked file
/// gets a patch: there is no index or HEAD entry to diff it against.
#[cfg(windows)]
const NULL_DEVICE: &str = "NUL";
#[cfg(not(windows))]
const NULL_DEVICE: &str = "/dev/null";

fn is_tracked(path: &str, file: &str) -> bool {
    GitCmd::in_repo(path)
        .args(["ls-files", "--error-unmatch", "--"])
        .arg(file)
        .succeeds()
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
                .args(["diff", "--no-color", "--patch", "--no-index", "--"])
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

    let mut cmd = GitCmd::in_repo(path).args(["diff", "--no-color", "--patch"]);
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

/// Parent SHAs of `sha`, oldest first.
fn parents(path: &str, sha: &str) -> Result<Vec<String>, String> {
    Ok(GitCmd::in_repo(path)
        .args(["show", "--no-patch", "--format=%P", sha])
        .run()?
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

pub(super) fn get_commit_diff_inner(path: &str, sha: &str) -> Result<String, String> {
    validate_repo_path(path)?;
    validate_sha(sha)?;

    // `git show` prints nothing for a merge; comparing against the first parent
    // is what every git GUI shows instead.
    let parents = parents(path, sha)?;
    let out = if parents.len() > 1 {
        GitCmd::in_repo(path)
            .args(["diff", "--no-color", "--patch"])
            .arg(&parents[0])
            .arg(sha)
            .output()?
    } else {
        GitCmd::in_repo(path)
            .args(["show", "--no-color", "--patch", "--format=", sha])
            .output()?
    };

    match out.status.code() {
        Some(0) | Some(1) => Ok(capped(out.stdout)),
        _ => Err(super::git::stderr_or(&out, "git diff failed")),
    }
}

/// Diff of one working-tree file (or the whole tree when `file` is `None`).
#[tauri::command]
pub async fn get_diff(path: String, file: Option<String>, staged: bool) -> Result<String, String> {
    blocking(move || get_diff_inner(&path, file.as_deref(), staged)).await
}

/// Diff introduced by `sha`; merges are compared against their first parent.
#[tauri::command]
pub async fn get_commit_diff(path: String, sha: String) -> Result<String, String> {
    blocking(move || get_commit_diff_inner(&path, &sha)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

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
        assert_eq!(parents(&path, &sha).unwrap().len(), 2);

        let diff = get_commit_diff_inner(&path, &sha).unwrap();
        assert!(
            diff.contains("b.txt"),
            "merge diff must not be empty; got: {diff}"
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
    fn traversal_in_the_file_argument_is_refused() {
        let (_dir, path) = init_repo();
        assert!(get_diff_inner(&path, Some("../escape"), false).is_err());
    }
}
