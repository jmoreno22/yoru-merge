use serde::{Deserialize, Serialize};

/// Outcome of continuing, skipping or aborting a multi-step git operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SequencerResult {
    /// The operation finished; the repository is no longer in that state.
    Completed,
    /// The operation paused again on unresolved conflicts.
    Conflicts {
        files: Vec<String>,
    },
    Error {
        message: String,
    },
}
