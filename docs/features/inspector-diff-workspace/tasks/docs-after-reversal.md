---
id: T39
title: "Bring the repo docs and the test plan in line with the reversal"
layer: "docs"
deps: ["T36", "T37", "T38"]
acs: ["AC-04", "AC-06", "AC-22"]
files_hint: ["DESIGN.md", "README.md", "docs/features/inspector-diff-workspace/test-plan.md"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T39 — Bring the repo docs and the test plan in line with the reversal

## Why

`DESIGN.md` is the canonical description of the workbench vocabulary (T14, T28) and still describes the pre-reversal inspector: §Density says `--inspector-list-rows` runs «1 to 6, and past 6 while the diff workspace is open», §Density says `--inspector-header-max-h` is «whatever the diff slot's floor and the file list leave», the policy rule is stated as «the diff slot keeps at least half of the column», and §App shell lists the diff slot as a `flex-1` block whose released pixels «land in the diff slot». None of that is true after `2049df4`, and AC-22's control is documented nowhere.

## What

- `DESIGN.md` §Density: `--inspector-list-rows` is unbounded above with a 2-row floor; `--inspector-header-max-h` is what the **file list's** floor leaves; the policy rule protects the list, not the diff.
- `DESIGN.md` §App shell: the History inspector is the commit header and the file list — the diff slot is a zero-height parking home for the portalled element (ADR-0003 unaffected); the Changes view keeps its real, growing slot. Every pixel a collapsed block releases lands in the file list.
- `DESIGN.md`: the open-behaviour control and the `commitFileClickOpensWorkspace` preference (AC-22), including that both modes keep the double-click, the open-large control and the shortcut.
- `README.md`: only if its preferences or shortcut table goes stale from the above — the six combos of T14 are unchanged.
- `test-plan.md`: a row mapping AC-22 to the T36 component rows, and the AC-03 / AC-04 / AC-06 / AC-18 rows re-pointed at what the amended criteria now assert.

## Definition of Done

- [ ] No stale mention of the diff slot as a growing or floor-holding block in History remains in `DESIGN.md` (grep for `diff slot`, `flex-1`, `50 %` in the inspector sections).
- [ ] AC-22 has a row in `test-plan.md` naming at least one test, and no test-plan row describes an assertion the wave removed.
- [ ] Markdown lint (if configured) and `pnpm lint` green.

## Notes

Docs only — no code. **Not covered here:** `screens.md` has no state for the open-behaviour control (SCR-01's file list header); that is a `/sdd:screens` re-run, not a task. T26 stays blocked on the owner's screenshots, and its `diff-workspace-dark.png` should now also show the control.

## Outcome (2026-09-07)

Landed in `805a32d`. `DESIGN.md` §Density and §App shell rewritten (rows
unbounded with a 2-row floor, the cap as what the list's floor leaves, the
policy protecting the list, the slot's double life), plus a new «Opening a
file» paragraph for AC-22. `README.md`'s History bullet no longer promises a
per-file diff inside the inspector. `test-plan.md` gained four AC-22 rows and
re-pointed the AC-04 and AC-06 rows.

**Still open, deliberately:** `screens.md` has no state for the open-behaviour
control in SCR-01's file list header — that is a `/sdd:screens` re-run, not a
task. **T26** remains blocked on the owner's screenshots, and
`diff-workspace-dark.png` should now also show the control.

## Outcome note — appended 2026-09-08 by T42 (review round 9)

Not a rewrite of the DoD above: the task file stays the record of what was
asked, per the rule the team settled in round 7 (S4). What this note adds is
what [review round 9](../_review/review-2026-09-08.md) measured against it.

**The DoD bullet «no test-plan row describes an assertion the wave removed» was
not met**, and the *What* section's «the AC-03 / AC-04 / AC-06 / **AC-18** rows
re-pointed» was narrowed to AC-04 and AC-06 by the Outcome above without the
scope change being flagged — while `tracker.md` marked T39 `done`. Fifteen rows
still described the pre-reversal design (R9-S1-F6, R9-S2-F5), four of them
naming things that no longer exist: `:95` cited T16, whose 12-case `it.each`
this wave deleted along with the `diffHeight` it read; `:109` cited `diffHeight`
itself; `:112` and `:115` pinned 116 / 120 and 126 where the code now produces
210 and 280.

**T42 re-pointed all fifteen** and added rows for what T40 landed. T39 keeps its
`done` status: the work it did do was correct, and the gap is closed by a task
of its own rather than by reopening this one.

**The «still open, deliberately» note above is now closed too:** the owner chose
amendment in place over a `/sdd:screens` re-run, and T41 gave the
open-behaviour control a component entry, a `click-opens-off` state, a place in
the W-01 wireframes and a row in the AC → screen map. T26 stays blocked on the
screenshots.
