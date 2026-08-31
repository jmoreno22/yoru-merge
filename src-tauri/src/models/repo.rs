use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    /// Work-tree root (or git dir for bare repos), always forward-slashed.
    pub path: String,
    pub name: String,
    pub current_branch: Option<String>,
    pub is_clean: bool,
    pub is_bare: bool,
}
