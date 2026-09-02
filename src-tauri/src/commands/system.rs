//! Handing a path over to the desktop: file manager, terminal, editor.
//!
//! Nothing here goes through a shell. Every helper spawns a detached process
//! and drops the handle, because the app must never wait on a window the user
//! may keep open for hours.

use std::path::Path;
use std::process::{Command, Stdio};

use serde_json::Value;
use tauri_plugin_store::StoreExt;

use super::git::{validate_ref, validate_repo_path, validate_url, GitCmd};
use super::repo::{RECENTS_FILE, RECENTS_KEY};
use crate::models::RepoInfo;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

/// A helper process that must never flash a console window.
#[cfg(windows)]
fn hidden(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    let mut command = Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(windows))]
fn hidden(program: &str) -> Command {
    Command::new(program)
}

fn spawn_detached(mut command: Command) -> Result<(), String> {
    let program = command.get_program().to_string_lossy().to_string();
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    super::git::strip_appimage_libs(&mut command);
    command
        .spawn()
        .map(|_child| ())
        .map_err(|e| format!("could not start {program}: {e}"))
}

fn existing_path(target: &str) -> Result<&Path, String> {
    if target.trim().is_empty() {
        return Err("path is empty".to_string());
    }
    // These paths become arguments to a program that is not git, so none of the
    // `commands::git` validators fits as it stands — `validate_repo_path`
    // insists on a directory and `validate_pathspec` allows a leading '-',
    // which git only ignores because it reads pathspecs after `--`. The two
    // hazards they guard against are the same ones here.
    if target.starts_with('-') {
        return Err("path must not start with '-'".to_string());
    }
    if target.contains('\0') {
        return Err("path contains a NUL byte".to_string());
    }
    let path = Path::new(target);
    if !path.exists() {
        return Err("path does not exist".to_string());
    }
    Ok(path)
}

/// `/select,` reveals a file inside its folder; a folder is opened directly.
/// explorer.exe only understands backslashes.
#[cfg(windows)]
fn file_manager_argument(target: &Path, is_file: bool) -> String {
    let native = target.to_string_lossy().replace('/', "\\");
    if is_file {
        format!("/select,{native}")
    } else {
        native
    }
}

/// The command that reveals `target` in the desktop's file manager.
///
/// Built rather than spawned so what it does to a file — reveal it, never hand
/// it to the program its extension is associated with — can be asserted.
#[cfg(windows)]
fn file_manager_command(target: &Path) -> Command {
    let mut command = hidden("explorer.exe");
    command.arg(file_manager_argument(target, target.is_file()));
    command
}

#[cfg(not(windows))]
fn file_manager_command(target: &Path) -> Command {
    let directory = if target.is_file() {
        target.parent().unwrap_or(target)
    } else {
        target
    };
    let mut command = Command::new("xdg-open");
    command.arg(directory);
    command
}

fn open_file_manager(target: &Path) -> Result<(), String> {
    // On Windows explorer.exe reports a non-zero exit code even when it
    // succeeds, so the spawn result is all we can honestly check.
    spawn_detached(file_manager_command(target))
}

/// Terminal emulators to try on Linux, in order, with the flag each one uses
/// for its start directory.
#[cfg(not(windows))]
fn terminal_candidates(dir: &str) -> Vec<(String, Vec<String>)> {
    let mut candidates: Vec<(String, Vec<String>)> = Vec::new();
    if let Ok(preferred) = std::env::var("TERMINAL") {
        if !preferred.trim().is_empty() {
            candidates.push((preferred, Vec::new()));
        }
    }
    candidates.push(("x-terminal-emulator".into(), Vec::new()));
    candidates.push((
        "gnome-terminal".into(),
        vec![format!("--working-directory={dir}")],
    ));
    candidates.push(("konsole".into(), vec!["--workdir".into(), dir.to_string()]));
    candidates.push((
        "xfce4-terminal".into(),
        vec![format!("--working-directory={dir}")],
    ));
    candidates.push((
        "alacritty".into(),
        vec!["--working-directory".into(), dir.to_string()],
    ));
    candidates.push(("kitty".into(), vec!["-d".into(), dir.to_string()]));
    candidates.push(("foot".into(), vec!["-D".into(), dir.to_string()]));
    candidates
}

/// Unlike every other helper here, a terminal owns a console and a tty, so its
/// stdio is left alone: redirecting it to null breaks console-based terminals.
fn spawn_terminal(mut command: Command) -> std::io::Result<()> {
    super::git::strip_appimage_libs(&mut command);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NEW_CONSOLE);
    }
    command.spawn().map(|_child| ())
}

/// Split a user-configured terminal command into program plus arguments,
/// replacing the `{dir}` placeholder. The split is on whitespace and the
/// substitution happens inside each token, so a directory with spaces stays a
/// single argument (nothing goes through a shell). `None` when it is blank.
fn custom_terminal_command(command: &str, dir: &str) -> Option<(String, Vec<String>)> {
    let mut tokens = command
        .split_whitespace()
        .map(|token| token.replace("{dir}", dir));
    let program = tokens.next()?;
    Some((program, tokens.collect()))
}

fn open_terminal(dir: &Path, terminal: Option<&str>) -> Result<(), String> {
    let dir_string = dir.to_string_lossy().to_string();

    // An explicit preference wins outright: the user chose this terminal, so a
    // failure is reported instead of silently falling back to another one.
    if let Some(command) = terminal {
        let Some((program, args)) = custom_terminal_command(command, &dir_string) else {
            return Err("terminal command is empty".to_string());
        };
        let mut configured = Command::new(&program);
        configured.args(&args).current_dir(dir);
        return spawn_terminal(configured).map_err(|e| format!("could not start {program}: {e}"));
    }

    #[cfg(windows)]
    {
        let mut windows_terminal = Command::new("wt.exe");
        windows_terminal.arg("-d").arg(dir);
        if spawn_terminal(windows_terminal).is_ok() {
            return Ok(());
        }

        let mut powershell = Command::new("powershell.exe");
        powershell.arg("-NoLogo").current_dir(dir);
        spawn_terminal(powershell).map_err(|e| format!("could not open a terminal: {e}"))
    }
    #[cfg(not(windows))]
    {
        for (program, args) in terminal_candidates(&dir_string) {
            let mut command = Command::new(&program);
            command.args(&args).current_dir(dir);
            if spawn_terminal(command).is_ok() {
                return Ok(());
            }
        }
        Err("no terminal emulator found".to_string())
    }
}

/// Editor commands to try, in order. An explicit command wins outright.
fn editor_candidates(editor: Option<&str>) -> Vec<Vec<String>> {
    let split =
        |value: &str| -> Vec<String> { value.split_whitespace().map(str::to_string).collect() };

    if let Some(explicit) = editor {
        let parts = split(explicit);
        if !parts.is_empty() {
            return vec![parts];
        }
    }

    let mut candidates = Vec::new();
    for variable in ["VISUAL", "EDITOR"] {
        if let Ok(value) = std::env::var(variable) {
            let parts = split(&value);
            if !parts.is_empty() {
                candidates.push(parts);
            }
        }
    }
    // VS Code ships as a .cmd shim on Windows, which Command::new cannot find
    // by its bare name.
    #[cfg(windows)]
    candidates.push(vec!["code.cmd".to_string()]);
    candidates.push(vec!["code".to_string()]);
    candidates
}

/// Tries every candidate in order, reporting whether one of them started.
fn spawn_editor(target: &Path, editor: Option<&str>) -> bool {
    for parts in editor_candidates(editor) {
        let (program, args) = parts.split_first().expect("candidates are never empty");
        let mut command = hidden(program);
        command.args(args).arg(target);
        if spawn_detached(command).is_ok() {
            return true;
        }
    }
    false
}

/// With no editor to start, the file is revealed in its folder.
///
/// It is never handed to the program its extension is associated with, which is
/// what `explorer.exe <file>` and `xdg-open <file>` do: for a `.exe`, `.lnk`,
/// `.bat`, `.ps1`, `.msi`, `.hta`, `.url` or `.desktop` that means running it,
/// and the file the user asked to read may have arrived inside somebody else's
/// repository. The set of extensions that execute is not one this app can close
/// — Windows adds to it — so revealing is unconditional rather than decided per
/// extension.
fn open_editor(target: &Path, editor: Option<&str>) -> Result<(), String> {
    if spawn_editor(target, editor) {
        return Ok(());
    }
    open_file_manager(target)
}

/// Only http(s) may reach the browser. A "web URL" derived from a remote can
/// be anything the remote says, so `file://`, `javascript:` and friends are
/// refused rather than handed to the shell handler.
fn validate_http_url(url: &str) -> Result<(), String> {
    // Covers NUL, control characters, whitespace and a leading '-'.
    validate_url(url)?;
    let scheme = url.to_ascii_lowercase();
    if !scheme.starts_with("http://") && !scheme.starts_with("https://") {
        return Err("only http and https URLs can be opened".to_string());
    }
    Ok(())
}

/// A URL is not a path: it must not get the backslash treatment that
/// `file_manager_command` applies, which would turn `http://x` into `http:\\x`.
fn open_url_inner(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut command = hidden("explorer.exe");
        command.arg(url);
        spawn_detached(command)
    }
    #[cfg(not(windows))]
    {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        spawn_detached(command)
    }
}

fn init_repo_inner(path: &str, default_branch: Option<&str>) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| format!("could not create {path}: {e}"))?;
    let mut args = vec!["init"];
    if let Some(branch) = default_branch {
        args.extend(["-b", branch]);
    }
    GitCmd::bare()
        .current_dir(path)
        .args(&args)
        .run()
        .map(|_| ())
}

fn git_version_inner() -> Result<String, String> {
    let raw = GitCmd::bare().arg("--version").run()?;
    let trimmed = raw.trim();
    Ok(trimmed
        .strip_prefix("git version ")
        .unwrap_or(trimmed)
        .to_string())
}

// ── Preferences ──────────────────────────────────────────────────────────────
//
// The programs this module starts are read from the store here, not received
// from the webview: a command string that crosses the IPC boundary is a command
// that anything running in the webview gets to choose.

/// Where the frontend keeps durable preferences, and how it shapes them.
///
/// Mirrors `src/app/core/services/preferences-schema.ts`: every value lives in
/// one object under [`PREFERENCES_KEY`], with the version beside it at the top
/// level. Change one side and the other stops finding the user's settings.
const PREFERENCES_FILE: &str = "preferences.json";
const PREFERENCES_KEY: &str = "preferences";
const SCHEMA_VERSION_KEY: &str = "schemaVersion";
/// First schema version whose values live under [`PREFERENCES_KEY`].
const SINGLE_KEY_VERSION: u32 = 4;

const EDITOR_KEY: &str = "externalEditor";
const TERMINAL_KEY: &str = "terminal";
const AI_PROVIDER_KEY: &str = "aiProvider";

/// One preference out of the store's raw top level.
///
/// The stored version decides which half to read, exactly as
/// `migratePreferences` does: a store written before the single-key move keeps
/// its values as loose top-level keys, and it is the version that says so —
/// not which keys happen to exist — so a downgrade that rewrote the loose keys
/// wins over the object it left behind.
fn preference<'a>(stored: &'a Value, key: &str) -> Option<&'a Value> {
    // Read as a float, like the frontend's `asNumber`: a version that arrived
    // as `4.0` must not be read as "written before the move".
    let version = stored
        .get(SCHEMA_VERSION_KEY)
        .and_then(Value::as_f64)
        .unwrap_or_default();
    if version < f64::from(SINGLE_KEY_VERSION) {
        stored.get(key)
    } else {
        stored.get(PREFERENCES_KEY)?.get(key)
    }
}

/// The command configured under `key`, or `None` when there is none to run.
///
/// Missing, not a string, blank or carrying a control character all mean the
/// same thing — nothing configured — so the caller falls back to the platform
/// defaults it used before the user set anything. Refusing outright would be
/// worse: the store is a plain file any process running as this user can edit,
/// and `sanitizePreferences` drops exactly the same values on the way in.
fn configured_command(stored: &Value, key: &str) -> Option<String> {
    let text = preference(stored, key)?.as_str()?.trim();
    if text.is_empty() || text.chars().any(char::is_control) {
        return None;
    }
    Some(text.to_string())
}

/// The store's top level. A store that cannot be opened reads as an empty one,
/// which is the same thing as one with nothing in it: the defaults apply.
fn stored_preferences(app: &tauri::AppHandle) -> Value {
    match app.store(PREFERENCES_FILE) {
        Ok(store) => Value::Object(store.entries().into_iter().collect()),
        Err(_) => Value::Null,
    }
}

/// The AI CLI the user configured. Read here because the preferences store is
/// read in one place; [`super::ai`] is what knows how to run it.
pub fn configured_ai_provider(app: &tauri::AppHandle) -> Option<String> {
    configured_command(&stored_preferences(app), AI_PROVIDER_KEY)
}

#[tauri::command]
pub async fn open_in_file_manager(target: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || open_file_manager(existing_path(&target)?))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_in_terminal(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    validate_repo_path(&dir)?;
    let terminal = configured_command(&stored_preferences(&app), TERMINAL_KEY);
    tauri::async_runtime::spawn_blocking(move || {
        open_terminal(Path::new(&dir), terminal.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_in_editor(app: tauri::AppHandle, target: String) -> Result<(), String> {
    let editor = configured_command(&stored_preferences(&app), EDITOR_KEY);
    tauri::async_runtime::spawn_blocking(move || {
        open_editor(existing_path(&target)?, editor.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    validate_http_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || open_url_inner(&url))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn init_repo(path: String, default_branch: Option<String>) -> Result<RepoInfo, String> {
    if let Some(branch) = default_branch.as_deref() {
        validate_ref(branch)?;
    }
    let created = path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        init_repo_inner(&created, default_branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())??;

    super::repo::open_repo(path).await
}

#[tauri::command]
pub async fn remove_recent_repo(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let store = app.store(RECENTS_FILE).map_err(|e| e.to_string())?;
    let mut repos: Vec<serde_json::Value> = store
        .get(RECENTS_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();

    repos.retain(|entry| entry.get("path").and_then(|p| p.as_str()) != Some(path.as_str()));

    let value = serde_json::to_value(&repos).map_err(|e| e.to_string())?;
    store.set(RECENTS_KEY, value);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_git_version() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(git_version_inner)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::git_ok;
    use serde_json::json;

    #[test]
    fn missing_targets_are_rejected_before_spawning_anything() {
        assert_eq!(existing_path("").unwrap_err(), "path is empty");
        assert_eq!(
            existing_path("C:/definitely/not/here/at/all").unwrap_err(),
            "path does not exist"
        );
    }

    /// A target reaches a third-party program's argv, so it must not be able to
    /// pose as one of that program's options.
    #[test]
    fn a_target_that_looks_like_an_option_is_rejected() {
        assert_eq!(
            existing_path("--wait").unwrap_err(),
            "path must not start with '-'"
        );
        assert_eq!(
            existing_path("C:/repo/a\0b.txt").unwrap_err(),
            "path contains a NUL byte"
        );
    }

    // ── Preferences ──────────────────────────────────────────────────────

    /// The store as the frontend leaves it: one object, version 4.
    fn store_v4(values: Value) -> Value {
        json!({ "schemaVersion": 4, "preferences": values })
    }

    #[test]
    fn the_configured_commands_come_out_of_the_single_preferences_key() {
        let stored = store_v4(json!({
            "externalEditor": "subl -w",
            "terminal": "wt -d {dir}",
            "aiProvider": "claude -p",
        }));
        assert_eq!(
            configured_command(&stored, EDITOR_KEY).as_deref(),
            Some("subl -w")
        );
        assert_eq!(
            configured_command(&stored, TERMINAL_KEY).as_deref(),
            Some("wt -d {dir}")
        );
        assert_eq!(
            configured_command(&stored, AI_PROVIDER_KEY).as_deref(),
            Some("claude -p")
        );
    }

    /// Nothing configured, nothing to run: the caller falls back to the
    /// platform defaults it used before the store existed.
    #[test]
    fn an_absent_preference_leaves_the_platform_defaults_in_place() {
        for stored in [
            Value::Null,
            json!({}),
            store_v4(json!({})),
            store_v4(json!({ "terminal": "wt" })),
        ] {
            assert_eq!(configured_command(&stored, EDITOR_KEY), None, "{stored}");
        }
    }

    /// A store is a plain file, so its values arrive in whatever shape somebody
    /// wrote. A malformed one reads as unconfigured, never as an error and
    /// never as something to run.
    #[test]
    fn a_malformed_preference_reads_as_unconfigured() {
        for value in [
            json!(42),
            json!(true),
            json!(null),
            json!(["code"]),
            json!({ "program": "code" }),
            json!(""),
            json!("   "),
            json!("code\u{0}--wait"),
            json!("code\n--wait"),
        ] {
            let stored = store_v4(json!({ "externalEditor": value }));
            assert_eq!(configured_command(&stored, EDITOR_KEY), None, "{value}");
        }
        // The whole object being the wrong shape is the same answer.
        let stored = json!({ "schemaVersion": 4, "preferences": "code" });
        assert_eq!(configured_command(&stored, EDITOR_KEY), None);
    }

    /// A store written by an older build keeps its values as loose top-level
    /// keys until the first flush, and it is the version that says which half
    /// to read — the same fork `migratePreferences` takes on the other side.
    #[test]
    fn a_store_written_before_the_single_key_move_is_still_read() {
        for stored in [
            json!({ "schemaVersion": 3, "externalEditor": "vim" }),
            // Written before the version key existed at all.
            json!({ "externalEditor": "vim" }),
        ] {
            assert_eq!(
                configured_command(&stored, EDITOR_KEY).as_deref(),
                Some("vim"),
                "{stored}"
            );
        }

        // Both shapes present: the stored version decides, so a downgrade that
        // rewrote the loose keys wins over the object it left behind.
        let downgraded = json!({
            "schemaVersion": 3,
            "externalEditor": "vim",
            "preferences": { "externalEditor": "subl" },
        });
        assert_eq!(
            configured_command(&downgraded, EDITOR_KEY).as_deref(),
            Some("vim")
        );
        let upgraded = json!({
            "schemaVersion": 4,
            "externalEditor": "vim",
            "preferences": { "externalEditor": "subl" },
        });
        assert_eq!(
            configured_command(&upgraded, EDITOR_KEY).as_deref(),
            Some("subl")
        );
    }

    /// The version arrives as JSON, where `4` and `4.0` are the same number.
    #[test]
    fn a_version_that_arrived_as_a_float_still_reads_the_object() {
        let stored = json!({
            "schemaVersion": 4.0,
            "preferences": { "externalEditor": "subl" },
        });
        assert_eq!(
            configured_command(&stored, EDITOR_KEY).as_deref(),
            Some("subl")
        );
    }

    #[test]
    fn an_explicit_editor_command_is_split_on_whitespace() {
        assert_eq!(
            editor_candidates(Some("subl -w -n")),
            vec![vec!["subl".to_string(), "-w".to_string(), "-n".to_string()]]
        );
        assert_eq!(
            editor_candidates(Some("C:/Program/code.exe")),
            vec![vec!["C:/Program/code.exe".to_string()]]
        );
    }

    #[test]
    fn a_blank_editor_falls_through_to_the_defaults() {
        let candidates = editor_candidates(Some("   "));
        assert!(candidates
            .last()
            .is_some_and(|last| last == &vec!["code".to_string()]));
    }

    /// The first half of the fallback decision: nothing is running, so
    /// `open_editor` has to fall through to revealing the file.
    #[test]
    fn an_editor_that_cannot_start_leaves_nothing_running() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let file = dir.path().join("notes.txt");
        std::fs::write(&file, "x").expect("write");
        assert!(!spawn_editor(&file, Some("yoru-no-such-editor-at-all")));
    }

    /// The second half: what the fallback runs reveals the file in its folder.
    /// Handing it to `explorer.exe <file>` or `xdg-open <file>` instead would
    /// *run* this payload, which is the whole point of not doing that.
    #[test]
    fn the_editor_fallback_reveals_the_file_instead_of_opening_it() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let payload = dir.path().join("payload.exe");
        std::fs::write(&payload, "MZ").expect("write");

        let command = file_manager_command(&payload);
        let program = command.get_program().to_string_lossy().to_string();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();

        #[cfg(windows)]
        {
            assert_eq!(program, "explorer.exe");
            assert_eq!(
                args,
                vec![format!(
                    "/select,{}",
                    payload.to_string_lossy().replace('/', "\\")
                )]
            );
        }
        #[cfg(not(windows))]
        {
            assert_eq!(program, "xdg-open");
            assert_eq!(args, vec![dir.path().to_string_lossy().to_string()]);
        }
        // Whatever the platform, the payload is never an argument on its own.
        assert!(
            !args.iter().any(|arg| arg == &payload.to_string_lossy()),
            "got: {args:?}"
        );
    }

    #[cfg(windows)]
    #[test]
    fn explorer_reveals_files_and_opens_folders() {
        assert_eq!(
            file_manager_argument(Path::new("C:/repo/a b.txt"), true),
            "/select,C:\\repo\\a b.txt"
        );
        assert_eq!(
            file_manager_argument(Path::new("C:/repo"), false),
            "C:\\repo"
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn linux_terminals_carry_their_working_directory_flag() {
        let candidates = terminal_candidates("/tmp/repo");
        let names: Vec<&str> = candidates.iter().map(|(name, _)| name.as_str()).collect();
        assert!(names.contains(&"gnome-terminal"));
        assert!(names.contains(&"kitty"));
        let konsole = candidates
            .iter()
            .find(|(name, _)| name == "konsole")
            .expect("konsole candidate");
        assert_eq!(konsole.1, vec!["--workdir", "/tmp/repo"]);
    }

    #[test]
    fn only_http_urls_may_be_opened() {
        assert!(validate_http_url("https://github.com/o/r/commit/abc123").is_ok());
        assert!(validate_http_url("http://localhost:8080/x?y=1#z").is_ok());
        // The scheme is case-insensitive.
        assert!(validate_http_url("HTTPS://Example.com").is_ok());

        for refused in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,<script>",
            "git@github.com:o/r.git",
            "ssh://git@host/r.git",
            "//evil.example.com",
            "",
        ] {
            assert!(
                validate_http_url(refused).is_err(),
                "{refused} should be refused"
            );
        }
    }

    /// A URL is handed to a process argument, so anything that could split it
    /// into another argument or a second command must never get through.
    #[test]
    fn urls_with_control_characters_or_dashes_are_rejected() {
        for refused in [
            "https://x.com/a\nb",
            "https://x.com/a\rb",
            "https://x.com/a b",
            "https://x.com/a\0b",
            "--upload-pack=calc.exe",
        ] {
            assert!(
                validate_http_url(refused).is_err(),
                "{refused:?} should be refused"
            );
        }
    }

    fn parsed(command: &str, dir: &str) -> (String, Vec<String>) {
        custom_terminal_command(command, dir).expect("command should parse")
    }

    #[test]
    fn a_custom_terminal_substitutes_the_dir_placeholder() {
        assert_eq!(
            parsed("wt -d {dir}", "C:/repo"),
            (
                "wt".to_string(),
                vec!["-d".to_string(), "C:/repo".to_string()]
            )
        );
        assert_eq!(
            parsed("alacritty --working-directory {dir}", "/tmp/repo"),
            (
                "alacritty".to_string(),
                vec!["--working-directory".to_string(), "/tmp/repo".to_string()]
            )
        );
    }

    /// The placeholder is replaced inside the token, so a directory with spaces
    /// stays one argument — there is no shell to re-split it.
    #[test]
    fn a_directory_with_spaces_stays_a_single_argument() {
        assert_eq!(
            parsed("wt -d {dir}", "C:/my repo/ñ"),
            (
                "wt".to_string(),
                vec!["-d".to_string(), "C:/my repo/ñ".to_string()]
            )
        );
        assert_eq!(
            parsed("xfce4-terminal --working-directory={dir}", "/tmp/my repo"),
            (
                "xfce4-terminal".to_string(),
                vec!["--working-directory=/tmp/my repo".to_string()]
            )
        );
    }

    /// Without the placeholder the arguments are passed through untouched; the
    /// directory reaches the terminal as its working directory instead.
    #[test]
    fn a_custom_terminal_without_the_placeholder_keeps_its_arguments() {
        assert_eq!(parsed("wt", "/tmp/repo"), ("wt".to_string(), vec![]));
        assert_eq!(
            parsed("kitty --single-instance", "/tmp/repo"),
            ("kitty".to_string(), vec!["--single-instance".to_string()])
        );
    }

    #[test]
    fn extra_whitespace_between_arguments_is_ignored() {
        assert_eq!(
            parsed("  wt   -d   {dir}  ", "/tmp/repo"),
            (
                "wt".to_string(),
                vec!["-d".to_string(), "/tmp/repo".to_string()]
            )
        );
    }

    #[test]
    fn a_blank_custom_terminal_is_rejected_without_spawning() {
        assert_eq!(custom_terminal_command("", "/tmp"), None);
        assert_eq!(custom_terminal_command("   ", "/tmp"), None);

        let dir = tempfile::TempDir::new().expect("temp dir");
        let error = open_terminal(dir.path(), Some("   ")).unwrap_err();
        assert_eq!(error, "terminal command is empty");
    }

    #[test]
    fn init_creates_a_repository_with_the_requested_branch() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let nested = dir.path().join("nested/repo");
        let path = nested.to_string_lossy().replace('\\', "/");

        init_repo_inner(&path, Some("trunk")).unwrap();
        assert!(nested.join(".git").exists());
        assert_eq!(git_ok(&path, &["symbolic-ref", "--short", "HEAD"]), "trunk");
    }

    #[test]
    fn init_without_a_branch_uses_the_git_default() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let path = dir.path().to_string_lossy().replace('\\', "/");
        init_repo_inner(&path, None).unwrap();
        assert!(dir.path().join(".git").exists());
    }

    #[test]
    fn git_version_drops_the_prefix() {
        let version = git_version_inner().unwrap();
        assert!(!version.starts_with("git version"), "got: {version}");
        assert!(
            version.chars().next().is_some_and(|c| c.is_ascii_digit()),
            "got: {version}"
        );
    }
}
