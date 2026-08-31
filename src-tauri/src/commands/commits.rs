//! Commit history reading.

use super::git::{blocking, validate_repo_path, validate_revision, GitCmd};
use super::history::{history_page, HistoryCache};
use crate::models::{CommitInfo, RefInfo, RefType};

/// Field layout shared by every `git log`-based reader in the crate.
pub(super) const LOG_FORMAT: &str = "--format=%H%x00%h%x00%s%x00%an%x00%ae%x00%aI%x00%P%x00%D%x00";

/// Parse one `%D` decoration into refs.
///
/// Callers must pass `--decorate=full`, which is the only way to tell a local
/// branch containing a slash (`release/1.0`) from a remote-tracking branch.
/// Short decorations are still accepted so nothing breaks if a caller forgets.
pub(super) fn parse_refs(deco: &str) -> Vec<RefInfo> {
    let trimmed = deco.trim();
    if trimmed.is_empty() {
        return vec![];
    }
    let inner = trimmed
        .strip_prefix('(')
        .and_then(|s| s.strip_suffix(')'))
        .unwrap_or(trimmed);

    let mut result = Vec::new();
    for token in inner.split(", ") {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        if let Some(rest) = token.strip_prefix("HEAD -> ") {
            let name = short_ref_name(rest);
            result.push(RefInfo {
                name: name.clone(),
                ref_type: RefType::Head,
            });
            result.push(RefInfo {
                name,
                ref_type: classify_ref(rest),
            });
        } else if let Some(rest) = token.strip_prefix("tag: ") {
            result.push(RefInfo {
                name: short_ref_name(rest),
                ref_type: RefType::Tag,
            });
        } else if token == "HEAD" {
            result.push(RefInfo {
                name: "HEAD".to_string(),
                ref_type: RefType::Head,
            });
        } else {
            result.push(RefInfo {
                name: short_ref_name(token),
                ref_type: classify_ref(token),
            });
        }
    }
    result
}

fn short_ref_name(name: &str) -> String {
    for prefix in ["refs/heads/", "refs/remotes/", "refs/tags/"] {
        if let Some(rest) = name.strip_prefix(prefix) {
            return rest.to_string();
        }
    }
    name.to_string()
}

fn classify_ref(name: &str) -> RefType {
    if name.starts_with("refs/remotes/") {
        RefType::Remote
    } else if name.starts_with("refs/tags/") {
        RefType::Tag
    } else if name.starts_with("refs/heads/") {
        RefType::Branch
    } else if name.contains('/') {
        // Short decoration: the only ambiguous case, and remotes are far more
        // common there than local branches with a slash.
        RefType::Remote
    } else {
        RefType::Branch
    }
}

/// Split `git log` output produced with [`LOG_FORMAT`] into commits.
///
/// Every record ends with a NUL, and git separates records with a newline, so
/// the stream is a flat run of NUL-delimited fields whose first field of each
/// record carries a leading newline. Nothing in a record can contain a NUL,
/// which is what makes this safe for paths, subjects and author names.
pub(super) fn parse_log_output(stdout: &str) -> Vec<CommitInfo> {
    let fields: Vec<&str> = stdout
        .split('\u{0}')
        .map(|field| field.trim_start_matches(['\r', '\n']))
        .collect();

    fields
        .as_chunks::<8>()
        .0
        .iter()
        .map(|f| CommitInfo {
            sha: f[0].to_string(),
            short_sha: f[1].to_string(),
            message: f[2].to_string(),
            author_name: f[3].to_string(),
            author_email: f[4].to_string(),
            date: f[5].to_string(),
            parent_shas: f[6].split_whitespace().map(|s| s.to_string()).collect(),
            refs: parse_refs(f[7]),
            on_current_branch: true,
        })
        .collect()
}

fn git_log_shell(
    path: &str,
    limit: u32,
    skip: u32,
    branch: Option<&str>,
) -> Result<Vec<CommitInfo>, String> {
    let mut cmd = GitCmd::in_repo(path).args([
        "log",
        "--decorate=full",
        LOG_FORMAT,
        &format!("--max-count={limit}"),
        &format!("--skip={skip}"),
    ]);
    cmd = match branch {
        Some(b) => cmd.arg(b),
        None => cmd.arg("--all"),
    };

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // A repository without commits is a normal, empty result.
        if stderr.contains("does not have any commits yet")
            || stderr.contains("bad default revision")
            || stderr.contains("unknown revision")
        {
            return Ok(vec![]);
        }
        return Err(stderr.trim().to_string());
    }

    Ok(parse_log_output(&String::from_utf8_lossy(&output.stdout)))
}

pub(super) fn validate_log_args(path: &str, branch: Option<&str>) -> Result<(), String> {
    validate_repo_path(path)?;
    match branch {
        Some(name) => validate_revision(name),
        None => Ok(()),
    }
}

/// A page of commit history, newest first.
///
/// Thin wrapper over the shared history cache so paging never re-walks the
/// repository and lane numbers stay stable across pages. The CLI reader remains
/// as a fallback for repositories libgit2 cannot open.
#[tauri::command]
pub async fn git_log(
    path: String,
    limit: u32,
    skip: u32,
    branch: Option<String>,
    cache: tauri::State<'_, HistoryCache>,
) -> Result<Vec<CommitInfo>, String> {
    validate_log_args(&path, branch.as_deref())?;
    let cache = cache.inner().clone();
    blocking(move || {
        let all = branch.is_none();
        match history_page(&cache, &path, limit, skip, branch.as_deref(), all) {
            Ok(page) => Ok(page.commits),
            Err(_) => git_log_shell(&path, limit, skip, branch.as_deref()),
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_empty_repo, init_repo, write_file};

    /// The same page `git_log` returns, read through a throwaway cache.
    fn log(path: &str, limit: u32, skip: u32, branch: Option<&str>) -> Vec<CommitInfo> {
        history_page(
            &HistoryCache::default(),
            path,
            limit,
            skip,
            branch,
            branch.is_none(),
        )
        .expect("history page")
        .commits
    }

    #[test]
    fn full_decorations_separate_slashed_branches_from_remotes() {
        let refs = parse_refs(
            "HEAD -> refs/heads/release/1.0, refs/remotes/origin/main, tag: refs/tags/v1.0",
        );
        assert_eq!(refs.len(), 4);
        assert!(matches!(refs[0].ref_type, RefType::Head));
        assert_eq!(refs[0].name, "release/1.0");
        assert!(matches!(refs[1].ref_type, RefType::Branch));
        assert_eq!(refs[1].name, "release/1.0");
        assert!(matches!(refs[2].ref_type, RefType::Remote));
        assert_eq!(refs[2].name, "origin/main");
        assert!(matches!(refs[3].ref_type, RefType::Tag));
        assert_eq!(refs[3].name, "v1.0");
    }

    #[test]
    fn short_decorations_still_parse() {
        let refs = parse_refs("(HEAD -> main, tag: v1)");
        assert_eq!(refs.len(), 3);
        assert!(matches!(refs[0].ref_type, RefType::Head));
        assert!(matches!(refs[1].ref_type, RefType::Branch));
        assert!(matches!(refs[2].ref_type, RefType::Tag));
    }

    #[test]
    fn detached_head_decoration_parses() {
        let refs = parse_refs("HEAD, refs/tags/v2");
        assert_eq!(refs.len(), 2);
        assert!(matches!(refs[0].ref_type, RefType::Head));
        assert_eq!(refs[0].name, "HEAD");
        assert!(matches!(refs[1].ref_type, RefType::Tag));
    }

    #[test]
    fn empty_decoration_yields_no_refs() {
        assert!(parse_refs("").is_empty());
    }

    #[test]
    fn history_of_a_temp_repo_is_newest_first() {
        let (_dir, path) = init_repo();
        write_file(&path, "b.txt", "b\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "second"]);

        let commits = log(&path, 10, 0, None);
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].message, "second");
        assert_eq!(commits[1].message, "init");
        assert_eq!(commits[0].sha.len(), 40);
        assert!(commits[0].on_current_branch);
        assert_eq!(commits[0].parent_shas.len(), 1);
    }

    #[test]
    fn history_skips_and_limits() {
        let (_dir, path) = init_repo();
        for i in 0..4 {
            write_file(&path, &format!("f{i}.txt"), "x\n");
            git_ok(&path, &["add", "."]);
            git_ok(&path, &["commit", "-m", &format!("c{i}")]);
        }
        let page = log(&path, 2, 1, None);
        assert_eq!(page.len(), 2);
        assert_eq!(page[0].message, "c2");
    }

    #[test]
    fn an_empty_repository_yields_no_commits() {
        let (_dir, path) = init_empty_repo();
        assert!(log(&path, 10, 0, None).is_empty());
        assert!(git_log_shell(&path, 10, 0, None).unwrap().is_empty());
    }

    #[test]
    fn unicode_branch_names_are_accepted() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature/añadir-login"]);
        write_file(&path, "c.txt", "c\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "añadido"]);

        let commits = log(&path, 10, 0, Some("feature/añadir-login"));
        assert_eq!(commits[0].message, "añadido");
    }

    #[test]
    fn the_shell_fallback_matches_the_cached_reader() {
        let (_dir, path) = init_repo();
        write_file(&path, "b.txt", "b\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "second"]);
        git_ok(&path, &["tag", "-a", "v1", "-m", "release"]);

        let shell = git_log_shell(&path, 10, 0, None).unwrap();
        let cached = log(&path, 10, 0, None);
        assert_eq!(
            shell.iter().map(|c| &c.sha).collect::<Vec<_>>(),
            cached.iter().map(|c| &c.sha).collect::<Vec<_>>()
        );
        // An annotated tag must resolve to the commit it peels to, in both readers.
        for source in [&shell, &cached] {
            assert!(source[0]
                .refs
                .iter()
                .any(|r| matches!(r.ref_type, RefType::Tag) && r.name == "v1"));
        }
    }

    #[test]
    fn option_like_paths_are_rejected() {
        assert!(validate_log_args("--exec=calc", None).is_err());
        assert!(validate_log_args("", None).is_err());
        let (_dir, path) = init_repo();
        assert!(validate_log_args(&path, Some("--exec=calc")).is_err());
        assert!(validate_log_args(&path, Some("main")).is_ok());
    }
}
