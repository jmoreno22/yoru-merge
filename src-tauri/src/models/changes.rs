use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingChanges {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
    /// Hash of the raw `git status` output these lists were parsed from.
    pub fingerprint: String,
    /// The caller's fingerprint still matches; every list is empty.
    pub unchanged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    /// Source path for renames and copies; `None` otherwise.
    pub old_path: Option<String>,
    pub status: FileChangeStatus,
    /// A gitlink entry: its diff is a commit pointer, not file content.
    pub is_submodule: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
}
