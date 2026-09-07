---
id: T20
title: "Restore focus on close reliably, including the commit-row branch"
layer: "app"
deps: []
acs: ["AC-08"]
files_hint: [
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/core/services/diff-workspace-state.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "src/app/features/commit-list/commit-list.ts",
  "src/app/features/commit-list/commit-list.html",
  "src/app/features/commit-inspector/commit-inspector.ts",
  "docs/features/inspector-diff-workspace/tasks/diff-workspace-service.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T20 — Restore focus on close reliably, including the commit-row branch

## Why

`focusRow` does one `querySelector` and gives up when the row is absent, yet both restore targets live in CDK virtual viewports and the owner already resolved that the row must be scrolled into view first; the restore is queued before the remounted commit list restores its offset; the AC's «commit row when opened by shortcut from the centre» branch was never built, so `data-focus-key="row.sha"` is inert; the fixtures pin key shapes the app never produces — [review 2026-09-03 F-6, F-14, F-16](../_review/review-2026-09-03.md), [spec AC-08](../spec.md), [test-plan §Open questions](../test-plan.md).

## What

- On close: scroll the owning viewport to the target row's index, then focus, after the commit list has applied its restored offset (let the list own the refocus after `scrollToOffset`, or move the restore to a later phase).
- `mod+d` while the commit list holds focus: open the active file with the commit row's sha as `focusKey`.
- Remove `snapshot.activeFile` and `shownFile()` (written, never read). `focusRow` takes the injected `DOCUMENT`.
- Fixtures use the real key shapes (bare path, `side:path`, sha). `tasks/diff-workspace-service.md` DoD reads «scrolls into view and focuses».

## Definition of Done

- [ ] `diff-workspace-state.spec.ts` red first on the real-key round trip, then green.
- [ ] Manual: open a file far down a 30-file list, scroll the list away, close → the row is scrolled in and focused; open by `mod+d` from the commit list, close → the commit row is focused; commit list at a non-zero offset → focus lands.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

Compile-coupled with T19 / T21 through the state and service files.

**Files beyond `files_hint`:** `src/app/features/working-changes/changes-list.ts` — the other restore target is a virtual list too and takes the same scroll-then-focus path; `src/app/shared/ui/virtual-row-focus.ts` + `src/app/shared/ui/index.ts` — the helper is shared by the three lists.
