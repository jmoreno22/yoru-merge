//! Filesystem watching: one debounced watcher per open repository.

use notify_debouncer_full::notify::event::{EventKind, ModifyKind};
use notify_debouncer_full::notify::{Config, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{
    new_debouncer_opt, DebounceEventResult, DebouncedEvent, Debouncer, NoCache,
};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

use super::branches::AheadBehindCache;
use super::git::{blocking, validate_repo_path};
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
type RepoWatcher = Debouncer<FsWatcher, NoCache>;

/// Only inotify needs one watch per directory; ReadDirectoryChangesW and
/// FSEvents watch a whole tree through one handle, so filtering buys nothing.
#[cfg(target_os = "linux")]
type FsWatcher = filtered::FilteredWatcher<RecommendedWatcher>;
#[cfg(not(target_os = "linux"))]
type FsWatcher = RecommendedWatcher;

#[derive(Default)]
pub struct WatcherState(Mutex<HashMap<String, RepoWatcher>>);

/// What part of the repository a path belongs to, or `None` when the change is
/// noise the UI must not react to.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub(super) enum ChangeKind {
    Refs,
    Worktree,
    Index,
    /// `refs/stash`, which no history scope walks.
    Stash,
    /// `.git/config`, where the remotes live.
    Config,
}

impl ChangeKind {
    fn as_str(self) -> &'static str {
        match self {
            ChangeKind::Refs => "refs",
            ChangeKind::Worktree => "worktree",
            ChangeKind::Index => "index",
            ChangeKind::Stash => "stash",
            ChangeKind::Config => "config",
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct RepoChangedPayload {
    /// The watched repository, so the UI knows which workspace to refresh.
    path: String,
    kind: &'static str,
}

#[derive(Clone, serde::Serialize)]
struct RepoWatchErrorPayload {
    path: String,
    message: String,
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
        if inside_git == "refs/stash" || inside_git == "logs/refs/stash" {
            return Some(ChangeKind::Stash);
        }
        if inside_git == "config" {
            return Some(ChangeKind::Config);
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

/// The kinds one debounced batch touched, each once however many paths it held.
///
/// Reads are dropped before classifying: inotify reports every `open()`, so a
/// `git status` in a terminal or an editor reading a file would otherwise
/// refresh the whole UI. So is a directory that was only modified: NTFS
/// reports the first listing of a directory each hour as a change to it (its
/// last-access time), and a real change inside one always arrives as an event
/// on the file itself.
fn changed_kinds(repo: &str, events: &[DebouncedEvent]) -> HashSet<ChangeKind> {
    events
        .iter()
        .filter(|event| !matches!(event.kind, EventKind::Access(_)))
        .flat_map(|event| {
            let dir_touch = matches!(event.kind, EventKind::Modify(kind) if !matches!(kind, ModifyKind::Name(_)));
            event
                .paths
                .iter()
                .filter(move |p| !(dir_touch && p.is_dir()))
        })
        .filter_map(|p| classify(repo, &p.to_string_lossy()))
        .collect()
}

/// A recursive watch that leaves out what `classify` would drop anyway plus
/// everything `.gitignore` hides. inotify needs one watch per directory, and
/// notify's own recursive mode walks `node_modules`, `target` and
/// `.git/objects` too, which is what exhausts `max_user_watches` on a monorepo.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod filtered {
    use notify_debouncer_full::notify::event::{EventKind, ModifyKind};
    use notify_debouncer_full::notify::{
        self, Config, ErrorKind, Event, EventHandler, RecursiveMode, Watcher, WatcherKind,
    };
    use std::collections::HashSet;
    use std::path::{Path, PathBuf};
    use std::sync::{mpsc, Arc, Mutex, MutexGuard, OnceLock};

    use super::IGNORED_DIRS;
    use crate::commands::git::{git_path, GitCmd};

    pub(super) fn is_skipped(root: &Path, dir: &Path, ignored: &HashSet<PathBuf>) -> bool {
        let Some(name) = dir.file_name().and_then(|n| n.to_str()) else {
            return false;
        };
        IGNORED_DIRS.contains(&name)
            || (name == "objects" && dir.parent() == Some(root.join(".git").as_path()))
            || ignored.contains(dir)
    }

    /// The ignored directories of the work tree: only the outermost one of
    /// each ignored tree, so the list stays short.
    ///
    /// `ls-files --directory` also lists a directory that merely holds nothing
    /// but ignored files today; `check-ignore` keeps only those a pattern
    /// matches, so a file added there later is still seen.
    pub(super) fn gitignored_dirs(root: &Path) -> HashSet<PathBuf> {
        let repo = git_path(root);
        let listed = GitCmd::in_repo(&repo)
            .args([
                "ls-files",
                "-z",
                "--others",
                "--ignored",
                "--exclude-standard",
                "--directory",
            ])
            .run()
            .unwrap_or_default();
        let candidates: String = listed
            .split('\0')
            .filter(|entry| entry.ends_with('/'))
            .flat_map(|dir| [dir, "\0"])
            .collect();
        if candidates.is_empty() {
            return HashSet::new();
        }
        // Exits 1 when nothing matches, which reads as "no ignored directory".
        GitCmd::in_repo(&repo)
            .args(["check-ignore", "--stdin", "-z"])
            .run_with_stdin(candidates.as_bytes())
            .unwrap_or_default()
            .split('\0')
            .filter_map(|entry| entry.strip_suffix('/'))
            .map(|dir| root.join(dir))
            .collect()
    }

    /// A directory created after the watch started that `.gitignore` hides,
    /// such as a build output folder.
    pub(super) fn is_newly_ignored(root: &Path, dir: &Path) -> bool {
        GitCmd::in_repo(&git_path(root))
            .args(["check-ignore", "-q", "--"])
            .arg(git_path(dir))
            .succeeds()
    }

    /// Hands `watch` every directory under `top` that is not skipped, `top`
    /// first. Symlinks are not followed: git records them as links, and
    /// following one can leave the repository or loop.
    pub(super) fn walk_watchable(
        root: &Path,
        top: &Path,
        ignored: &HashSet<PathBuf>,
        mut watch: impl FnMut(&Path) -> notify::Result<()>,
    ) -> notify::Result<()> {
        let mut pending = vec![top.to_path_buf()];
        while let Some(dir) = pending.pop() {
            match watch(&dir) {
                Ok(()) => {}
                Err(e) if dir == top || matches!(e.kind, ErrorKind::MaxFilesWatch) => {
                    return Err(e)
                }
                // Removed between being listed and being watched.
                Err(_) => continue,
            }
            let Ok(entries) = std::fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                if entry.file_type().is_ok_and(|t| t.is_dir()) {
                    let path = entry.path();
                    if !is_skipped(root, &path, ignored) {
                        pending.push(path);
                    }
                }
            }
        }
        Ok(())
    }

    struct Tree {
        root: PathBuf,
        ignored: HashSet<PathBuf>,
    }

    /// One non-recursive watch per directory that is not skipped. Directories
    /// created later are added by a helper thread, because the inner watcher
    /// cannot be called from inside its own event handler.
    pub(crate) struct FilteredWatcher<W: Watcher> {
        inner: Arc<Mutex<W>>,
        tree: Arc<OnceLock<Tree>>,
    }

    fn lock<W>(inner: &Mutex<W>) -> notify::Result<MutexGuard<'_, W>> {
        inner
            .lock()
            .map_err(|_| notify::Error::generic("watcher lock poisoned"))
    }

    impl<W: Watcher + Send + 'static> Watcher for FilteredWatcher<W> {
        fn new<F: EventHandler>(handler: F, config: Config) -> notify::Result<Self> {
            let handler = Arc::new(Mutex::new(handler));
            let (created_tx, created_rx) = mpsc::channel::<PathBuf>();
            let forward = Arc::clone(&handler);
            let inner = W::new(
                move |event: notify::Result<Event>| {
                    if let Ok(event) = &event {
                        if matches!(
                            event.kind,
                            EventKind::Create(_) | EventKind::Modify(ModifyKind::Name(_))
                        ) {
                            for path in &event.paths {
                                let _ = created_tx.send(path.clone());
                            }
                        }
                    }
                    if let Ok(mut handler) = forward.lock() {
                        handler.handle_event(event);
                    }
                },
                config,
            )?;
            let inner = Arc::new(Mutex::new(inner));
            let tree = Arc::new(OnceLock::<Tree>::new());

            let weak_inner = Arc::downgrade(&inner);
            let thread_tree = Arc::clone(&tree);
            std::thread::Builder::new()
                .name("repo watch: new directories".into())
                .spawn(move || {
                    // Ends once the inner watcher, and with it the sender its
                    // handler owns, is dropped.
                    for dir in created_rx {
                        let Some(tree) = thread_tree.get() else {
                            continue;
                        };
                        if !dir.is_dir()
                            || !dir.starts_with(&tree.root)
                            || is_skipped(&tree.root, &dir, &tree.ignored)
                            || is_newly_ignored(&tree.root, &dir)
                        {
                            continue;
                        }
                        let Some(inner) = weak_inner.upgrade() else {
                            break;
                        };
                        let Ok(mut watcher) = inner.lock() else {
                            break;
                        };
                        let added = walk_watchable(&tree.root, &dir, &tree.ignored, |d| {
                            watcher.watch(d, RecursiveMode::NonRecursive)
                        });
                        // Anything else means the directory is already gone
                        // again, which is no news for the UI.
                        let Err(e) = added else {
                            continue;
                        };
                        if matches!(e.kind, ErrorKind::MaxFilesWatch) {
                            if let Ok(mut handler) = handler.lock() {
                                handler.handle_event(Err(e));
                            }
                        }
                    }
                })
                .map_err(notify::Error::io)?;

            Ok(Self { inner, tree })
        }

        fn watch(&mut self, path: &Path, recursive_mode: RecursiveMode) -> notify::Result<()> {
            if recursive_mode == RecursiveMode::NonRecursive {
                return lock(&self.inner)?.watch(path, recursive_mode);
            }
            let tree = Tree {
                root: path.to_path_buf(),
                ignored: gitignored_dirs(path),
            };
            // Published before walking, so a directory created mid-walk is
            // still picked up by the helper thread.
            if self.tree.set(tree).is_err() {
                return Err(notify::Error::generic(
                    "a filtered watch takes one recursive root",
                ));
            }
            let tree = self.tree.get().expect("tree was just set");
            let mut inner = lock(&self.inner)?;
            walk_watchable(&tree.root, &tree.root, &tree.ignored, |dir| {
                inner.watch(dir, RecursiveMode::NonRecursive)
            })
        }

        fn unwatch(&mut self, _path: &Path) -> notify::Result<()> {
            Err(notify::Error::generic(
                "a filtered watch is torn down by dropping it",
            ))
        }

        fn configure(&mut self, option: Config) -> notify::Result<bool> {
            lock(&self.inner)?.configure(option)
        }

        fn kind() -> WatcherKind {
            W::kind()
        }
    }
}

/// Builds the watcher for `path`. Blocking: on Linux the recursive watch walks
/// every directory and asks git for the ignored ones.
fn start_watching(app: AppHandle, path: String) -> Result<RepoWatcher, String> {
    let repo_path = path.clone();
    let mut debouncer = new_debouncer_opt::<_, FsWatcher, NoCache>(
        DEBOUNCE,
        None,
        move |result: DebounceEventResult| match result {
            Ok(events) => {
                for kind in changed_kinds(&repo_path, &events) {
                    let _ = app.emit(
                        "repo-changed",
                        RepoChangedPayload {
                            path: repo_path.clone(),
                            kind: kind.as_str(),
                        },
                    );
                }
            }
            // Above all the inotify watch limit: the UI has to know that live
            // refresh no longer covers the whole tree.
            Err(errors) => {
                let message = errors
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join("; ");
                let _ = app.emit(
                    "repo-watch-error",
                    RepoWatchErrorPayload {
                        path: repo_path.clone(),
                        message,
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
    Ok(debouncer)
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

    let debouncer = blocking({
        let path = path.clone();
        move || start_watching(app, path)
    })
    .await?;

    // Two calls racing through the setup keep the first watcher.
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .entry(path)
        .or_insert(debouncer);
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
    use super::filtered::*;
    use super::*;
    use crate::commands::git::git_path;
    use crate::commands::git::test_support::{init_repo, write_file};
    use notify_debouncer_full::notify::event::{AccessKind, AccessMode, CreateKind, ModifyKind};
    use notify_debouncer_full::notify::{self, Event, Watcher};
    use std::sync::mpsc;
    use std::time::Instant;

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
    fn the_stash_and_the_config_have_their_own_kinds() {
        for path in [
            "C:/code/YoruMerge/.git/refs/stash",
            "C:/code/YoruMerge/.git/logs/refs/stash",
        ] {
            assert_eq!(classify(REPO, path), Some(ChangeKind::Stash), "{path}");
        }
        assert_eq!(
            classify(REPO, "C:/code/YoruMerge/.git/config"),
            Some(ChangeKind::Config)
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
            "C:/code/YoruMerge/.git/config.lock",
            "C:/code/YoruMerge/node_modules/left-pad/index.js",
            "C:/code/YoruMerge/src-tauri/target/debug/build.rs",
            "C:/code/YoruMerge/dist/main.js",
            "C:/code/YoruMerge/.angular/cache/x",
            "C:/code/YoruMerge/.git/COMMIT_EDITMSG",
        ] {
            assert_eq!(classify(REPO, path), None, "{path}");
        }
    }

    fn debounced(kind: EventKind, path: &str) -> DebouncedEvent {
        DebouncedEvent::new(Event::new(kind).add_path(path.into()), Instant::now())
    }

    #[test]
    fn reads_never_count_as_changes() {
        let events = [
            debounced(
                EventKind::Access(AccessKind::Open(AccessMode::Any)),
                "C:/code/YoruMerge/.git/index",
            ),
            debounced(
                EventKind::Access(AccessKind::Close(AccessMode::Read)),
                "C:/code/YoruMerge/src/main.ts",
            ),
        ];
        assert!(changed_kinds(REPO, &events).is_empty());
    }

    #[test]
    fn a_directory_whose_metadata_changed_is_not_a_change() {
        let root = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir_all(root.path().join(".git/refs/heads")).expect("refs");
        std::fs::create_dir_all(root.path().join("src")).expect("src");
        std::fs::write(root.path().join("src/a.ts"), "a").expect("file");
        let repo = root.path().to_string_lossy().to_string();
        let at = |relative: &str| root.path().join(relative).to_string_lossy().to_string();

        let touched = [
            debounced(EventKind::Modify(ModifyKind::Any), &at(".git/refs/heads")),
            debounced(EventKind::Modify(ModifyKind::Any), &at("src")),
        ];
        assert!(changed_kinds(&repo, &touched).is_empty());

        let real = [
            debounced(EventKind::Modify(ModifyKind::Any), &at("src")),
            debounced(EventKind::Modify(ModifyKind::Any), &at("src/a.ts")),
            debounced(
                EventKind::Create(CreateKind::Folder),
                &at(".git/refs/heads"),
            ),
        ];
        assert_eq!(
            changed_kinds(&repo, &real),
            HashSet::from([ChangeKind::Worktree, ChangeKind::Refs])
        );
    }

    #[test]
    fn a_batch_reports_each_kind_once() {
        let events = [
            debounced(
                EventKind::Access(AccessKind::Open(AccessMode::Any)),
                "C:/code/YoruMerge/.git/HEAD",
            ),
            debounced(
                EventKind::Create(CreateKind::File),
                "C:/code/YoruMerge/a.ts",
            ),
            debounced(EventKind::Modify(ModifyKind::Any), "C:/code/YoruMerge/b.ts"),
            debounced(
                EventKind::Modify(ModifyKind::Any),
                "C:/code/YoruMerge/.git/index",
            ),
        ];
        assert_eq!(
            changed_kinds(REPO, &events),
            HashSet::from([ChangeKind::Worktree, ChangeKind::Index])
        );
    }

    /// Every directory the walk would watch, relative to `root`, sorted.
    fn watched_dirs(root: &Path) -> Vec<String> {
        let ignored = gitignored_dirs(root);
        let mut dirs = Vec::new();
        walk_watchable(root, root, &ignored, |dir| {
            let relative = dir.strip_prefix(root).expect("inside the root");
            dirs.push(git_path(relative));
            Ok(())
        })
        .expect("walk");
        dirs.sort();
        dirs
    }

    #[test]
    fn the_walk_skips_heavy_and_gitignored_directories() {
        let (_dir, repo) = init_repo();
        write_file(&repo, ".gitignore", "build/\n*.log\n");
        write_file(&repo, "src/señal ñ/a.ts", "a");
        write_file(&repo, "node_modules/pkg/index.js", "x");
        write_file(&repo, "build/out/main.js", "x");
        write_file(&repo, "logs/today.log", "x");

        let dirs = watched_dirs(Path::new(&repo));

        for expected in ["", ".git", ".git/refs/heads", "src", "src/señal ñ", "logs"] {
            assert!(
                dirs.contains(&expected.to_string()),
                "{expected} in {dirs:?}"
            );
        }
        for skipped in ["node_modules", "build", ".git/objects"] {
            assert!(
                !dirs
                    .iter()
                    .any(|d| d == skipped || d.starts_with(&format!("{skipped}/"))),
                "{skipped} in {dirs:?}"
            );
        }
    }

    #[test]
    fn a_new_ignored_directory_is_recognised() {
        let (_dir, repo) = init_repo();
        write_file(&repo, ".gitignore", "coverage/\n");
        write_file(&repo, "coverage/x.json", "{}");
        write_file(&repo, "src/x.ts", "x");
        let root = Path::new(&repo);
        assert!(is_newly_ignored(root, &root.join("coverage")));
        assert!(!is_newly_ignored(root, &root.join("src")));
    }

    /// Waits for an event naming `wanted`, keeping every event received.
    fn wait_for(
        rx: &mpsc::Receiver<notify::Result<Event>>,
        seen: &mut Vec<Event>,
        wanted: &Path,
        wait: Duration,
    ) -> bool {
        let deadline = Instant::now() + wait;
        while let Some(left) = deadline.checked_duration_since(Instant::now()) {
            match rx.recv_timeout(left) {
                Ok(Ok(event)) => {
                    let found = event.paths.iter().any(|p| p == wanted);
                    seen.push(event);
                    if found {
                        return true;
                    }
                }
                Ok(Err(_)) => {}
                Err(_) => return false,
            }
        }
        false
    }

    /// Runs the inotify code path on whatever platform the tests run on: the
    /// wrapper only asks its inner watcher for non-recursive watches.
    #[test]
    fn the_filtered_watch_follows_new_directories_and_skips_ignored_ones() {
        let (_dir, repo) = init_repo();
        write_file(&repo, "node_modules/pkg/index.js", "x");
        write_file(&repo, "src/a.ts", "a");
        let root = Path::new(&repo);

        let (tx, rx) = mpsc::channel();
        let mut watcher =
            FilteredWatcher::<RecommendedWatcher>::new(tx, Config::default()).expect("watcher");
        watcher
            .watch(root, RecursiveMode::Recursive)
            .expect("watch");

        let mut seen = Vec::new();
        let skipped = root.join("node_modules").join("pkg").join("index.js");
        std::fs::write(&skipped, "changed").expect("write skipped");
        let watched = root.join("src").join("a.ts");
        std::fs::write(&watched, "changed").expect("write watched");
        assert!(
            wait_for(&rx, &mut seen, &watched, Duration::from_secs(5)),
            "src/a.ts was not reported"
        );

        std::fs::create_dir(root.join("fresh")).expect("create dir");
        // The helper thread adds the new watch asynchronously; keep writing
        // until the file inside the new directory is reported.
        let inside = root.join("fresh").join("b.ts");
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut reported = false;
        while !reported && Instant::now() < deadline {
            std::fs::write(&inside, "b").expect("write inside new dir");
            reported = wait_for(&rx, &mut seen, &inside, Duration::from_millis(500));
        }
        assert!(
            reported,
            "a directory created after the watch is not followed"
        );

        drop(watcher);
        seen.extend(rx.try_iter().flatten());
        assert!(
            seen.iter().all(|e| !e.paths.contains(&skipped)),
            "a skipped directory was watched: {seen:?}"
        );
    }
}
