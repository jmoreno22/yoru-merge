use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub commits: Vec<GraphCommit>,
    pub max_lanes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphCommit {
    pub sha: String,
    pub lane: u32,
    pub parent_shas: Vec<String>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from_lane: u32,
    pub to_lane: u32,
    /// Row the edge starts at (index of the commit that owns it).
    pub from_row: u32,
    /// Row the edge ends at; `commits.len()` when the parent is off-screen.
    pub to_row: u32,
    pub edge_type: EdgeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    Straight,
    Merge,
    Fork,
}
