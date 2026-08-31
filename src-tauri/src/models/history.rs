use serde::{Deserialize, Serialize};

use super::commit::CommitInfo;
use super::graph::GraphData;

/// One page of history plus the graph rows for exactly those commits.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryPage {
    pub commits: Vec<CommitInfo>,
    pub graph: GraphData,
    /// Total commits in the current scope; `None` when it could not be counted.
    pub total: Option<u32>,
    pub has_more: bool,
}
