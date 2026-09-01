//! Reading and writing the handful of git settings the UI exposes.
//!
//! Writes are restricted to a whitelist: a settings dialog has no business
//! being a general `git config` front-end.

use super::git::{stderr_or, validate_message, validate_repo_path, GitCmd};
use crate::models::RepoConfig;

const ALLOWED_KEYS: &[&str] = &[
    "user.name",
    "user.email",
    "pull.rebase",
    "commit.gpgsign",
    "gpg.format",
    "init.defaultBranch",
    "core.autocrlf",
    "fetch.prune",
    // Not a git setting but a YoruMerge one, kept in git config so it can live
    // in the repository the user is protecting rather than in app preferences.
    "yoru.ai",
];

fn value_of(cmd: GitCmd, args: &[&str]) -> Option<String> {
    cmd.args(args)
        .run()
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// git accepts several spellings for booleans, and `pull.rebase` additionally
/// accepts `interactive` / `merges`, which the UI shows as "rebase on pull".
fn as_bool(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "true" | "1" | "yes" | "on" | "interactive" | "merges"
    )
}

/// `path` is `None` when no repository is open (the Settings dialog): there is
/// no local scope to read or to layer on, so the local fields stay empty and
/// the effective value of everything else is the global one.
fn repo_config_inner(path: Option<&str>) -> RepoConfig {
    let local = |key: &str| {
        path.and_then(|repo| value_of(GitCmd::in_repo(repo), &["config", "--local", "--get", key]))
    };
    let global = |key: &str| value_of(GitCmd::bare(), &["config", "--global", "--get", key]);
    let effective = |key: &str| match path {
        Some(repo) => value_of(GitCmd::in_repo(repo), &["config", "--get", key]),
        None => value_of(GitCmd::bare(), &["config", "--global", "--get", key]),
    };

    RepoConfig {
        user_name: local("user.name"),
        user_email: local("user.email"),
        global_user_name: global("user.name"),
        global_user_email: global("user.email"),
        pull_rebase: effective("pull.rebase").map(|value| as_bool(&value)),
        gpg_sign: effective("commit.gpgsign").is_some_and(|value| as_bool(&value)),
        signing_format: effective("gpg.format"),
        default_branch: effective("init.defaultBranch"),
        autocrlf: effective("core.autocrlf"),
        ai_enabled: effective("yoru.ai").map(|value| as_bool(&value)),
    }
}

fn run_config(cmd: GitCmd, global: bool, key: &str, value: Option<&str>) -> Result<(), String> {
    let mut args = vec!["config"];
    if global {
        args.push("--global");
    }
    match value {
        Some(value) => args.extend([key, value]),
        None => args.extend(["--unset", key]),
    }

    let output = cmd.args(&args).output()?;
    if output.status.success() {
        return Ok(());
    }
    // `--unset` exits 5 when the key was not set; the caller wanted it gone and
    // it is gone.
    if value.is_none() && output.status.code() == Some(5) {
        return Ok(());
    }
    Err(stderr_or(&output, "git config failed"))
}

#[tauri::command]
pub async fn get_repo_config(path: Option<String>) -> Result<RepoConfig, String> {
    if let Some(path) = path.as_deref() {
        validate_repo_path(path)?;
    }
    tauri::async_runtime::spawn_blocking(move || repo_config_inner(path.as_deref()))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_config_value(
    path: Option<String>,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    if !ALLOWED_KEYS.contains(&key.as_str()) {
        return Err(format!("configuration key not allowed: {key}"));
    }
    if let Some(path) = path.as_deref() {
        validate_repo_path(path)?;
    }
    if let Some(value) = value.as_deref() {
        validate_message(value)?;
    }

    tauri::async_runtime::spawn_blocking(move || match path {
        Some(path) => run_config(GitCmd::in_repo(&path), false, &key, value.as_deref()),
        None => run_config(GitCmd::bare(), true, &key, value.as_deref()),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{git_ok, init_repo};

    #[test]
    fn reads_the_local_identity_and_derived_flags() {
        let (_dir, repo) = init_repo();
        git_ok(&repo, &["config", "pull.rebase", "true"]);
        git_ok(&repo, &["config", "core.autocrlf", "input"]);
        git_ok(&repo, &["config", "gpg.format", "ssh"]);

        let config = repo_config_inner(Some(&repo));
        assert_eq!(config.user_name.as_deref(), Some("Test User"));
        assert_eq!(config.user_email.as_deref(), Some("t@example.com"));
        assert_eq!(config.pull_rebase, Some(true));
        assert!(!config.gpg_sign);
        assert_eq!(config.signing_format.as_deref(), Some("ssh"));
        assert_eq!(config.autocrlf.as_deref(), Some("input"));
    }

    /// The non-identity fields read the *effective* value, so they inherit
    /// whatever the machine has globally; isolate git from it to assert that an
    /// unset key comes back as `None` and never as an empty string.
    #[test]
    fn missing_keys_are_none_not_empty_strings() {
        let (_dir, repo) = init_repo();
        let isolated = tempfile::TempDir::new().expect("temp dir");
        let empty = isolated.path().join("gitconfig");
        let empty = empty.to_string_lossy().replace('\\', "/");

        let value = |key: &str| {
            value_of(
                GitCmd::in_repo(&repo)
                    .env("GIT_CONFIG_GLOBAL", &empty)
                    .env("GIT_CONFIG_SYSTEM", &empty),
                &["config", "--get", key],
            )
        };
        assert_eq!(value("pull.rebase"), None);
        assert_eq!(value("gpg.format"), None);
        assert_eq!(value("user.name").as_deref(), Some("Test User"));
    }

    /// With no repository open the Settings dialog still needs the global
    /// identity, and nothing may be reported as a repository override.
    #[test]
    fn without_a_repository_only_the_global_scope_is_read() {
        let global = |key: &str| value_of(GitCmd::bare(), &["config", "--global", "--get", key]);
        let config = repo_config_inner(None);

        assert_eq!(config.user_name, None);
        assert_eq!(config.user_email, None);
        assert_eq!(config.global_user_name, global("user.name"));
        assert_eq!(config.global_user_email, global("user.email"));
        // The effective fields fall back to the global scope verbatim, whatever
        // this machine happens to have configured.
        assert_eq!(config.signing_format, global("gpg.format"));
        assert_eq!(config.default_branch, global("init.defaultBranch"));
        assert_eq!(config.autocrlf, global("core.autocrlf"));
        assert_eq!(
            config.pull_rebase,
            global("pull.rebase").map(|value| as_bool(&value))
        );
        assert_eq!(
            config.gpg_sign,
            global("commit.gpgsign").is_some_and(|value| as_bool(&value))
        );
    }

    #[test]
    fn writes_and_unsets_a_local_value() {
        let (_dir, repo) = init_repo();

        run_config(GitCmd::in_repo(&repo), false, "user.name", Some("Renamed")).unwrap();
        assert_eq!(
            repo_config_inner(Some(&repo)).user_name.as_deref(),
            Some("Renamed")
        );

        run_config(GitCmd::in_repo(&repo), false, "user.name", None).unwrap();
        assert_eq!(repo_config_inner(Some(&repo)).user_name, None);
        // Unsetting an absent key is not an error.
        run_config(GitCmd::in_repo(&repo), false, "user.name", None).unwrap();
    }

    #[test]
    fn writes_a_global_value_into_an_isolated_config_file() {
        let home = tempfile::TempDir::new().expect("temp dir");
        let global_config = home.path().join("gitconfig");
        let global_config = global_config.to_string_lossy().replace('\\', "/");

        run_config(
            GitCmd::bare().env("GIT_CONFIG_GLOBAL", &global_config),
            true,
            "user.name",
            Some("Global Tester"),
        )
        .unwrap();

        let read_back = value_of(
            GitCmd::bare().env("GIT_CONFIG_GLOBAL", &global_config),
            &["config", "--global", "--get", "user.name"],
        );
        assert_eq!(read_back.as_deref(), Some("Global Tester"));
        assert!(std::fs::read_to_string(&global_config)
            .unwrap()
            .contains("Global Tester"));
    }

    #[test]
    fn values_with_shell_characters_survive() {
        let (_dir, repo) = init_repo();
        run_config(
            GitCmd::in_repo(&repo),
            false,
            "user.name",
            Some("Ana & Ñoño; \"quoted\""),
        )
        .unwrap();
        assert_eq!(
            git_ok(&repo, &["config", "--local", "user.name"]),
            "Ana & Ñoño; \"quoted\""
        );
    }

    #[test]
    fn rejects_keys_outside_the_whitelist() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let error = rt
            .block_on(set_config_value(
                None,
                "core.editor".to_string(),
                Some("vim".to_string()),
            ))
            .unwrap_err();
        assert!(error.contains("not allowed"), "got: {error}");
    }

    #[test]
    fn boolean_spellings_are_understood() {
        assert!(as_bool("true"));
        assert!(as_bool("On"));
        assert!(as_bool("interactive"));
        assert!(!as_bool("false"));
        assert!(!as_bool(""));
    }
}
