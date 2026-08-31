//! Paged commit history.
//!
//! Walking the whole DAG and assigning graph lanes is what makes history
//! expensive, and both must be done over the FULL commit list for lanes to stay
//! stable while paging. Both results are therefore cached per repository and
//! scope, and invalidated when any ref (or HEAD) moves. A page is a plain slice
//! of the cached vectors, so graph row indices stay absolute: page `k` lines up
//! 1:1 with the accumulated commit array on the UI side.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use git2::{Oid, Reference, Repository, Revwalk, Sort};

use super::git::{validate_repo_path, validate_revision, GitCmd};
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
        if let (Some(oid), Some(shorthand)) = (reference_commit_oid(&head), head.shorthand()) {
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
        let (Some(oid), Some(name)) = (reference_commit_oid(&reference), reference.name()) else {
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
        message: commit.summary().unwrap_or("").to_string(),
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

struct CachedHistory {
    ref_fingerprint: String,
    oids: Vec<Oid>,
    head_set: HashSet<Oid>,
    ref_map: HashMap<Oid, Vec<RefInfo>>,
    /// Lanes for the FULL walk, so paging never reshuffles the graph.
    graph: GraphData,
}

/// Managed state: one cached walk per repository path and scope.
#[derive(Default, Clone)]
pub struct HistoryCache(Arc<Mutex<HashMap<String, CachedHistory>>>);

/// Cheap signature of every ref plus HEAD; any change invalidates the walk.
fn ref_fingerprint(path: &str) -> String {
    let refs = GitCmd::in_repo(path)
        .args(["for-each-ref", "--format=%(refname)%00%(objectname)"])
        .run()
        .unwrap_or_default();
    let head = GitCmd::in_repo(path)
        .args(["rev-parse", "HEAD"])
        .run()
        .unwrap_or_default();
    format!("{refs}\u{1}{head}")
}

fn push_branch(repo: &Repository, walk: &mut Revwalk<'_>, name: &str) -> Result<(), String> {
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
                return walk.push(oid).map_err(|e| e.message().to_string());
            }
        }
    }

    let commit = repo
        .revparse_single(name)
        .and_then(|object| object.peel_to_commit())
        .map_err(|_| format!("unknown revision: {name}"))?;
    walk.push(commit.id()).map_err(|e| e.message().to_string())
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
        Scope::Branch(name) => push_branch(repo, walk, name),
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

/// Lane assignment only reads sha and parents, so the rest stays empty.
fn lane_stub(sha: String, parent_shas: Vec<String>) -> CommitInfo {
    CommitInfo {
        short_sha: String::new(),
        sha,
        message: String::new(),
        author_name: String::new(),
        author_email: String::new(),
        date: String::new(),
        parent_shas,
        refs: Vec::new(),
        on_current_branch: false,
    }
}

fn build_history(
    repo: &Repository,
    scope: &Scope,
    ref_fingerprint: String,
) -> Result<CachedHistory, String> {
    let mut walk = repo.revwalk().map_err(|e| e.message().to_string())?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.message().to_string())?;
    push_scope(repo, &mut walk, scope)?;

    let mut oids = Vec::new();
    let mut stubs = Vec::new();
    for oid in walk {
        let oid = oid.map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        stubs.push(lane_stub(
            oid.to_string(),
            commit.parent_ids().map(|id| id.to_string()).collect(),
        ));
        oids.push(oid);
    }

    Ok(CachedHistory {
        ref_fingerprint,
        graph: assign_lanes(&stubs),
        head_set: head_reachable(repo),
        ref_map: build_ref_map(repo)?,
        oids,
    })
}

/// Shared with the thin `git_log` / `get_graph_data` commands so all three read
/// the same cached walk.
pub(crate) fn history_page(
    cache: &HistoryCache,
    path: &str,
    limit: u32,
    skip: u32,
    branch: Option<&str>,
    all: bool,
) -> Result<HistoryPage, String> {
    let repo = Repository::open(path).map_err(|e| e.message().to_string())?;
    let scope = Scope::new(branch, all);
    let key = format!("{path}\u{0}{}", scope.key());
    let fingerprint = ref_fingerprint(path);

    let mut cached = cache
        .0
        .lock()
        .map_err(|_| "history cache is unavailable".to_string())?;

    let stale = cached
        .get(&key)
        .is_none_or(|entry| entry.ref_fingerprint != fingerprint);
    if stale {
        cached.insert(key.clone(), build_history(&repo, &scope, fingerprint)?);
    }
    let entry = cached.get(&key).expect("entry was just inserted");

    let total = entry.oids.len();
    let start = (skip as usize).min(total);
    let end = start.saturating_add(limit as usize).min(total);

    let mut commits = Vec::with_capacity(end - start);
    for oid in &entry.oids[start..end] {
        let commit = repo
            .find_commit(*oid)
            .map_err(|e| e.message().to_string())?;
        let refs = entry.ref_map.get(oid).cloned().unwrap_or_default();
        commits.push(commit_info(&commit, refs, entry.head_set.contains(oid)));
    }

    Ok(HistoryPage {
        commits,
        graph: GraphData {
            commits: entry.graph.commits[start..end].to_vec(),
            max_lanes: entry.graph.max_lanes,
        },
        total: Some(total as u32),
        has_more: end < total,
    })
}

#[tauri::command]
pub async fn get_history(
    path: String,
    limit: u32,
    skip: u32,
    branch: Option<String>,
    all: bool,
    cache: tauri::State<'_, HistoryCache>,
) -> Result<HistoryPage, String> {
    validate_repo_path(&path)?;
    if let Some(name) = branch.as_deref() {
        validate_revision(name)?;
    }
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        history_page(&cache, &path, limit, skip, branch.as_deref(), all)
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
}

#[cfg(test)]
mod tests {
    use super::testutil::*;
    use super::*;

    fn page(cache: &HistoryCache, repo: &str, limit: u32, skip: u32) -> HistoryPage {
        history_page(cache, repo, limit, skip, None, true).expect("history page")
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
        for (commit, row) in page_two.commits.iter().zip(&page_two.graph.commits) {
            assert_eq!(commit.sha, row.sha);
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
        let main_only = history_page(&cache, &repo, 50, 0, None, false).unwrap();
        assert_eq!(main_only.total, Some(1));

        let feature = history_page(&cache, &repo, 50, 0, Some("feature"), false).unwrap();
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
    fn unicode_branch_names_are_walkable() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "rama/ñandú"]);
        commit_file(&repo, "file.txt", "more\n", "on ñandú");

        let cache = HistoryCache::default();
        let scoped = history_page(&cache, &repo, 50, 0, Some("rama/ñandú"), false).unwrap();
        assert_eq!(scoped.total, Some(2));
        assert_eq!(scoped.commits[0].message, "on ñandú");
    }
}
