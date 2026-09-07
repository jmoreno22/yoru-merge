---
id: T24
title: "Component specs: commit inspector, open-large gesture and shortcuts help"
layer: "ui"
deps: ["T15", "T16", "T17", "T18", "T20", "T21", "T22"]
acs: ["AC-01", "AC-02", "AC-04", "AC-05", "AC-08", "AC-11", "AC-12", "AC-21"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "src/app/features/settings/settings-dialog.spec.ts",
  "src/testing/"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T24 — Component specs: commit inspector, open-large gesture and shortcuts help

## Why

The `component / automated` rows of the test plan backed by T9, T10, T11, T12 and the Keyboard page have no counterpart in the branch — [review 2026-09-03 F-9](../_review/review-2026-09-03.md), [test-plan §AC coverage](../test-plan.md).

## What

Write the component specs the plan lists, against the fixed behaviour of T16–T22:

- AC-01: 12-line body clamped to four lines with «show more»; 2-line body unclamped with no control; «show more» unclamps in place.
- AC-02: collapse control / shortcut → summary line; expand restores the clamp state; a seeded `true` preference paints the summary line on the first render.
- AC-04: 30 files → six rows, scrollable, count 30; 2 files → two rows; 0 files → header with 0 and «No files changed».
- AC-05: collapse keeps the active file in the viewer; expand brings the same active row back.
- AC-08: close restores focus to the originating row, to the commit row when opened by shortcut from the centre, to the now-active row after navigation, and to a row outside the viewport after scrolling it in.
- AC-11: next shows the third of five, marks the row active, disables the edges, skips folders in tree order.
- AC-12: the Keyboard page lists the six rows with the workspace closed; no combo equals a hunk combo.
- AC-21: six icon actions with tooltips; overflow into More under a narrow width; Reset → Hard keeps its confirmation.

## Definition of Done

- [ ] Every listed row passes under `pnpm test` (jsdom docblock, TestBed, `src/testing/` stubs); each spec was red before the assertion was met.
- [ ] `pnpm lint` green.

## Notes

Fixtures per test-plan §Test data (component). Layout geometry stays manual (e2e-through-UI rows).
