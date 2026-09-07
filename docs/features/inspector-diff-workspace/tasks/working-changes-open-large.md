---
id: T13
title: "Add the open-large gesture to the working-changes lists"
layer: "ui"
deps: ["T6"]
acs: ["AC-06", "AC-13", "AC-15", "AC-16"]
files_hint: [
  "src/app/features/working-changes/working-changes.ts",
  "src/app/features/working-changes/working-changes.html",
  "src/app/features/working-changes/file-row.html",
  "src/app/features/working-changes/file-row.ts",
  "src/app/features/working-changes/changes-list.ts",
  "src/app/features/working-changes/commit-composer.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T13 — Add the open-large gesture to the working-changes lists

## Why

Changes gets only the gesture: one side at a time, lists and composer hidden while open, composer shortcuts inert, advance-or-close when the side empties — [sad §5](../sad.md), [sad §6 critical flow 2, F8](../sad.md), [spec AC-13, AC-15, AC-16](../spec.md), [screens SCR-03, SCR-04](../screens.md).

## What

In `features/working-changes/`:

- Row control `lucideMaximize2` + `yoruTooltip` «Open in diff workspace (Ctrl+D)» on hover / focus / active for **staged and unstaged rows only** (Conflicts keep Resolve — owner decision in screens) (`changes-open-large-<side>-<path>`); double-click; `registerOpener` while a staged / unstaged row is active. On open: `source = { kind: 'working-tree', side }`, `files` = that side's paths in display order (tree or flat via `changes-tree.ts`), snapshot with the row's `data-focus-key`.
- `working-changes.html`: `@if (!workspace.isOpen())` around the filter strip, the lists and the composer (the centre is the workspace, wired by T8).
- `commit-composer.ts`: the commit and commit-draft shortcuts gain `when: () => !workspace.isOpen()` (AC-15).
- `effect`: while open, re-publish `setFiles` with the shown side's current files after every refresh (own stage / unstage and watcher-driven alike); T6 applies advance-or-close. Notices: own action → `ToastService.info` «No changes left in Unstaged» / «… in Staged» (AC-13); external change → «<path> no longer has unstaged changes (changed outside the app)» (AC-16) — distinguish by whether an `OpsRunner` stage / unstage from this workspace was in flight.

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: open an unstaged file → lists + composer hidden, hunk / line stage controls present; stage a hunk → diff refreshes; Close → counts updated (AC-13). `shift+n` never crosses to Staged.
- [ ] Manual: `Ctrl+Enter` / `Ctrl+Shift+Enter` while open commit nothing (AC-15).
- [ ] Manual: stage the last hunk of the last unstaged file → workspace closes, Changes view back with the toast «No changes left in Unstaged» (AC-13); `git add` the shown file from a terminal → closes with the external notice (AC-16).

## Notes

Shares `working-changes.html` with T5 (lane); T5's edit is the one `(keydown.escape)` attribute. Reuse the existing `busy` on hunk buttons for SCR-04 refreshing — nothing new to draw.
