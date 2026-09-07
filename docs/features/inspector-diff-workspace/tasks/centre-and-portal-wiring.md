---
id: T8
title: "Wire the centre view and re-host the diff viewer"
layer: "wiring"
deps: ["T7"]
acs: ["AC-06", "AC-18", "AC-19"]
files_hint: [
  "src/app/shared/components/main-content/main-content.html",
  "src/app/shared/components/main-content/main-content.ts",
  "src/app/features/diff-viewer/diff-viewer.ts",
  "src/app/features/diff-viewer/diff-viewer.html"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T8 — Wire the centre view and re-host the diff viewer

## Why

The workspace replaces the centre content *before* the `railView` switch, and the single diff viewer instance moves between the inspector slot and the workspace outlet without destroy / recreate — [ADR-0001](../adr/0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot.md), [ADR-0003](../adr/0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md), [sad §5 `main-content`](../sad.md), [spec AC-06, AC-18, AC-19](../spec.md).

## What

- `main-content.html`: centre column gains `@if (workspace.isOpen()) { <app-diff-workspace/> } @else { @switch (view()) … }`. Inspector column: drop `flex-[2]` on the commit inspector and `flex-[3]` on the diff viewer; the commit inspector becomes content-sized (`flex-none`, sized by T11) and the **diff slot** (`data-testid="inspector-diff-slot"`) is the only `flex-1 min-h-0` child; blame / file history keep their `flex-[3]` / `flex-[2]` (AC-19). The slot collapses to 0 px while the viewer element is away.
- `main-content.ts` (or a small host directive): create a `DomPortal` from the `<app-diff-viewer>` host element; on `workspace.isOpen()` → attach to the workspace outlet, on close → detach back into the slot. Same wiring in the Changes centre view (the viewer lives in the inspector there too).
- `diff-viewer.ts` / `.html`: re-measure on attach (`ResizeObserver` already fires on size change — confirm; else trigger the existing measure).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: open the workspace on a 2 000-line diff already shown in the inspector — performance panel first paint ≤ 150 ms, network / IPC shows no second `get_commit_file_diff` (NFR, AC-06); line selection and hunk cursor survive the move.
- [ ] Manual: inspector at the bottom and with blame stacked, the diff viewer height is ≥ the 1.0.5 build side by side (AC-18, AC-19); both densities, both themes, Windows and Linux WebKitGTK if available ([sad §11](../sad.md) risk 1).
- [ ] Manual: while open, the inspector diff slot is 0 px and header + list take the column (AC-06).

## Notes

Fallback if the portal misbehaves in a configuration: two conditional hosts (ADR-0003 option 2) — record the measurement that forced it. Shares `features/diff-viewer/` with T5, different files.

**Files beyond `files_hint`:** `src/app/features/commit-list/commit-list.ts` — the History content unmounts while the workspace is open and remounts on close, so its virtual-scroll viewport recreates at offset 0; only `CommitList` owns `listScrollTop` and the viewport, so restoring the scroll position the workspace hands back had to happen there rather than in `main-content`.
