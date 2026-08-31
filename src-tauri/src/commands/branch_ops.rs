//! Branch lifecycle: create, delete, rename, upstream, detached checkout,
//! and the ahead/behind comparison the UI shows between two refs.

use super::git::{
    stderr_or, validate_ref, validate_remote_name, validate_repo_path, validate_revision, GitCmd,
};
use crate::models::{CheckoutResult, CompareResult};

fn create_branch_inner(
    path: &str,
    name: &str,
    start_point: Option<&str>,
    checkout: bool,
) -> Result<(), String> {
    let mut args = vec!["branch", name];
    if let Some(start) = start_point {
        args.push(start);
    }
    GitCmd::in_repo(path).args(&args).run()?;

    if checkout {
        GitCmd::in_repo(path).args(["checkout", name]).run()?;
    }
    Ok(())
}

fn delete_branch_inner(path: &str, name: &str, force: bool) -> Result<(), String> {
    let current = GitCmd::in_repo(path)
        .args(["branch", "--show-current"])
        .run()
        .unwrap_or_default();
    if current.trim() == name {
        return Err(format!(
            "'{name}' is the current branch; check out another branch before deleting it"
        ));
    }

    let flag = if force { "-D" } else { "-d" };
    GitCmd::in_repo(path)
        .args(["branch", flag, name])
        .run()
        .map(|_| ())
        .map_err(|error| {
            if error.contains("not fully merged") {
                format!("branch '{name}' is not fully merged; deleting it discards those commits")
            } else {
                error
            }
        })
}

fn rename_branch_inner(path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    GitCmd::in_repo(path)
        .args(["branch", "-m", old_name, new_name])
        .run()
        .map(|_| ())
}

fn delete_remote_branch_inner(path: &str, remote: &str, branch: &str) -> Result<(), String> {
    GitCmd::in_repo(path)
        .args(["push", remote, "--delete", branch])
        .run()
        .map(|_| ())
}

fn set_upstream_inner(path: &str, branch: &str, upstream: Option<&str>) -> Result<(), String> {
    let cmd = match upstream {
        Some(upstream) => {
            GitCmd::in_repo(path).args(["branch", &format!("--set-upstream-to={upstream}"), branch])
        }
        None => GitCmd::in_repo(path).args(["branch", "--unset-upstream", branch]),
    };
    cmd.run().map(|_| ())
}

/// git refuses a checkout that would discard uncommitted work; the UI needs to
/// tell that apart from a genuine failure so it can offer to stash or force.
fn is_overwrite_refusal(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("would be overwritten") || lower.contains("local changes")
}

/// git lists the endangered paths as tab-indented lines under its error.
fn overwritten_files(message: &str) -> Vec<String> {
    message
        .lines()
        .filter_map(|line| line.strip_prefix('\t'))
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect()
}

fn checkout_commit_inner(path: &str, rev: &str) -> Result<CheckoutResult, String> {
    let output = GitCmd::in_repo(path)
        .args(["checkout", "--detach", rev])
        .output()?;
    if output.status.success() {
        return Ok(CheckoutResult::DetachedHead);
    }

    let message = stderr_or(&output, "checkout failed");
    Ok(if is_overwrite_refusal(&message) {
        CheckoutResult::WouldOverwrite {
            files: overwritten_files(&message),
        }
    } else {
        CheckoutResult::Error { message }
    })
}

fn compare_refs_inner(path: &str, base: &str, head: &str) -> Result<CompareResult, String> {
    let counts = GitCmd::in_repo(path)
        .args([
            "rev-list",
            "--left-right",
            "--count",
            &format!("{base}...{head}"),
        ])
        .run()?;

    // Left side is reachable from `base` only (what `head` is behind by).
    let mut fields = counts
        .split_whitespace()
        .map(|n| n.parse::<u32>().unwrap_or(0));
    let behind = fields.next().unwrap_or(0);
    let ahead = fields.next().unwrap_or(0);

    let merge_base = GitCmd::in_repo(path)
        .args(["merge-base", base, head])
        .run()
        .ok()
        .map(|sha| sha.trim().to_string())
        .filter(|sha| !sha.is_empty());

    Ok(CompareResult {
        ahead,
        behind,
        merge_base,
    })
}

#[tauri::command]
pub async fn create_branch(
    path: String,
    name: String,
    start_point: Option<String>,
    checkout: bool,
) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&name)?;
    if let Some(start) = start_point.as_deref() {
        validate_revision(start)?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        create_branch_inner(&path, &name, start_point.as_deref(), checkout)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_branch(path: String, name: String, force: bool) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&name)?;
    tauri::async_runtime::spawn_blocking(move || delete_branch_inner(&path, &name, force))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn rename_branch(path: String, old_name: String, new_name: String) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&old_name)?;
    validate_ref(&new_name)?;
    tauri::async_runtime::spawn_blocking(move || rename_branch_inner(&path, &old_name, &new_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_upstream(
    path: String,
    branch: String,
    upstream: Option<String>,
) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&branch)?;
    if let Some(upstream) = upstream.as_deref() {
        validate_ref(upstream)?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        set_upstream_inner(&path, &branch, upstream.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_remote_branch(
    path: String,
    remote: String,
    branch: String,
) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_remote_name(&remote)?;
    validate_ref(&branch)?;
    tauri::async_runtime::spawn_blocking(move || {
        delete_remote_branch_inner(&path, &remote, &branch)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn checkout_commit(path: String, rev: String) -> Result<CheckoutResult, String> {
    validate_repo_path(&path)?;
    validate_revision(&rev)?;
    tauri::async_runtime::spawn_blocking(move || checkout_commit_inner(&path, &rev))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn compare_refs(
    path: String,
    base: String,
    head: String,
) -> Result<CompareResult, String> {
    validate_repo_path(&path)?;
    validate_revision(&base)?;
    validate_revision(&head)?;
    tauri::async_runtime::spawn_blocking(move || compare_refs_inner(&path, &base, &head))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{
        commit_file, git, git_ok, init_empty_repo, init_remote_and_clone, init_repo, write_file,
    };

    fn branch_exists(repo: &str, name: &str) -> bool {
        git_ok(
            repo,
            &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
        )
        .lines()
        .any(|line| line.trim() == name)
    }

    #[test]
    fn creates_a_branch_and_optionally_checks_it_out() {
        let (_dir, repo) = init_repo();

        create_branch_inner(&repo, "feature/ñ", None, false).unwrap();
        assert!(branch_exists(&repo, "feature/ñ"));
        assert_eq!(git_ok(&repo, &["branch", "--show-current"]), "main");

        create_branch_inner(&repo, "other", None, true).unwrap();
        assert_eq!(git_ok(&repo, &["branch", "--show-current"]), "other");
    }

    #[test]
    fn creates_a_branch_at_a_start_point() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "one");
        let first = git_ok(&repo, &["rev-parse", "HEAD"]);
        commit_file(&repo, "file.txt", "two\n", "two");

        create_branch_inner(&repo, "from-first", Some(&first), false).unwrap();
        assert_eq!(git_ok(&repo, &["rev-parse", "from-first"]), first);
    }

    #[test]
    fn deleting_the_current_branch_fails_with_a_clear_message() {
        let (_dir, repo) = init_repo();
        let error = delete_branch_inner(&repo, "main", true).unwrap_err();
        assert!(
            error.contains("current branch"),
            "unexpected message: {error}"
        );
        assert!(branch_exists(&repo, "main"));
    }

    #[test]
    fn deleting_an_unmerged_branch_needs_force() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "feature work");
        git_ok(&repo, &["checkout", "main"]);

        let error = delete_branch_inner(&repo, "feature", false).unwrap_err();
        assert!(
            error.contains("not fully merged"),
            "unexpected message: {error}"
        );
        assert!(branch_exists(&repo, "feature"));

        delete_branch_inner(&repo, "feature", true).unwrap();
        assert!(!branch_exists(&repo, "feature"));
    }

    #[test]
    fn renames_a_branch() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["branch", "old"]);
        rename_branch_inner(&repo, "old", "new").unwrap();
        assert!(branch_exists(&repo, "new"));
        assert!(!branch_exists(&repo, "old"));
    }

    #[test]
    fn sets_and_unsets_the_upstream() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["branch", "feature"]);
        let upstream = |repo: &str| {
            git_ok(
                repo,
                &[
                    "for-each-ref",
                    "--format=%(upstream:short)",
                    "refs/heads/feature",
                ],
            )
        };

        set_upstream_inner(&repo, "feature", Some("main")).unwrap();
        assert_eq!(upstream(&repo), "main");

        set_upstream_inner(&repo, "feature", None).unwrap();
        assert!(upstream(&repo).is_empty());
    }

    #[test]
    fn deletes_a_branch_on_a_remote() {
        let (remote, _clone, repo) = init_remote_and_clone();
        let remote_path = remote.path().to_str().expect("non-UTF-8 path").to_string();
        git_ok(&repo, &["push", "origin", "main:doomed"]);

        delete_remote_branch_inner(&repo, "origin", "doomed").unwrap();
        let remote_refs = git_ok(
            &remote_path,
            &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
        );
        assert!(!remote_refs.lines().any(|line| line.trim() == "doomed"));
    }

    #[test]
    fn checkout_commit_detaches_head() {
        let (_dir, repo) = init_repo();
        let sha = git_ok(&repo, &["rev-parse", "HEAD"]);

        assert_eq!(
            checkout_commit_inner(&repo, &sha).unwrap(),
            CheckoutResult::DetachedHead
        );
        assert!(
            !git(&repo, &["symbolic-ref", "-q", "HEAD"]).status.success(),
            "HEAD should be detached after checkout --detach"
        );
    }

    #[test]
    fn checkout_commit_refuses_to_discard_local_changes() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "one");
        let first = git_ok(&repo, &["rev-parse", "HEAD"]);
        commit_file(&repo, "file.txt", "two\n", "two");
        write_file(&repo, "file.txt", "dirty\n");

        assert_eq!(
            checkout_commit_inner(&repo, &first).unwrap(),
            CheckoutResult::WouldOverwrite {
                files: vec!["file.txt".to_string()]
            }
        );
        assert_eq!(
            std::fs::read_to_string(std::path::Path::new(&repo).join("file.txt")).unwrap(),
            "dirty\n"
        );
    }

    #[test]
    fn checkout_commit_reports_an_unknown_revision() {
        let (_dir, repo) = init_repo();
        assert!(matches!(
            checkout_commit_inner(&repo, "cafebabe").unwrap(),
            CheckoutResult::Error { .. }
        ));
    }

    #[test]
    fn compares_two_diverged_refs() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        let base_sha = git_ok(&repo, &["rev-parse", "HEAD"]);
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "f1");
        commit_file(&repo, "feature.txt", "ff\n", "f2");
        git_ok(&repo, &["checkout", "main"]);
        commit_file(&repo, "main.txt", "m\n", "m1");

        let result = compare_refs_inner(&repo, "main", "feature").unwrap();
        assert_eq!(result.ahead, 2);
        assert_eq!(result.behind, 1);
        assert_eq!(result.merge_base, Some(base_sha));
    }

    #[test]
    fn identical_refs_compare_as_zero() {
        let (_dir, repo) = init_repo();
        let result = compare_refs_inner(&repo, "main", "main").unwrap();
        assert_eq!((result.ahead, result.behind), (0, 0));
        assert_eq!(
            result.merge_base,
            Some(git_ok(&repo, &["rev-parse", "HEAD"]))
        );
    }
}
