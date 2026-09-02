# PROJECT KNOWLEDGE BASE

## OVERVIEW
YoruMerge — cross-platform Git GUI desktop client (Windows / Linux). Tauri 2
shell, Angular 22 frontend (TypeScript, Signals, zoneless), Rust backend driving
the `git` CLI, Tailwind CSS 4. pnpm-managed.

## STRUCTURE
```
./                       # repo root = the app + its docs
├── README.md            # quickstart, requirements, shortcuts
├── ARCHITECTURE.md      # 3-layer architecture (Angular → Tauri IPC → Rust)
├── DESIGN.md            # design-system source of truth (Japanese cyberpunk theme)
├── CONTRIBUTING.md      # contributor rules
├── CHANGELOG.md         # Keep a Changelog; release.yml lifts the tag's section into the release body
├── docs/screenshots/    # captures referenced by the README
├── .github/workflows/   # ci.yml (lint/test/build + bundle smoke) + release.yml
├── src/                 # Angular frontend (entry src/main.ts, host src/index.html)
│   └── app/AGENTS.md    # frontend conventions
├── src-tauri/           # Rust backend + Tauri config (main.rs → lib.rs run()); see src-tauri/AGENTS.md
├── angular.json         # dev server :1420, prefix=app, prod budgets 1.2/1.6 MB
├── biome.json           # formatter + linter config (2 spaces, single quotes, 88 cols)
├── vitest.config.ts     # pure-TS unit tests, node environment
└── tsconfig*.json       # strict TS + strict Angular templates
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Run / build the app | repository root | all commands run from the repo root |
| Add a Git operation | `src-tauri/src/commands/` + register in `lib.rs` | Rust backend |
| Call backend from UI | `src/app/core/services/tauri-git.service.ts` | Single `invoke()` bridge, one method per command |
| Repo state and actions | `src/app/core/services/current-repo.service.ts` + `core/services/ops/*` | Facade over the active tab; features never invoke directly |
| Add / edit a screen | `src/app/features/` | One folder per screen or dialog |
| App chrome | `src/app/shared/components/` | titlebar, tabs, toolbar, rail, sidebar, `main-content` (the centre view), status bar |
| Shared UI kit | `src/app/shared/ui/` | `yoru-*` components, context menus, shortcuts, tooltips |
| Shared types | both `src/app/core/models/` (TS) and `src-tauri/src/models/` (Rust) | Kept in sync by hand via serde; fields are `snake_case` on both sides |
| Styling / theme tokens | `DESIGN.md` first, then `src/styles.css` | DESIGN.md is canonical — update it BEFORE code |
| App startup wiring | `src/app/app.config.ts`, `src-tauri/src/lib.rs` | There is no router; `AppShell` is the UI root |

## ARCHITECTURE (the one mental model that matters)
```
Angular UI ──invoke("cmd", args)──► #[tauri::command] async fn ──► git CLI / notify
         ◄──── serde JSON / emit() events ────
```
Every backend capability is a Rust command registered in `lib.rs`'s
`invoke_handler` AND wrapped in `tauri-git.service.ts`. Adding a feature means
touching both sides plus the matching model in both `models/` directories.

## CONVENTIONS (deviations only)
- The app lives at the repository root: frontend in `src/`, backend in `src-tauri/`.
- TS is fully strict (`strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`); Angular strict templates on (`strictTemplates`, `strictInjectionParameters`, `typeCheckHostBindings`).
- **Biome** is the formatter and linter, configured in `biome.json`: 2 spaces, single quotes, 88 columns, LF endings, organize-imports on.
- Identifiers and comments are in **English**. A comment earns its place only by explaining a non-obvious *why*.
- No path aliases in tsconfig; use relative imports.
- Conventional Commits required (`feat:`, `fix:`, `chore:`…). One feature/fix per PR. No co-authorship trailers.
- The frontend is **zoneless**: `zone.js` is not a dependency. Anything asynchronous must end in a signal write.
- Paths handed to git always use forward slashes and `-z` / `%x00` separators, so non-ASCII names and spaces survive on both platforms.

## ANTI-PATTERNS (THIS PROJECT)
- **Never** push with bare `--force` — use `--force-with-lease` (enforced in `commands/remote.rs`).
- **Never** remove the `#![windows_subsystem]` attribute at the top of `src-tauri/src/main.rs`.
- **Never** encode Git state by colour alone — pair it with an icon or a word (DESIGN.md accessibility rule).
- **Never** use pure-black backgrounds or display fonts for dense UI text (DESIGN.md).
- **Never** widen the CSP in `tauri.conf.json` to work around a build artefact. Tauri adds a nonce to `style-src`, which makes `'unsafe-inline'` inert: Angular's component styles are matched to that nonce through `CSP_NONCE` in `app.config.ts`, and the production build has `inlineCritical` off so the stylesheet is a plain `<link>` rather than one revived by an inline `onload`.
- Validate every git argument before any fs/git access, with the validators in `commands/git.rs`. Arguments never reach a shell, so what they reject is option injection (a leading `-`) and NUL bytes.
- Shelling out goes through the `GitCmd` builder — never `cmd /c` or `sh -c`.

## TESTING
- Frontend: `pnpm test` → vitest over `src/**/*.spec.ts`, **pure TypeScript only** (no `@angular/core` imports, node environment). Component contracts are checked by `ng build` with `strictTemplates`.
- Rust: `cargo test --all-features`. Lint gate: `cargo clippy --all-targets -- -D warnings`; format gate: `cargo fmt --all -- --check`.

## COMMANDS
```bash
pnpm install             # frontend deps (CI: pnpm install --frozen-lockfile)
pnpm tauri dev           # run desktop app (triggers `pnpm start` = ng serve :1420)
pnpm tauri build         # release bundle (triggers `pnpm build`)
pnpm tauri build --debug # debug bundle, what CI's bundle-smoke runs
pnpm build               # frontend-only production build (budgets 1.2 / 1.6 MB)
pnpm lint                # biome check src
pnpm format              # biome format --write src
pnpm test                # vitest run
cd src-tauri && cargo clippy --all-targets -- -D warnings
cd src-tauri && cargo test --all-features
```

## NOTES
- CI (`ci.yml`) runs lint / test / frontend build / `cargo fmt --check` / clippy / cargo test on Ubuntu and Windows, plus a `bundle-smoke` job that runs `pnpm tauri build --debug` on both. Node 24, pnpm pinned by `packageManager`. The bundling jobs pin `ubuntu-22.04` on purpose — an AppImage links against the builder's glibc.
- Linux builds need system packages: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libgtk-3-dev`, `libssl-dev`, `build-essential`.
- The Tauri updater IS wired: `createUpdaterArtifacts` + `plugins.updater` in `tauri.conf.json` (endpoint = GitHub Releases `latest.json`), signed in CI with the `TAURI_SIGNING_*` secrets. Releases are built by `release.yml` via `tauri-apps/tauri-action`, with the release body extracted from the tag's `CHANGELOG.md` section.
- `.agents/`, `.claude/` and `.sisyphus/` are agent/workflow metadata, not app code, and are untracked.
