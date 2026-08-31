use serde::{Deserialize, Serialize};

use super::changes::FileChangeStatus;
use super::commit::RefInfo;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignatureStatus {
    None,
    Good,
    Bad,
    Unknown,
}

/// Which copy of a file to read: the work tree, the index, or a revision.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FileSource {
    Workdir,
    Index,
    Rev { rev: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFile {
    pub path: String,
    /// Previous path for renames and copies.
    pub old_path: Option<String>,
    pub status: FileChangeStatus,
    pub additions: u32,
    pub deletions: u32,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetails {
    pub sha: String,
    pub short_sha: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_date: String,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_date: String,
    pub subject: String,
    pub body: String,
    pub refs: Vec<RefInfo>,
    pub signature: SignatureStatus,
    pub files: Vec<CommitFile>,
    pub additions: u32,
    pub deletions: u32,
}
