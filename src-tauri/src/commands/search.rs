//! Commit search.

use super::commits::{parse_log_output, LOG_FORMAT};
use super::git::{blocking, validate_message, validate_pathspec, validate_repo_path, GitCmd};
use crate::models::CommitInfo;

fn is_sha_like(s: &str) -> bool {
    s.len() >= 7 && s.len() <= 40 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn search_commits_inner(
    path: &str,
    query: &str,
    author: &str,
    limit: u32,
    touching_path: Option<&str>,
) -> Result<Vec<CommitInfo>, String> {
    validate_repo_path(path)?;
    validate_message(query)?;
    validate_message(author)?;
    let touching_path = touching_path.filter(|file| !file.is_empty());
    if let Some(file) = touching_path {
        validate_pathspec(file)?;
    }

    // A full sha names one commit outright, so there is nothing left to filter.
    if is_sha_like(query) {
        let out = GitCmd::in_repo(path)
            .args(["show", "--no-patch", "--decorate=full", LOG_FORMAT, query])
            .output()?;
        if !out.status.success() {
            return Ok(vec![]);
        }
        return Ok(parse_log_output(&String::from_utf8_lossy(&out.stdout)));
    }

    let mut cmd = GitCmd::in_repo(path).args([
        "log",
        "--decorate=full",
        LOG_FORMAT,
        // `--exclude` only applies to the `--all` that follows it; without this
        // every search would surface stash commits as if they were history.
        "--exclude=refs/stash",
        "--all",
        &format!("--max-count={}", limit.max(1)),
    ]);

    if !query.is_empty() {
        // Fixed strings, so a query like `fix(auth)` is not read as a regex.
        cmd = cmd
            .arg(format!("--grep={query}"))
            .args(["--fixed-strings", "--regexp-ignore-case"]);
    }
    if !author.is_empty() {
        cmd = cmd.arg(format!("--author={author}"));
    }
    if let Some(file) = touching_path {
        // Wrapped in `*` so a fragment of a path matches anywhere in the tree;
        // git ANDs the pathspec with the `--grep` / `--author` filters.
        cmd = cmd.arg("--").arg(format!("*{file}*"));
    }

    let out = cmd.output()?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        if stderr.contains("does not have any commits yet")
            || stderr.contains("bad default revision")
        {
            return Ok(vec![]);
        }
        return Err(stderr.trim().to_string());
    }

    Ok(parse_log_output(&String::from_utf8_lossy(&out.stdout)))
}

/// Search commit subjects and authors across every ref except the stash,
/// optionally limited to commits touching `touching_path`.
#[tauri::command]
pub async fn search_commits(
    path: String,
    query: String,
    author: String,
    limit: u32,
    touching_path: Option<String>,
) -> Result<Vec<CommitInfo>, String> {
    blocking(move || search_commits_inner(&path, &query, &author, limit, touching_path.as_deref()))
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

    fn commit(path: &str, file: &str, message: &str) {
        write_file(path, file, "content\n");
        git_ok(path, &["add", "."]);
        git_ok(path, &["commit", "-m", message]);
    }

    fn search(
        path: &str,
        query: &str,
        author: &str,
        limit: u32,
    ) -> Result<Vec<CommitInfo>, String> {
        search_commits_inner(path, query, author, limit, None)
    }

    #[test]
    fn searches_by_message() {
        let (_dir, path) = init_repo();
        commit(&path, "a1.txt", "feat: alpha feature");
        commit(&path, "b1.txt", "fix: beta bug");

        let results = search(&path, "alpha", "", 200).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].message.contains("alpha"));
    }

    #[test]
    fn parentheses_are_matched_literally() {
        let (_dir, path) = init_repo();
        commit(&path, "a1.txt", "fix(auth): reject empty tokens");
        commit(&path, "b1.txt", "fix auth elsewhere");

        // As a regex this would match both commits (and older git versions
        // would simply error on an unbalanced paren).
        let results = search(&path, "fix(auth)", "", 200).unwrap();
        assert_eq!(results.len(), 1, "got: {results:?}");
        assert!(results[0].message.starts_with("fix(auth)"));

        let unbalanced = search(&path, "reject (empty", "", 200).unwrap();
        assert!(unbalanced.is_empty());
    }

    #[test]
    fn searches_by_author() {
        let (_dir, path) = init_repo();
        let found = search(&path, "", "Test User", 200).unwrap();
        assert!(!found.is_empty());
        assert!(found.iter().all(|c| c.author_name.contains("Test User")));

        assert!(search(&path, "", "Nobody At All", 200).unwrap().is_empty());
    }

    #[test]
    fn the_limit_is_honoured() {
        let (_dir, path) = init_repo();
        for i in 0..5 {
            commit(&path, &format!("f{i}.txt"), &format!("commit {i}"));
        }

        assert_eq!(search(&path, "", "", 3).unwrap().len(), 3);
        assert_eq!(search(&path, "", "", 100).unwrap().len(), 6);
    }

    #[test]
    fn a_path_filter_narrows_the_results() {
        let (_dir, path) = init_repo();
        commit(&path, "src/alpha.txt", "touches alpha");
        commit(&path, "docs/beta.txt", "touches beta");

        let alpha = search_commits_inner(&path, "", "", 200, Some("alpha")).unwrap();
        assert_eq!(alpha.len(), 1);
        assert_eq!(alpha[0].message.trim(), "touches alpha");

        let by_dir = search_commits_inner(&path, "", "", 200, Some("docs/")).unwrap();
        assert_eq!(by_dir.len(), 1);
        assert_eq!(by_dir[0].message.trim(), "touches beta");

        // The path filter is ANDed with the message filter.
        assert!(search_commits_inner(&path, "beta", "", 200, Some("alpha"))
            .unwrap()
            .is_empty());

        assert!(search_commits_inner(&path, "", "", 200, Some("../escape")).is_err());
    }

    #[test]
    fn stash_commits_never_show_up() {
        let (_dir, path) = init_repo();
        write_file(&path, "a.txt", "dirty\n");
        git_ok(&path, &["stash", "push", "-m", "buscable"]);

        let results = search(&path, "buscable", "", 200).unwrap();
        assert!(results.is_empty(), "got: {results:?}");
    }

    #[test]
    fn a_full_sha_resolves_directly() {
        let (_dir, path) = init_repo();
        let sha = git_ok(&path, &["rev-parse", "HEAD"]);

        let results = search(&path, &sha, "", 200).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].sha, sha);

        assert!(search(&path, &"0".repeat(40), "", 200).unwrap().is_empty());
    }

    #[test]
    fn an_empty_repository_returns_nothing() {
        let (_dir, path) = crate::commands::git::test_support::init_empty_repo();
        assert!(search(&path, "", "", 200).unwrap().is_empty());
    }

    #[test]
    fn newlines_in_a_query_are_rejected_but_unicode_is_not() {
        let (_dir, path) = init_repo();
        commit(&path, "n.txt", "añadir señal ñ");

        assert!(search(&path, "bad\0query", "", 200).is_err());
        assert_eq!(search(&path, "señal ñ", "", 200).unwrap().len(), 1);
    }
}
