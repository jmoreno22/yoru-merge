use serde::{Deserialize, Serialize};

/// Result of a `git merge` operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MergeResult {
    /// The branch was already fully merged; nothing to do.
    UpToDate,
    /// The merge advanced HEAD via fast-forward (no merge commit created).
    FastForward,
    /// A merge commit was created successfully.
    Success,
    /// A squash merge was applied and staged, but no commit was created.
    Squashed,
    /// The merge could not complete due to conflicts.
    Conflicts { files: Vec<String> },
}

/// The four views of a conflicted file needed for a three-way merge editor.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeContent {
    /// Common ancestor version (empty string for add/add conflicts with no base).
    pub base: String,
    /// Our (HEAD) version.
    pub ours: String,
    /// Incoming (theirs) version.
    pub theirs: String,
    /// Current on-disk content, including `<<<<<<<`, `=======`, `>>>>>>>` markers.
    pub current: String,
}
