use serde::{Deserialize, Serialize};

/// `git blame` for one file, with each commit's metadata sent once: a line
/// carries the index of its commit in `commits` instead of repeating it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameResult {
    pub commits: Vec<BlameCommit>,
    pub lines: Vec<BlameRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameCommit {
    pub sha: String,
    pub author: String,
    pub time: i64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameRow {
    /// Index into [`BlameResult::commits`].
    pub commit: usize,
    pub line_no: usize,
    pub content: String,
}
