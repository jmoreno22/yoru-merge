//! Staging and unstaging individual hunks of a file.

use super::git::{
    blocking, validate_pathspec, validate_repo_path, GitCmd, NO_EXT_DIFF, NO_TEXTCONV,
};
use serde::{Deserialize, Serialize};

/// One hunk of a file's diff, identified by its position in that diff.
///
/// An ordinal survives re-reading the patch, which byte offsets do not: the
/// frontend and the backend both parse the same `git diff` output, so "the
/// third hunk" is unambiguous while "byte 412" depends on how the diff was
/// generated.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct HunkRange {
    /// Zero-based index of the hunk inside the file's diff.
    pub index: u32,
}

/// Everything before the first `@@` (the `diff --git`, mode, `index`, `---`
/// and `+++` lines) plus one string per hunk.
///
/// The header is copied verbatim so `new file mode`, `deleted file mode`,
/// `rename from/to` and `/dev/null` sides survive into the sliced patch.
pub(super) fn split_diff(diff: &str) -> (String, Vec<String>) {
    let mut header = String::new();
    let mut hunks: Vec<String> = Vec::new();

    for line in diff.split_inclusive('\n') {
        if line.starts_with("@@") {
            hunks.push(line.to_string());
        } else if let Some(current) = hunks.last_mut() {
            current.push_str(line);
        } else {
            header.push_str(line);
        }
    }
    (header, hunks)
}

/// Rebuild a patch containing only `selection`, in diff order.
pub(super) fn slice_hunks(diff: &str, selection: &[HunkRange]) -> Result<String, String> {
    let (header, hunks) = split_diff(diff);
    if hunks.is_empty() {
        return Err("the file has no diff to stage".to_string());
    }

    let mut indices: Vec<usize> = Vec::with_capacity(selection.len());
    for range in selection {
        let index = range.index as usize;
        if index >= hunks.len() {
            return Err(format!(
                "hunk {index} is out of range (the file has {})",
                hunks.len()
            ));
        }
        if indices.contains(&index) {
            return Err(format!("hunk {index} selected twice"));
        }
        indices.push(index);
    }
    indices.sort_unstable();

    let mut patch = header;
    for index in indices {
        patch.push_str(&hunks[index]);
    }
    if !patch.ends_with('\n') {
        patch.push('\n');
    }
    Ok(patch)
}

/// `git apply --cached`, dry-run first so a rejected patch never leaves the
/// index half-written.
fn apply_to_index(path: &str, patch: &[u8], reverse: bool) -> Result<(), String> {
    for check in [true, false] {
        let mut cmd = GitCmd::in_repo(path).args(["apply", "--cached", "--whitespace=nowarn"]);
        if reverse {
            cmd = cmd.arg("--reverse");
        }
        if check {
            cmd = cmd.arg("--check");
        }
        cmd.run_with_stdin(patch)?;
    }
    Ok(())
}

/// Paths a patch would touch, taken from the lines git actually reads to
/// decide a target: `---` / `+++`, and the rename/copy headers a pure rename
/// carries instead of them.
pub(super) fn patch_paths(patch: &str) -> Result<Vec<String>, String> {
    const SIDE_PREFIXES: [&str; 2] = ["--- ", "+++ "];
    const NAME_PREFIXES: [&str; 4] = ["rename from ", "rename to ", "copy from ", "copy to "];

    let mut paths = Vec::new();
    for line in patch.lines() {
        let raw = if let Some(rest) = SIDE_PREFIXES.iter().find_map(|p| line.strip_prefix(p)) {
            // `--- a/x` / `+++ b/x`; `/dev/null` is the missing side of an
            // added or deleted file and names nothing.
            if rest.trim_end() == "/dev/null" {
                continue;
            }
            rest
        } else if let Some(rest) = NAME_PREFIXES.iter().find_map(|p| line.strip_prefix(p)) {
            rest
        } else {
            continue;
        };

        // Git quotes a header path when it holds unusual bytes; the quoting
        // never hides a `..`, so the raw text is what has to be checked.
        let mut candidate = raw.trim_end_matches(['\r', '\n', '\t']).trim_end();
        if candidate.len() >= 2 && candidate.starts_with('"') && candidate.ends_with('"') {
            candidate = &candidate[1..candidate.len() - 1];
        }
        let candidate = candidate
            .strip_prefix("a/")
            .or_else(|| candidate.strip_prefix("b/"))
            .unwrap_or(candidate);

        validate_pathspec(candidate)
            .map_err(|e| format!("the patch touches an invalid path: {e}"))?;
        if candidate.starts_with('/')
            || candidate.starts_with('\\')
            || std::path::Path::new(candidate).is_absolute()
            // `C:x` is drive-relative on Windows and escapes the repo too.
            || candidate.as_bytes().get(1) == Some(&b':')
        {
            return Err(format!(
                "the patch touches a path outside the repository: {candidate}"
            ));
        }
        paths.push(candidate.to_string());
    }
    Ok(paths)
}

fn apply_patch_inner(path: &str, patch: &str, reverse: bool, cached: bool) -> Result<(), String> {
    validate_repo_path(path)?;
    if patch_paths(patch)?.is_empty() {
        return Err("the patch does not name any file".to_string());
    }

    // `--unidiff-zero` and `--recount` are what make a synthetic line-selection
    // patch applicable: it carries no context and its hunk counts are whatever
    // the caller computed.
    for check in [true, false] {
        let mut cmd = GitCmd::in_repo(path).args([
            "apply",
            "--unidiff-zero",
            "--recount",
            "--whitespace=nowarn",
        ]);
        if cached {
            cmd = cmd.arg("--cached");
        }
        if reverse {
            cmd = cmd.arg("--reverse");
        }
        if check {
            cmd = cmd.arg("--check");
        }
        cmd.arg("-").run_with_stdin(patch.as_bytes())?;
    }
    Ok(())
}

fn file_diff(path: &str, file: &str, staged: bool) -> Result<String, String> {
    let mut cmd = GitCmd::in_repo(path).args(["diff", NO_EXT_DIFF, NO_TEXTCONV, "--no-color"]);
    if staged {
        cmd = cmd.arg("--cached");
    }
    cmd.arg("--").arg(file).run()
}

fn stage_hunks_inner(path: &str, file: &str, selection: &[HunkRange]) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;
    if selection.is_empty() {
        return Ok(());
    }
    let patch = slice_hunks(&file_diff(path, file, false)?, selection)?;
    apply_to_index(path, patch.as_bytes(), false)
}

fn unstage_hunks_inner(path: &str, file: &str, selection: &[HunkRange]) -> Result<(), String> {
    validate_repo_path(path)?;
    validate_pathspec(file)?;
    if selection.is_empty() {
        return Ok(());
    }
    let patch = slice_hunks(&file_diff(path, file, true)?, selection)?;
    apply_to_index(path, patch.as_bytes(), true)
}

/// Stage the selected hunks of `file`.
#[tauri::command]
pub async fn stage_hunks(
    path: String,
    file: String,
    selection: Vec<HunkRange>,
) -> Result<(), String> {
    blocking(move || stage_hunks_inner(&path, &file, &selection)).await
}

/// Unstage the selected hunks of `file`.
#[tauri::command]
pub async fn unstage_hunks(
    path: String,
    file: String,
    selection: Vec<HunkRange>,
) -> Result<(), String> {
    blocking(move || unstage_hunks_inner(&path, &file, &selection)).await
}

/// Apply a caller-built patch, for selections finer than a whole hunk.
///
/// `cached` targets the index (stage selected lines); clearing it targets the
/// work tree, which paired with `reverse` is how selected lines are discarded.
#[tauri::command]
pub async fn apply_patch(
    path: String,
    patch: String,
    reverse: bool,
    cached: bool,
) -> Result<(), String> {
    blocking(move || apply_patch_inner(&path, &patch, reverse, cached)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{
        arm_external_diff, arm_textconv, git_ok, init_repo, write_file,
    };

    const TWO_HUNKS: &str = concat!(
        "diff --git a/foo.txt b/foo.txt\n",
        "index abc1234..def5678 100644\n",
        "--- a/foo.txt\n",
        "+++ b/foo.txt\n",
        "@@ -1,3 +1,3 @@\n",
        " line1\n",
        "-old2\n",
        "+new2\n",
        " line3\n",
        "@@ -10,3 +10,3 @@\n",
        " line10\n",
        "-old11\n",
        "+new11\n",
        " line12\n",
    );

    #[test]
    fn the_header_and_every_hunk_are_separated() {
        let (header, hunks) = split_diff(TWO_HUNKS);
        assert!(header.starts_with("diff --git"));
        assert!(header.ends_with("+++ b/foo.txt\n"));
        assert_eq!(hunks.len(), 2);
        assert!(hunks[0].starts_with("@@ -1,3"));
        assert!(hunks[1].starts_with("@@ -10,3"));
    }

    #[test]
    fn slicing_keeps_the_header_and_only_the_chosen_hunk() {
        let patch = slice_hunks(TWO_HUNKS, &[HunkRange { index: 0 }]).unwrap();
        assert!(patch.contains("+new2"));
        assert!(!patch.contains("+new11"));
        assert_eq!(patch.matches("@@ -").count(), 1);
        assert!(patch.ends_with('\n'));
    }

    #[test]
    fn file_creation_headers_are_preserved() {
        let created = concat!(
            "diff --git a/new.txt b/new.txt\n",
            "new file mode 100644\n",
            "index 0000000..3582182\n",
            "--- /dev/null\n",
            "+++ b/new.txt\n",
            "@@ -0,0 +1,1 @@\n",
            "+hello\n",
        );
        let patch = slice_hunks(created, &[HunkRange { index: 0 }]).unwrap();
        assert!(patch.contains("new file mode 100644"));
        assert!(patch.contains("--- /dev/null"));
    }

    #[test]
    fn out_of_range_and_duplicate_selections_are_rejected() {
        assert!(slice_hunks(TWO_HUNKS, &[HunkRange { index: 5 }]).is_err());
        assert!(slice_hunks(TWO_HUNKS, &[HunkRange { index: 1 }, HunkRange { index: 1 }]).is_err());
        assert!(slice_hunks("", &[HunkRange { index: 0 }]).is_err());
    }

    #[test]
    fn selection_order_does_not_matter() {
        let forwards =
            slice_hunks(TWO_HUNKS, &[HunkRange { index: 0 }, HunkRange { index: 1 }]).unwrap();
        let backwards =
            slice_hunks(TWO_HUNKS, &[HunkRange { index: 1 }, HunkRange { index: 0 }]).unwrap();
        assert_eq!(forwards, backwards);
    }

    /// Twenty lines with the given terminator, so the same test covers CRLF.
    fn numbered(lines: usize, eol: &str) -> String {
        (1..=lines)
            .map(|i| format!("line{i}{eol}"))
            .collect::<String>()
    }

    fn stage_first_hunk_only(eol: &str, file: &str) {
        let (_dir, path) = init_repo();
        write_file(&path, file, &numbered(20, eol));
        git_ok(&path, &["add", "--", file]);
        git_ok(&path, &["commit", "-m", "base"]);

        let mut lines: Vec<String> = (1..=20).map(|i| format!("line{i}")).collect();
        lines[0] = "MODIFIED_FIRST".to_string();
        lines[17] = "MODIFIED_LAST".to_string();
        let modified: String = lines.iter().map(|l| format!("{l}{eol}")).collect();
        write_file(&path, file, &modified);

        stage_hunks_inner(&path, file, &[HunkRange { index: 0 }]).unwrap();

        let staged = git_ok(&path, &["diff", "--cached", "--no-color", "--", file]);
        assert!(staged.contains("+MODIFIED_FIRST"), "staged:\n{staged}");
        assert!(!staged.contains("MODIFIED_LAST"), "staged:\n{staged}");

        let unstaged = git_ok(&path, &["diff", "--no-color", "--", file]);
        assert!(
            !unstaged.contains("+MODIFIED_FIRST"),
            "unstaged:\n{unstaged}"
        );
        assert!(unstaged.contains("MODIFIED_LAST"), "unstaged:\n{unstaged}");
    }

    #[test]
    fn staging_one_hunk_leaves_the_other_unstaged() {
        stage_first_hunk_only("\n", "file.txt");
    }

    #[test]
    fn crlf_files_and_unicode_names_stage_by_hunk_too() {
        stage_first_hunk_only("\r\n", "señal ñ.txt");
    }

    #[test]
    fn unstaging_a_hunk_returns_it_to_the_work_tree() {
        let (_dir, path) = init_repo();
        write_file(&path, "file.txt", &numbered(20, "\n"));
        git_ok(&path, &["add", "file.txt"]);
        git_ok(&path, &["commit", "-m", "base"]);

        let mut lines: Vec<String> = (1..=20).map(|i| format!("line{i}\n")).collect();
        lines[0] = "CHANGED_FIRST\n".to_string();
        lines[17] = "CHANGED_LAST\n".to_string();
        write_file(&path, "file.txt", &lines.concat());
        git_ok(&path, &["add", "file.txt"]);

        unstage_hunks_inner(&path, "file.txt", &[HunkRange { index: 0 }]).unwrap();

        let staged = git_ok(&path, &["diff", "--cached", "--no-color", "--", "file.txt"]);
        assert!(!staged.contains("CHANGED_FIRST"), "staged:\n{staged}");
        assert!(staged.contains("CHANGED_LAST"), "staged:\n{staged}");
    }

    /// A driver would also break staging outright: the patch fed to `git apply`
    /// would be whatever the program printed.
    #[test]
    fn a_diff_driver_configured_by_the_repository_is_never_executed() {
        let (_dir, path) = init_repo();
        write_file(&path, "file.txt", &numbered(20, "\n"));
        git_ok(&path, &["add", "file.txt"]);
        git_ok(&path, &["commit", "-m", "base"]);

        let mut lines: Vec<String> = (1..=20).map(|i| format!("line{i}\n")).collect();
        lines[0] = "CHANGED_FIRST\n".to_string();
        write_file(&path, "file.txt", &lines.concat());
        let marker = arm_external_diff(&path);
        let textconv_marker = arm_textconv(&path);

        let outcome = stage_hunks_inner(&path, "file.txt", &[HunkRange { index: 0 }]);

        assert!(!marker.exists(), "the repository's diff.external ran");
        assert!(!textconv_marker.exists(), "the repository's textconv ran");
        outcome.unwrap();
        // Both flags here too, so the check itself cannot trip either driver.
        let staged = git_ok(
            &path,
            &[
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--cached",
                "--",
                "file.txt",
            ],
        );
        assert!(staged.contains("+CHANGED_FIRST"), "staged:\n{staged}");
    }

    #[test]
    fn invalid_arguments_are_rejected() {
        let (_dir, path) = init_repo();
        assert!(stage_hunks_inner("", "foo", &[HunkRange { index: 0 }]).is_err());
        assert!(stage_hunks_inner(&path, "../escape", &[HunkRange { index: 0 }]).is_err());
        // An empty selection is a no-op, not an error.
        assert!(stage_hunks_inner(&path, "a.txt", &[]).is_ok());
    }

    // ── apply_patch ──────────────────────────────────────────────────────────

    /// Five numbered lines, committed.
    fn five_line_repo() -> (tempfile::TempDir, String) {
        let (dir, path) = init_repo();
        write_file(&path, "file.txt", &numbered(5, "\n"));
        git_ok(&path, &["add", "file.txt"]);
        git_ok(&path, &["commit", "-m", "base"]);
        (dir, path)
    }

    /// A zero-context patch replacing one line, the way a line-selection UI
    /// builds it.
    fn one_line_patch(line_no: usize, from: &str, to: &str) -> String {
        format!(
            "diff --git a/file.txt b/file.txt\n\
             --- a/file.txt\n\
             +++ b/file.txt\n\
             @@ -{line_no},1 +{line_no},1 @@\n\
             -{from}\n\
             +{to}\n"
        )
    }

    #[test]
    fn only_the_selected_lines_of_a_hunk_are_staged() {
        let (_dir, path) = five_line_repo();
        // One contiguous hunk touching lines 2 and 4.
        let mut lines: Vec<String> = (1..=5).map(|i| format!("line{i}\n")).collect();
        lines[1] = "CHANGED2\n".to_string();
        lines[3] = "CHANGED4\n".to_string();
        write_file(&path, "file.txt", &lines.concat());

        apply_patch_inner(&path, &one_line_patch(2, "line2", "CHANGED2"), false, true).unwrap();

        let staged = git_ok(&path, &["diff", "--cached", "--no-color", "--", "file.txt"]);
        assert!(staged.contains("+CHANGED2"), "staged:\n{staged}");
        assert!(!staged.contains("CHANGED4"), "staged:\n{staged}");

        // The work tree still holds both edits; only the index moved.
        let worktree =
            std::fs::read_to_string(std::path::Path::new(&path).join("file.txt")).unwrap();
        assert!(worktree.contains("CHANGED2") && worktree.contains("CHANGED4"));
    }

    #[test]
    fn reverse_without_cached_discards_the_selected_lines() {
        let (_dir, path) = five_line_repo();
        let mut lines: Vec<String> = (1..=5).map(|i| format!("line{i}\n")).collect();
        lines[1] = "CHANGED2\n".to_string();
        lines[3] = "CHANGED4\n".to_string();
        write_file(&path, "file.txt", &lines.concat());

        apply_patch_inner(&path, &one_line_patch(2, "line2", "CHANGED2"), true, false).unwrap();

        let worktree =
            std::fs::read_to_string(std::path::Path::new(&path).join("file.txt")).unwrap();
        assert!(worktree.contains("line2"), "worktree:\n{worktree}");
        assert!(!worktree.contains("CHANGED2"), "worktree:\n{worktree}");
        assert!(worktree.contains("CHANGED4"), "the other edit must survive");
    }

    #[test]
    fn a_rejected_patch_leaves_the_index_untouched() {
        let (_dir, path) = five_line_repo();
        // The index still holds `line2`, so this patch cannot apply.
        let stale = one_line_patch(2, "SOMETHING ELSE", "CHANGED2");

        assert!(apply_patch_inner(&path, &stale, false, true).is_err());
        assert!(git_ok(&path, &["diff", "--cached", "--name-only"]).is_empty());
    }

    #[test]
    fn patch_paths_reads_both_sides_and_rename_headers() {
        let created = concat!(
            "diff --git a/new.txt b/new.txt\n",
            "new file mode 100644\n",
            "--- /dev/null\n",
            "+++ b/new.txt\n",
            "@@ -0,0 +1,1 @@\n",
            "+hello\n",
        );
        assert_eq!(patch_paths(created).unwrap(), vec!["new.txt".to_string()]);

        let renamed = concat!(
            "diff --git a/old.txt b/new.txt\n",
            "similarity index 100%\n",
            "rename from old.txt\n",
            "rename to new.txt\n",
        );
        assert_eq!(
            patch_paths(renamed).unwrap(),
            vec!["old.txt".to_string(), "new.txt".to_string()]
        );

        let quoted = "--- \"a/señal ñ.txt\"\n+++ \"b/señal ñ.txt\"\n";
        assert_eq!(patch_paths(quoted).unwrap(), vec!["señal ñ.txt"; 2]);
    }

    #[test]
    fn patches_reaching_outside_the_repository_are_refused() {
        let (_dir, path) = five_line_repo();

        for escape in [
            "--- a/../../evil.txt\n+++ b/../../evil.txt\n",
            "--- a/file.txt\n+++ b/../outside.txt\n",
            "rename to ../../evil.txt\n",
            "--- a/file.txt\n+++ /etc/passwd\n",
            "--- a/file.txt\n+++ C:/Windows/win.ini\n",
        ] {
            let result = patch_paths(escape);
            assert!(result.is_err(), "should have been refused: {escape:?}");
            assert!(apply_patch_inner(&path, escape, false, true).is_err());
        }

        // A patch naming nothing at all is refused before git ever runs.
        assert!(apply_patch_inner(&path, "not a patch at all\n", false, true).is_err());
    }
}
