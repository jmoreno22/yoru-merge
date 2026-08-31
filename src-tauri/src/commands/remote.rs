//! Remote operations: fetch (with streaming progress), pull, push and remote CRUD.

use super::git::{
    blocking, validate_ref, validate_remote_name, validate_repo_path, validate_url, GitCmd,
};
use super::git_auth::{auth_error_message, is_auth_error};
use super::merge::conflicted_files;
use crate::models::{FetchProgress, PullResult, PushResult, RemoteInfo};
use std::collections::HashMap;
use tauri::ipc::Channel;

// ── Progress parsing ──────────────────────────────────────────────────────────

/// Extract `(current, total)` from a git progress line.
///
/// Prefers the `(N/M)` counter; falls back to the integer after the last `: `
/// for "Counting objects: 42, done." style lines.
fn parse_progress_numbers(line: &str) -> (Option<u32>, Option<u32>) {
    if let (Some(open), Some(close)) = (line.find('('), line.rfind(')')) {
        if open < close {
            let parts: Vec<&str> = line[open + 1..close].split('/').collect();
            if parts.len() == 2 {
                let current = parts[0].trim().parse::<u32>().ok();
                let total = parts[1].trim().parse::<u32>().ok();
                if current.is_some() || total.is_some() {
                    return (current, total);
                }
            }
        }
    }
    if let Some(pos) = line.rfind(": ") {
        let digits: String = line[pos + 2..]
            .trim_start()
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(n) = digits.parse::<u32>() {
            return (Some(n), Some(n));
        }
    }
    (None, None)
}

/// Map one `--progress` line onto a [`FetchProgress`] event.
pub(super) fn parse_fetch_line(line: &str) -> FetchProgress {
    let lower = line.to_ascii_lowercase();
    let phase = if lower.contains("counting objects") || lower.contains("enumerating objects") {
        "counting"
    } else if lower.contains("compressing objects") {
        "compressing"
    } else if lower.contains("receiving objects") {
        "receiving"
    } else if lower.contains("resolving deltas") {
        "resolving"
    } else {
        return FetchProgress {
            phase: "info".into(),
            current: None,
            total: None,
            done: false,
            message: Some(line.to_string()),
        };
    };

    let (current, total) = parse_progress_numbers(line);
    FetchProgress {
        phase: phase.into(),
        current,
        total,
        done: false,
        message: None,
    }
}

pub(super) fn done_event() -> FetchProgress {
    FetchProgress {
        phase: "done".into(),
        current: None,
        total: None,
        done: true,
        message: None,
    }
}

/// Run a transfer, forwarding every progress line to `on_progress` and turning
/// credential failures into the shared help message.
pub(super) fn run_transfer(
    cmd: GitCmd,
    on_progress: &Channel<FetchProgress>,
) -> Result<(), String> {
    let result = cmd.run_streaming(|line| {
        on_progress.send(parse_fetch_line(line)).ok();
    });

    match result {
        Ok(()) => {
            on_progress.send(done_event()).ok();
            Ok(())
        }
        Err(message) if is_auth_error(&message) => Err(auth_error_message(&message)),
        Err(message) => Err(message),
    }
}

// ── fetch ─────────────────────────────────────────────────────────────────────

/// Fetch from `remote` (or every remote when `None`) with live progress.
#[tauri::command]
pub async fn fetch_remote(
    path: String,
    remote: Option<String>,
    prune: bool,
    tags: bool,
    on_progress: Channel<FetchProgress>,
) -> Result<(), String> {
    blocking(move || {
        validate_repo_path(&path)?;
        if let Some(name) = &remote {
            validate_remote_name(name)?;
        }

        let mut cmd = GitCmd::in_repo(&path).args(["fetch", "--progress"]);
        if prune {
            cmd = cmd.arg("--prune");
        }
        if tags {
            cmd = cmd.arg("--tags");
        }
        cmd = match &remote {
            Some(name) => cmd.arg(name),
            None => cmd.arg("--all"),
        };

        run_transfer(cmd, &on_progress)
    })
    .await
}

// ── pull ──────────────────────────────────────────────────────────────────────

fn pull_flag(mode: &str) -> Result<&'static str, String> {
    match mode {
        "merge" => Ok("--no-rebase"),
        "rebase" => Ok("--rebase"),
        "ff_only" => Ok("--ff-only"),
        _ => Err("mode must be \"merge\", \"rebase\" or \"ff_only\"".to_string()),
    }
}

fn pull_inner(
    path: &str,
    remote: &str,
    branch: &str,
    mode: &str,
    autostash: bool,
) -> Result<PullResult, String> {
    validate_repo_path(path)?;
    validate_remote_name(remote)?;
    validate_ref(branch)?;
    let flag = pull_flag(mode)?;

    let mut cmd = GitCmd::in_repo(path)
        .args(["pull", "--no-edit", flag])
        .env("GIT_EDITOR", "true");
    if autostash {
        cmd = cmd.arg("--autostash");
    }
    let output = cmd.arg(remote).arg(branch).output()?;

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    // A conflicted index is authoritative: `pull --rebase` reports the stop
    // differently from `pull --no-rebase`, but both leave unmerged entries.
    let conflicts = conflicted_files(path)?;
    if !conflicts.is_empty() {
        return Ok(PullResult::Conflicts { files: conflicts });
    }

    if !output.status.success() {
        if is_auth_error(&combined) {
            return Ok(PullResult::AuthRequired);
        }
        return Err(combined.trim().to_string());
    }

    if combined.contains("Already up to date") || combined.contains("Already up-to-date") {
        return Ok(PullResult::UpToDate);
    }
    if combined.contains("Fast-forward") || combined.contains("Fast forward") {
        return Ok(PullResult::FastForward);
    }
    if combined.contains("Merge made by") {
        return Ok(PullResult::Merged);
    }
    if mode == "rebase" {
        return Ok(PullResult::Rebased);
    }
    Ok(PullResult::FastForward)
}

/// Pull `branch` from `remote` using the requested integration `mode`.
#[tauri::command]
pub async fn pull(
    path: String,
    remote: String,
    branch: String,
    mode: String,
    autostash: bool,
) -> Result<PullResult, String> {
    blocking(move || pull_inner(&path, &remote, &branch, &mode, autostash)).await
}

// ── push ──────────────────────────────────────────────────────────────────────

/// Pick the `[rejected]` line out of git's stderr, or fall back to all of it.
fn extract_rejection_reason(stderr: &str) -> String {
    stderr
        .lines()
        .find(|line| line.contains("[rejected]"))
        .map(|line| line.trim().to_string())
        .unwrap_or_else(|| stderr.trim().to_string())
}

fn push_inner(
    path: &str,
    remote: &str,
    branch: &str,
    force: bool,
    set_upstream: bool,
    tags: bool,
) -> Result<PushResult, String> {
    validate_repo_path(path)?;
    validate_remote_name(remote)?;
    validate_ref(branch)?;

    let mut cmd = GitCmd::in_repo(path).arg("push");
    if force {
        // Never a bare `--force`: the lease keeps a concurrent push from being
        // silently discarded.
        cmd = cmd.arg("--force-with-lease");
    }
    if set_upstream {
        cmd = cmd.arg("--set-upstream");
    }
    if tags {
        cmd = cmd.arg("--follow-tags");
    }
    let output = cmd.arg(remote).arg(branch).output()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", String::from_utf8_lossy(&output.stdout), stderr);

    if combined.contains("Everything up-to-date") || combined.contains("Everything up to date") {
        return Ok(PushResult::UpToDate);
    }
    if output.status.success() {
        return Ok(PushResult::Success);
    }

    // Only a failed push can be an auth failure; a successful one whose output
    // merely mentions credentials must not be reported as one.
    if is_auth_error(&combined) {
        return Ok(PushResult::AuthRequired);
    }
    if combined.contains("[rejected]") {
        return Ok(PushResult::Rejected {
            reason: extract_rejection_reason(&stderr),
        });
    }
    Err(combined.trim().to_string())
}

/// Push `branch` to `remote`; `force` always means `--force-with-lease`.
#[tauri::command]
pub async fn push(
    path: String,
    remote: String,
    branch: String,
    force: bool,
    set_upstream: bool,
    tags: bool,
) -> Result<PushResult, String> {
    blocking(move || push_inner(&path, &remote, &branch, force, set_upstream, tags)).await
}

// ── Remote CRUD ───────────────────────────────────────────────────────────────

fn list_remotes_inner(path: &str) -> Result<Vec<RemoteInfo>, String> {
    validate_repo_path(path)?;

    let out = GitCmd::in_repo(path).args(["remote", "-v"]).output()?;
    if !out.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut map: HashMap<String, RemoteInfo> = HashMap::new();

    for line in stdout.lines() {
        // "name\turl (fetch)" / "name\turl (push)"
        let Some((name, rest)) = line.split_once('\t') else {
            continue;
        };
        let name = name.trim();
        let rest = rest.trim();
        if name.is_empty() || !rest.ends_with(')') {
            continue;
        }
        let Some(pos) = rest.rfind(" (") else {
            continue;
        };
        let url = rest[..pos].trim();
        let kind = &rest[pos + 2..rest.len() - 1];

        let entry = map.entry(name.to_string()).or_insert_with(|| RemoteInfo {
            name: name.to_string(),
            fetch_url: String::new(),
            push_url: String::new(),
        });
        match kind {
            "fetch" => entry.fetch_url = url.to_string(),
            "push" => entry.push_url = url.to_string(),
            _ => {}
        }
    }

    let mut result: Vec<RemoteInfo> = map.into_values().collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

fn add_remote_inner(path: &str, name: &str, url: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_remote_name(name)?;
    validate_url(url)?;
    GitCmd::in_repo(path)
        .args(["remote", "add", name, url])
        .run()
        .map(|_| ())
}

fn remove_remote_inner(path: &str, name: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_remote_name(name)?;
    GitCmd::in_repo(path)
        .args(["remote", "remove", name])
        .run()
        .map(|_| ())
}

fn set_remote_url_inner(path: &str, name: &str, url: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_remote_name(name)?;
    validate_url(url)?;
    GitCmd::in_repo(path)
        .args(["remote", "set-url", name, url])
        .run()
        .map(|_| ())
}

fn rename_remote_inner(path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_remote_name(old_name)?;
    validate_remote_name(new_name)?;
    GitCmd::in_repo(path)
        .args(["remote", "rename", old_name, new_name])
        .run()
        .map(|_| ())
}

/// Every configured remote with its fetch and push URLs.
#[tauri::command]
pub async fn list_remotes(path: String) -> Result<Vec<RemoteInfo>, String> {
    blocking(move || list_remotes_inner(&path)).await
}

/// Add a remote named `name` pointing at `url`.
#[tauri::command]
pub async fn add_remote(path: String, name: String, url: String) -> Result<(), String> {
    blocking(move || add_remote_inner(&path, &name, &url)).await
}

/// Remove the remote named `name`.
#[tauri::command]
pub async fn remove_remote(path: String, name: String) -> Result<(), String> {
    blocking(move || remove_remote_inner(&path, &name)).await
}

/// Rename remote `old_name` to `new_name`.
#[tauri::command]
pub async fn rename_remote(path: String, old_name: String, new_name: String) -> Result<(), String> {
    blocking(move || rename_remote_inner(&path, &old_name, &new_name)).await
}

/// Point the remote named `name` at `url` (both fetch and push).
#[tauri::command]
pub async fn set_remote_url(path: String, name: String, url: String) -> Result<(), String> {
    blocking(move || set_remote_url_inner(&path, &name, &url)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{
        clone_repo, git_ok, init_remote_and_clone, init_repo, write_file,
    };
    use std::path::Path;

    /// Push one commit rewriting `a.txt` from a throwaway clone of `remote`.
    fn advance_remote(remote: &Path, content: &str) {
        let (_dir, path) = clone_repo(remote);
        write_file(&path, "a.txt", content);
        git_ok(&path, &["commit", "-am", "remote update"]);
        git_ok(&path, &["push", "origin", "main"]);
    }

    #[test]
    fn progress_lines_map_to_phases() {
        let receiving = parse_fetch_line("Receiving objects:  45% (45/100)");
        assert_eq!(receiving.phase, "receiving");
        assert_eq!(receiving.current, Some(45));
        assert_eq!(receiving.total, Some(100));

        let counting = parse_fetch_line("remote: Counting objects: 42, done.");
        assert_eq!(counting.phase, "counting");
        assert_eq!(counting.current, Some(42));

        let other = parse_fetch_line("From https://example.com/repo");
        assert_eq!(other.phase, "info");
        assert!(other.message.is_some());
    }

    #[test]
    fn fresh_repo_has_no_remotes() {
        let (_dir, path) = init_repo();
        assert!(list_remotes_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn add_list_rename_remove_roundtrip() {
        let (_dir, path) = init_repo();
        let url = "https://example.com/repo.git";

        add_remote_inner(&path, "origin", url).unwrap();
        let remotes = list_remotes_inner(&path).unwrap();
        assert_eq!(remotes.len(), 1);
        assert_eq!(remotes[0].fetch_url, url);
        assert_eq!(remotes[0].push_url, url);

        rename_remote_inner(&path, "origin", "upstream").unwrap();
        let names: Vec<String> = list_remotes_inner(&path)
            .unwrap()
            .into_iter()
            .map(|r| r.name)
            .collect();
        assert_eq!(names, vec!["upstream".to_string()]);

        remove_remote_inner(&path, "upstream").unwrap();
        assert!(list_remotes_inner(&path).unwrap().is_empty());
    }

    #[test]
    fn set_url_repoints_an_existing_remote() {
        let (_dir, path) = init_repo();
        add_remote_inner(&path, "origin", "https://example.com/old.git").unwrap();

        set_remote_url_inner(&path, "origin", "https://example.com/new.git").unwrap();

        let remotes = list_remotes_inner(&path).unwrap();
        assert_eq!(remotes[0].fetch_url, "https://example.com/new.git");
        assert_eq!(remotes[0].push_url, "https://example.com/new.git");

        assert!(set_remote_url_inner(&path, "origin", "--upload-pack=calc").is_err());
        assert!(set_remote_url_inner(&path, "--foo", "https://example.com/r.git").is_err());
        assert!(set_remote_url_inner(&path, "missing", "https://example.com/r.git").is_err());
    }

    #[test]
    fn remote_names_reject_option_injection() {
        let (_dir, path) = init_repo();
        assert!(add_remote_inner(&path, "--foo", "https://example.com/r.git").is_err());
        assert!(add_remote_inner(&path, "origin", "--upload-pack=calc").is_err());
    }

    #[test]
    fn pull_mode_is_whitelisted() {
        assert!(pull_flag("merge").is_ok());
        assert!(pull_flag("rebase").is_ok());
        assert!(pull_flag("ff_only").is_ok());
        assert!(pull_flag("--exec=calc").is_err());
    }

    #[test]
    fn pull_reports_up_to_date() {
        let (_remote, _clone, path) = init_remote_and_clone();
        let result = pull_inner(&path, "origin", "main", "merge", false).unwrap();
        assert_eq!(result, PullResult::UpToDate);
    }

    #[test]
    fn pull_fast_forwards_a_remote_commit() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "remote update\n");

        let result = pull_inner(&path, "origin", "main", "merge", false).unwrap();
        assert_eq!(result, PullResult::FastForward);
    }

    #[test]
    fn pull_rebase_replays_local_commits() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "remote update\n");
        write_file(&path, "local.txt", "ours\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "ours"]);

        let result = pull_inner(&path, "origin", "main", "rebase", false).unwrap();

        assert_eq!(result, PullResult::Rebased);
        assert_eq!(
            git_ok(&path, &["log", "--format=%s", "-1"]),
            "ours",
            "the local commit must sit on top"
        );
    }

    #[test]
    fn pull_autostash_keeps_uncommitted_work() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "remote update\n");
        write_file(&path, "scratch.txt", "work in progress\n");
        git_ok(&path, &["add", "scratch.txt"]);

        let result = pull_inner(&path, "origin", "main", "merge", true).unwrap();

        assert_eq!(result, PullResult::FastForward);
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("scratch.txt")).unwrap(),
            "work in progress\n"
        );
    }

    #[test]
    fn push_reports_up_to_date() {
        let (_remote, _clone, path) = init_remote_and_clone();
        let result = push_inner(&path, "origin", "main", false, false, false).unwrap();
        assert_eq!(result, PushResult::UpToDate);
    }

    #[test]
    fn push_sends_a_new_commit() {
        let (_remote, _clone, path) = init_remote_and_clone();
        write_file(&path, "a.txt", "local\n");
        git_ok(&path, &["commit", "-am", "local"]);

        let result = push_inner(&path, "origin", "main", false, true, false).unwrap();
        assert_eq!(result, PushResult::Success);
    }

    #[test]
    fn push_rejection_is_reported_not_treated_as_auth() {
        let (remote, _clone, path) = init_remote_and_clone();
        // Advance the remote so our push is not a fast-forward.
        advance_remote(remote.path(), "theirs\n");
        write_file(&path, "a.txt", "ours\n");
        git_ok(&path, &["commit", "-am", "ours"]);

        let result = push_inner(&path, "origin", "main", false, false, false).unwrap();
        assert!(
            matches!(result, PushResult::Rejected { .. }),
            "expected Rejected, got {result:?}"
        );
    }

    #[test]
    fn pull_conflicts_list_the_unmerged_files() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "theirs\n");
        write_file(&path, "a.txt", "ours\n");
        git_ok(&path, &["commit", "-am", "ours"]);

        let result = pull_inner(&path, "origin", "main", "merge", false).unwrap();
        assert_eq!(
            result,
            PullResult::Conflicts {
                files: vec!["a.txt".to_string()]
            }
        );
    }
}
