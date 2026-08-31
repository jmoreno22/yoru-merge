//! Opening, cloning and remembering repositories.

use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::path::Path;
use std::process::{Child, ChildStderr, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;
use tauri_plugin_store::StoreExt;

use super::git::{blocking, validate_ref, validate_repo_path, validate_url, GitCmd};
use super::git_auth::{auth_error_message, is_auth_error};
use super::remote::{done_event, parse_fetch_line};
use crate::models::{FetchProgress, RepoInfo};

/// Store file and key holding the recent-repository list. Shared with the
/// `remove_recent_repo` command so both sides read the same list.
pub const RECENTS_FILE: &str = "recents.json";
pub const RECENTS_KEY: &str = "repos";
const RECENTS_LIMIT: usize = 10;

/// Marker the UI matches to tell a cancelled clone apart from a real failure.
const CLONE_CANCELED: &str = "clone canceled";

type RunningClones = Mutex<HashMap<String, Child>>;

/// Clones that can still be cancelled, keyed by the id the UI generated.
///
/// The child process is *moved* into the map while it runs, so whichever side
/// takes it back out owns it: that is also how the cloning thread learns it was
/// cancelled instead of having failed.
#[derive(Default)]
pub struct CloneState(pub Arc<RunningClones>);

/// An entry in the recently-opened repositories list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoEntry {
    pub path: String,
    pub name: String,
    pub last_opened: String,
}

/// Repository name derived from its root, with the `.git` suffix of a bare
/// repository stripped.
fn repo_name(root: &str) -> String {
    let trimmed = root.trim_end_matches('/');
    let last = trimmed.rsplit('/').next().unwrap_or(trimmed);
    last.strip_suffix(".git").unwrap_or(last).to_string()
}

pub(super) fn open_repo_inner(path: &str) -> Result<RepoInfo, String> {
    validate_repo_path(path)?;

    let probe = GitCmd::in_repo(path)
        .args(["rev-parse", "--is-bare-repository"])
        .output()?;
    if !probe.status.success() {
        return Err("not a git repository".to_string());
    }
    let is_bare = String::from_utf8_lossy(&probe.stdout).trim() == "true";

    // Any subdirectory of a work tree opens the repository it belongs to.
    let root_arg = if is_bare {
        "--absolute-git-dir"
    } else {
        "--show-toplevel"
    };
    let root = GitCmd::in_repo(path)
        .args(["rev-parse", root_arg])
        .run()?
        .trim_end_matches(['\r', '\n'])
        .to_string();
    if root.is_empty() {
        return Err("not a git repository".to_string());
    }

    let current_branch = GitCmd::in_repo(&root)
        .args(["branch", "--show-current"])
        .run()
        .ok()
        .map(|s| s.trim_end_matches(['\r', '\n']).to_string())
        .filter(|s| !s.is_empty());

    let is_clean = if is_bare {
        true
    } else {
        GitCmd::in_repo(&root)
            .args(["status", "--porcelain"])
            .run()
            .map(|s| s.trim().is_empty())
            .unwrap_or(false)
    };

    Ok(RepoInfo {
        name: repo_name(&root),
        path: root,
        current_branch,
        is_clean,
        is_bare,
    })
}

/// Open a local repository from any path inside it.
#[tauri::command]
pub async fn open_repo(path: String) -> Result<RepoInfo, String> {
    blocking(move || open_repo_inner(&path)).await
}

// ── Cloning ───────────────────────────────────────────────────────────────────

/// `git clone` as a raw [`Command`].
///
/// [`GitCmd`] owns every child it spawns, but cancelling a clone needs that
/// handle, so its hardened environment is reproduced here instead.
fn clone_command() -> Command {
    let mut cmd = Command::new("git");
    cmd.args(["-c", "core.quotePath=false", "clone", "--progress"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_PAGER", "cat")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: a GUI app must never flash a console.
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

/// Forward every `--progress` line, returning the last few as the error message.
///
/// Git writes progress to stderr and separates in-place updates with `\r`
/// rather than `\n`, so both are treated as line terminators.
fn stream_progress(mut stderr: ChildStderr, on_progress: &Channel<FetchProgress>) -> String {
    const TAIL_LINES: usize = 8;

    let mut pending: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 4096];
    let mut tail: VecDeque<String> = VecDeque::with_capacity(TAIL_LINES);
    let emit = |line: &str, tail: &mut VecDeque<String>| {
        if line.is_empty() {
            return;
        }
        if tail.len() == TAIL_LINES {
            tail.pop_front();
        }
        tail.push_back(line.to_string());
        on_progress.send(parse_fetch_line(line)).ok();
    };

    while let Ok(read) = stderr.read(&mut chunk) {
        if read == 0 {
            break;
        }
        pending.extend_from_slice(&chunk[..read]);
        while let Some(pos) = pending.iter().position(|&b| b == b'\n' || b == b'\r') {
            let line: Vec<u8> = pending.drain(..=pos).collect();
            let text = String::from_utf8_lossy(&line[..line.len() - 1]);
            emit(text.trim(), &mut tail);
        }
    }
    let rest = String::from_utf8_lossy(&pending).trim().to_string();
    emit(&rest, &mut tail);

    Vec::from(tail).join("\n")
}

/// Run `cmd`, keeping the child cancellable under `clone_id` while it works.
///
/// The child is always reaped, but by whichever side owns it at the time: this
/// function when the clone runs to completion, [`cancel_clone_inner`] when it
/// is killed. Clippy cannot follow the handle through the registry.
#[allow(clippy::zombie_processes)]
fn run_clone(
    mut cmd: Command,
    clone_id: Option<&str>,
    running: &RunningClones,
    on_progress: &Channel<FetchProgress>,
) -> Result<(), String> {
    let mut child = cmd.spawn().map_err(|e| format!("failed to run git: {e}"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "git produced no output stream".to_string())?;

    let mut owned = Some(child);
    if let Some(id) = clone_id {
        let child = owned.take().expect("the child was just spawned");
        running
            .lock()
            .map_err(|e| e.to_string())?
            .insert(id.to_string(), child);
    }

    // The lock is never held while the transfer runs.
    let tail = stream_progress(stderr, on_progress);

    let taken = match clone_id {
        Some(id) => running.lock().map_err(|e| e.to_string())?.remove(id),
        None => owned.take(),
    };
    let Some(mut child) = taken else {
        // `cancel_clone` took the child out of the registry and killed it.
        return Err(CLONE_CANCELED.to_string());
    };

    let status = child
        .wait()
        .map_err(|e| format!("failed to wait for git: {e}"))?;
    if status.success() {
        on_progress.send(done_event()).ok();
        return Ok(());
    }

    let message = if tail.is_empty() {
        "git command failed".to_string()
    } else {
        tail
    };
    if is_auth_error(&message) {
        return Err(auth_error_message(&message));
    }
    Err(message)
}

fn cancel_clone_inner(running: &RunningClones, clone_id: &str) -> Result<bool, String> {
    let taken = running.lock().map_err(|e| e.to_string())?.remove(clone_id);
    let Some(mut child) = taken else {
        return Ok(false);
    };
    child.kill().ok();
    // Reaped here because the cloning thread no longer owns the child.
    child.wait().ok();
    Ok(true)
}

/// Clone `url` into `dest`, streaming transfer progress to the UI.
///
/// Passing a `clone_id` makes the transfer cancellable through
/// [`cancel_clone`]; a cancelled clone fails with [`CLONE_CANCELED`].
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn clone_repo(
    url: String,
    dest: String,
    depth: Option<u32>,
    branch: Option<String>,
    recursive: bool,
    clone_id: Option<String>,
    on_progress: Channel<FetchProgress>,
    state: State<'_, CloneState>,
) -> Result<(), String> {
    let running = state.0.clone();
    blocking(move || {
        validate_url(&url)?;
        if dest.trim().is_empty() || dest.starts_with('-') {
            return Err("invalid destination path".to_string());
        }
        if let Some(name) = &branch {
            validate_ref(name)?;
        }

        let mut cmd = clone_command();
        if let Some(depth) = depth.filter(|d| *d > 0) {
            cmd.arg(format!("--depth={depth}"))
                .arg("--no-single-branch");
        }
        if let Some(name) = &branch {
            cmd.arg("--branch").arg(name);
        }
        if recursive {
            cmd.arg("--recurse-submodules");
        }
        cmd.arg(&url).arg(&dest);

        let dest_existed = Path::new(&dest).exists();
        let result = run_clone(cmd, clone_id.as_deref(), &running, &on_progress);

        // A killed git leaves a half-written checkout behind; only the directory
        // this clone created may be removed.
        if !dest_existed && matches!(&result, Err(message) if message == CLONE_CANCELED) {
            std::fs::remove_dir_all(&dest).ok();
        }
        result
    })
    .await
}

/// Kill the clone registered under `clone_id`; `false` when none is running.
#[tauri::command]
pub async fn cancel_clone(clone_id: String, state: State<'_, CloneState>) -> Result<bool, String> {
    cancel_clone_inner(&state.0, &clone_id)
}

// ── Recent repositories ───────────────────────────────────────────────────────

fn load_recents(app: &tauri::AppHandle) -> Result<Vec<RepoEntry>, String> {
    let store = app.store(RECENTS_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(RECENTS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

fn save_recents(app: &tauri::AppHandle, mut repos: Vec<RepoEntry>) -> Result<(), String> {
    repos.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
    repos.truncate(RECENTS_LIMIT);

    let store = app.store(RECENTS_FILE).map_err(|e| e.to_string())?;
    store.set(
        RECENTS_KEY,
        serde_json::to_value(&repos).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

/// Recently opened repositories, newest first.
#[tauri::command]
pub async fn get_recent_repos(app: tauri::AppHandle) -> Result<Vec<RepoEntry>, String> {
    let mut repos = load_recents(&app)?;
    repos.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
    repos.truncate(RECENTS_LIMIT);
    Ok(repos)
}

/// Insert or refresh a repository in the recents list.
#[tauri::command]
pub async fn add_recent_repo(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut repos = load_recents(&app)?;
    let name = repo_name(&path.replace('\\', "/"));
    let last_opened = chrono::Utc::now().to_rfc3339();

    match repos.iter_mut().find(|r| r.path == path) {
        Some(existing) => {
            existing.last_opened = last_opened;
            existing.name = name;
        }
        None => repos.push(RepoEntry {
            path,
            name,
            last_opened,
        }),
    }
    save_recents(&app, repos)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::git_path;
    use crate::commands::git::test_support::{git_ok, init_remote_and_clone, init_repo};
    use std::path::Path;

    fn silent_channel() -> Channel<FetchProgress> {
        Channel::new(|_| Ok(()))
    }

    #[test]
    fn missing_path_uses_the_exact_message_the_ui_matches() {
        let err = open_repo_inner("/definitely/not/here").unwrap_err();
        assert_eq!(err, "path does not exist");
    }

    #[test]
    fn a_plain_directory_is_not_a_repository() {
        let dir = tempfile::TempDir::new().unwrap();
        let err = open_repo_inner(dir.path().to_str().unwrap()).unwrap_err();
        assert!(err.contains("not a git repository"), "got: {err}");
    }

    #[test]
    fn opens_from_a_subdirectory_and_reports_the_root() {
        let (_dir, path) = init_repo();
        std::fs::create_dir_all(Path::new(&path).join("nested/deep")).unwrap();

        let sub = format!("{path}/nested/deep");
        let info = open_repo_inner(&sub).unwrap();

        assert_eq!(info.current_branch.as_deref(), Some("main"));
        assert!(info.is_clean);
        assert!(!info.is_bare);
        // The reported root is the work tree, not the subdirectory we opened.
        assert!(!info.path.replace('\\', "/").ends_with("nested/deep"));
    }

    #[test]
    fn ampersands_and_spaces_in_the_path_are_accepted() {
        let (_dir, path) = init_repo();
        let nested = Path::new(&path).join("Tom & Jerry");
        std::fs::create_dir_all(&nested).unwrap();

        let info = open_repo_inner(nested.to_str().unwrap()).unwrap();
        assert_eq!(info.name, repo_name(&info.path));
    }

    #[test]
    fn a_bare_repository_is_reported_as_bare() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("thing.git");
        let out = std::process::Command::new("git")
            .args(["init", "--bare", "-b", "main"])
            .arg(&path)
            .output()
            .unwrap();
        assert!(out.status.success());

        let info = open_repo_inner(path.to_str().unwrap()).unwrap();
        assert!(info.is_bare);
        assert!(info.is_clean);
        assert_eq!(info.name, "thing");
    }

    #[test]
    fn a_dirty_work_tree_is_not_clean() {
        let (_dir, path) = init_repo();
        std::fs::write(Path::new(&path).join("a.txt"), "dirty\n").unwrap();
        assert!(!open_repo_inner(&path).unwrap().is_clean);
    }

    #[test]
    fn an_unborn_head_reports_the_default_branch() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().to_str().unwrap().to_string();
        let out = std::process::Command::new("git")
            .args(["init", "-b", "main"])
            .arg(&path)
            .output()
            .unwrap();
        assert!(out.status.success());
        git_ok(&path, &["config", "user.email", "t@example.com"]);

        let info = open_repo_inner(&path).unwrap();
        assert_eq!(info.current_branch.as_deref(), Some("main"));
    }

    #[test]
    fn canceling_an_unknown_clone_reports_false() {
        assert!(!cancel_clone_inner(&RunningClones::default(), "nope").unwrap());
    }

    #[test]
    fn a_finished_clone_deregisters_itself() {
        let (remote, _clone, _path) = init_remote_and_clone();
        let dest = tempfile::TempDir::new().unwrap();
        let target = git_path(&dest.path().join("fresh"));
        let running = RunningClones::default();

        let mut cmd = clone_command();
        cmd.arg(git_path(remote.path())).arg(&target);
        run_clone(cmd, Some("job-1"), &running, &silent_channel()).unwrap();

        assert!(Path::new(&target).join(".git").exists());
        assert!(running.lock().unwrap().is_empty());
    }

    #[test]
    fn canceling_a_registered_clone_kills_and_removes_it() {
        let dest = tempfile::TempDir::new().unwrap();
        let mut cmd = clone_command();
        cmd.arg(git_path(&dest.path().join("missing-source")))
            .arg(git_path(&dest.path().join("target")));
        let child = cmd.spawn().unwrap();

        let running = RunningClones::default();
        running.lock().unwrap().insert("job-1".to_string(), child);

        assert!(cancel_clone_inner(&running, "job-1").unwrap());
        assert!(running.lock().unwrap().is_empty());
        assert!(!cancel_clone_inner(&running, "job-1").unwrap());
    }

    #[test]
    fn a_failed_clone_surfaces_the_git_message() {
        let dest = tempfile::TempDir::new().unwrap();
        let mut cmd = clone_command();
        cmd.arg(git_path(&dest.path().join("missing-source")))
            .arg(git_path(&dest.path().join("target")));

        let err = run_clone(cmd, None, &RunningClones::default(), &silent_channel()).unwrap_err();
        assert!(
            err.contains("does not exist") || err.contains("repository"),
            "got: {err}"
        );
    }

    #[test]
    fn repo_name_strips_the_bare_suffix() {
        assert_eq!(repo_name("C:/code/YoruMerge"), "YoruMerge");
        assert_eq!(repo_name("/srv/git/thing.git"), "thing");
        assert_eq!(repo_name("/srv/git/thing/"), "thing");
    }
}
