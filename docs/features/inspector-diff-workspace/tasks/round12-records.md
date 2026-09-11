---
id: T52
title: "Round-12 records: AC-18's coverage rows, the acs drift, and the third grep bullet T48 left unnamed"
layer: "docs"
deps: ["T50", "T51"]
acs: ["AC-01", "AC-03", "AC-18", "AC-19"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/round11-criteria-amendment.md",
  "docs/features/inspector-diff-workspace/tasks/round11-records.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T52 — Round-12 records

## Why

From `_review/review-2026-09-08-round12.md`:

**R12-S1-F2, coverage half.** `test-plan.md:90` — AC-18's manual `e2e-through-UI` row — still states
the un-carved guarantee, so the same file gives a tester two contradictory expected results for one
measurement: at `:90` the bottom share must be ≥ the right share unconditionally, and at `:166` the
fourth prescribed run expects 0.691 / 0.727 against 0.750 *by the carve-out*. Neither AC-18 row
(`:89` component, `:90` e2e) names **T47** or the collapsed twin — the twin is filed under **AC-03**
at `:43` — so a reader tracing AC-18 to a test reaches a component row that does not measure the
share and a manual row whose expected outcome is the falsified claim, while the automated row that
pins the carve-out exists under another AC.

**R12-S2-F5.** `tasks.json` T47 `acs` claims `AC-18` and no AC-18 row attributes anything to T47.
Every other AC in T47's `acs` resolves to a row that names it. This is round-11 O7's pattern
recurring in the wave that closed O7 for T44.

**R12-S1-F4 ≡ R12-S2-F4.** T48's DoD bullet «`grep -n "two-fifths" spec.md` returns nothing in §7»
is unmet — `spec.md:255` quotes «baseline about 275 px (fixed two-fifths)» inside the dropped-KPI
marker. T48's Outcome has a paragraph naming *two* grep-shaped bullets it could not satisfy, with
sound reasoning (the house convention quotes a retired claim inside the marker that retires it); this
third bullet of the same kind is simply not named, so the DoD reads as satisfied when it is not.

Plus two bookkeeping observations: **O11** — `tasks.json` T49 `acs` omits `AC-01` while T49 edited
the AC-01 sweep row (`test-plan.md:35`); **O12** — `tracker.md:60` still cites
`inspector-layout.ts:77` / `:98` for the two guards, which sit at `:84` and `:75` / `:105` after T44.

## What

- **`test-plan.md:90`**: add T50's carve-out wording **verbatim** and a dated round-12 marker; the
  row's expected result must agree with `:166`'s fourth run rather than contradict it. Diff the two
  quoted sentences against each other and against `spec.md` AC-18 — this is the check round 11's
  equivalent bullet skipped.
- **AC-18's coverage rows** (`:89`, `:90`): name **T47** and, for the automated cover, point at the
  collapsed twin and the new bottom row T51 adds. State plainly which row measures the guard at the
  carve-out remainder and which measures the collapsed 75 % floor at the bottom placement — they are
  different rows and different claims (R12-S2-F2).
- **`test-plan.md:43`** (the AC-03 row) and **`:166`**: correct the description of the collapsed twin
  to what it actually pins, and name T51's new bottom row as the collapsed share's automated cover.
- **`tasks.json`**: T47 `acs` — either drop `AC-18` or keep it and make the AC-18 row attribute the
  twin to T47; decide it, do not leave it dangling. T49 `acs` gains `AC-01` (O11). T50–T52 `acs` and
  `files_hint` agree with their task files.
- **`round11-criteria-amendment.md`**: two corrections, both dated, both leaving the original claim
  quoted inside them. (a) The third grep-shaped bullet, named beside the two its Outcome already
  names. (b) **`:40`, T48's Why** — «at a 110 px remainder the collapsed share floor (82.5) leaves an
  allowance of 27.5» is the second live site of the arithmetic T51 corrects in the spec file
  (`grep -rn "27.5"` finds exactly these two): the two-row floor binds at that remainder, leaving
  **16** comfortable / **20** compact, and the suite's own MUT-E output says `expected 16 to be 34`.
  Correct rather than quietly rewrite — the two records T49 fixed this way are the precedent.
- **`round11-records.md`**: T49's DoD claimed «every row whose subject T47 changed names T47 in its
  Task column»; AC-18 was the gap. Add the dated correction.
- **`tracker.md:60`**: re-point the two guard line numbers (O12).
- `updated_at` moves to the day this lands in every artefact this task touches.

## Definition of Done

- [ ] `test-plan.md:90` and `:166` give the same expected result for the same measurement, and both
      quote T50's wording verbatim — verified by diffing the extracted sentences, not by reading them.
- [ ] Every AC in `tasks.json` T47 `acs` resolves to a `test-plan.md` row that names T47; likewise for
      T49, T50, T51 and T52. Check it mechanically over all 52 tasks, not by inspection.
- [ ] `files_hint` agrees between `tasks.json` and every task file for T1…T52 — **0 mismatches**,
      parsed from both records (the check T49 established; keep it).
- [ ] `round11-criteria-amendment.md` and `round11-records.md` each carry a dated round-12 correction
      of the claim the review falsified, with the original claim left quoted inside it — for T48 that
      is **two** corrections (the third grep bullet and the `:40` allowance).
- [ ] `grep -rn "27.5" src docs/features/inspector-diff-workspace/` returns no live claim that the
      collapsed share floor binds at a 110 px remainder — only quotations inside dated markers and
      the review records.
- [ ] `tracker.md` and `_epic.md` totals read 52 tasks and carry the round-12 provenance line.
- [ ] No `src/` change in this task.
- [ ] Every DoD bullet of this task that cannot be satisfied as written is **named** in the Outcome
      with the reason. This is the third wave in a row where an unnamed unmet bullet became the next
      round's finding.

## Outcome (2026-09-08)

Landed after T50 and T51, so the counts, the wording and the row attributions are the ones that are
now true. Docs only — the four production files are byte-identical to the review-time tree (md5) and
`git status --porcelain -- src-tauri` is empty; `pnpm lint` clean, 266 files.

**The two AC-18 expected results now agree, and both quote T50 verbatim.** The manual row at `:91`
gained the carve-out and a pointer to the fourth §NFR run; the §NFR bullet at `:167` was re-pointed
to T50's sentence. Verified by extracting every occurrence of the sentence by regex across
`spec.md`, `sad.md`, `ux-flows.md` and `test-plan.md`: **six sites, all 313 characters, all
byte-identical** — `spec.md:198`, `spec.md:231`, `sad.md:733`, `ux-flows.md:179`, `test-plan.md:91`,
`test-plan.md:167`. `grep "hard floor binds"` outside markers returns **0**.

**AC-18 has automated cover for the first time, and it is where the chain broke.** Its only rows were
a component row that does not measure the share and a manual row; the rows that pin its carve-out were
filed under AC-03. A new unit row — `AC-18 / AC-01 / AC-02 *(review round 12 R12-S1-F2)*`, Task
`T40, T47, T51`, using the table's own combined-AC convention — states both halves: the guard at the
reachable 220 / 110 remainder (0.6909 against 0.750, expanded and collapsed alike) and the collapsed
75 % floor at 400 / 200, where that floor actually binds. That row is also the attribution
`tasks.json` T47 `acs` was missing for `AC-18` (R12-S2-F5).

**Two rows corrected rather than re-pointed.** `:43` claimed the collapsed twin «pins the one
configuration where AC-18's cross-placement share yields» — it pins the *guard*; the share claim is
what R12-S2-F2 falsified, and the correction says so and names T51's 400 / 200 row for the floor.
`:92` gained T51's size half (the basis asserted by value in template order, and no min/max-height
floor) with the `min-h-0` exemption recorded and why.

**Mechanical checks, run rather than asserted.** `files_hint` agrees between `tasks.json` and every
task file for **T1…T52 — 0 mismatches**, no `tasks.json` id without a task file and no task file
without an entry. `tasks.json` parses, 52 tasks, DAG acyclic by DFS with no dangling dep. T49 `acs`
gained `AC-01` (O11). Every AC in the `acs` of the two **code** tasks resolves to a row naming that
task: T47 none unattributed, T51 none unattributed.

**Records corrected in place, originals left quoted.** `round11-criteria-amendment.md` carries two
dated round-12 corrections — its `:40` allowance arithmetic (the 2-row floor binds, leaving 16 / 20;
«27.5» is a number the policy never computes) and its «in all three criteria sites in those words»
claim (one of three). `round11-records.md` carries one, for the AC-18 coverage claim its DoD reported
met. `tracker.md`'s round-9 guard citation is re-pointed (O12) as history rather than rewritten.

**`updated_at` needed no bump:** every artefact this task touches already reads `2026-09-08`, because
rounds 9 through 12 all land on the same day.

### DoD bullets I could not satisfy as written, all of them

1. **«Every AC in the `acs` list of T47, T49, T50, T51 and T52 resolves to a test-plan row that names
   that task»** — **mis-scoped for the three docs tasks.** `test-plan.md:29` defines the Task column
   as «the task whose Definition of Done the row backs», and a docs task's DoD is not backed by a test
   row: T41, T42, T45, T46, T48 and T49 appear in no Task column either, which is the repo's
   convention, not an omission. The bullet holds for the code tasks (T47, T51: none unattributed) and
   should have said so. I briefly put `T52` into the AC-18 manual row's Task column and then took it
   back out for exactly this reason.
2. **«No live claim survives that the collapsed share floor binds at a 110 px remainder»** — as a
   grep, **unmet**: `grep -rn "27.5"` still returns `round11-criteria-amendment.md:40` and
   `inspector-layout.spec.ts:365`. Both are the house convention working as intended — the first is
   the retired sentence with its dated correction immediately below it, the second is T51's new
   comment *quoting* the retired claim to say the policy never computes that number. The claim is
   retired; the string is not gone, and it should not be. Third wave running that a grep-shaped bullet
   could not be met literally; this time it is named.

### Observation for the next round — pre-existing, deliberately not fixed here

<!-- corrected 2026-09-08 (T55, review round 13 R13-S1-F3): the paragraph below read «the `acs` ↔
Task-column check I ran over all 52 tasks finds **two pre-existing mismatches outside this wave's
scope**: `tasks.json` **T34** claims `AC-18` and `AC-19` and **T44** claims `AC-03` and `AC-04`, with
no row naming those tasks for those ACs.» The half about T47 and T51 being clean reproduces exactly;
the exhaustiveness does not. Re-run independently by stage 1 and by the lead over the same 88 coverage
rows: the answer is twelve, not two — and two of the ten it did not name are this feature's own AC-18
and AC-19. The count is restated below under an explicit predicate, which is what the original
paragraph lacked. -->

**The predicate**, so the next round reproduces the number instead of guessing it: parse every row of
the `## AC coverage` table, take the AC ids from its first cell and the `T<n>` ids from its **Task**
cell; a task's `acs` entry is *unattributed* when no row carries both that AC and that task. Then
filter — a docs task that writes no test never appears in a Task column at all (the column «points at
the `tasks.json` task whose Definition of Done the row backs», `test-plan.md:29`), so counting those
as mismatches counts the convention rather than a defect.

Under **P1, «the task appears in the Task column at least once»** — the reading that produces the T34
and T44 the original paragraph named — the set is **twelve** tasks, measured over all 55 after this
wave's registration:

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
| **T34** | **AC-18, AC-19** (one of the two originally named) |
| T35 | AC-06 |
| **T44** | AC-03, AC-04 (the other) |

Under **P2, «every non-docs task»**, it is **sixteen** — P1 plus T22, T23, T24 and T38, which write
tests but are named by no row at all. T47, T51 and, after T55's re-pointing, T54 are clean under both.

**Owner decision (2026-09-08, round 13, decision 3): correct the record, leave the twelve as a
recorded observation.** They are pre-existing bookkeeping, not missing coverage — every AC involved
has rows; what is missing is the attribution of *that task* on *that AC*. They belong in one decision
rather than inside a corrections wave. **T25/AC-18 and T8/AC-19 are the two to look at first:** they
are this feature's own criteria, and they are exactly the entries the round-12 paragraph's «two» hid.

## Notes

`deps: [T50, T51]` is real: the quoted carve-out must be T50's final wording, and the rows describing
the collapsed twin and the new bottom row cannot be truthful before T51 lands.

`test-plan.md` is this task's file alone; `ux-flows.md` is T50's. The two docs tasks share no file,
so they cannot contend if the lanes ever run in parallel.

The commit must carry `SDD-Task: T52` and its `SDD-AC` trailers (R9-S1-F9).
