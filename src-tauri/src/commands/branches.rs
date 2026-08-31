//! Branch listing, checkout, fast-forward and tag listing.

use super::git::{blocking, validate_ref, validate_repo_path, validate_revision, GitCmd};
use super::git_auth::{auth_error_message, is_auth_error};
use crate::models::{BranchInfo, BranchList, CheckoutResult, FastForwardResult, TagInfo};

/// Parse `[ahead N, behind M]` / `[ahead N]` / `[behind M]` / `[gone]` / empty.
pub(super) fn parse_ahead_behind(track: &str) -> (u32, u32) {
    let count = |marker: &str| -> u32 {
        track
            .find(marker)
            .map(|pos| {
                track[pos + marker.len()..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0)
            })
            .unwrap_or(0)
    };
    (count("ahead "), count("behind "))
}

/// Files git named in a "would be overwritten" refusal.
pub(super) fn overwrite_files(stderr: &str) -> Vec<String> {
    let mut files = Vec::new();
    let mut collecting = false;
    for line in stderr.lines() {
        if line.contains("would be overwritten by") {
            collecting = true;
        } else if let Some(file) = line.strip_prefix('\t') {
            if collecting {
                files.push(file.trim_end_matches(['\r', '\n']).trim().to_string());
            }
        } else if collecting {
            collecting = false;
        }
    }
    files
}

fn ref_exists(path: &str, refname: &str) -> bool {
    GitCmd::in_repo(path)
        .args(["show-ref", "--verify", "--quiet", refname])
        .succeeds()
}

fn head_is_detached(path: &str) -> bool {
    !GitCmd::in_repo(path)
        .args(["symbolic-ref", "--quiet", "HEAD"])
        .succeeds()
}

/// Local branch name implied by a remote-tracking branch (`origin/x` → `x`).
fn local_name_of(remote_branch: &str) -> Option<&str> {
    remote_branch
        .split_once('/')
        .map(|(_, local)| local)
        .filter(|local| !local.is_empty())
}

fn checkout_branch_inner(
    path: &str,
    name: &str,
    create_tracking: bool,
    force: bool,
) -> CheckoutResult {
    let prepared = (|| {
        validate_repo_path(path)?;
        validate_revision(name)
    })();
    if let Err(message) = prepared {
        return CheckoutResult::Error { message };
    }

    let mut cmd = GitCmd::in_repo(path).arg("checkout");
    if force {
        // `--force` discards conflicting changes the way git does: it never
        // sweeps away unrelated untracked files.
        cmd = cmd.arg("--force");
    }

    let is_local = ref_exists(path, &format!("refs/heads/{name}"));
    let is_remote = !is_local && ref_exists(path, &format!("refs/remotes/{name}"));

    if is_local {
        cmd = cmd.arg(name);
    } else if is_remote && create_tracking {
        let Some(local) = local_name_of(name) else {
            return CheckoutResult::Error {
                message: format!("cannot derive a local branch name from {name}"),
            };
        };
        if ref_exists(path, &format!("refs/heads/{local}")) {
            cmd = cmd.arg(local);
        } else {
            cmd = cmd.args(["-b", local, "--track", name]);
        }
    } else {
        cmd = cmd.args(["--detach", name]);
    }

    let output = match cmd.output() {
        Ok(output) => output,
        Err(message) => return CheckoutResult::Error { message },
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let files = overwrite_files(&stderr);
        if !files.is_empty() {
            return CheckoutResult::WouldOverwrite { files };
        }
        return CheckoutResult::Error {
            message: stderr.trim().to_string(),
        };
    }

    if head_is_detached(path) {
        CheckoutResult::DetachedHead
    } else {
        CheckoutResult::Success
    }
}

/// Upstream of `branch` as `(short, remote, remote_ref)`.
fn upstream_of(path: &str, branch: &str) -> Option<(String, String, String)> {
    let line = GitCmd::in_repo(path)
        .args([
            "for-each-ref",
            "--format=%(upstream:short)%00%(upstream:remotename)%00%(upstream:remoteref)",
            &format!("refs/heads/{branch}"),
        ])
        .run()
        .ok()?;
    let fields: Vec<&str> = line.trim_end_matches(['\r', '\n']).split('\u{0}').collect();
    if fields.len() < 3 || fields.iter().take(3).any(|f| f.is_empty()) {
        return None;
    }
    Some((
        fields[0].to_string(),
        fields[1].to_string(),
        fields[2].to_string(),
    ))
}

fn resolve(path: &str, rev: &str) -> Option<String> {
    GitCmd::in_repo(path)
        .args(["rev-parse", "--verify", "--quiet", rev])
        .run()
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn fast_forward_inner(path: &str, branch: &str) -> FastForwardResult {
    let prepared = (|| {
        validate_repo_path(path)?;
        validate_ref(branch)
    })();
    if let Err(message) = prepared {
        return FastForwardResult::NetworkError { message };
    }

    let Some((upstream_short, remote, remote_ref)) = upstream_of(path, branch) else {
        return FastForwardResult::NoUpstream;
    };

    // The CLI reuses the user's configured credential helper, which the
    // libgit2 callbacks could not do for SSH agents or GCM.
    if let Err(message) = GitCmd::in_repo(path)
        .args(["fetch", &remote, &remote_ref])
        .run()
    {
        if is_auth_error(&message) {
            return FastForwardResult::AuthRequired {
                message: auth_error_message(&message),
            };
        }
        return FastForwardResult::NetworkError { message };
    }

    let (Some(local_oid), Some(upstream_oid)) = (
        resolve(path, &format!("refs/heads/{branch}")),
        resolve(path, &format!("refs/remotes/{upstream_short}")),
    ) else {
        return FastForwardResult::NoUpstream;
    };

    if local_oid == upstream_oid {
        return FastForwardResult::AlreadyUpToDate;
    }
    let is_ancestor = GitCmd::in_repo(path)
        .args(["merge-base", "--is-ancestor", &local_oid, &upstream_oid])
        .succeeds();
    if !is_ancestor {
        return FastForwardResult::NotFastForwardable;
    }

    let checked_out = GitCmd::in_repo(path)
        .args(["branch", "--show-current"])
        .run()
        .map(|s| s.trim() == branch)
        .unwrap_or(false);

    let result = if checked_out {
        GitCmd::in_repo(path)
            .args(["merge", "--ff-only", &upstream_short])
            .run()
            .map(|_| ())
    } else {
        // Not checked out: move the ref directly, guarded by its old value so a
        // concurrent update cannot be clobbered.
        GitCmd::in_repo(path)
            .args([
                "update-ref",
                &format!("refs/heads/{branch}"),
                &upstream_oid,
                &local_oid,
            ])
            .run()
            .map(|_| ())
    };

    match result {
        Ok(()) => FastForwardResult::FastForwarded,
        Err(message) if message.contains("Not possible to fast-forward") => {
            FastForwardResult::NotFastForwardable
        }
        Err(message) => FastForwardResult::NetworkError { message },
    }
}

fn list_branches_inner(path: &str) -> Result<BranchList, String> {
    validate_repo_path(path)?;

    let current = GitCmd::in_repo(path)
        .args(["branch", "--show-current"])
        .run()
        .ok()
        .map(|s| s.trim_end_matches(['\r', '\n']).to_string())
        .filter(|s| !s.is_empty());

    let output = GitCmd::in_repo(path)
        .args([
            "for-each-ref",
            "refs/heads",
            "refs/remotes",
            "--format=%(refname:short)%00%(refname)%00%(upstream:short)%00%(upstream:track)%00%(objectname)",
        ])
        .output()?;

    if !output.status.success() {
        return Ok(BranchList {
            local: vec![],
            remote: vec![],
            current: None,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut local: Vec<BranchInfo> = Vec::new();
    let mut remote: Vec<BranchInfo> = Vec::new();

    for line in stdout.lines() {
        let fields: Vec<&str> = line.split('\u{0}').collect();
        if fields.len() < 5 {
            continue;
        }
        let short_name = fields[0].trim();
        // `origin/HEAD` is an alias for the remote's default branch, not a
        // branch of its own.
        if short_name.is_empty() || short_name.ends_with("/HEAD") {
            continue;
        }

        let is_remote = fields[1].starts_with("refs/remotes/");
        let (ahead, behind) = parse_ahead_behind(fields[3]);
        let info = BranchInfo {
            name: short_name.to_string(),
            sha: fields[4].trim().to_string(),
            is_remote,
            upstream: Some(fields[2].trim().to_string()).filter(|s| !s.is_empty()),
            ahead,
            behind,
        };

        if is_remote {
            remote.push(info);
        } else {
            local.push(info);
        }
    }

    Ok(BranchList {
        local,
        remote,
        current,
    })
}

fn list_tags_inner(path: &str) -> Result<Vec<TagInfo>, String> {
    validate_repo_path(path)?;

    // `*objectname` is the peeled target: for an annotated tag `objectname` is
    // the tag object itself, which no commit lookup would ever find.
    let output = GitCmd::in_repo(path)
        .args([
            "for-each-ref",
            "refs/tags",
            "--format=%(refname:short)%00%(objectname)%00%(*objectname)%00%(objecttype)%00%(contents:subject)",
        ])
        .output()?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tags = Vec::new();
    for line in stdout.lines() {
        let fields: Vec<&str> = line.split('\u{0}').collect();
        if fields.len() < 5 {
            continue;
        }
        let name = fields[0].trim();
        let peeled = fields[2].trim();
        let object = fields[1].trim();
        if name.is_empty() || (peeled.is_empty() && object.is_empty()) {
            continue;
        }

        let is_annotated = fields[3].trim() == "tag";
        let subject = fields[4].trim();
        tags.push(TagInfo {
            name: name.to_string(),
            sha: if peeled.is_empty() { object } else { peeled }.to_string(),
            message: if is_annotated && !subject.is_empty() {
                Some(subject.to_string())
            } else {
                None
            },
            is_annotated,
        });
    }

    Ok(tags)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Local and remote-tracking branches plus the checked-out branch.
#[tauri::command]
pub async fn list_branches(path: String) -> Result<BranchList, String> {
    blocking(move || list_branches_inner(&path)).await
}

/// Check out a branch, a remote branch or any revision (detached).
#[tauri::command]
pub async fn checkout_branch(
    path: String,
    name: String,
    create_tracking: bool,
    force: bool,
) -> Result<CheckoutResult, String> {
    blocking(move || Ok(checkout_branch_inner(&path, &name, create_tracking, force))).await
}

/// Fetch `branch`'s upstream and fast-forward it when possible.
#[tauri::command]
pub async fn fast_forward(path: String, branch: String) -> Result<FastForwardResult, String> {
    blocking(move || Ok(fast_forward_inner(&path, &branch))).await
}

/// Every tag, resolved to the commit it points at.
#[tauri::command]
pub async fn list_tags(path: String) -> Result<Vec<TagInfo>, String> {
    blocking(move || list_tags_inner(&path)).await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{
        clone_repo, git_ok, init_remote_and_clone, init_repo, write_file,
    };
    use std::path::Path;

    fn branch_with_commit(path: &str, branch: &str, file: &str, content: &str) {
        git_ok(path, &["checkout", "-b", branch]);
        write_file(path, file, content);
        git_ok(path, &["add", "."]);
        git_ok(path, &["commit", "-m", &format!("work on {branch}")]);
        git_ok(path, &["checkout", "main"]);
    }

    #[test]
    fn ahead_behind_parses_every_shape() {
        assert_eq!(parse_ahead_behind("[ahead 2, behind 5]"), (2, 5));
        assert_eq!(parse_ahead_behind("[ahead 3]"), (3, 0));
        assert_eq!(parse_ahead_behind("[behind 1]"), (0, 1));
        assert_eq!(parse_ahead_behind("[gone]"), (0, 0));
        assert_eq!(parse_ahead_behind(""), (0, 0));
    }

    #[test]
    fn overwrite_refusals_are_turned_into_a_file_list() {
        let stderr = concat!(
            "error: Your local changes to the following files would be overwritten by checkout:\n",
            "\ta.txt\n",
            "\tseñal ñ.txt\n",
            "Please commit your changes or stash them before you switch branches.\n",
            "Aborting\n",
        );
        assert_eq!(
            overwrite_files(stderr),
            vec!["a.txt".to_string(), "señal ñ.txt".to_string()]
        );
        assert!(overwrite_files("error: pathspec 'x' did not match").is_empty());
    }

    #[test]
    fn lists_local_branches_with_shas() {
        let (_dir, path) = init_repo();
        branch_with_commit(&path, "feature/añadir", "b.txt", "b\n");

        let branches = list_branches_inner(&path).unwrap();

        assert_eq!(branches.current.as_deref(), Some("main"));
        let names: Vec<&str> = branches.local.iter().map(|b| b.name.as_str()).collect();
        assert!(names.contains(&"main"), "got: {names:?}");
        assert!(names.contains(&"feature/añadir"), "got: {names:?}");
        assert!(branches.local.iter().all(|b| b.sha.len() == 40));
        assert!(branches.remote.is_empty());
    }

    #[test]
    fn a_clone_reports_its_upstream_and_ahead_count() {
        let (_remote, _clone, path) = init_remote_and_clone();
        write_file(&path, "a.txt", "ahead\n");
        git_ok(&path, &["commit", "-am", "ahead"]);

        let branches = list_branches_inner(&path).unwrap();
        let main = branches.local.iter().find(|b| b.name == "main").unwrap();

        assert_eq!(main.upstream.as_deref(), Some("origin/main"));
        assert_eq!(main.ahead, 1);
        assert_eq!(main.behind, 0);
        assert!(branches.remote.iter().all(|b| !b.name.ends_with("/HEAD")));
    }

    #[test]
    fn checkout_switches_branches() {
        let (_dir, path) = init_repo();
        branch_with_commit(&path, "feature", "b.txt", "feature\n");

        assert_eq!(
            checkout_branch_inner(&path, "feature", false, false),
            CheckoutResult::Success
        );
        assert_eq!(git_ok(&path, &["branch", "--show-current"]), "feature");
    }

    #[test]
    fn a_dirty_file_blocks_checkout_and_is_named() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "a.txt", "feature\n");
        git_ok(&path, &["commit", "-am", "feature"]);
        git_ok(&path, &["checkout", "main"]);
        write_file(&path, "a.txt", "dirty\n");

        let result = checkout_branch_inner(&path, "feature", false, false);

        assert_eq!(
            result,
            CheckoutResult::WouldOverwrite {
                files: vec!["a.txt".to_string()]
            }
        );
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "dirty\n"
        );
    }

    #[test]
    fn force_discards_changes_but_keeps_untracked_files() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "a.txt", "feature\n");
        git_ok(&path, &["commit", "-am", "feature"]);
        git_ok(&path, &["checkout", "main"]);

        write_file(&path, "a.txt", "dirty\n");
        write_file(&path, "notas señal ñ.txt", "keep me\n");
        write_file(&path, "scratch/deep note.txt", "keep me too\n");

        assert_eq!(
            checkout_branch_inner(&path, "feature", false, true),
            CheckoutResult::Success
        );

        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "feature\n"
        );
        assert!(
            Path::new(&path).join("notas señal ñ.txt").exists(),
            "force must never delete untracked files"
        );
        assert!(Path::new(&path).join("scratch/deep note.txt").exists());
    }

    #[test]
    fn a_remote_branch_becomes_a_tracking_branch() {
        let (_remote, _clone, path) = init_remote_and_clone();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "feature\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "feature"]);
        git_ok(&path, &["push", "-u", "origin", "feature"]);
        git_ok(&path, &["checkout", "main"]);
        git_ok(&path, &["branch", "-D", "feature"]);

        assert_eq!(
            checkout_branch_inner(&path, "origin/feature", true, false),
            CheckoutResult::Success
        );
        assert_eq!(
            git_ok(
                &path,
                &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]
            ),
            "origin/feature"
        );
    }

    #[test]
    fn a_remote_branch_without_tracking_detaches() {
        let (_remote, _clone, path) = init_remote_and_clone();
        assert_eq!(
            checkout_branch_inner(&path, "origin/main", false, false),
            CheckoutResult::DetachedHead
        );
    }

    #[test]
    fn a_commit_id_or_tag_detaches_head() {
        let (_dir, path) = init_repo();
        let sha = git_ok(&path, &["rev-parse", "HEAD"]);
        git_ok(&path, &["tag", "v1"]);

        assert_eq!(
            checkout_branch_inner(&path, &sha, false, false),
            CheckoutResult::DetachedHead
        );
        git_ok(&path, &["checkout", "main"]);
        assert_eq!(
            checkout_branch_inner(&path, "v1", false, false),
            CheckoutResult::DetachedHead
        );
    }

    #[test]
    fn checking_out_a_missing_branch_is_an_error() {
        let (_dir, path) = init_repo();
        assert!(matches!(
            checkout_branch_inner(&path, "missing", false, false),
            CheckoutResult::Error { .. }
        ));
        assert!(matches!(
            checkout_branch_inner(&path, "--exec=calc", false, false),
            CheckoutResult::Error { .. }
        ));
    }

    #[test]
    fn fast_forward_without_an_upstream() {
        let (_dir, path) = init_repo();
        assert_eq!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::NoUpstream
        );
    }

    #[test]
    fn fast_forward_reports_already_up_to_date() {
        let (_remote, _clone, path) = init_remote_and_clone();
        assert_eq!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::AlreadyUpToDate
        );
    }

    /// Push one commit to `remote` from a throwaway clone.
    fn advance_remote(remote: &Path, content: &str) {
        let (_dir, path) = clone_repo(remote);
        write_file(&path, "a.txt", content);
        git_ok(&path, &["commit", "-am", "remote update"]);
        git_ok(&path, &["push", "origin", "main"]);
    }

    #[test]
    fn fast_forward_advances_the_checked_out_branch() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "remote update\n");

        assert_eq!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::FastForwarded
        );
        assert_eq!(
            std::fs::read_to_string(Path::new(&path).join("a.txt")).unwrap(),
            "remote update\n"
        );
    }

    #[test]
    fn fast_forward_advances_a_branch_that_is_not_checked_out() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "remote update\n");
        git_ok(&path, &["checkout", "-b", "side"]);

        assert_eq!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::FastForwarded
        );
        assert_eq!(
            git_ok(&path, &["rev-parse", "main"]),
            git_ok(&path, &["rev-parse", "origin/main"])
        );
        // The work tree stayed on `side`.
        assert_eq!(git_ok(&path, &["branch", "--show-current"]), "side");
    }

    #[test]
    fn diverged_branches_are_not_fast_forwardable() {
        let (remote, _clone, path) = init_remote_and_clone();
        advance_remote(remote.path(), "theirs\n");
        write_file(&path, "local.txt", "ours\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "ours"]);

        assert_eq!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::NotFastForwardable
        );
    }

    #[test]
    fn an_unreachable_remote_is_a_network_error() {
        let (_remote, _clone, path) = init_remote_and_clone();
        git_ok(
            &path,
            &[
                "remote",
                "set-url",
                "origin",
                "https://127.0.0.1:9/missing.git",
            ],
        );

        assert!(matches!(
            fast_forward_inner(&path, "main"),
            FastForwardResult::NetworkError { .. }
        ));
    }

    #[test]
    fn tags_resolve_to_commits_and_report_their_kind() {
        let (_dir, path) = init_repo();
        let commit = git_ok(&path, &["rev-parse", "HEAD"]);
        git_ok(&path, &["tag", "v1-light"]);
        git_ok(&path, &["tag", "-a", "v2-annotated", "-m", "versión ñ"]);

        let mut tags = list_tags_inner(&path).unwrap();
        tags.sort_by(|a, b| a.name.cmp(&b.name));
        assert_eq!(tags.len(), 2);

        let light = &tags[0];
        assert_eq!(light.name, "v1-light");
        assert!(!light.is_annotated);
        assert_eq!(light.sha, commit);
        assert_eq!(light.message, None);

        let annotated = &tags[1];
        assert_eq!(annotated.name, "v2-annotated");
        assert!(annotated.is_annotated);
        // The peeled commit, not the tag object.
        assert_eq!(annotated.sha, commit);
        assert_eq!(annotated.message.as_deref(), Some("versión ñ"));
    }

    #[test]
    fn invalid_paths_are_rejected() {
        assert!(list_branches_inner("").is_err());
        assert!(list_tags_inner("--exec=calc").is_err());
    }
}
