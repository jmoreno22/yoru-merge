# Contributing to YoruMerge

## Setup

1. Install the prerequisites in [README.md](README.md#prerequisites) — Node ≥ 22,
   pnpm 11 (`corepack enable`), Rust stable, and the WebKitGTK packages on Linux.
2. `pnpm install`
3. `pnpm tauri dev`

Everything runs from the repository root.

## Before you open a PR

```bash
pnpm lint          # Biome
pnpm test          # Vitest
pnpm build         # production build, enforces the bundle budgets

cd src-tauri
cargo clippy --all-targets -- -D warnings
cargo test --all-features
```

All five must pass. Report the real result — a skipped check is worse than a
failing one.

## Commits

[Conventional Commits](https://www.conventionalcommits.org):
`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`,
`ci:`. One feature or fix per PR.

Commit messages describe the change, nothing else — no tool attribution, no
co-author trailers.

## Frontend

- **Read [DESIGN.md](DESIGN.md) first.** It is the source of truth: if the
  implementation and the document disagree, update the document, then the code.
- Build from the **UI kit** in `src/app/shared/ui/` (`yoru-dialog`,
  `yoru-context-menu`, `yoru-button`, …) rather than restyling raw elements.
  Its API is documented in `shared/ui/README.md`.
- **Icons are Lucide via `<ng-icon>`.** Never emoji or unicode glyphs. Add a new
  icon to `shared/icons/icons.ts` first — `YoruIconName` is the allowed set.
- **Every scrollable surface gets `.neon-scroll`.** Never redeclare
  `::-webkit-scrollbar` in a component.
- Colours come from `--app-*` / `--color-*` tokens. No hex in a template. Dim
  text by stepping down to `--app-text-faint`, not with `opacity-*`.
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals
  (`input()`, `output()`, `model()`) — no `@Input`/`@Output` decorators.
- Templates and styles in separate `.html` / `.css` files. Component classes are
  named without a `Component` suffix (`Sidebar`, `AppShell`).
- Never let a feature component reach into a sibling; route intent through the
  shell or a core service.
- UI text is English. Never encode Git state by colour alone — pair it with an
  icon or a label.

## Backend

- Spawn `git` only through `GitCmd` (`commands/git.rs`), and use its shared
  validators. No local copies.
- Commands are `async fn`; blocking work goes inside
  `tauri::async_runtime::spawn_blocking`.
- Windows **and** Linux: forward slashes in paths handed to Git, no shell
  invocation, `#[cfg(windows)]` / `#[cfg(unix)]` where behaviour differs,
  CRLF-safe parsing, `-z` / `%x00` separators for anything containing paths.
- Error strings are read by users: trim stderr, drop the duplicated `fatal:`
  prefix. Where the UI branches on the outcome, return a tagged enum.
- Never push with a bare `--force`; `--force-with-lease` only.
- Never remove the `#![windows_subsystem]` attribute at the top of `main.rs`.

## Tests

- Rust: a test per command, against a temp repo created with `git init -b main`.
  Cover unicode paths, paths with spaces, and root commits.
- Frontend: Vitest covers pure TypeScript — parsers, validators, helpers.
  Component behaviour is checked by `ng build` with `strictTemplates`. Keep
  specs free of `@angular/core` imports; a spec that needs DOM globals opts in
  with `// @vitest-environment jsdom` on the first line.

## Style

Biome (`biome.json`) is the formatter and linter: 2-space indent,
single quotes, semicolons, 88-column lines. It runs on `src/**/*.ts` and
`src/**/*.css` — templates are not formatted by it.

Two recommended rules are switched off on purpose; `biome.json` cannot carry
comments, so the reasons live here:

- **`complexity/useLiteralKeys`** — its fix rewrites `raw['key']` to `raw.key`,
  which does not compile under the project's
  `noPropertyAccessFromIndexSignature`.
- **`complexity/noImportantStyles`** — the `prefers-reduced-motion` override and
  the drag-over highlight in `styles.css` must beat utility classes.

- English identifiers and comments.
- Comments explain a non-obvious *why* or a constraint the code cannot express.
  No narration of what the code does, and no ticket ids.
- Match the surrounding indentation of the file you are editing.

## License

By contributing you agree your contributions are licensed under the MIT License.
