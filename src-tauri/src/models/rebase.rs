use serde::{Deserialize, Serialize};

/// One entry in an interactive rebase todo list.
///
/// `action` is one of: `pick`, `squash`, `fixup`, `reword`, `drop`, `edit`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseTodoEntry {
    pub action: String,
    pub sha: String,
    pub message: String,
}

/// Result of a `git rebase` operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RebaseResult {
    /// The branch was successfully rebased onto the target ref.
    Rebased,
    /// The branch was already based on the requested target.
    UpToDate,
    /// One or more files need manual conflict resolution.
    Conflicts { files: Vec<String> },
    /// The rebase stopped on purpose (`edit`/`break`) and waits for the user.
    Paused { message: String },
    /// Git refused to start because the repository is not in a rebaseable state.
    NotPossible,
    /// Validation or git execution failed with a user-visible message.
    Error { message: String },
}

/// Result of a `git reset` operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ResetResult {
    /// HEAD moved to the requested commit using the selected reset mode.
    Reset { mode: String },
    /// Validation or git execution failed with a user-visible message.
    Error { message: String },
}

/// Result of applying a single patch on top of HEAD (cherry-pick / revert).
///
/// Conflicts leave the sequencer running so the user can resolve, continue or
/// abort; nothing is rolled back automatically.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PatchApplyResult {
    Applied,
    Conflicts { files: Vec<String> },
    Error { message: String },
}
