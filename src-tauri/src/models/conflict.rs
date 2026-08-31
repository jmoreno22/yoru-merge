use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictFile {
    pub path: String,
    pub conflict_count: usize,
}
