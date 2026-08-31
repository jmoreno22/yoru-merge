use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReflogEntry {
    pub sha: String,
    pub short_sha: String,
    /// Reflog selector, e.g. `HEAD@{3}`.
    pub selector: String,
    /// Leading verb of the reflog subject, e.g. `checkout`, `commit`, `rebase`.
    pub action: String,
    pub message: String,
    pub date: String,
}
