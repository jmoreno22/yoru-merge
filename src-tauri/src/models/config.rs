use serde::{Deserialize, Serialize};

/// Git configuration relevant to the UI. The `user_*` fields hold the
/// repository-local override (if any); the `global_user_*` fields hold the
/// user-wide value, so the UI can show which one is in effect.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepoConfig {
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub global_user_name: Option<String>,
    pub global_user_email: Option<String>,
    pub pull_rebase: Option<bool>,
    pub gpg_sign: bool,
    pub signing_format: Option<String>,
    pub default_branch: Option<String>,
    pub autocrlf: Option<String>,
    /// `yoru.ai`: the per-repository AI opt-out. `None` when unset (allowed),
    /// `Some(false)` when this repository refuses to have its diffs sent to a
    /// provider.
    pub ai_enabled: Option<bool>,
}
