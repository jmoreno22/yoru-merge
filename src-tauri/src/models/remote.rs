use serde::{Deserialize, Serialize};

/// Progress event emitted during `fetch_remote` and `clone_repo`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchProgress {
    /// One of "counting" | "compressing" | "receiving" | "resolving" | "info" | "done"
    pub phase: String,
    /// Objects processed so far (absent for info/done phases).
    pub current: Option<u32>,
    /// Total object count (absent for info/done phases).
    pub total: Option<u32>,
    /// `true` only on the final "done" event.
    pub done: bool,
    /// Human-readable line for "info" phase events.
    pub message: Option<String>,
}

/// Result of a `git pull` operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PullResult {
    /// The local branch was already at the same commit as the remote.
    UpToDate,
    /// The local branch was fast-forwarded to the remote tip.
    FastForward,
    /// A merge commit was created.
    Merged,
    /// The local commits were replayed on top of the remote tip.
    Rebased,
    /// One or more merge conflicts require manual resolution.
    Conflicts { files: Vec<String> },
    /// The remote required credentials that were not available from Git's helper.
    AuthRequired,
}

/// Result of a `git push` operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PushResult {
    /// All refs were pushed successfully.
    Success,
    /// The remote already had all refs up-to-date; nothing was sent.
    UpToDate,
    /// The remote rejected the push (e.g. non-fast-forward).
    Rejected { reason: String },
    /// The remote required authentication that was not available.
    AuthRequired,
}

/// Describes a single git remote entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}
