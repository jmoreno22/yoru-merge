//! Stash operations.

use super::git::{
    blocking, validate_message, validate_pathspec, validate_ref, validate_repo_path, GitCmd,
    NO_EXT_DIFF, NO_TEXTCONV,
};
use crate::models::StashEntry;

fn stash_ref(index: u32) -> String {
    format!("stash@{{{index}}}")
}

fn stash_save_inner(
    path: &str,
    message: Option<&str>,
    include_untracked: bool,
    keep_index: bool,
    paths: &[String],
) -> Result<(), String> {
    validate_repo_path(path)?;
    paths.iter().try_for_each(|p| validate_pathspec(p))?;

    let mut cmd = GitCmd::in_repo(path).args(["stash", "push"]);
    if include_untracked {
        cmd = cmd.arg("--include-untracked");
    }
    if keep_index {
        cmd = cmd.arg("--keep-index");
    }
    if let Some(msg) = message.map(str::trim).filter(|m| !m.is_empty()) {
        validate_message(msg)?;
        cmd = cmd.arg("-m").arg(msg);
    }
    if !paths.is_empty() {
        cmd = cmd.arg("--").args(paths);
    }

    cmd.run().map(|_| ())
}

fn stash_list_inner(path: &str) -> Result<Vec<StashEntry>, String> {
    validate_repo_path(path)?;

    // NUL separators: a stash message is free text and routinely contains the
    // `|` this used to split on.
    let out = GitCmd::in_repo(path)
        .args(["stash", "list", "--format=%gd%x00%s%x00%cI"])
        .output()?;
    if !out.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for line in stdout.lines() {
        let fields: Vec<&str> = line.split('\u{0}').collect();
        if fields.len() < 3 {
            continue;
        }
        let selector = fields[0].trim();
        let index = selector
            .strip_prefix("stash@{")
            .and_then(|s| s.strip_suffix('}'))
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        entries.push(StashEntry {
            index,
            message: fields[1].to_string(),
            sha: selector.to_string(),
            date: fields[2].trim().to_string(),
        });
    }
    Ok(entries)
}

fn stash_apply_inner(path: &str, index: u32, pop: bool) -> Result<(), String> {
    validate_repo_path(path)?;
    let subcommand = if pop { "pop" } else { "apply" };
    GitCmd::in_repo(path)
        .args(["stash", subcommand, &stash_ref(index)])
        .run()
        .map(|_| ())
}

fn stash_drop_inner(path: &str, index: u32) -> Result<(), String> {
    validate_repo_path(path)?;
    GitCmd::in_repo(path)
        .args(["stash", "drop", &stash_ref(index)])
        .run()
        .map(|_| ())
}

fn stash_show_inner(path: &str, index: u32) -> Result<String, String> {
    validate_repo_path(path)?;
    GitCmd::in_repo(path)
        .args([
            "stash",
            "show",
            NO_EXT_DIFF,
            NO_TEXTCONV,
            "--patch",
            "--no-color",
            "--include-untracked",
            &stash_ref(index),
        ])
        .run()
}

fn stash_branch_inner(path: &str, index: u32, branch_name: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_ref(branch_name)?;
    GitCmd::in_repo(path)
        .args(["stash", "branch", branch_name, &stash_ref(index)])
        .run()
        .map(|_| ())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Stash the work tree, optionally limited to `paths`.
#[tauri::command]
pub async fn stash_save(
    path: String,
    message: Option<String>,
    include_untracked: bool,
    keep_index: bool,
    paths: Vec<String>,
) -> Result<(), String> {
    blocking(move || {
        stash_save_inner(
            &path,
            message.as_deref(),
            include_untracked,
            keep_index,
            &paths,
        )
    })
    .await
}

/// Every stash entry, newest first.
#[tauri::command]
pub async fn stash_list(path: String) -> Result<Vec<StashEntry>, String> {
    blocking(move || stash_list_inner(&path)).await
}

/// Apply (or pop) the stash at `index`.
#[tauri::command]
pub async fn stash_apply(path: String, index: u32, pop: bool) -> Result<(), String> {
    blocking(move || stash_apply_inner(&path, index, pop)).await
}

/// Delete the stash at `index` without applying it.
#[tauri::command]
pub async fn stash_drop(path: String, index: u32) -> Result<(), String> {
    blocking(move || stash_drop_inner(&path, index)).await
}

/// Full diff of the stash at `index`.
#[tauri::command]
pub async fn stash_show(path: String, index: u32) -> Result<String, String> {
    blocking(move || stash_show_inner(&path, index)).await
}

/// Create `branch_name` from the stash at `index` and apply it there.
#[tauri::command]
pub async fn stash_branch(path: String, index: u32, branch_name: String) -> Result<(), String> {
    blocking(move || stash_branch_inner(&path, index, &branch_name)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};
    use std::path::Path;

    #[test]
    fn save_then_list_keeps_a_message_containing_a_pipe() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "modified\n");

        stash_save_inner(&path, Some("wip | señal ñ"), false, false, &[]).unwrap();

        let stashes = stash_list_inner(&path).unwrap();
        assert_eq!(stashes.len(), 1);
        assert!(
            stashes[0].message.contains("wip | señal ñ"),
            "got: {}",
            stashes[0].message
        );
        assert_eq!(stashes[0].index, 0);
        assert_eq!(stashes[0].sha, "stash@{0}");
        assert!(stashes[0].date.contains('T'), "date must be ISO 8601");
    }

    #[test]
    fn apply_restores_the_changes_and_keeps_the_entry() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "modified\n");
        stash_save_inner(&path, Some("apply"), false, false, &[]).unwrap();

        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "v1\n"
        );

        stash_apply_inner(&path, 0, false).unwrap();

        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "modified\n"
        );
        assert_eq!(stash_list_inner(&path).unwrap().len(), 1);
    }

    #[test]
    fn pop_and_drop_remove_the_entry() {
        let (_dir, path) = init_repo();

        write_file(&path, "a.txt", "one\n");
        stash_save_inner(&path, None, false, false, &[]).unwrap();
        stash_apply_inner(&path, 0, true).unwrap();
        assert!(stash_list_inner(&path).unwrap().is_empty());

        write_file(&path, "a.txt", "two\n");
        stash_save_inner(&path, None, false, false, &[]).unwrap();
        stash_drop_inner(&path, 0).unwrap();
        assert!(stash_list_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn untracked_files_are_only_stashed_when_asked() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "dirty\n");
        write_file(&path, "new.txt", "untracked\n");

        stash_save_inner(&path, None, false, false, &[]).unwrap();
        assert!(Path::new(&path).join("new.txt").exists());
        stash_apply_inner(&path, 0, true).unwrap();

        stash_save_inner(&path, None, true, false, &[]).unwrap();
        assert!(!Path::new(&path).join("new.txt").exists());
    }

    #[test]
    fn keep_index_leaves_the_staged_change_in_place() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "staged\n");
        git_ok(&path, &["add", "a.txt"]);
        write_file(&path, "b.txt", "unstaged\n");
        git_ok(&path, &["add", "b.txt"]);
        write_file(&path, "b.txt", "unstaged edit\n");

        stash_save_inner(&path, None, false, true, &[]).unwrap();

        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "staged\n"
        );
    }

    #[test]
    fn only_the_listed_paths_are_stashed() {
        let (_dir, path) = init_repo();
        write_file(&path, "señal ñ.txt", "tracked\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "add"]);

        write_file(&path, "a.txt", "changed a\n");
        write_file(&path, "señal ñ.txt", "changed ñ\n");

        stash_save_inner(&path, None, false, false, &["señal ñ.txt".to_string()]).unwrap();

        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "changed a\n"
        );
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("señal ñ.txt")).unwrap(),
            "tracked\n"
        );
    }

    #[test]
    fn show_returns_the_stashed_patch() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "stashed change\n");
        stash_save_inner(&path, Some("show me"), false, false, &[]).unwrap();

        let diff = stash_show_inner(&path, 0).unwrap();
        assert!(diff.contains("a.txt"), "got: {diff}");
        assert!(diff.contains("+stashed change"), "got: {diff}");
    }

    #[test]
    fn branch_moves_the_stash_onto_a_new_branch() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "for the branch\n");
        stash_save_inner(&path, Some("branch me"), false, false, &[]).unwrap();

        stash_branch_inner(&path, 0, "feature/desde-stash").unwrap();

        assert_eq!(
            git_ok(&path, &["branch", "--show-current"]),
            "feature/desde-stash"
        );
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "for the branch\n"
        );
        assert!(stash_list_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn invalid_input_is_rejected() {
        let (_dir, path) = init_repo();
        assert!(stash_save_inner("", None, false, false, &[]).is_err());
        assert!(stash_branch_inner(&path, 0, "--exec=calc").is_err());
        assert!(stash_save_inner(&path, None, false, false, &["../escape".to_string()]).is_err());
    }
}
