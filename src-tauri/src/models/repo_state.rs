use serde::{Deserialize, Serialize};

/// Which multi-step git operation, if any, is currently in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RepoState {
    Clean,
    Merging,
    Rebasing,
    CherryPicking,
    Reverting,
    Bisecting,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepoStateInfo {
    pub state: RepoState,
    pub head_detached: bool,
    /// Commit HEAD points at. Empty on an unborn branch, which has no commit.
    pub head_sha: String,
    /// 1-based position inside an interactive rebase todo list.
    pub rebase_step: Option<u32>,
    pub rebase_total: Option<u32>,
    pub conflicted_files: Vec<String>,
}
