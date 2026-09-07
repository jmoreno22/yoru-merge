---
id: T2
title: "Write the diff workspace state machine"
layer: "domain"
deps: []
acs: ["AC-08", "AC-09", "AC-11", "AC-13", "AC-16", "AC-17"]
files_hint: ["src/app/core/services/diff-workspace-state.ts", "src/app/core/services/diff-workspace-state.spec.ts"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T2 — Write the diff workspace state machine

## Why

The workspace is in-memory centre-view state with a restore snapshot, and its restore logic must be a pure-TypeScript unit test (NFR «close ≤ 100 ms … pure-TypeScript unit test on the restore logic») — [ADR-0001](../adr/0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot.md), [sad §5 ownership rules](../sad.md), [spec AC-08, AC-09, AC-11, AC-13, AC-16, AC-17](../spec.md).

## What

`src/app/core/services/diff-workspace-state.ts`, framework-free:

- types: `DiffWorkspaceSource = { kind: 'commit'; sha: string } | { kind: 'working-tree'; side: 'staged' | 'unstaged' }`; `DiffWorkspaceSnapshot = { railView, tabId, selectedCommitSha | side, activeFile, listScrollTop, focusKey }`; `DiffWorkspaceState = { open: false } | { open: true; source; files: string[]; index; snapshot }`.
- pure transitions: `open(state, { source, files, index, snapshot })` (replaces any open workspace — AC-09), `navigate(state, index)` (clamped, returns unchanged at the edges — AC-11), `setFiles(state, files)` → `{ state, effect: 'keep' | 'advance' | 'close' }` (shown file gone: advance to the next on the same side, else close — AC-13, AC-16; empty list keeps the workspace open with both edges disabled — AC-07 «commit removed»), `close(state)` → `{ state, restore: RestoreInstructions }` where restore carries `listScrollTop`, `selection` and `focusKey` (the originating row, or the now-active file when navigation changed it — AC-08).
- `shouldCloseFor(state, current: { railView, tabId, selectedCommitSha, side })` → boolean: true when any differs from the snapshot (AC-17); `canPrev / canNext` selectors.

Plus `diff-workspace-state.spec.ts`.

## Definition of Done

- [ ] `diff-workspace-state.spec.ts` passes: open replaces an open workspace (one at a time); navigate at first / last is a no-op and `canPrev / canNext` are false there; `setFiles` returns `advance` when the shown file left and a neighbour remains, `close` when none remains, `keep` otherwise, and keeps the workspace open on an empty list; `close` after navigation restores focus on the now-active file, otherwise on the originating key, always with the captured `listScrollTop`; `shouldCloseFor` is true for each of view, tab, commit, side changes and false when identical.
- [ ] No `@angular/core` import; `pnpm test` and `pnpm lint` green.

## Notes

`DiffWorkspaceSnapshot` is the single checklist of what the centre view must recover ([sad §11](../sad.md) risk 3): document that in a short type comment. Consumed by T6.
