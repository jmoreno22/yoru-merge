# RUST BACKEND (`src-tauri/`)

Tauri 2 Rust backend exposing Git operations to the Angular UI via `#[tauri::command]`. (Stack/IPC overview → repo-root AGENTS.md.)

## STRUCTURE
```
src/main.rs              # binary entry — #![windows_subsystem] guard + calls lib::run()
src/lib.rs               # run(): plugins, managed state, invoke_handler (the command registry)
src/commands/            # ONE module per Git domain — see below
src/commands/mod.rs      # `pub mod` list, the authoritative module inventory
src/graph/               # commit-graph lane assignment (lane_assignment.rs)
src/models/              # serde structs returned to the UI — mirror src/app/core/models/ (TS)
capabilities/default.json # Tauri permission manifest
```

`commands/` modules, grouped by role (regenerate from `mod.rs`, which is the
list that actually compiles):

| Role | Modules |
|------|---------|
| Plumbing | `git` (the `GitCmd` builder + every validator), `git_auth` (credential-failure detection), `watcher` (debounced fs watching) |
| Repository lifecycle | `repo` (open / clone / recents), `system` (init, external opens, git version), `config` |
| Read paths | `commits`, `history`, `graph`, `search`, `reflog`, `commit_details`, `diff`, `changes`, `repo_state` |
| Mutations | `staging`, `hunks`, `branches`, `branch_ops`, `tags`, `stash`, `merge`, `remote`, `advanced`, `sequencer` |

## ADD A COMMAND (the full checklist)
1. Write `pub fn` with `#[tauri::command]` in the right `commands/<domain>.rs` (create module + add to `mod.rs` if new domain).
2. Register the fn in the `generate_handler![...]` list inside `lib.rs`'s `invoke_handler` — an unregistered command fails at runtime, not at compile time.
3. If it returns a new shape, add a serde struct in `models/` AND mirror it in `src/app/core/models/`.
4. Wrap it with a typed method in `src/app/core/services/tauri-git.service.ts`.

## CONVENTIONS (this layer)
- Identifiers, comments and doc comments are **English**, like the rest of the repo. Spanish appears only as fixture data inside tests (non-ASCII paths and messages are deliberate coverage).
- Every git invocation goes through `GitCmd` (`commands/git.rs`), which pins the environment: `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C` (parsers depend on English output), `GIT_OPTIONAL_LOCKS=0`, closed stdin, and `CREATE_NO_WINDOW` on Windows.
- Argument validation also lives in `commands/git.rs` (`validate_repo_path`, `validate_pathspec`, `validate_ref`, `validate_sha`, `validate_revision`, `validate_remote_name`, `validate_url`, `validate_message`). Call them from the command module; do not re-implement them there.
- Long-lived state goes through Tauri managed state registered in `lib.rs`, not globals: `WatcherState` (`pub struct WatcherState(pub Mutex<HashMap<String, RepoWatcher>>)`, `commands/watcher.rs`) and `HistoryCache` (`commands/history.rs`).
- Two ways back to the UI: the watcher emits the app-wide `repo-changed` event (consumed by `current-repo.service.ts`), while per-call progress (clone, fetch/pull/push) streams through a `tauri::ipc::Channel<FetchProgress>` argument.
- Tests are **colocated inline**: `#[cfg(test)] mod tests` inside each production `.rs`. No separate test files, and no `test_` prefix — test names read as sentences (`url_rejects_option_injection`). Use `tempfile` + `tokio` + the real `git` CLI (no mock lib).
- Lint: `cargo clippy --all-targets -- -D warnings`. Format gate: `cargo fmt --all -- --check`. All tests: `cargo test --all-features`. Single test: `cargo test commands::git::tests::url_rejects_option_injection -- --exact` (run from this dir).

## ANTI-PATTERNS (this layer)
- **Never** push with bare `--force` — only `--force-with-lease` (`commands/remote.rs`).
- **Never** remove the `#![windows_subsystem]` attribute in `main.rs` (marked DO NOT REMOVE).
- **Never** touch the filesystem or spawn git before validating the arguments with the `commands/git.rs` validators.
- **Never** build a command line by hand or shell out through `cmd /c` / `sh -c` — arguments never pass through a shell, which is why the validators only need to reject option injection (a leading `-`) and NUL bytes.
- The updater plugin is not wired up: there is no signing key and no endpoint. Adding `tauri-plugin-updater` means adding both in the same change.
