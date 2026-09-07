---
id: T6
title: "Ship the diff workspace service"
layer: "app"
deps: ["T2"]
acs: ["AC-06", "AC-08", "AC-09", "AC-17"]
files_hint: [
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/features/commit-list/commit-list.html"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T6 — Ship the diff workspace service

## Why

One service owns «what is shown in the centre», closes the workspace on any selection / view / tab change and replays the snapshot — [ADR-0001](../adr/0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot.md), [sad §5 «Who closes the workspace»](../sad.md), [spec AC-06, AC-08, AC-09, AC-17](../spec.md).

## What

`src/app/core/services/diff-workspace.service.ts` (`providedIn: 'root'`), a thin signal wrapper over T2:

- `state`, `isOpen`, `current` (source + file), `canPrev`, `canNext` computed signals.
- `open(request)`: builds the snapshot from `CurrentRepoService` (`selectedCommitSha` or side, `railView`, `activeTabId`, `repo.listScrollTop`) plus the caller's `focusKey`; loads the file's diff through the existing diff-loading path (no second fetch when the file is already the active one — [ADR-0003](../adr/0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md)).
- `navigate(index)` / `next()` / `prev()`: load the neighbour's diff from the same source and update the active file so the owning list marks its row.
- `setFiles(files)`: applies the T2 effect (`advance` → navigate; `close` → close with the caller-provided notice via `ToastService.info`).
- `close()`: applies restore — writes `repo.listScrollTop` and publishes the pending `[data-focus-key="…"]`, which the list owning the row scrolls into view and focuses (a row outside a virtual viewport's rendered range has no element to focus).
- an `effect` that calls `close()` **without** replaying the snapshot when T2 `shouldCloseFor` is true (AC-17).
- registers `diff-workspace.open` (`mod+d`, label «Open in diff workspace») once with `KeyboardShortcutsService`, delegating to the currently registered opener (`registerOpener(fn)` used by T12 / T13 while their list has an active row) — SCR-05.

`commit-list.html`: stable `data-focus-key` on each commit row (commit sha) so the restore can land focus when the workspace was opened by shortcut from the centre (AC-08).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: open (through a temporary call or T12), change the rail view → the service reports closed and the view shows its list; return → list, not workspace (AC-17).
- [ ] Manual: close replays `listScrollTop` (commit list at the same offset) and the row with the snapshot key is scrolled into view and focused (AC-08).
- [ ] The `diff-workspace.open` shortcut appears in the Keyboard settings page (AC-12 partial).

## Notes

Logic stays in T2; this file must contain no branching that a spec could have covered. The «not loaded a second time» NFR holds because `open` on the already-active file leaves `repo.diffText` untouched.
