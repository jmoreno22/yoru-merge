# YoruMerge — Architecture

## Three layers

```
┌───────────────────────────────────────────────────────────┐
│  Angular 20 frontend — src/                                │
│  standalone components · signals · Tailwind CSS 4          │
└───────────────────────────┬───────────────────────────────┘
                            │  invoke() / Channel / emit()
                            │  Tauri IPC (serde JSON)
┌───────────────────────────▼───────────────────────────────┐
│  Rust backend — src-tauri/src/                             │
│  #[tauri::command] · git2 · git CLI via GitCmd · notify    │
└───────────────────────────────────────────────────────────┘
```

Adding a capability means touching both sides: a command in
`src-tauri/src/commands/`, its registration in `lib.rs`, a matching struct in
`src-tauri/src/models/`, a wrapper method in `tauri-git.service.ts`, and a
mirror type in `src/app/core/models/`. Serde field names are snake_case on both
sides so the two model directories read identically.

## Backend

### git2 or the CLI?

Both, deliberately.

- **`git2` (libgit2)** for reading: revision walks, commit metadata, refs,
  blame. No process spawn per row, and no output parsing.
- **The `git` CLI** for everything that writes or that libgit2 models
  differently from Git itself: merge, rebase, cherry-pick, revert, stash,
  hunk-level staging, remotes and credentials. The user's own `git` config,
  hooks and credential helpers then apply exactly as they do in a terminal.

Every CLI call goes through **`GitCmd`** (`commands/git.rs`) — the single
builder for spawning `git`. It owns the non-interactive environment
(`GIT_TERMINAL_PROMPT=0` and friends), hidden windows on Windows, stdout/stderr
capture, streaming output, and the shared argument validators
(`validate_repo_path`, `validate_ref`, `validate_pathspec`, `validate_sha`, …).
Nothing spawns `git` any other way, and no module keeps a private copy of a
validator.

Cross-platform rules the backend follows: forward slashes in every path handed
to Git (`git_path`), never a shell (`cmd /c`, `sh -c`), `#[cfg(windows)]` /
`#[cfg(unix)]` for process spawning, CRLF-safe parsing, and `-z` / `%x00`
separators for anything that can contain a path.

### Commands

`src-tauri/src/commands/` is one module per domain: `repo`, `commits`,
`changes`, `staging`, `hunks`, `diff`, `branches`, `branch_ops`, `tags`,
`merge`, `stash`, `remote`, `search`, `history`, `commit_details`, `repo_state`,
`sequencer`, `reflog`, `config`, `system`, `watcher`, `git_auth`, `advanced`.

Commands are `async fn` and run their blocking work inside
`tauri::async_runtime::spawn_blocking`, so a slow `git log` on a large
repository never blocks the IPC thread. Results are `Result<T, String>` with
user-readable messages; where the UI has to branch on the outcome the command
returns a tagged enum instead (`SequencerResult`, `CheckoutResult`, `PullResult`).

### History cache

Paging a repository with 200 000 commits cannot re-walk the history per page,
and lane assignment has to be stable across pages or the graph would jump.
`history.rs` keeps a per-repository cache in Tauri managed state: the
topologically ordered oid list, HEAD reachability, and the ref map, fingerprinted
against `for-each-ref`. A page is a slice of that list; lanes are computed once
over the whole list (`graph/lane_assignment.rs`) and sliced to the page.

### File watcher

`watcher.rs` uses `notify-debouncer-full` with a 400 ms debounce and ignores the
noisy paths (`.git/objects/**`, `*.lock`, `node_modules`, `target`, `dist`,
`.angular`). Each event is classified as `refs`, `worktree` or `index` so the
frontend can refresh only what changed instead of reloading everything.

## Frontend

### Layers

```
src/app/
  core/       services, models, utils — no templates
    services/ tauri-git.service.ts (the only invoke() bridge)
              workspace.store.ts    (multi-repo state)
              current-repo.service.ts + ops/ (actions per domain)
    models/   TypeScript mirrors of the Rust structs
  shared/
    ui/       the UI kit — dialog, context menu, button, badge, …
    icons/    the curated Lucide set
    components/ app chrome: shell, toolbar, rail, sidebar, status bar
  features/   one folder per screen or dialog
```

State is Angular Signals. RxJS is present but is not the state model.
Components are standalone with `ChangeDetectionStrategy.OnPush`.

### Multi-repository state

`WorkspaceStore` holds one `RepoState` per open repository — the tabs in the
title bar. Each `RepoState` is a bag of signals (branches, history, working
changes, repo state, selected commit, …) plus its own watcher subscription.
Switching tabs swaps which `RepoState` the UI reads; nothing is re-fetched.

`CurrentRepoService` is a thin facade over the active `RepoState`. The actual
work lives in `core/services/ops/` — one service per domain (`repo-ops`,
`staging-ops`, `branch-ops`, `remote-ops`, `merge-ops`, `stash-ops`,
`history-ops`, `sequencer-ops`, `system-ops`), each taking the `RepoState` it
operates on explicitly, so an action started on one tab cannot land on another
after an await.

### Rendering choices

- The **branch graph** is a `<canvas>`. Thousands of rows of SVG would not
  survive scrolling; the canvas reads its lane palette from the
  `--graph-lane-*` CSS variables once per theme.
- The **diff viewer** is `diff2html` plus `highlight.js/lib/core` with an
  explicit language list. **No Monaco** — a full editor is tens of megabytes for
  a read-only view, and it fights the theme.
- Long lists (commits, files, blame) use the CDK virtual scroller. Row heights
  are fixed by the density tokens in `styles.css`; `--row-h` must match the
  virtual scroller's `itemSize` and the graph's row height.

## Repository layout

```
./                     the application and its docs
├── README.md          quickstart
├── ARCHITECTURE.md    this file
├── DESIGN.md          the design system (canonical)
├── CONTRIBUTING.md    conventions
├── .github/workflows/ ci.yml + release.yml
├── src/               Angular frontend (entry: src/main.ts)
├── src-tauri/         Rust backend + Tauri config (entry: src/lib.rs)
├── angular.json       dev server on port 1420, bundle budgets
├── biome.json         formatter + linter
└── vitest.config.ts
```
