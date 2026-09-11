---
id: T46
title: "Round-10 test-plan re-point: the thesis, the NFR validation section and the overstated sweep rows"
layer: "docs"
deps: ["T44", "T45"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T46 — Round-10 test-plan re-point

## Why

T42 re-pointed the fifteen stale rows of the **AC coverage** table and stopped at the table. The
sections around it were never opened, and they are the ones the release checklist is actually run
from — [review round 10, R10-S1-F3, F4, F5, F10 and R10-S2-F3](../_review/review-2026-09-08-round10.md).
Round 9's owner decision 4 is the reason this cannot wait: `test-plan.md` is the AC → test map
every future round reads as its baseline.

## What

- **The thesis (R10-S1-F4)** — `test-plan.md:14`, the first sentence a reader meets: «The inspector
  must hand **the diff viewer** its height (**header and file list yield first**, floors at two
  rows and one clamp line)». Both halves are what the 2026-09-07 reversal inverted: the protected
  block is the commit file list (`spec.md:107` AC-03, `inspector-layout.ts:38-52`) and the header
  yields first.
- **§NFR validation (R10-S1-F3)** — `:153`, `:154` and `:155` are the release checklist's copy of
  `spec.md` §6 NFR rows 1–3 and re-introduce both measurements round 9 removed: «Diff viewer share
  … assert **element-height share** ≥ 50 %», «… ≥ 75 %», and «Diff height at the bottom or with
  stacked panels → 3 runs **side by side with the 1.0.5 build** … assert **height ≥ the 1.0.5
  value**». Re-point all three to the §6 measurement as restated, and to amended AC-18's
  «≥ the share it has with the inspector on the right».
- **The edge case (R10-S1-F5)** — `:133` «Available height below the floors … the policy holds
  rows = 2 and clamp = 1, never negative, **and the diff takes the remainder** (SAD §11 risk row)».
  The configuration is real and is now the row T40 landed
  (`inspector-layout.spec.ts:325-350`, the 220 px bottom minimum with both panels stacked), but the
  expectation names an output the policy no longer has; `sad.md:753` is about the stacked-panel
  remainder, not a diff. Re-point the row and name the test that now covers it.
- **The overstated sweep rows (R10-S1-F10, R10-S2-F3)** — `:35` (AC-01), `:95` (AC-02) and `:118`
  (AC-02, review 2026-09-03 F-2) all promise «swept over 144 configurations». **Run this after
  T44**: T44 restores the loop to a full assertion per configuration and adds a seventh height, so
  the honest number changes again. State the count T44 leaves, say what the `fileCount === 0`
  configurations assert (the bare head, not the share), and add **T44** to the Task column of the
  rows whose subject it changed.
- **The remaining observations** — `:106`'s Expected column claims the AC-03 component row shows
  «the commit inspector block is the growing child **and keeps ≥ 50 % of the column**» while
  `main-content.spec.ts:317-338` asserts the growing child and the written cap, not a share (O-5,
  same class as round 9's O2); `:120`'s AC-22 sentence belongs in T42's `acs` and was not
  (O-11); `updated_at` is still `2026-09-03` after T42 rewrote fifteen rows (O-2).
- **AC-19's cover (R10-S1-F8)** — `:89` is a unit row that subtracts a stacked height the caller
  supplies; it never checks the caller's panels are fixed. Point AC-19 at the row T44 adds.

## Definition of Done

- [ ] `grep -rniE "diff viewer share|element-height|1\.0\.5 build|the diff takes the remainder" test-plan.md`
      returns nothing outside a dated historical marker.
- [ ] Every AC-01…AC-22 row names a test that exists at HEAD **and** asserts what the row says;
      spot-checked by opening each named `file:line`, not by grepping the AC id.
- [ ] Every row whose subject T44 changed names T44 in its Task column.
- [ ] The sweep rows state the configuration count T44 leaves and what the empty-list
      configurations assert.
- [ ] No `src/` change in this task.

## Outcome (2026-09-08)

Landed after T44, so the sweep rows could state the number that is now true. Docs only; `pnpm lint`
clean.

**The thesis** (`:14`) names the commit file list as the protected block and the body clamp, then the
header cap, as what yields. **§NFR validation**'s three bullets are re-pointed at the §6 quotient and
at amended AC-18's «≥ the share», with the empty-list carve-out named — they were the release
checklist's copy of the two measurements T41 had already removed from the spec. **The edge case**
(`:133`) now describes the configuration T40 actually pinned (the 220 px bottom minimum with both
panels stacked) and names the row that pins it, instead of a diff taking a remainder.

**The sweep rows** say **168 configurations**, not 144, and say what the empty-list configurations
assert (the bare head) rather than implying they assert the share; both name **T44** in their Task
column, and the AC-01 row records why `421` is in the table.

**AC-19 gained an automated row** — the fixed-basis row T44 landed — and its existing unit row now
says out loud that it takes the stacked height from its caller and does not check the caller. That
pair is the whole of R10-S1-F8's paper trail.

**O8** the AC-03 component row's Expected column no longer claims a share it does not assert; **O15**
T42 carries `AC-22`; **O5** `updated_at` moved to 2026-09-08.

**Limit of the DoD's «open each named file».** The coverage table names tests by intent, not by path
(one `.spec.ts` path appears in the whole file, and it resolves), so «the named test exists» cannot be
checked mechanically here. The rows this wave changed were checked against the suite's own titles;
the remaining rows rest on round 10 stage 1's mechanical trace, which walked all 22 ACs to a test and
found only the rows fixed above wrong. Recorded rather than claimed.

## Notes

`deps: [T44, T45]` is real, not decorative: the sweep rows cannot be written truthfully before T44
lands, and the NFR rows quote the §6 wording T45 finalises.

The commit must carry `SDD-Task: T46` and its `SDD-AC` trailers (R9-S1-F9).
