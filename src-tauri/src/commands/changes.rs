//! Working-tree status.

use super::git::{blocking, validate_repo_path, GitCmd};
use crate::models::{FileChange, FileChangeStatus, WorkingChanges};

fn map_status_char(c: u8) -> Option<FileChangeStatus> {
    match c {
        b'M' => Some(FileChangeStatus::Modified),
        b'A' => Some(FileChangeStatus::Added),
        b'D' => Some(FileChangeStatus::Deleted),
        b'R' => Some(FileChangeStatus::Renamed),
        b'C' => Some(FileChangeStatus::Copied),
        b'T' => Some(FileChangeStatus::TypeChanged),
        _ => None,
    }
}

/// The 4-character `<sub>` field is `N...` for an ordinary path and
/// `S<c><m><u>` for a submodule.
fn is_submodule_field(field: &[u8]) -> bool {
    field.first() == Some(&b'S')
}

/// Last space-separated field of a record — the path, which may itself contain
/// spaces, so it must be taken as the remainder rather than split further.
fn record_path(token: &[u8], field_count: usize) -> Option<&str> {
    let parts: Vec<&[u8]> = token.splitn(field_count, |&b| b == b' ').collect();
    if parts.len() < field_count {
        return None;
    }
    std::str::from_utf8(parts[field_count - 1]).ok()
}

/// Parse raw `git status --porcelain=v2 -z` bytes.
///
/// Records are NUL-terminated; a rename/copy record (`2`) is followed by a
/// second NUL-token holding the source path.
pub(super) fn parse_porcelain_v2(data: &[u8]) -> WorkingChanges {
    let mut staged: Vec<FileChange> = Vec::new();
    let mut unstaged: Vec<FileChange> = Vec::new();
    let mut untracked: Vec<String> = Vec::new();
    let mut conflicted: Vec<String> = Vec::new();

    let mut tokens = data.split(|&b| b == b'\0');
    while let Some(token) = tokens.next() {
        match token.first() {
            // "1 XY sub mH mI mW hH hI path"
            Some(b'1') => {
                let parts: Vec<&[u8]> = token.splitn(9, |&b| b == b' ').collect();
                let (Some(xy), Some(path)) = (parts.get(1), record_path(token, 9)) else {
                    continue;
                };
                if xy.len() < 2 {
                    continue;
                }
                let is_submodule = parts.get(2).is_some_and(|f| is_submodule_field(f));
                if let Some(status) = map_status_char(xy[0]) {
                    staged.push(FileChange {
                        path: path.to_string(),
                        old_path: None,
                        status,
                        is_submodule,
                    });
                }
                if let Some(status) = map_status_char(xy[1]) {
                    unstaged.push(FileChange {
                        path: path.to_string(),
                        old_path: None,
                        status,
                        is_submodule,
                    });
                }
            }
            // "2 XY sub mH mI mW hH hI Xscore path" + "origPath"
            Some(b'2') => {
                let source = tokens
                    .next()
                    .and_then(|t| std::str::from_utf8(t).ok())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                let parts: Vec<&[u8]> = token.splitn(10, |&b| b == b' ').collect();
                let (Some(xy), Some(path)) = (parts.get(1), record_path(token, 10)) else {
                    continue;
                };
                if xy.len() < 2 {
                    continue;
                }
                let is_submodule = parts.get(2).is_some_and(|f| is_submodule_field(f));
                if let Some(status) = map_status_char(xy[0]) {
                    staged.push(FileChange {
                        path: path.to_string(),
                        old_path: source,
                        status,
                        is_submodule,
                    });
                }
                if let Some(status) = map_status_char(xy[1]) {
                    unstaged.push(FileChange {
                        path: path.to_string(),
                        old_path: None,
                        status,
                        is_submodule,
                    });
                }
            }
            // "u XY sub m1 m2 m3 mW h1 h2 h3 path"
            Some(b'u') => {
                if let Some(path) = record_path(token, 11) {
                    conflicted.push(path.to_string());
                }
            }
            // "? path"
            Some(b'?') => {
                if let Some(path) = record_path(token, 2) {
                    untracked.push(path.to_string());
                }
            }
            // '!' (ignored) and empty separators.
            _ => {}
        }
    }

    WorkingChanges {
        staged,
        unstaged,
        untracked,
        conflicted,
    }
}

pub(super) fn working_changes_inner(path: &str) -> Result<WorkingChanges, String> {
    validate_repo_path(path)?;

    let output = GitCmd::in_repo(path)
        .args([
            "status",
            "--porcelain=v2",
            "-z",
            "--untracked-files=all",
            "--find-renames",
        ])
        .output()?;

    if !output.status.success() {
        return Err(super::git::stderr_or(&output, "git status failed"));
    }
    Ok(parse_porcelain_v2(&output.stdout))
}

/// Staged, unstaged, untracked and conflicted files of the work tree.
#[tauri::command]
pub async fn get_working_changes(path: String) -> Result<WorkingChanges, String> {
    blocking(move || working_changes_inner(&path)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

    #[test]
    fn modified_file_lands_in_unstaged_only() {
        let changes = parse_porcelain_v2(b"1 .M N... 100644 100644 100644 abc def path.txt\0");
        assert_eq!(changes.unstaged.len(), 1);
        assert_eq!(changes.unstaged[0].path, "path.txt");
        assert_eq!(changes.unstaged[0].status, FileChangeStatus::Modified);
        assert!(changes.staged.is_empty());
    }

    #[test]
    fn both_sides_are_reported_independently() {
        let changes = parse_porcelain_v2(b"1 MM N... 1 2 3 a b path\0");
        assert_eq!(changes.staged[0].status, FileChangeStatus::Modified);
        assert_eq!(changes.unstaged[0].status, FileChangeStatus::Modified);
    }

    #[test]
    fn rename_records_carry_the_source_path() {
        let changes = parse_porcelain_v2(b"2 R. N... 1 2 3 a b R90 new name.txt\0old name.txt\0");
        assert_eq!(changes.staged.len(), 1);
        assert_eq!(changes.staged[0].status, FileChangeStatus::Renamed);
        assert_eq!(changes.staged[0].path, "new name.txt");
        assert_eq!(changes.staged[0].old_path.as_deref(), Some("old name.txt"));
        assert!(changes.unstaged.is_empty());
    }

    #[test]
    fn the_sub_field_marks_gitlinks() {
        let plain = parse_porcelain_v2(b"1 .M N... 100644 100644 100644 abc def path.txt\0");
        assert!(!plain.unstaged[0].is_submodule);

        // "SC.." — a gitlink whose recorded commit moved.
        let gitlink = parse_porcelain_v2(b"1 .M SC.. 160000 160000 160000 abc def vendor/lib\0");
        assert!(gitlink.unstaged[0].is_submodule);

        let renamed = parse_porcelain_v2(b"2 R. S... 1 2 3 a b R90 vendor/new\0vendor/old\0");
        assert!(renamed.staged[0].is_submodule);
    }

    #[test]
    fn a_real_submodule_is_flagged() {
        let (_inner, inner_path) = init_repo();
        let (_dir, path) = init_repo();
        // Cloning a submodule over a local path is refused by default since
        // git 2.38; older versions simply ignore the unknown config key.
        git_ok(
            &path,
            &[
                "-c",
                "protocol.file.allow=always",
                "submodule",
                "add",
                "--",
                &inner_path.replace('\\', "/"),
                "vendor",
            ],
        );

        let changes = working_changes_inner(&path).unwrap();
        let vendor = changes
            .staged
            .iter()
            .find(|c| c.path == "vendor")
            .expect("submodule not reported");
        assert!(vendor.is_submodule);
        assert!(changes
            .staged
            .iter()
            .any(|c| c.path == ".gitmodules" && !c.is_submodule));
    }

    #[test]
    fn untracked_conflicted_and_ignored_are_separated() {
        let changes = parse_porcelain_v2(
            b"? new file.txt\0u UU N... 1 2 3 4 a b c conflict.txt\0! ignored.txt\0",
        );
        assert_eq!(changes.untracked, vec!["new file.txt".to_string()]);
        assert_eq!(changes.conflicted, vec!["conflict.txt".to_string()]);
        assert!(changes.staged.is_empty());
        assert!(changes.unstaged.is_empty());
    }

    #[test]
    fn a_real_rename_is_detected_end_to_end() {
        let (_dir, path) = init_repo();
        write_file(&path, "señal ñ.txt", "some content that stays identical\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "add"]);
        git_ok(&path, &["mv", "señal ñ.txt", "señal renombrada.txt"]);

        let changes = working_changes_inner(&path).unwrap();
        let renamed = changes
            .staged
            .iter()
            .find(|c| c.status == FileChangeStatus::Renamed)
            .expect("rename not reported");
        assert_eq!(renamed.path, "señal renombrada.txt");
        assert_eq!(renamed.old_path.as_deref(), Some("señal ñ.txt"));
    }

    #[test]
    fn untracked_files_with_spaces_survive() {
        let (_dir, path) = init_repo();
        write_file(&path, "Tom & Jerry/señal ñ.txt", "x\n");

        let changes = working_changes_inner(&path).unwrap();
        assert_eq!(changes.untracked, vec!["Tom & Jerry/señal ñ.txt"]);
    }

    #[test]
    fn invalid_paths_are_rejected() {
        assert!(working_changes_inner("").is_err());
        assert!(working_changes_inner("--exec=calc").is_err());
    }
}
