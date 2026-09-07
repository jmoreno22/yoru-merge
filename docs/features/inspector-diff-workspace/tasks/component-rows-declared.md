---
id: T27
title: "Component rows the plan declared: header, shortcuts, squeezed column, rows while open, commit-list restore, Esc layers, filter guard, hunk keys, watcher trigger"
layer: "ui"
deps: ["T24", "T25"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-06", "AC-08", "AC-10", "AC-11", "AC-12", "AC-13", "AC-16"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "src/app/features/commit-list/commit-list.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/features/settings/settings-dialog.spec.ts",
  "src/app/features/working-changes/working-changes.spec.ts",
  "src/app/features/diff-workspace/diff-workspace.spec.ts",
  "src/testing/",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T27 — Component rows the plan declared

## Why

The re-review of 2026-09-04 traced every AC to code and found the behaviour intact, but nine rows `test-plan.md` marks `component · automated` were never written by T24 / T25, and the fixes of T19 and T22 (the watcher trigger, the filter guard) have no assertion at any level — [review 2026-09-04 G1–G9](../_review/review-2026-09-04.md). The owner's 2026-09-03 decision was to honour the plan, not to relabel it.

## What

Write the missing rows against the behaviour as of `f3069c2`, one `it` per row, red before green:

- **AC-01** (`test-plan.md` row «long body opens clamped»): the expanded header also shows author, dates, short sha, ref badges and the six actions — reuse the label sweep of the AC-21 tests.
- **AC-02** (row «collapse control and shortcut»): dispatch `mod+shift+h` and `mod+shift+l`; assert the summary line / header-only list and the written preference.
- **AC-03** (row «squeezed inspector writes the two variables»): mount the inspector at the minimum height with a 12-line body and 30 files; the host carries `--inspector-list-rows: 2` and `--inspector-clamp-lines: 1`.
- **AC-04 / AC-06** (`DESIGN.md` §Density, W-01d): with the workspace open, `--inspector-list-rows` exceeds the policy value up to the file count and returns to it on close.
- **AC-08** (rows «Esc and Close bring the commit list back» and «target row outside the viewport»): render `CommitList`, open by `mod+d` from a focused commit row at a non-zero offset, close; the offset is replayed and the commit row (sha key) is focused. New spec file `commit-list.spec.ts`.
- **AC-10** (row «Esc with a higher layer open»): in the `MainContent` fixture layer a dialog, the palette, an opted-in filter with content and a diff line selection over an open workspace; each Esc closes exactly one layer, the workspace last.
- **AC-11** (F-10 guard, `commit-inspector.ts` republish effect): type a filter term that hides the shown file while the workspace is open; `isOpen()` and `current()?.file` are unchanged.
- **AC-12** (row «hunk shortcuts still move between hunks»): press `n` with the workspace open and assert the hunk position advanced; the collision row in `settings-dialog.spec.ts` reads the viewer's registered combos instead of a hardcoded `n` / `p`.
- **AC-13** (`working-changes.spec.ts` `republish` helper): drive one advance through the Stage control so a real staging call holds `stagingBusy` across its own refresh, instead of writing the flag directly.
- **AC-16** (row «watcher event while a working-tree file is shown»): drive the stub's `repo-changed` emitter through the watcher listener (debounce and echo suppression included) instead of calling `refreshAll()`; if the listener cannot be driven under jsdom, amend the row to put that link on the manual checklist and say so.
- **AC-06** (double-click row): count `get_commit_file_diff` calls from `stub.calls`, as the working-changes spec already does for `get_diff`.

Test hygiene found by the same review:

- Provide the icon set in every component `TestBed` (a shared helper in `src/testing/`) so jsdom logs no «No icon named lucideX was found».
- The inspector spec reuses the shared `CommitDetails` factory from `repo-fixtures.ts` (extend it with `subject` / `body` overrides) and drops its local pair.
- Remove the unreachable `ng_on_destroy: undefined` stub entries and the comments that describe them (`tauri-git-stub.ts` short-circuits `ngOnDestroy` before the lookup), the `TEST_CONFIG` export and the `DISPLAYED` duplicate of `PATHS`.

## Definition of Done

- [ ] Every row above passes under `pnpm test`; each spec was red before the assertion was met.
- [ ] `test-plan.md`: the rows now carry `T27` in their task column; any row amended to manual says why.
- [ ] No `ng_on_destroy` entry remains under `src/`; `pnpm test` runs without the missing-icon stderr noise.
- [ ] `pnpm lint` green.

## Notes

`commit-list.spec.ts` is a new component spec: the list is unmounted while the workspace is open (`main-content.html`), so the restore must be driven through `MainContent` or through the service's `pendingFocusKey` with the list re-rendered — pick whichever the T25 fixtures already support.

**Files beyond `files_hint`:** `src/app/features/commit-list/commit-list.ts` — the AC-08 row exposed a real defect (the remounted list zeroed `listScrollTop` before reading it back), fixed with a remount guard in the same commit so the row could land green; `src/app/core/services/diff-workspace.service.spec.ts` — the unreachable `ng_on_destroy` stub entries finding C3 names live there too.
