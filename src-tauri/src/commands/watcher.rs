//! Filesystem watching: one debounced watcher per open repository.

use notify_debouncer_full::notify::{Config, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer_opt, DebounceEventResult, Debouncer, NoCache};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

use super::branches::AheadBehindCache;
use super::git::validate_repo_path;
use super::history::HistoryCache;

/// Long enough that a `git commit` (which rewrites the index, HEAD and refs in
/// quick succession) arrives as one notification instead of five.
const DEBOUNCE: Duration = Duration::from_millis(400);

const IGNORED_DIRS: &[&str] = &["node_modules", "target", "dist", ".angular"];

/// `NoCache` instead of the recommended cache: on Windows and macOS the latter
/// is a `FileIdMap`, whose `add_path` walks the whole worktree — `node_modules`,
/// `target` and `.git/objects` included — to read a file id per entry. Its only
/// use is stitching rename events back together, and we classify paths, not
/// event kinds.
type RepoWatcher = Debouncer<RecommendedWatcher, NoCache>;

#[derive(Default)]
pub struct WatcherState(pub Mutex<HashMap<String, RepoWatcher>>);

/// What part of the repository a path belongs to, or `None` when the change is
/// noise the UI must not react to.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub(super) enum ChangeKind {
    Refs,
    Worktree,
    Index,
}

impl ChangeKind {
    fn as_str(self) -> &'static str {
        match self {
            ChangeKind::Refs => "refs",
            ChangeKind::Worktree => "worktree",
            ChangeKind::Index => "index",
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct RepoChangedPayload {
    /// The watched repository, so the UI knows which workspace to refresh.
    path: String,
    kind: &'static str,
}

/// Classify one changed path relative to the watched repository root.
pub(super) fn classify(repo: &str, changed: &str) -> Option<ChangeKind> {
    let repo = repo.replace('\\', "/");
    let changed = changed.replace('\\', "/");
    let relative = changed
        .strip_prefix(&repo)
        .map(|r| r.trim_start_matches('/'))
        .unwrap_or(&changed);

    // Lock files churn constantly while git works and never carry new state.
    if relative.ends_with(".lock") {
        return None;
    }

    if let Some(inside_git) = relative
        .strip_prefix(".git/")
        .or_else(|| relative.strip_prefix(".git"))
    {
        let inside_git = inside_git.trim_start_matches('/');
        // Loose and packed objects are written before the ref that makes them
        // reachable; reacting to them would refresh once per object.
        if inside_git.starts_with("objects/") {
            return None;
        }
        if inside_git == "index" {
            return Some(ChangeKind::Index);
        }
        if inside_git.starts_with("refs/")
            || inside_git.starts_with("logs/")
            || inside_git == "HEAD"
            || inside_git == "packed-refs"
            || inside_git == "MERGE_HEAD"
            || inside_git == "CHERRY_PICK_HEAD"
            || inside_git == "REVERT_HEAD"
            || inside_git.starts_with("rebase-merge")
            || inside_git.starts_with("rebase-apply")
        {
            return Some(ChangeKind::Refs);
        }
        return None;
    }

    if relative.split('/').any(|part| IGNORED_DIRS.contains(&part)) {
        return None;
    }
    Some(ChangeKind::Worktree)
}

/// Start watching `path`; watching an already-watched repository is a no-op.
#[tauri::command]
pub async fn watch_repo(
    app: AppHandle,
    path: String,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    validate_repo_path(&path)?;

    {
        let watchers = state.0.lock().map_err(|e| e.to_string())?;
        if watchers.contains_key(&path) {
            return Ok(());
        }
    }

    let repo_path = path.clone();
    let mut debouncer = new_debouncer_opt::<_, RecommendedWatcher, NoCache>(
        DEBOUNCE,
        None,
        move |result: DebounceEventResult| {
            let Ok(events) = result else {
                return;
            };
            // One event per kind per batch: a rebase touches hundreds of files
            // but the UI only needs to know "refs changed" once.
            let kinds: HashSet<ChangeKind> = events
                .iter()
                .flat_map(|event| event.paths.iter())
                .filter_map(|p| classify(&repo_path, &p.to_string_lossy()))
                .collect();

            for kind in kinds {
                let _ = app.emit(
                    "repo-changed",
                    RepoChangedPayload {
                        path: repo_path.clone(),
                        kind: kind.as_str(),
                    },
                );
            }
        },
        NoCache::new(),
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path, debouncer);
    Ok(())
}

/// Stop watching `path` and drop everything cached for it.
///
/// The locks are taken one after the other, never nested, so this cannot
/// deadlock against a page or a branch listing being served.
#[tauri::command]
pub async fn unwatch_repo(
    path: String,
    state: State<'_, WatcherState>,
    history: State<'_, HistoryCache>,
    ahead_behind: State<'_, AheadBehindCache>,
) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.remove(&path);
    history.evict(&path);
    ahead_behind.evict(&path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPO: &str = "C:/code/YoruMerge";

    #[test]
    fn ref_updates_are_reported_as_refs() {
        for path in [
            "C:/code/YoruMerge/.git/refs/heads/main",
            "C:\\code\\YoruMerge\\.git\\HEAD",
            "C:/code/YoruMerge/.git/packed-refs",
            "C:/code/YoruMerge/.git/logs/HEAD",
            "C:/code/YoruMerge/.git/rebase-merge/done",
        ] {
            assert_eq!(classify(REPO, path), Some(ChangeKind::Refs), "{path}");
        }
    }

    #[test]
    fn the_index_has_its_own_kind() {
        assert_eq!(
            classify(REPO, "C:/code/YoruMerge/.git/index"),
            Some(ChangeKind::Index)
        );
    }

    #[test]
    fn work_tree_files_are_reported_as_worktree() {
        assert_eq!(
            classify(REPO, "C:/code/YoruMerge/src/señal ñ.ts"),
            Some(ChangeKind::Worktree)
        );
    }

    #[test]
    fn noise_is_dropped() {
        for path in [
            "C:/code/YoruMerge/.git/objects/ab/cdef",
            "C:/code/YoruMerge/.git/index.lock",
            "C:/code/YoruMerge/.git/refs/heads/main.lock",
            "C:/code/YoruMerge/node_modules/left-pad/index.js",
            "C:/code/YoruMerge/src-tauri/target/debug/build.rs",
            "C:/code/YoruMerge/dist/main.js",
            "C:/code/YoruMerge/.angular/cache/x",
            "C:/code/YoruMerge/.git/COMMIT_EDITMSG",
        ] {
            assert_eq!(classify(REPO, path), None, "{path}");
        }
    }
}
