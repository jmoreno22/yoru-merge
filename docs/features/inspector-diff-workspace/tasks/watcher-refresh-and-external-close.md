---
id: T19
title: "Refresh the workspace diff on watcher events and close on external emptying"
layer: "app"
deps: []
acs: ["AC-13", "AC-16"]
files_hint: [
  "src/app/core/services/ops/repo-ops.ts",
  "src/app/core/services/ops/staging-ops.ts",
  "src/app/core/services/workspace.store.ts",
  "src/app/core/services/diff-workspace-state.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/features/working-changes/working-changes.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T19 — Refresh the workspace diff on watcher events and close on external emptying

## Why

`runRefresh` never reloads the active diff, so an external edit leaves stale patch text in the workspace; `setFiles` advances whenever other files remain, so the AC-16 «changed outside the app» notice is reachable only when the whole side empties; and the own-vs-external verdict is a one-second wall clock whose premise about the watcher does not hold — [review 2026-09-03 F-4, F-5, F-12](../_review/review-2026-09-03.md), [spec AC-13, AC-16, §6.1](../spec.md), [sad.md F8](../sad.md).

## What

- `runRefresh`: on `worktree` / `index` kinds, reload the active diff (`refreshActiveDiff`) while the workspace shows a working-tree file.
- Ownership as a flag, not a clock: the staging operations mark the refresh they trigger; `OWN_ACTION_WINDOW_MS` and `ownStagingAt` are removed.
- `setFiles(state, files, own)`: an external change that removed the shown file → `close` regardless of what else remains; the app's own action → `advance` (or `close` when none remains); the `advance` branch sets `navigated: true` so a later close focuses the now-active row.
- `working-changes.ts` selects the AC-13 or AC-16 notice from the flag.

## Definition of Done

- [ ] `diff-workspace-state.spec.ts` red first, then green: own-advance, external-close with files remaining, advance-then-close focus key; no `@angular/core` import.
- [ ] Manual: edit the shown file from a terminal → the diff refreshes; stage it from a terminal → the workspace closes with the external notice.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

Shares `diff-workspace-state.ts` and `diff-workspace.service.ts` with T20 / T21: one compile-coupled lane.

**Files beyond `files_hint`:** `src/app/core/services/current-repo.service.ts` — `changesOrigin` needs a proxy accessor like every other per-repo field; `src/app/features/commit-inspector/commit-inspector.ts` — `setFiles` gained a required `origin` parameter every caller must pass.
