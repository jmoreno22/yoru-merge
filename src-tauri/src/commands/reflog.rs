//! HEAD reflog, the safety net behind "undo" in the UI.

use super::git::{validate_repo_path, GitCmd};
use crate::models::ReflogEntry;

/// Reflog subjects read `checkout: moving from a to b`, `commit: message`,
/// `rebase (finish): returning to …`. The verb before the colon is the action.
fn split_subject(subject: &str) -> (String, String) {
    match subject.split_once(": ") {
        Some((action, message)) => (action.to_string(), message.to_string()),
        None => (subject.to_string(), String::new()),
    }
}

fn reflog_inner(path: &str, limit: u32) -> Result<Vec<ReflogEntry>, String> {
    let output = GitCmd::in_repo(path)
        .args([
            "reflog",
            "show",
            "--format=%H%x00%h%x00%gd%x00%gs%x00%cI",
            "-n",
            &limit.to_string(),
        ])
        .output()?;

    // An unborn repository has no reflog: an empty list, not an error.
    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries = stdout
        .split('\n')
        .map(|line| line.trim_end_matches(['\r', '\n']))
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let fields: Vec<&str> = line.splitn(5, '\0').collect();
            let [sha, short_sha, selector, subject, date] = fields[..] else {
                return None;
            };
            let (action, message) = split_subject(subject);
            Some(ReflogEntry {
                sha: sha.to_string(),
                short_sha: short_sha.to_string(),
                selector: selector.to_string(),
                action,
                message,
                date: date.to_string(),
            })
        })
        .collect();
    Ok(entries)
}

#[tauri::command]
pub async fn get_reflog(path: String, limit: u32) -> Result<Vec<ReflogEntry>, String> {
    validate_repo_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || reflog_inner(&path, limit))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{commit_file, git_ok, init_empty_repo, init_repo};

    #[test]
    fn splits_the_action_from_the_message() {
        assert_eq!(
            split_subject("checkout: moving from main to feature"),
            (
                "checkout".to_string(),
                "moving from main to feature".to_string()
            )
        );
        assert_eq!(
            split_subject("commit (initial): first"),
            ("commit (initial)".to_string(), "first".to_string())
        );
        assert_eq!(
            split_subject("rebase finished"),
            ("rebase finished".to_string(), String::new())
        );
    }

    #[test]
    fn reads_the_most_recent_entries_first() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "file.txt", "second\n", "second");

        let entries = reflog_inner(&repo, 10).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].selector, "HEAD@{0}");
        assert_eq!(entries[0].action, "commit");
        assert_eq!(entries[0].message, "second");
        assert_eq!(entries[1].action, "checkout");
        assert!(entries[1].message.contains("moving from main to feature"));
        assert_eq!(entries[0].short_sha.len(), 7);
        assert_eq!(entries[0].sha.len(), 40);
        assert!(entries[0].date.contains('T'));
    }

    #[test]
    fn honours_the_limit() {
        let (_dir, repo) = init_empty_repo();
        for i in 0..5 {
            commit_file(&repo, "file.txt", &format!("{i}\n"), &format!("c{i}"));
        }
        assert_eq!(reflog_inner(&repo, 2).unwrap().len(), 2);
    }

    #[test]
    fn an_unborn_repository_has_an_empty_reflog() {
        let (_dir, repo) = init_empty_repo();
        assert!(reflog_inner(&repo, 10).unwrap().is_empty());
    }

    #[test]
    fn messages_with_separators_stay_intact() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "x\n", "fix: a | b & c");
        let entries = reflog_inner(&repo, 1).unwrap();
        assert_eq!(entries[0].action, "commit (initial)");
        assert_eq!(entries[0].message, "fix: a | b & c");
    }
}
