---
id: T55
title: "Round-13 records: T52's acs sweep, T51's undisclosed gap, and the test-plan rows for the fourth basis"
layer: "docs"
deps: ["T53", "T54"]
acs: ["AC-18", "AC-19"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/round12-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round12-records.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T55 — Round-13 records

## Why

**R13-S1-F3 — T52's closing observation reports two `acs` ↔ Task-column mismatches; the same check
finds twelve.** `round12-records.md:155-160` says: «The `acs` ↔ Task-column check I ran over all 52
tasks finds **two pre-existing mismatches outside this wave's scope**: `tasks.json` **T34** claims
`AC-18` and `AC-19` and **T44** claims `AC-03` and `AC-04`, with no row naming those tasks for those
ACs.» Re-run from `tasks.json` and `test-plan.md`'s Task column by stage 1 and independently by the
lead — the same 88 coverage rows, the same predicate (a task that **does** appear somewhere in the
Task column, which excludes the docs-task convention `test-plan.md:29` describes) — the answer is
**twelve**:

| task | ACs claimed with no row naming it |
|---|---|
| T2 | AC-16 |
| T6 | AC-06, AC-09 |
| T7 | AC-20 |
| **T8** | **AC-19** |
| T12 | AC-07, AC-17 |
| T13 | AC-06 |
| T21 | AC-17 |
| **T25** | AC-06, AC-13, AC-14, AC-15, AC-16, AC-17, **AC-18** |
| T29 | AC-16 |
| **T34** | **AC-18, AC-19** (one of the two T52 names) |
| T35 | AC-06 |
| **T44** | AC-03, AC-04 (the other) |

Widened to every non-docs task it is sixteen (adds T22, T23, T24, T38). T52's other half reproduces
exactly — T47 and T51 are clean, as its DoD bullet 1 claims. What does not reproduce is the
exhaustiveness, and two of the unflagged entries — **T25/AC-18** and **T8/AC-19** — are precisely the
criteria this wave existed to repair.

**R13-S2-F2's record half.** T51's Outcome (`round12-code-fixes.md`) restates owner decision 2's four
basis values in its What and records five mutations, none of which probes the fourth. Three further
mutations that hold (MUT-G, MY-M2b, MY-M2c) and one that does not (MY-N3, the fourth basis) are
absent from it. Probing that value would have exposed R13-S2-F2 to the wave itself.

**The test plan's AC-19 row.** `test-plan.md:93` lists three of the four values («`0 0 37.5%` blame
alone, then `0 0 30%` / `0 0 20%` stacked») — honest where T51's record is not, but it now needs to
name the fourth once T54 pins it, and to name T54.

## What

1. **`round12-records.md:155-160`** — replace the paragraph with the real set, under an explicit
   predicate. **Owner decision (2026-09-08, round 13, decision 3):** correct the record and leave the
   twelve as a recorded observation; they are pre-existing bookkeeping, not missing coverage, and
   deciding them belongs in one pass rather than inside a corrections wave. State the count under both
   readings (12 «appears in the Task column», 16 «every non-docs task»), name T25/AC-18 and T8/AC-19
   explicitly as the two that touch this feature's own criteria, and mark it as the next round's
   candidate scope. Keep the retired sentence quoted inside its dated round-13 marker, per the house
   convention.
2. **`round12-code-fixes.md`** — a dated round-13 marker on the What bullet that restates the four
   basis values, recording that the fourth (`'0 0 28.6%'`, file history alone) was **not** pinned by
   T51 and is pinned by T54; and an Outcome addendum listing the three further mutations that hold
   (MUT-G, MY-M2b, MY-M2c) and MY-N3, which did not. Do not rewrite the original claim — mark it.
3. **`test-plan.md:93`** (AC-19 coverage row) — name the fourth value and **T54**, so the row
   describes the suite that runs; and **`test-plan.md`'s AC-19 rows generally** — check that every
   task in `tasks.json` T54's `acs` resolves to a row naming T54, the check T52 introduced.
4. Re-run T52's own `acs` ↔ Task-column check over all **55** tasks after T53's registration, and
   record the count for T53, T54, T55 (they must be clean, or named with the docs-task predicate).

## Definition of Done

- [x] `round12-records.md`'s paragraph states the predicate and the real set; the twelve are listed;
      the retired «two» survives only inside a dated round-13 marker.
- [x] The count is produced **mechanically** from `tasks.json` + `test-plan.md`, not by inspection,
      and the script's predicate is written into the record so the next round can reproduce it
      without guessing.
- [x] `round12-code-fixes.md` carries the round-13 marker on the four-values bullet and the Outcome
      addendum; the original text is marked, not rewritten.
- [x] `test-plan.md:93` names `'0 0 28.6%'` and T54, and every AC in T54's `acs` resolves to a row
      naming T54.
- [x] `test-plan.md` is this task's file alone; `sad.md`, `ux-flows.md` and `screens.md` are T53's, so
      the two docs tasks share none.
- [x] No `src/` change: `git diff --stat HEAD -- src src-tauri` unchanged by this task.
- [x] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason —
      the practice T52 got right and this task inherits.

## Notes

`deps: [T53, T54]` is real: the counts and the row attributions must be the ones that ship, so this
task lands last — the round-9 / 10 / 11 / 12 pattern.

The twelve mismatches are **not** this task's to fix. It records them, with the predicate that makes
them reproducible, so the owner can scope them in one decision instead of twelve.

## Outcome (2026-09-08)

Landed. Three documents, no `src/` change.

**T52's observation now states its predicate and its real set.** The retired «two pre-existing
mismatches» survives only inside a dated round-13 marker, quoted. Below it the record spells out how
the number is produced — parse the `## AC coverage` table, take the AC ids from the first cell and the
`T<n>` ids from the **Task** cell, call an `acs` entry unattributed when no row carries both — and then
gives both readings, because the filter is where the original went wrong:

| predicate | count |
|---|---|
| **P1** the task appears in the Task column at least once (the reading that yields T34 and T44) | **12** — T2, T6, T7, T8, T12, T13, T21, T25, T29, T34, T35, T44 |
| **P2** every non-docs task | **16** — P1 plus T22, T23, T24, T38 |

Measured over all **55** tasks after T53's registration, by the same script twice and reproduced
against stage 1's and the lead's independent runs. **T25/AC-18 and T8/AC-19** are named explicitly as
the two the original «two» hid, and the owner decision to leave the twelve as a recorded observation
is written into the record with its reason.

**T51's undisclosed gap is marked, not rewritten.** The four-values bullet in
`round12-code-fixes.md` keeps its text and carries a round-13 marker saying three of the four landed
and which one did not, and an **Addendum** lists the four round-13 mutations the task's own table
omits: MUT-G, MY-M2b and MY-M2c hold; **MY-N3 does not** — `'0 0 28.6%'` mutated left 839 green. The
addendum ends with the transferable rule: when an owner decision enumerates N values, run N mutations,
not the ones the row happens to walk.

**The AC-19 coverage row names the fourth value and T54**, with its own marker. T54's `acs` now
resolves cleanly: `AC-03` → the invariant row, `AC-18` → the bottom-placement unit row, `AC-19` → the
fixed-basis component row, all three naming T54 — **0 unattributed entries for T54**, checked by the
same script. Before this task T54 was itself in the P2 set, which is exactly the drift R12-S2-F5
described.

**Files.** `test-plan.md`, `round12-records.md` and `round12-code-fixes.md` are this task's alone;
`sad.md`, `ux-flows.md` and `screens.md` are T53's. The two docs tasks of the wave share no file.

**DoD bullets that could not be satisfied as written: none.**
