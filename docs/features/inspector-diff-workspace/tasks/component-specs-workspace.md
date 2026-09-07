---
id: T25
title: "Component specs: diff workspace, centre wiring and working changes"
layer: "ui"
deps: ["T15", "T17", "T18", "T19", "T21", "T23"]
acs: ["AC-06", "AC-07", "AC-13", "AC-14", "AC-15", "AC-16", "AC-17", "AC-18"]
files_hint: [
  "src/app/features/diff-workspace/diff-workspace.spec.ts",
  "src/app/features/working-changes/working-changes.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/testing/"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T25 — Component specs: diff workspace, centre wiring and working changes

## Why

The `component / automated` rows of the test plan backed by T7, T8 and T13 have no counterpart in the branch; AC-14, AC-15 and AC-18 have zero automated coverage of any kind — [review 2026-09-03 F-9](../_review/review-2026-09-03.md), [test-plan §AC coverage](../test-plan.md).

## What

Write the component specs the plan lists, against the fixed behaviour of T17–T23:

- AC-06: strip shows path, short sha + subject, previous / next, Close; the viewer's option controls appear once, inside the workspace; the inspector diff slot is 0 px while the viewer is away.
- AC-07: a binary file shows the viewer's explanation with an active strip; an emptied commit list shows the explanation with both edges disabled and Close returns (amended AC-07).
- AC-13: opening an unstaged file hides lists, filter strip and composer, shows stage controls, publishes only that side; own action emptying the side advances then closes with the AC-13 notice.
- AC-14: commit source → no staging control, staging keys inert wherever focus is.
- AC-15: commit / commit-draft shortcuts do nothing while open; Esc in the composer keeps the draft.
- AC-16: a stubbed `repo-changed` triggers one reload; an external change removing the shown file closes with the «changed outside the app» notice even when other files remain.
- AC-17: view / tab / selection change closes without replay; the original view shows its list.
- AC-18: placement = bottom renders the same header and list states; collapsing leaves the diff slot as the only growing child.

## Definition of Done

- [ ] Every listed row passes under `pnpm test`; each spec was red before the assertion was met.
- [ ] `pnpm lint` green.

## Notes

The IPC seam is the typed `invoke` stub from T15; no real repository.
