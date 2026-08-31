use serde::{Deserialize, Serialize};

/// Divergence between two refs: `ahead` commits are in `head` only,
/// `behind` commits are in `base` only.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompareResult {
    pub ahead: u32,
    pub behind: u32,
    pub merge_base: Option<String>,
}
