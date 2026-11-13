//! Paged commit history.
//!
//! Walking the whole DAG and assigning graph lanes is what makes history
//! expensive, and both must be done over the FULL commit list for lanes to stay
//! stable while paging. Both results are therefore cached per repository and
//! scope, and invalidated when any ref (or HEAD) moves. A page is a plain slice
//! of the cached vectors, so graph row indices stay absolute: page `k` lines up
//! 1:1 with the accumulated commit array on the UI side.

use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use git2::{Oid, Reference, Repository, Revwalk, Sort};

use super::git::{validate_repo_path, validate_revision};
use crate::graph::assign_lanes;
use crate::models::{CommitInfo, GraphData, HistoryPage, RefInfo, RefType};

// ── Shared git2 helpers (also used by commit_details.rs) ─────────────────────

/// Format a git2 timestamp as ISO-8601 in the commit's own timezone.
pub(crate) fn format_git2_time(time: git2::Time) -> String {
    use chrono::{FixedOffset, TimeZone};

    let zero = || FixedOffset::east_opt(0).expect("zero offset is valid");
    let offset =
        FixedOffset::east_opt(time.offset_minutes().saturating_mul(60)).unwrap_or_else(zero);

    offset
        .timestamp_opt(time.seconds(), 0)
        .single()
        .unwrap_or_else(|| {
            zero()
                .timestamp_opt(0, 0)
                .single()
                .expect("unix epoch is valid")
        })
        .to_rfc3339()
}

fn reference_commit_oid(reference: &Reference<'_>) -> Option<Oid> {
    reference
        .peel_to_commit()
        .map(|commit| commit.id())
        .ok()
        .or_else(|| reference.target())
}

fn add_ref_info(map: &mut HashMap<Oid, Vec<RefInfo>>, oid: Oid, info: RefInfo) {
    let refs = map.entry(oid).or_default();
    let present = refs.iter().any(|existing| {
        existing.name == info.name
            && std::mem::discriminant(&existing.ref_type) == std::mem::discriminant(&info.ref_type)
    });
    if !present {
        refs.push(info);
    }
}

/// Map every commit oid to the refs pointing at it (tags peeled to their commit).
pub(crate) fn build_ref_map(repo: &Repository) -> Result<HashMap<Oid, Vec<RefInfo>>, String> {
    let mut map = HashMap::new();

    if let Ok(head) = repo.head() {
        if let (Some(oid), Some(shorthand)) = (reference_commit_oid(&head), head.shorthand().ok()) {
            add_ref_info(
                &mut map,
                oid,
                RefInfo {
                    name: shorthand.to_string(),
                    ref_type: RefType::Head,
                },
            );
        }
    }

    for reference in repo.references().map_err(|e| e.message().to_string())? {
        let reference = reference.map_err(|e| e.message().to_string())?;
        let (Some(oid), Some(name)) = (reference_commit_oid(&reference), reference.name().ok())
        else {
            continue;
        };

        let info = if let Some(short) = name.strip_prefix("refs/heads/") {
            RefInfo {
                name: short.to_string(),
                ref_type: RefType::Branch,
            }
        } else if let Some(short) = name.strip_prefix("refs/remotes/") {
            if short.ends_with("/HEAD") {
                continue;
            }
            RefInfo {
                name: short.to_string(),
                ref_type: RefType::Remote,
            }
        } else if let Some(short) = name.strip_prefix("refs/tags/") {
            RefInfo {
                name: short.to_string(),
                ref_type: RefType::Tag,
            }
        } else {
            continue;
        };

        add_ref_info(&mut map, oid, info);
    }

    Ok(map)
}

/// Build a `CommitInfo` from a git2 commit; the caller supplies the tagging.
pub(crate) fn commit_info(
    commit: &git2::Commit<'_>,
    refs: Vec<RefInfo>,
    on_current_branch: bool,
) -> CommitInfo {
    let author = commit.author();
    let sha = commit.id().to_string();
    CommitInfo {
        short_sha: sha.chars().take(7).collect(),
        sha,
        message: commit.summary().ok().flatten().unwrap_or("").to_string(),
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        date: format_git2_time(author.when()),
        parent_shas: commit.parent_ids().map(|id| id.to_string()).collect(),
        refs,
        on_current_branch,
    }
}

// ── Cache ────────────────────────────────────────────────────────────────────

/// What the walk covered; each scope is cached separately.
enum Scope {
    All,
    Head,
    Branch(String),
}

impl Scope {
    fn new(branch: Option<&str>, all: bool) -> Self {
        match (all, branch) {
            (true, _) => Scope::All,
            (false, Some(name)) => Scope::Branch(name.to_string()),
            (false, None) => Scope::Head,
        }
    }

    fn key(&self) -> String {
        match self {
            Scope::All => "*all".to_string(),
            Scope::Head => "*head".to_string(),
            Scope::Branch(name) => format!("branch:{name}"),
        }
    }
}

/// The revwalk and its lanes: what only moving a tip can invalidate.
struct Walk {
    oids: Vec<Oid>,
    /// Kept so a change of decorations alone can recompute `head_set`.
    parents: Vec<Vec<Oid>>,
    /// Lanes for the FULL walk, so paging never reshuffles the graph.
    graph: GraphData,
}

struct CachedHistory {
    walk_key: u64,
    ref_fingerprint: u64,
    /// Ticket taken when `ref_fingerprint` was read; orders concurrent builds.
    built_at: u64,
    walk: Arc<Walk>,
    head_set: HashSet<Oid>,
    ref_map: HashMap<Oid, Vec<RefInfo>>,
}

/// The walks cached for one repository, most recently used first.
type RepoScopes = Vec<(String, Arc<CachedHistory>)>;

/// A repository is browsed through one scope at a time; the spare slot keeps
/// the previous one warm while the user switches back and forth. Every entry
/// holds the whole walk, so an unbounded map would retain a repository's
/// history for the life of the process.
const SCOPES_PER_REPO: usize = 2;

#[derive(Default)]
struct CacheInner {
    scopes: Mutex<HashMap<String, RepoScopes>>,
    clock: AtomicU64,
}

/// Managed state: the cached walks per repository path and scope.
#[derive(Default, Clone)]
pub struct HistoryCache(Arc<CacheInner>);

impl HistoryCache {
    fn scopes(&self) -> Result<MutexGuard<'_, HashMap<String, RepoScopes>>, String> {
        self.0
            .scopes
            .lock()
            .map_err(|_| "history cache is unavailable".to_string())
    }

    /// Ticket ordering two builds by the moment each one read the refs.
    fn tick(&self) -> u64 {
        self.0.clock.fetch_add(1, Ordering::Relaxed)
    }

    /// The cached walk for `path`/`scope_key`, if it still starts from the same
    /// tips. Its decorations may be stale; the caller compares fingerprints.
    fn get(
        &self,
        path: &str,
        scope_key: &str,
        walk_key: u64,
    ) -> Result<Option<Arc<CachedHistory>>, String> {
        let mut scopes = self.scopes()?;
        let Some(entries) = scopes.get_mut(path) else {
            return Ok(None);
        };
        let Some(at) = entries.iter().position(|(key, _)| key == scope_key) else {
            return Ok(None);
        };
        if entries[at].1.walk_key != walk_key {
            return Ok(None);
        }
        let hit = entries.remove(at);
        let history = Arc::clone(&hit.1);
        entries.insert(0, hit);
        Ok(Some(history))
    }

    /// Publish `built` and return whichever walk ends up cached.
    ///
    /// Two threads can walk the same scope at once from different refs, and
    /// fingerprints are hashes with no order of their own — the ticket has one.
    /// The build that read the refs first saw a repository no newer than the
    /// other, so it never replaces it.
    fn store(
        &self,
        path: &str,
        scope_key: &str,
        built: Arc<CachedHistory>,
    ) -> Result<Arc<CachedHistory>, String> {
        let mut scopes = self.scopes()?;
        let entries = scopes.entry(path.to_string()).or_default();
        if let Some(at) = entries.iter().position(|(key, _)| key == scope_key) {
            if entries[at].1.built_at > built.built_at {
                let hit = entries.remove(at);
                let winner = Arc::clone(&hit.1);
                entries.insert(0, hit);
                return Ok(winner);
            }
            entries.remove(at);
        }
        entries.insert(0, (scope_key.to_string(), Arc::clone(&built)));
        entries.truncate(SCOPES_PER_REPO);
        Ok(built)
    }

    /// Forget every walk cached for `path`, whose tab is gone.
    pub fn evict(&self, path: &str) {
        if let Ok(mut scopes) = self.0.scopes.lock() {
            scopes.remove(path);
        }
    }

    /// The scope keys cached for `path`, most recently used first.
    #[cfg(test)]
    fn cached_scopes(&self, path: &str) -> Vec<String> {
        self.scopes()
            .expect("cache lock")
            .get(path)
            .map(|entries| entries.iter().map(|(key, _)| key.clone()).collect())
            .unwrap_or_default()
    }

    /// The walk cached for `path`/`scope_key`, to tell a reuse from a rebuild.
    #[cfg(test)]
    fn cached_walk(&self, path: &str, scope_key: &str) -> Option<Arc<Walk>> {
        self.scopes()
            .expect("cache lock")
            .get(path)?
            .iter()
            .find(|(key, _)| key == scope_key)
            .map(|(_, entry)| Arc::clone(&entry.walk))
    }
}

/// Cheap signature of every ref plus HEAD: what the decorations (ref badges,
/// "on the current branch") are derived from.
///
/// `refs/stash` and `refs/notes/*` are left out: no scope walks them and
/// `build_ref_map` drops them, so stashing or annotating would otherwise
/// rebuild decorations the UI never shows. Targets are hashed unpeeled, which
/// is enough because retagging rewrites the tag object too.
fn ref_fingerprint(repo: &Repository) -> u64 {
    let mut entries: Vec<(String, String)> = Vec::new();
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            let Ok(name) = reference.name() else {
                continue;
            };
            if name == "refs/stash" || name.starts_with("refs/notes/") {
                continue;
            }
            let target = reference
                .target()
                .map(|oid| oid.to_string())
                .or_else(|| {
                    reference
                        .symbolic_target()
                        .ok()
                        .flatten()
                        .map(str::to_string)
                })
                .unwrap_or_default();
            entries.push((name.to_string(), target));
        }
    }
    // `references()` gives no iteration order, so an unsorted hash would differ
    // between two identical calls and invalidate the cache on every page.
    entries.sort_unstable();

    let mut hasher = DefaultHasher::new();
    entries.hash(&mut hasher);
    let head = repo.head().ok();
    // The name is hashed too, so detaching HEAD at the same commit still counts.
    head.as_ref().and_then(|h| h.name().ok()).hash(&mut hasher);
    head.as_ref()
        .and_then(|h| h.target())
        .map(|oid| oid.to_string())
        .hash(&mut hasher);
    hasher.finish()
}

/// Signature of the commits the walk of `scope` starts from. Names are left
/// out, so a branch or tag created at a commit already walked, or a checkout
/// to one, keeps the walk and only redoes the decorations.
fn walk_key(repo: &Repository, scope: &Scope) -> u64 {
    let head = || repo.head().ok().and_then(|head| head.target());
    let mut tips: Vec<Oid> = match scope {
        Scope::All => {
            let mut tips: Vec<Oid> = repo
                .references()
                .map(|references| {
                    references
                        .flatten()
                        .filter(|r| {
                            r.name().is_ok_and(|name| {
                                name.starts_with("refs/heads/") || name.starts_with("refs/remotes/")
                            })
                        })
                        .filter_map(|r| r.target())
                        .collect()
                })
                .unwrap_or_default();
            tips.extend(head());
            tips
        }
        Scope::Head => head().into_iter().collect(),
        Scope::Branch(name) => branch_tip(repo, name).ok().into_iter().collect(),
    };
    tips.sort_unstable();
    tips.dedup();

    let mut hasher = DefaultHasher::new();
    tips.hash(&mut hasher);
    hasher.finish()
}

fn branch_tip(repo: &Repository, name: &str) -> Result<Oid, String> {
    let candidates = if name.starts_with("refs/") {
        vec![name.to_string()]
    } else {
        vec![
            format!("refs/heads/{name}"),
            format!("refs/remotes/{name}"),
            format!("refs/tags/{name}"),
        ]
    };

    for refname in candidates {
        if let Ok(reference) = repo.find_reference(&refname) {
            if let Some(oid) = reference_commit_oid(&reference) {
                return Ok(oid);
            }
        }
    }

    repo.revparse_single(name)
        .and_then(|object| object.peel_to_commit())
        .map(|commit| commit.id())
        .map_err(|_| format!("unknown revision: {name}"))
}

fn push_scope(repo: &Repository, walk: &mut Revwalk<'_>, scope: &Scope) -> Result<(), String> {
    match scope {
        Scope::All => {
            // Both are no-ops on an empty or unborn repository.
            walk.push_glob("refs/heads/*").ok();
            walk.push_glob("refs/remotes/*").ok();
            walk.push_head().ok();
            Ok(())
        }
        Scope::Head => {
            walk.push_head().ok();
            Ok(())
        }
        Scope::Branch(name) => walk
            .push(branch_tip(repo, name)?)
            .map_err(|e| e.message().to_string()),
    }
}

fn head_reachable(repo: &Repository) -> HashSet<Oid> {
    let Ok(mut walk) = repo.revwalk() else {
        return HashSet::new();
    };
    if walk.push_head().is_err() {
        return HashSet::new();
    }
    walk.filter_map(Result::ok).collect()
}

/// The commits of the walk that are reachable from HEAD.
///
/// `All` and `Head` push HEAD, so the walk already holds HEAD's whole ancestry
/// and the parents collected during it answer what a second revwalk would. The
/// walk is topological, so one pass suffices: by the time a row is reached
/// every child that could have marked it has been seen. A branch scope need
/// not contain HEAD, and only then does the repository have to be walked again.
fn head_set(repo: &Repository, scope: &Scope, oids: &[Oid], parents: &[Vec<Oid>]) -> HashSet<Oid> {
    if matches!(scope, Scope::Head) {
        return oids.iter().copied().collect();
    }

    let head = repo
        .head()
        .ok()
        .and_then(|head| reference_commit_oid(&head))
        .filter(|oid| oids.contains(oid));
    let Some(head) = head else {
        return head_reachable(repo);
    };

    let mut reachable = HashSet::with_capacity(oids.len());
    reachable.insert(head);
    for (oid, parent_oids) in oids.iter().zip(parents) {
        if reachable.contains(oid) {
            reachable.extend(parent_oids.iter().copied());
        }
    }
    reachable
}

fn build_walk(repo: &Repository, scope: &Scope) -> Result<Walk, String> {
    let mut walk = repo.revwalk().map_err(|e| e.message().to_string())?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.message().to_string())?;
    push_scope(repo, &mut walk, scope)?;

    // Nothing here is formatted as a String: a page's shas are rendered from
    // the oids when it is sliced, not once per commit of the whole walk.
    let mut oids = Vec::new();
    let mut parents: Vec<Vec<Oid>> = Vec::new();
    for oid in walk {
        let oid = oid.map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        oids.push(oid);
        parents.push(commit.parent_ids().collect());
    }

    Ok(Walk {
        graph: assign_lanes(&oids, &parents),
        oids,
        parents,
    })
}

/// `walk` decorated with the refs as they are now.
fn decorate(
    repo: &Repository,
    scope: &Scope,
    walk: Arc<Walk>,
    keys: (u64, u64),
    built_at: u64,
) -> Result<CachedHistory, String> {
    Ok(CachedHistory {
        walk_key: keys.0,
        ref_fingerprint: keys.1,
        built_at,
        head_set: head_set(repo, scope, &walk.oids, &walk.parents),
        ref_map: build_ref_map(repo)?,
        walk,
    })
}

/// What a client hands back to ask whether its rows are still current.
fn page_fingerprint(scope_key: &str, walk_key: u64, ref_fingerprint: u64) -> String {
    format!("{scope_key}:{walk_key:016x}:{ref_fingerprint:016x}")
}

/// Shared with the thin `git_log` / `get_graph_data` commands so all three read
/// the same cached walk.
///
/// When `if_fingerprint` is the fingerprint of the current walk and refs, the
/// page comes back `unchanged` and without rows: the caller already has them.
pub(crate) fn history_page(
    cache: &HistoryCache,
    path: &str,
    limit: u32,
    skip: u32,
    branch: Option<&str>,
    all: bool,
    if_fingerprint: Option<&str>,
) -> Result<HistoryPage, String> {
    let repo = Repository::open(path).map_err(|e| e.message().to_string())?;
    let scope = Scope::new(branch, all);
    let scope_key = scope.key();
    let keys = (walk_key(&repo, &scope), ref_fingerprint(&repo));
    let built_at = cache.tick();

    // The walk happens outside the lock: it is seconds long on a big history,
    // and holding the cache for it stalls every other repository's pages.
    let entry = match cache.get(path, &scope_key, keys.0)? {
        Some(hit) if hit.ref_fingerprint == keys.1 => hit,
        Some(hit) => {
            let redecorated = decorate(&repo, &scope, Arc::clone(&hit.walk), keys, built_at)?;
            cache.store(path, &scope_key, Arc::new(redecorated))?
        }
        None => {
            let walk = Arc::new(build_walk(&repo, &scope)?);
            let built = decorate(&repo, &scope, walk, keys, built_at)?;
            cache.store(path, &scope_key, Arc::new(built))?
        }
    };

    let walk = &entry.walk;
    let total = walk.oids.len();
    let start = (skip as usize).min(total);
    let end = start.saturating_add(limit as usize).min(total);
    let fingerprint = page_fingerprint(&scope_key, entry.walk_key, entry.ref_fingerprint);

    if if_fingerprint == Some(fingerprint.as_str()) {
        return Ok(HistoryPage {
            commits: Vec::new(),
            graph: GraphData {
                commits: Vec::new(),
                max_lanes: walk.graph.max_lanes,
            },
            total: Some(total as u32),
            has_more: end < total,
            fingerprint,
            unchanged: true,
        });
    }

    let mut commits = Vec::with_capacity(end - start);
    for oid in &walk.oids[start..end] {
        let commit = repo
            .find_commit(*oid)
            .map_err(|e| e.message().to_string())?;
        let refs = entry.ref_map.get(oid).cloned().unwrap_or_default();
        commits.push(commit_info(&commit, refs, entry.head_set.contains(oid)));
    }

    Ok(HistoryPage {
        commits,
        graph: GraphData {
            commits: walk.graph.commits[start..end].to_vec(),
            max_lanes: walk.graph.max_lanes,
        },
        total: Some(total as u32),
        has_more: end < total,
        fingerprint,
        unchanged: false,
    })
}

#[tauri::command]
pub async fn get_history(
    path: String,
    limit: u32,
    skip: u32,
    branch: Option<String>,
    all: bool,
    if_fingerprint: Option<String>,
    cache: tauri::State<'_, HistoryCache>,
) -> Result<HistoryPage, String> {
    validate_repo_path(&path)?;
    if let Some(name) = branch.as_deref() {
        validate_revision(name)?;
    }
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        history_page(
            &cache,
            &path,
            limit,
            skip,
            branch.as_deref(),
            all,
            if_fingerprint.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
pub(crate) mod testutil {
    pub use crate::commands::git::test_support::*;
    use tempfile::TempDir;

    /// Write `name` and commit it in one step.
    pub fn commit_file(repo: &str, name: &str, contents: &str, message: &str) {
        write_file(repo, name, contents);
        git_ok(repo, &["add", "--", name]);
        git_ok(repo, &["commit", "-m", message]);
    }

    /// `main` and `feature` both rewrote `name` after a common base, so any of
    /// merge / rebase / cherry-pick between them conflicts on that one file.
    pub fn conflict_repo_named(name: &str) -> (TempDir, String) {
        let (dir, path) = init_empty_repo();
        commit_file(&path, name, "base\n", "base");
        git_ok(&path, &["checkout", "-b", "feature"]);
        commit_file(&path, name, "feature side\n", "feature");
        git_ok(&path, &["checkout", "main"]);
        commit_file(&path, name, "main side\n", "main");
        (dir, path)
    }

    pub fn conflict_repo() -> (TempDir, String) {
        conflict_repo_named("file.txt")
    }

    /// Write a commit object on top of HEAD whose author, committer and message
    /// are not valid UTF-8, and return its sha.
    ///
    /// That is the only reason git2 reports those fields as an error, and no
    /// `git commit` can produce one: the ident has to be handed to the object
    /// database as raw bytes.
    pub fn write_commit_with_invalid_utf8_ident(repo: &str) -> String {
        use std::io::Write;

        let tree = git_ok(repo, &["rev-parse", "HEAD^{tree}"]);
        let parent = git_ok(repo, &["rev-parse", "HEAD"]);
        let ident: &[u8] = b" \xff\xfe <b\xff@example.com> 1700000000 +0000\n";
        let mut object = format!("tree {tree}\nparent {parent}\nauthor").into_bytes();
        object.extend_from_slice(ident);
        object.extend_from_slice(b"committer");
        object.extend_from_slice(ident);
        object.extend_from_slice(b"\nsubject \xff\xfe\n\nbody \xff\xfe\n");

        let mut file = tempfile::NamedTempFile::new().expect("commit object file");
        file.write_all(&object).expect("write commit object");
        let out = std::process::Command::new("git")
            .args(["-C", repo, "hash-object", "-w", "-t", "commit", "--stdin"])
            .stdin(file.reopen().expect("reopen commit object"))
            .output()
            .expect("git hash-object");
        assert!(
            out.status.success(),
            "git hash-object failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Barrier;
    use std::time::{Duration, Instant};

    use super::testutil::*;
    use super::*;

    fn page(cache: &HistoryCache, repo: &str, limit: u32, skip: u32) -> HistoryPage {
        history_page(cache, repo, limit, skip, None, true, None).expect("history page")
    }

    fn fast_import(repo: &str, stream: &str) {
        use std::io::Write;

        let mut script = tempfile::NamedTempFile::new().expect("import script");
        script
            .write_all(stream.as_bytes())
            .expect("write import script");
        let out = std::process::Command::new("git")
            .args(["-C", repo, "fast-import", "--quiet"])
            .stdin(script.reopen().expect("reopen import script"))
            .output()
            .expect("git fast-import");
        assert!(
            out.status.success(),
            "git fast-import failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }

    /// Extend `main` with `count` commits that all keep HEAD's tree.
    ///
    /// `fast-import` packs them in one pass; one `git commit` per depth level,
    /// or one loose object per depth level through git2, makes the test take
    /// minutes instead of seconds.
    fn deepen(repo: &str, count: usize) {
        let head = git_ok(repo, &["rev-parse", "HEAD"]);
        let mut stream = String::new();
        for i in 0..count {
            let message = format!("deep {i}\n");
            stream.push_str("commit refs/heads/main\n");
            stream.push_str(&format!("mark :{}\n", i + 1));
            stream.push_str("committer Test User <t@example.com> 1700000000 +0000\n");
            stream.push_str(&format!("data {}\n{message}", message.len()));
            match i {
                0 => stream.push_str(&format!("from {head}\n")),
                _ => stream.push_str(&format!("from :{i}\n")),
            }
            stream.push('\n');
        }
        fast_import(repo, &stream);
    }

    #[test]
    fn empty_repository_yields_an_empty_page() {
        let (_dir, repo) = init_empty_repo();
        let result = page(&HistoryCache::default(), &repo, 50, 0);
        assert!(result.commits.is_empty());
        assert!(result.graph.commits.is_empty());
        assert_eq!(result.total, Some(0));
        assert!(!result.has_more);
    }

    #[test]
    fn pages_split_history_and_report_has_more() {
        let (_dir, repo) = init_empty_repo();
        for i in 0..5 {
            commit_file(&repo, "file.txt", &format!("{i}\n"), &format!("c{i}"));
        }
        let cache = HistoryCache::default();

        let first = page(&cache, &repo, 2, 0);
        assert_eq!(first.commits.len(), 2);
        assert_eq!(first.total, Some(5));
        assert!(first.has_more);
        assert_eq!(first.commits[0].message, "c4");

        let last = page(&cache, &repo, 2, 4);
        assert_eq!(last.commits.len(), 1);
        assert!(!last.has_more);
        assert_eq!(last.commits[0].message, "c0");

        let past_end = page(&cache, &repo, 2, 99);
        assert!(past_end.commits.is_empty());
        assert!(!past_end.has_more);
    }

    #[test]
    fn a_new_commit_invalidates_the_cache() {
        let (_dir, repo) = init_repo();
        let cache = HistoryCache::default();

        assert_eq!(page(&cache, &repo, 10, 0).total, Some(1));
        commit_file(&repo, "file.txt", "second\n", "second");
        let after = page(&cache, &repo, 10, 0);
        assert_eq!(after.total, Some(2));
        assert_eq!(after.commits[0].message, "second");
    }

    fn page_if(cache: &HistoryCache, repo: &str, fingerprint: &str) -> HistoryPage {
        history_page(cache, repo, 10, 0, None, true, Some(fingerprint)).expect("history page")
    }

    #[test]
    fn a_matching_fingerprint_gets_an_unchanged_page_without_rows() {
        let (_dir, repo) = init_repo();
        let cache = HistoryCache::default();
        let first = page(&cache, &repo, 10, 0);
        assert!(!first.unchanged);

        let again = page_if(&cache, &repo, &first.fingerprint);
        assert!(again.unchanged);
        assert!(again.commits.is_empty() && again.graph.commits.is_empty());
        assert_eq!(again.total, Some(1));

        commit_file(&repo, "file.txt", "second\n", "second");
        let after = page_if(&cache, &repo, &first.fingerprint);
        assert!(!after.unchanged);
        assert_ne!(after.fingerprint, first.fingerprint);
        assert_eq!(after.commits[0].message, "second");
    }

    #[test]
    fn a_new_tag_changes_the_fingerprint_but_keeps_the_walk() {
        let (_dir, repo) = init_repo();
        let cache = HistoryCache::default();
        let first = page(&cache, &repo, 10, 0);
        let walk = cache.cached_walk(&repo, "*all").expect("cached walk");

        git_ok(&repo, &["tag", "v1"]);
        let tagged = page_if(&cache, &repo, &first.fingerprint);

        assert!(!tagged.unchanged, "decorations changed");
        assert!(tagged.commits[0].refs.iter().any(|r| r.name == "v1"));
        let after = cache.cached_walk(&repo, "*all").expect("cached walk");
        assert!(Arc::ptr_eq(&walk, &after), "the walk was rebuilt");
    }

    #[test]
    fn a_checkout_to_a_walked_tip_redecorates_without_walking() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "feature work");
        let cache = HistoryCache::default();
        let on_feature = page(&cache, &repo, 10, 0);
        assert!(on_feature.commits[0].on_current_branch);
        let walk = cache.cached_walk(&repo, "*all").expect("cached walk");

        git_ok(&repo, &["checkout", "main"]);
        let on_main = page(&cache, &repo, 10, 0);

        let feature_row = on_main
            .commits
            .iter()
            .find(|c| c.message == "feature work")
            .expect("feature commit");
        assert!(!feature_row.on_current_branch);
        let after = cache.cached_walk(&repo, "*all").expect("cached walk");
        assert!(Arc::ptr_eq(&walk, &after), "the walk was rebuilt");
    }

    #[test]
    fn the_walk_key_follows_tips_not_names() {
        let (_dir, repo) = init_repo();
        let handle = Repository::open(&repo).expect("open repository");
        let key = || walk_key(&handle, &Scope::All);
        let before = key();

        git_ok(&repo, &["branch", "side"]);
        git_ok(&repo, &["tag", "-a", "v1", "-m", "release"]);
        git_ok(&repo, &["checkout", "side"]);
        assert_eq!(key(), before);

        commit_file(&repo, "file.txt", "second\n", "second");
        assert_ne!(key(), before);
    }

    #[test]
    fn lanes_are_stable_across_pages() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "feature work");
        git_ok(&repo, &["checkout", "main"]);
        commit_file(&repo, "main.txt", "m\n", "main work");
        git_ok(&repo, &["merge", "--no-ff", "-m", "merge", "feature"]);

        let cache = HistoryCache::default();
        let full = page(&cache, &repo, 100, 0);
        assert_eq!(full.total, Some(4));

        for skip in 0..4u32 {
            let single = page(&cache, &repo, 1, skip);
            assert_eq!(single.graph.commits.len(), 1);
            assert_eq!(
                single.graph.commits[0].lane, full.graph.commits[skip as usize].lane,
                "lane changed for row {skip}"
            );
            assert_eq!(single.graph.max_lanes, full.graph.max_lanes);
        }
    }

    #[test]
    fn graph_rows_line_up_with_the_commits_of_the_page() {
        let (_dir, repo) = init_empty_repo();
        for i in 0..4 {
            commit_file(&repo, "file.txt", &format!("{i}\n"), &format!("c{i}"));
        }
        let cache = HistoryCache::default();
        let page_two = page(&cache, &repo, 2, 2);
        assert_eq!(page_two.commits.len(), page_two.graph.commits.len());
        // A row carries no sha of its own: the pairing is the index, and the
        // edges it owns start at its absolute position in the history.
        for (offset, row) in page_two.graph.commits.iter().enumerate() {
            for edge in &row.edges {
                assert_eq!(edge.from_row as usize, 2 + offset);
            }
        }
    }

    /// Lanes are assigned over the full walk, so a sliced page keeps absolute
    /// row indices: `from_row` is the owning commit's row in the whole history,
    /// and the off-screen sentinel `to_row` is `total`, never the page length.
    #[test]
    fn graph_edges_carry_absolute_row_indices() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "feature work");
        git_ok(&repo, &["checkout", "main"]);
        commit_file(&repo, "main.txt", "m\n", "main work");
        git_ok(&repo, &["merge", "--no-ff", "-m", "merge", "feature"]);

        let cache = HistoryCache::default();
        let total = page(&cache, &repo, 100, 0).total.expect("total");

        for skip in 0..total {
            let single = page(&cache, &repo, 1, skip);
            let row = &single.graph.commits[0];
            for edge in &row.edges {
                assert_eq!(edge.from_row, skip, "from_row must be the absolute row");
                assert!(
                    edge.to_row <= total,
                    "to_row {} exceeds the sentinel {total}",
                    edge.to_row
                );
            }
        }
    }

    #[test]
    fn on_current_branch_marks_only_reachable_commits() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "off branch");
        git_ok(&repo, &["checkout", "main"]);

        let all = page(&HistoryCache::default(), &repo, 10, 0);
        let off = all
            .commits
            .iter()
            .find(|c| c.message == "off branch")
            .expect("feature commit is part of the all-refs walk");
        assert!(!off.on_current_branch);
        let base = all
            .commits
            .iter()
            .find(|c| c.message == "base")
            .expect("base commit");
        assert!(base.on_current_branch);
    }

    #[test]
    fn branch_scope_walks_only_that_branch() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "only on feature");
        git_ok(&repo, &["checkout", "main"]);

        let cache = HistoryCache::default();
        let main_only = history_page(&cache, &repo, 50, 0, None, false, None).unwrap();
        assert_eq!(main_only.total, Some(1));

        let feature = history_page(&cache, &repo, 50, 0, Some("feature"), false, None).unwrap();
        assert_eq!(feature.total, Some(2));
        assert!(!feature.commits[0].on_current_branch);
    }

    #[test]
    fn tags_are_peeled_to_their_commit() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["tag", "-a", "v1", "-m", "release"]);
        let result = page(&HistoryCache::default(), &repo, 10, 0);
        assert!(result.commits[0]
            .refs
            .iter()
            .any(|r| r.name == "v1" && matches!(r.ref_type, RefType::Tag)));
    }

    #[test]
    fn a_commit_whose_ident_is_not_utf8_is_still_listed() {
        let (_dir, repo) = init_repo();
        let sha = write_commit_with_invalid_utf8_ident(&repo);
        git_ok(&repo, &["update-ref", "refs/heads/broken", &sha]);

        let result = page(&HistoryCache::default(), &repo, 10, 0);
        let row = result
            .commits
            .iter()
            .find(|commit| commit.sha == sha)
            .expect("the commit with the unreadable ident is listed");
        assert_eq!(row.author_name, "");
        assert_eq!(row.author_email, "");
        assert_eq!(row.message, "");
    }

    fn fingerprint_of(repo: &str) -> u64 {
        ref_fingerprint(&Repository::open(repo).expect("open repository"))
    }

    #[test]
    fn the_fingerprint_is_the_same_when_nothing_moved() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["branch", "side"]);
        git_ok(&repo, &["tag", "-a", "v1", "-m", "release"]);
        assert_eq!(fingerprint_of(&repo), fingerprint_of(&repo));
    }

    #[test]
    fn stashing_does_not_change_the_fingerprint() {
        let (_dir, repo) = init_repo();
        write_file(
            &repo, "a.txt", "v2
",
        );
        let before = fingerprint_of(&repo);
        git_ok(&repo, &["stash"]);
        assert_eq!(fingerprint_of(&repo), before);
    }

    #[test]
    fn adding_a_note_does_not_change_the_fingerprint() {
        let (_dir, repo) = init_repo();
        let before = fingerprint_of(&repo);
        git_ok(&repo, &["notes", "add", "-m", "annotated", "HEAD"]);
        assert_eq!(fingerprint_of(&repo), before);
    }

    #[test]
    fn a_new_commit_changes_the_fingerprint() {
        let (_dir, repo) = init_repo();
        let before = fingerprint_of(&repo);
        commit_file(
            &repo, "file.txt", "second
", "second",
        );
        assert_ne!(fingerprint_of(&repo), before);
    }

    #[test]
    fn creating_a_branch_changes_the_fingerprint() {
        let (_dir, repo) = init_repo();
        let before = fingerprint_of(&repo);
        git_ok(&repo, &["branch", "side"]);
        assert_ne!(fingerprint_of(&repo), before);
    }

    #[test]
    fn detaching_head_changes_the_fingerprint() {
        let (_dir, repo) = init_repo();
        let before = fingerprint_of(&repo);
        git_ok(&repo, &["checkout", "--detach"]);
        assert_ne!(fingerprint_of(&repo), before);
    }

    #[test]
    fn evicting_a_path_drops_only_that_repositorys_walks() {
        let (_one_dir, one) = init_repo();
        let (_other_dir, other) = init_repo();
        let cache = HistoryCache::default();
        page(&cache, &one, 10, 0);
        page(&cache, &other, 10, 0);

        cache.evict(&one);

        assert!(cache.cached_scopes(&one).is_empty());
        assert_eq!(cache.cached_scopes(&other).len(), 1);
    }

    #[test]
    fn a_repository_keeps_only_its_two_most_recent_scopes() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["branch", "side"]);

        let cache = HistoryCache::default();
        history_page(&cache, &repo, 10, 0, None, true, None).expect("all scope");
        history_page(&cache, &repo, 10, 0, None, false, None).expect("head scope");
        history_page(&cache, &repo, 10, 0, Some("side"), false, None).expect("branch scope");

        assert_eq!(
            cache.cached_scopes(&repo),
            vec!["branch:side".to_string(), "*head".to_string()]
        );
    }

    /// The cache lock is only taken to look up and to publish, never while
    /// walking, so a page of one repository never queues behind another's walk.
    #[test]
    fn a_long_walk_does_not_block_pages_of_another_repository() {
        let (_deep_dir, deep) = init_repo();
        deepen(&deep, 20_000);
        let (_small_dir, small) = init_repo();

        let cache = HistoryCache::default();
        let gate = Barrier::new(2);
        let (walk, waited) = std::thread::scope(|scope| {
            let walker = scope.spawn(|| {
                gate.wait();
                let started = Instant::now();
                page(&cache, &deep, 1, 0);
                started.elapsed()
            });
            gate.wait();
            // Long enough that the other thread is well inside its walk.
            std::thread::sleep(Duration::from_millis(50));
            let started = Instant::now();
            page(&cache, &small, 10, 0);
            let waited = started.elapsed();
            (walker.join().expect("walk thread"), waited)
        });

        // Half the walk is a generous bar that a loaded machine still clears:
        // under a lock held for the whole build the page would have waited for
        // essentially all of it.
        println!("deep walk {walk:?}, page of the other repository {waited:?}");
        assert!(
            waited * 2 < walk,
            "a page of another repository waited {waited:?} on a {walk:?} walk"
        );
    }

    #[test]
    fn unicode_branch_names_are_walkable() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "rama/ñandú"]);
        commit_file(&repo, "file.txt", "more\n", "on ñandú");

        let cache = HistoryCache::default();
        let scoped = history_page(&cache, &repo, 50, 0, Some("rama/ñandú"), false, None).unwrap();
        assert_eq!(scoped.total, Some(2));
        assert_eq!(scoped.commits[0].message, "on ñandú");
    }
}
