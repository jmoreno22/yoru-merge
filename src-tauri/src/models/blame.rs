use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameLine {
    pub sha: String,
    pub author: String,
    pub time: i64,
    pub message: String,
    pub line_no: usize,
    pub content: String,
}
