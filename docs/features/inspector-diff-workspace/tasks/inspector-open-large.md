---
id: T12
title: "Add the open-large gesture to the commit inspector"
layer: "ui"
deps: ["T6", "T11"]
acs: ["AC-06", "AC-07", "AC-08", "AC-09", "AC-11", "AC-17"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.html",
  "src/app/features/commit-inspector/commit-files.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T12 — Add the open-large gesture to the commit inspector

## Why

The list that owns the gesture opens the workspace, passes the files in displayed order, re-publishes on change and lets its active row follow — [sad §5 «Who opens the workspace»](../sad.md), [sad §6 critical flow 1, F4, F5](../sad.md), [spec AC-06…AC-09, AC-11, AC-17](../spec.md), [screens SCR-01 workspace-open](../screens.md).

## What

In `features/commit-inspector/`:

- Row control `yoru-button` ghost sm icon-only `lucideMaximize2` + `yoruTooltip` «Open in diff workspace (Ctrl+D)» on hover / focus / active row (`inspector-open-large-<path>`); double-click on a row; `DiffWorkspaceService.registerOpener` while a file row is active (the `mod+d` shortcut is T6's).
- On open: `files` = the paths in the **current display order** (tree or flat, folders skipped — derive from the same model `commit-files.ts` renders), `index` = the active file, `focusKey` = the row's stable key (`data-focus-key` on each row); source = the selected commit.
- `effect`: while open, re-publish `setFiles` when the order (tree / flat toggle, filter) or the content changes; when the commit was removed by a refresh publish `[]` (AC-07 «commit removed» — edges disabled, workspace stays).
- Active row follows `workspace.current()` (AC-11); clicking another row while open calls `navigate` instead of opening a second workspace (AC-09).
- Workspace-open state (W-01d): with the diff slot at 0 px the policy receives the full height, so the list shows as many rows as fit — verify the T11 policy handles `diffFloor = 0` when the viewer is away.

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: double-click, control and `mod+d` each open the workspace on the active file; strip shows path + short sha + subject (AC-06).
- [ ] Manual: Esc / Close → commit list at the same scroll, same commit, focus on the originating row; after `shift+n`, focus on the now-active row (AC-08).
- [ ] Manual: tree order vs flat order → `shift+n` follows what the list shows, folders skipped; edges disabled (AC-11).
- [ ] Manual: `git commit --amend` outside the app while open → explanation replaces the diff, edges disabled, Close returns (AC-07).

## Notes

Last in the `commit-inspector` lane. The Reflog view shows the same inspector, so nothing extra is needed there.
