//! Everything the commit inspector needs about a single commit.
//!
//! Metadata comes from libgit2; the file list comes from `git diff` against the
//! first parent (the empty tree for a root commit), which keeps merges honest
//! and gives rename detection for free.

use std::collections::HashMap;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use git2::Repository;

use super::git::{stderr_or, validate_pathspec, validate_repo_path, validate_revision, GitCmd};
use super::history::{build_ref_map, format_git2_time};
use super::merge::resolve_in_repo;
use crate::models::{CommitDetails, CommitFile, FileChangeStatus, FileSource, SignatureStatus};

/// The well-known hash of git's empty tree, used as the base of root commits.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/// Above this a diff is useless to render and expensive to ship over IPC.
const MAX_DIFF_BYTES: usize = 10 * 1024 * 1024;

/// Base64 inflates by a third, so a preview larger than this would cost more to
/// ship over IPC than any image the UI can usefully show.
const MAX_PREVIEW_BYTES: u64 = 10 * 1024 * 1024;

const TOO_LARGE: &str = "file too large to preview";

/// First parent of `rev`, or the empty tree when it is a root commit.
fn diff_base(path: &str, rev: &str) -> String {
    GitCmd::in_repo(path)
        .args(["rev-parse", "--verify", "--quiet", &format!("{rev}^")])
        .run()
        .ok()
        .map(|sha| sha.trim().to_string())
        .filter(|sha| !sha.is_empty())
        .unwrap_or_else(|| EMPTY_TREE.to_string())
}

fn map_status(letter: char) -> FileChangeStatus {
    match letter {
        'A' => FileChangeStatus::Added,
        'D' => FileChangeStatus::Deleted,
        'R' => FileChangeStatus::Renamed,
        'C' => FileChangeStatus::Copied,
        'T' => FileChangeStatus::TypeChanged,
        _ => FileChangeStatus::Modified,
    }
}

/// Parse a combined `--raw --numstat -z` payload.
///
/// git emits every raw record first and every numstat record after, so the raw
/// pass fixes the order and the statuses while the numstat pass fills in the
/// line counts. Both passes must handle the rename form, where the path is sent
/// as two extra NUL-separated fields.
fn parse_raw_numstat(payload: &str) -> Vec<CommitFile> {
    let mut entries: Vec<(char, String, Option<String>)> = Vec::new();
    let mut stats: HashMap<String, (u32, u32, bool)> = HashMap::new();
    let mut tokens = payload.split('\0').filter(|token| !token.is_empty());

    while let Some(token) = tokens.next() {
        if let Some(header) = token.strip_prefix(':') {
            let status = header
                .rsplit(' ')
                .next()
                .and_then(|field| field.chars().next())
                .unwrap_or('M');
            let first = tokens.next().unwrap_or_default().to_string();
            if matches!(status, 'R' | 'C') {
                let second = tokens.next().unwrap_or_default().to_string();
                entries.push((status, second, Some(first)));
            } else {
                entries.push((status, first, None));
            }
            continue;
        }

        let mut fields = token.split('\t');
        let additions = fields.next().unwrap_or_default();
        let deletions = fields.next().unwrap_or_default();
        let inline_path = fields.next().unwrap_or_default();
        let path = if inline_path.is_empty() {
            tokens.next(); // old path of a rename
            tokens.next().unwrap_or_default().to_string()
        } else {
            inline_path.to_string()
        };
        stats.insert(
            path,
            (
                additions.parse().unwrap_or(0),
                deletions.parse().unwrap_or(0),
                additions == "-" || deletions == "-",
            ),
        );
    }

    entries
        .into_iter()
        .map(|(status, path, old_path)| {
            let (additions, deletions, binary) = stats.get(&path).copied().unwrap_or((0, 0, false));
            CommitFile {
                path,
                old_path,
                status: map_status(status),
                additions,
                deletions,
                binary,
            }
        })
        .collect()
}

fn signature_status(path: &str, rev: &str) -> SignatureStatus {
    let raw = GitCmd::in_repo(path)
        .args(["log", "-1", "--format=%G?", rev])
        .run()
        .unwrap_or_default();
    match raw.trim() {
        "G" | "U" => SignatureStatus::Good,
        "B" => SignatureStatus::Bad,
        "N" | "" => SignatureStatus::None,
        _ => SignatureStatus::Unknown,
    }
}

fn commit_details_inner(path: &str, sha: &str) -> Result<CommitDetails, String> {
    let repo = Repository::open(path).map_err(|e| e.message().to_string())?;
    let commit = repo
        .revparse_single(sha)
        .and_then(|object| object.peel_to_commit())
        .map_err(|_| format!("unknown revision: {sha}"))?;

    let full_sha = commit.id().to_string();
    let author = commit.author();
    let committer = commit.committer();

    let files = parse_raw_numstat(
        &GitCmd::in_repo(path)
            .args([
                "diff",
                "--raw",
                "--numstat",
                "-z",
                "--find-renames",
                &diff_base(path, &full_sha),
                &full_sha,
            ])
            .run()?,
    );
    let additions = files.iter().map(|file| file.additions).sum();
    let deletions = files.iter().map(|file| file.deletions).sum();

    Ok(CommitDetails {
        short_sha: full_sha.chars().take(7).collect(),
        parents: commit.parent_ids().map(|id| id.to_string()).collect(),
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        author_date: format_git2_time(author.when()),
        committer_name: committer.name().unwrap_or("").to_string(),
        committer_email: committer.email().unwrap_or("").to_string(),
        committer_date: format_git2_time(committer.when()),
        subject: commit.summary().unwrap_or("").to_string(),
        body: commit.body().unwrap_or("").to_string(),
        refs: build_ref_map(&repo)?
            .get(&commit.id())
            .cloned()
            .unwrap_or_default(),
        signature: signature_status(path, &full_sha),
        files,
        additions,
        deletions,
        sha: full_sha,
    })
}

fn capped(diff: String) -> Result<String, String> {
    if diff.len() > MAX_DIFF_BYTES {
        return Err("diff is larger than 10 MB and was not loaded".to_string());
    }
    Ok(diff)
}

fn commit_file_diff_inner(path: &str, sha: &str, file: &str) -> Result<String, String> {
    let base = diff_base(path, sha);
    capped(
        GitCmd::in_repo(path)
            .args(["diff", "--find-renames", &base, sha, "--", file])
            .run()?,
    )
}

fn file_at_revision_inner(path: &str, rev: &str, file: &str) -> Result<String, String> {
    capped(
        GitCmd::in_repo(path)
            .args(["show", &format!("{rev}:{file}")])
            .run()?,
    )
}

/// `git show <spec>` as raw bytes.
///
/// A preview target is usually binary, so the output must not go through the
/// lossy UTF-8 conversion every other reader in this crate uses.
fn show_bytes(path: &str, spec: &str) -> Result<Vec<u8>, String> {
    let out = GitCmd::in_repo(path).args(["show", spec]).output()?;
    if !out.status.success() {
        return Err(stderr_or(&out, "git show failed"));
    }
    if out.stdout.len() as u64 > MAX_PREVIEW_BYTES {
        return Err(TOO_LARGE.to_string());
    }
    Ok(out.stdout)
}

fn file_base64_inner(path: &str, file: &str, source: &FileSource) -> Result<String, String> {
    validate_repo_path(path)?;

    let bytes = match source {
        FileSource::Workdir => {
            let resolved = resolve_in_repo(path, file)?;
            let size = std::fs::metadata(&resolved)
                .map_err(|e| format!("cannot read file: {e}"))?
                .len();
            if size > MAX_PREVIEW_BYTES {
                return Err(TOO_LARGE.to_string());
            }
            std::fs::read(&resolved).map_err(|e| format!("cannot read file: {e}"))?
        }
        FileSource::Index => {
            validate_pathspec(file)?;
            show_bytes(path, &format!(":{file}"))?
        }
        FileSource::Rev { rev } => {
            validate_revision(rev)?;
            validate_pathspec(file)?;
            show_bytes(path, &format!("{rev}:{file}"))?
        }
    };

    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn get_commit_details(path: String, sha: String) -> Result<CommitDetails, String> {
    validate_repo_path(&path)?;
    validate_revision(&sha)?;
    tauri::async_runtime::spawn_blocking(move || commit_details_inner(&path, &sha))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_commit_file_diff(
    path: String,
    sha: String,
    file: String,
) -> Result<String, String> {
    validate_repo_path(&path)?;
    validate_revision(&sha)?;
    let file = file.replace('\\', "/");
    validate_pathspec(&file)?;
    tauri::async_runtime::spawn_blocking(move || commit_file_diff_inner(&path, &sha, &file))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_file_at_revision(
    path: String,
    rev: String,
    file: String,
) -> Result<String, String> {
    validate_repo_path(&path)?;
    validate_revision(&rev)?;
    let file = file.replace('\\', "/");
    validate_pathspec(&file)?;
    tauri::async_runtime::spawn_blocking(move || file_at_revision_inner(&path, &rev, &file))
        .await
        .map_err(|e| e.to_string())?
}

/// Raw bytes of `file` taken from `source`, base64-encoded so the UI can render
/// binary content (images) it could never receive as a string.
#[tauri::command]
pub async fn get_file_base64(
    path: String,
    file: String,
    source: FileSource,
) -> Result<String, String> {
    let file = file.replace('\\', "/");
    tauri::async_runtime::spawn_blocking(move || file_base64_inner(&path, &file, &source))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{commit_file, git_ok, init_empty_repo, write_file};

    fn file_named<'a>(details: &'a CommitDetails, path: &str) -> &'a CommitFile {
        details
            .files
            .iter()
            .find(|file| file.path == path)
            .unwrap_or_else(|| panic!("{path} missing from {:?}", details.files))
    }

    #[test]
    fn root_commit_lists_every_file_as_added() {
        let (_dir, repo) = init_empty_repo();
        write_file(&repo, "a.txt", "one\ntwo\n");
        write_file(&repo, "señal ñ.txt", "hola\n");
        git_ok(&repo, &["add", "-A"]);
        git_ok(&repo, &["commit", "-m", "root"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert!(details.parents.is_empty());
        assert_eq!(details.files.len(), 2);
        assert_eq!(
            file_named(&details, "a.txt").status,
            FileChangeStatus::Added
        );
        assert_eq!(file_named(&details, "a.txt").additions, 2);
        assert_eq!(file_named(&details, "señal ñ.txt").additions, 1);
        assert_eq!(details.additions, 3);
        assert_eq!(details.deletions, 0);
        assert_eq!(details.subject, "root");
        assert_eq!(details.signature, SignatureStatus::None);
        assert_eq!(details.short_sha.len(), 7);
        assert!(details.author_date.contains('T'));
    }

    #[test]
    fn renames_carry_their_previous_path() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "old.txt", "a\nb\nc\n", "base");
        git_ok(&repo, &["mv", "old.txt", "new.txt"]);
        write_file(&repo, "new.txt", "a\nb\nc\nd\n");
        git_ok(&repo, &["add", "-A"]);
        git_ok(&repo, &["commit", "-m", "rename"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        let renamed = file_named(&details, "new.txt");
        assert_eq!(renamed.status, FileChangeStatus::Renamed);
        assert_eq!(renamed.old_path.as_deref(), Some("old.txt"));
        assert_eq!(renamed.additions, 1);
        assert_eq!(renamed.deletions, 0);
    }

    #[test]
    fn deletions_and_additions_are_reported_separately() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "gone.txt", "x\ny\n", "base");
        git_ok(&repo, &["rm", "-q", "gone.txt"]);
        write_file(&repo, "fresh.txt", "new\n");
        git_ok(&repo, &["add", "-A"]);
        git_ok(&repo, &["commit", "-m", "swap"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert_eq!(
            file_named(&details, "gone.txt").status,
            FileChangeStatus::Deleted
        );
        assert_eq!(file_named(&details, "gone.txt").deletions, 2);
        assert_eq!(
            file_named(&details, "fresh.txt").status,
            FileChangeStatus::Added
        );
    }

    #[test]
    fn merge_commits_diff_against_their_first_parent() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "base\n", "base");
        git_ok(&repo, &["checkout", "-b", "feature"]);
        commit_file(&repo, "feature.txt", "f\n", "feature");
        git_ok(&repo, &["checkout", "main"]);
        commit_file(&repo, "main.txt", "m\n", "main");
        git_ok(&repo, &["merge", "--no-ff", "-m", "merge", "feature"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert_eq!(details.parents.len(), 2);
        assert_eq!(details.files.len(), 1);
        assert_eq!(details.files[0].path, "feature.txt");
    }

    #[test]
    fn binary_files_are_flagged() {
        let (_dir, repo) = init_empty_repo();
        std::fs::write(
            std::path::Path::new(&repo).join("blob.bin"),
            [0u8, 1, 2, 0, 3],
        )
        .unwrap();
        git_ok(&repo, &["add", "-A"]);
        git_ok(&repo, &["commit", "-m", "binary"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert!(file_named(&details, "blob.bin").binary);
        assert_eq!(file_named(&details, "blob.bin").additions, 0);
    }

    #[test]
    fn subject_and_body_are_split() {
        let (_dir, repo) = init_empty_repo();
        write_file(&repo, "file.txt", "x\n");
        git_ok(&repo, &["add", "-A"]);
        git_ok(
            &repo,
            &["commit", "-m", "the subject", "-m", "the body\nsecond line"],
        );

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert_eq!(details.subject, "the subject");
        assert!(details.body.starts_with("the body"));
        assert!(details.body.contains("second line"));
    }

    #[test]
    fn refs_pointing_at_the_commit_are_included() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "x\n", "only");
        git_ok(&repo, &["tag", "-a", "v1", "-m", "release"]);

        let details = commit_details_inner(&repo, "HEAD").unwrap();
        assert!(details.refs.iter().any(|r| r.name == "v1"));
        assert!(details.refs.iter().any(|r| r.name == "main"));
    }

    #[test]
    fn unknown_revisions_report_a_readable_error() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "x\n", "only");
        let error = commit_details_inner(&repo, "cafebabe").unwrap_err();
        assert!(error.contains("unknown revision"), "got: {error}");
    }

    #[test]
    fn file_diff_works_for_root_and_regular_commits() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "root");
        let root = git_ok(&repo, &["rev-parse", "HEAD"]);
        commit_file(&repo, "file.txt", "two\n", "second");
        let head = git_ok(&repo, &["rev-parse", "HEAD"]);

        let root_diff = commit_file_diff_inner(&repo, &root, "file.txt").unwrap();
        assert!(root_diff.contains("+one"));
        assert!(root_diff.contains("new file mode"));

        let head_diff = commit_file_diff_inner(&repo, &head, "file.txt").unwrap();
        assert!(head_diff.contains("-one"));
        assert!(head_diff.contains("+two"));
    }

    #[test]
    fn diff_base_falls_back_to_the_empty_tree() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "root");
        assert_eq!(diff_base(&repo, "HEAD"), EMPTY_TREE);

        commit_file(&repo, "file.txt", "two\n", "second");
        assert_ne!(diff_base(&repo, "HEAD"), EMPTY_TREE);
    }

    #[test]
    fn reads_a_file_at_an_older_revision() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "señal ñ.txt", "primero\n", "one");
        let first = git_ok(&repo, &["rev-parse", "HEAD"]);
        commit_file(&repo, "señal ñ.txt", "segundo\n", "two");

        let old = file_at_revision_inner(&repo, &first, "señal ñ.txt").unwrap();
        assert_eq!(old.trim_end_matches(['\r', '\n']), "primero");
        assert!(file_at_revision_inner(&repo, &first, "missing.txt").is_err());
    }

    #[test]
    fn base64_reads_binary_bytes_from_the_work_tree() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "a.txt", "x\n", "one");
        std::fs::write(
            std::path::Path::new(&repo).join("logo.png"),
            [0x89u8, 0x50, 0x4E, 0x47],
        )
        .unwrap();

        let encoded = file_base64_inner(&repo, "logo.png", &FileSource::Workdir).unwrap();
        assert_eq!(encoded, "iVBORw==");
        assert!(file_base64_inner(&repo, "../escape", &FileSource::Workdir).is_err());
    }

    #[test]
    fn base64_distinguishes_work_tree_index_and_revision() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "f.txt", "first\n", "one");
        let first = git_ok(&repo, &["rev-parse", "HEAD"]);
        write_file(&repo, "f.txt", "staged\n");
        git_ok(&repo, &["add", "--", "f.txt"]);
        write_file(&repo, "f.txt", "working\n");

        let text = |encoded: String| {
            String::from_utf8(STANDARD.decode(encoded).expect("valid base64")).expect("utf-8")
        };

        assert_eq!(
            text(file_base64_inner(&repo, "f.txt", &FileSource::Workdir).unwrap()),
            "working\n"
        );
        assert_eq!(
            text(file_base64_inner(&repo, "f.txt", &FileSource::Index).unwrap()),
            "staged\n"
        );
        assert_eq!(
            text(file_base64_inner(&repo, "f.txt", &FileSource::Rev { rev: first }).unwrap()),
            "first\n"
        );

        assert!(file_base64_inner(&repo, "missing.txt", &FileSource::Index).is_err());
        assert!(file_base64_inner(
            &repo,
            "f.txt",
            &FileSource::Rev {
                rev: "--exec=calc".to_string()
            }
        )
        .is_err());
    }

    #[test]
    fn a_preview_over_the_cap_is_refused() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "a.txt", "x\n", "one");
        std::fs::write(
            std::path::Path::new(&repo).join("big.bin"),
            vec![0u8; MAX_PREVIEW_BYTES as usize + 1],
        )
        .unwrap();

        assert_eq!(
            file_base64_inner(&repo, "big.bin", &FileSource::Workdir).unwrap_err(),
            TOO_LARGE
        );
    }

    #[test]
    fn parses_a_rename_only_payload() {
        let payload = ":100644 100644 de98044 d68dd40 R075\0old.txt\0new.txt\0\
                       1\t0\t\0old.txt\0new.txt\0";
        let files = parse_raw_numstat(payload);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "new.txt");
        assert_eq!(files[0].old_path.as_deref(), Some("old.txt"));
        assert_eq!(files[0].additions, 1);
        assert_eq!(files[0].status, FileChangeStatus::Renamed);
    }

    #[test]
    fn parses_a_binary_numstat_entry() {
        let payload = ":000000 100644 0000000 d7f758c A\0blob.bin\0-\t-\tblob.bin\0";
        let files = parse_raw_numstat(payload);
        assert_eq!(files.len(), 1);
        assert!(files[0].binary);
        assert_eq!(files[0].additions, 0);
    }

    #[test]
    fn an_empty_payload_yields_no_files() {
        assert!(parse_raw_numstat("").is_empty());
    }
}
