use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: u32,
    pub message: String,
    pub sha: String,
    pub date: String,
}
