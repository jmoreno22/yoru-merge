use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CheckoutResult {
    Success,
    /// Refused because these working-tree files would be lost.
    WouldOverwrite {
        files: Vec<String>,
    },
    DetachedHead,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FastForwardResult {
    FastForwarded,
    AlreadyUpToDate,
    NoUpstream,
    NotFastForwardable,
    NetworkError { message: String },
    AuthRequired { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub sha: String,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub name: String,
    /// Commit the tag resolves to (peeled for annotated tags).
    pub sha: String,
    pub message: Option<String>,
    pub is_annotated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchList {
    pub local: Vec<BranchInfo>,
    pub remote: Vec<BranchInfo>,
    pub current: Option<String>,
}
