---
id: T58
title: "Round-14 records: T54's unnamed DoD bullet, T53's marker adjacency, and T57's coverage attribution"
layer: "docs"
deps: ["T56", "T57"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/round13-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round13-criteria-amendment.md",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T58 — Round-14 records

## Why

**R14-S2-F1 — a ticked DoD bullet whose own grep does not return nothing, with the Outcome naming the
*other* unsatisfiable bullet.** `round13-code-fixes.md:80-81`, DoD bullet 1, marked `[x]`:

> `grep -n "838 tests green" src/app/core/services/inspector-layout.spec.ts` returns nothing; the
> clause names the twin and quotes both measured counts.

It returns:

```
389:      // said «all 838 tests green», which no round has ever measured — review
```

which is **correct behaviour** — the retired clause is quoted inside the marker that retires it, the
house convention T52 and T53 both got right, and the one T53's own last DoD bullet states explicitly:
«any DoD bullet written as a grep that cannot be satisfied because the retired wording survives inside
its own marker is **named in the Outcome**, with the reason». The substance at `:385-389` is right and
the review re-measured it at 4 / 835. The defect is the reporting: T54's Outcome
(`round13-code-fixes.md:158-164`) names exactly one bullet it could not satisfy — the
`git diff --name-only HEAD -- src` one — so the DoD reads as fully met.

An owner or a later reviewer auditing T54 runs the bullet's own command, gets a hit on `:389`, and
cannot tell from the task file whether the correction landed, was reverted, or was never applied. That
is the exact ambiguity R12-S1-F4 was raised to remove, and it is the **fifth consecutive round** of
this class — with T53, the sibling task in the same wave, carrying the bullet that guards against it.

**Round-14 O2 — T53's marker bullet, the same family one order of magnitude weaker.** T53's DoD
bullet 3 asks that «each of the **five** sites has a dated round-13 marker citing R13-S1-F1». It is
literally met at three (`sad.md:380`, `ux-flows.md:219`, `screens.md:343`). The two mermaid labels —
`sad.md:368`, a `sequenceDiagram` message, and `ux-flows.md:170`, flowchart node C — carry no marker of
their own because a markdown comment cannot live inside a mermaid block; each is named explicitly
inside the adjacent prose marker («neither the F2 message label nor this paragraph», «this map row and
node C of the diagram above»). Substantively met, structurally impossible to meet literally — and
T53's «DoD bullets that could not be satisfied as written: none» glosses that rather than naming it.

**T57's coverage attribution.** T57 claims `AC-03`, `AC-04` and `AC-05`. Every AC in a task's `acs`
must resolve to a `test-plan.md` coverage row naming that task — the check T52 introduced and T55
formalised with its predicate. T57 is a new task and none of the three rows names it yet.

## What

1. **`round13-code-fixes.md`** — add one sentence to the Outcome's «DoD bullets that could not be
   satisfied as written» paragraph naming **bullet 1** and the reason (the retired clause survives
   inside the marker that retires it, per the house convention), and re-word the bullet itself as
   «returns **only** the quoted retired clause inside its round-13 marker». Keep the original bullet
   text visible inside a dated round-14 marker citing R14-S2-F1 — mark it, do not silently rewrite it.
2. **`round13-criteria-amendment.md`** — a dated round-14 marker on DoD bullet 3 and on the Outcome's
   «DoD bullets that could not be satisfied as written: none», recording that two of the five sites
   are mermaid labels that cannot hold a marker and are covered by the adjacent prose marker instead
   (round-14 **O2**). The bullet was substantively met; what is corrected is the claim that nothing
   needed naming.
3. **`test-plan.md`** — name **T57** in the coverage rows for `AC-03`, `AC-04` and `AC-05`, each with
   its own dated marker saying what T57 changed there (the corrected `floor(` in the AC-03 component
   comment; the deleted vacuous arm and the re-proved C5 cover for AC-04 / AC-05). Where a row's prose
   describes the `fileCount === 0` rule, make it say which of the two arms carries it, so the row and
   the code agree after T57.
4. **Re-run T55's `acs` ↔ Task-column check over all 58 tasks** after T56's registration and record
   the result for T56, T57 and T58 under both predicates (P1: the task appears in the Task column at
   least once; P2: every non-docs task). They must be clean, or named with the docs-task predicate of
   `test-plan.md:29`. Record whether the pre-existing P1 = 12 / P2 = 16 sets moved.

## Definition of Done

- [x] `round13-code-fixes.md`'s Outcome names bullet 1 with its reason; the bullet is re-worded; the
      original wording survives inside a dated round-14 marker citing R14-S2-F1.
- [x] `round13-criteria-amendment.md` carries the round-14 marker on DoD bullet 3 and on its «none»
      claim, naming both mermaid sites and their covering markers.
- [x] Every AC in `tasks.json` T57's `acs` resolves to a `test-plan.md` coverage row naming **T57** —
      **0 unattributed entries for T57**, checked by the same script T55 wrote, not by inspection.
- [x] The `acs` ↔ Task-column count is produced **mechanically** over all **58** tasks; the predicate
      is written into the record; T56 / T57 / T58 are reported clean or named; any movement in the
      pre-existing 12 / 16 sets is stated.
- [x] `test-plan.md`, `round13-code-fixes.md` and `round13-criteria-amendment.md` are this task's
      alone; `sad.md`, `_epic.md`, `tracker.md` and `tasks.json` are T56's and the two `src/` files are
      T57's, so no two tasks in this wave share a file.
- [x] No `src/` change: `git diff --stat 805a32d -- src` unchanged by this task relative to what T57
      left.
- [x] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason —
      the practice this whole task exists to restore.

## Notes

`deps: [T56, T57]` is real: the coverage attributions must describe the code that ships and the
registration T56 writes, so this task lands last — the round-9 / 10 / 11 / 12 / 13 pattern.

The twelve pre-existing `acs` ↔ Task-column mismatches (round-13 R13-S1-F3, round-14 **O12**) are
**not** this task's to fix. They stay a recorded observation with their predicate, for a single later
decision.

## Outcome (2026-09-09)

Landed. Three documents plus one line of `tasks.json` — see the shared-file note below. No `src/`
change: `git diff --stat 805a32d -- src` is what T57 left, unchanged by this task.

**T54's bullet 1 is named and re-worded.** `round13-code-fixes.md`'s Outcome paragraph is now
«DoD bullets that could not be satisfied as written — **two**», and the new half states what bullet 1
actually returns (`:389`, the line that quotes the retired clause in order to retire it), why that is
correct behaviour rather than a failure, and why the omission blocked: an auditor running the bullet's
own command gets a hit and cannot tell whether the correction landed. The bullet itself now reads
«returns **only the quoted retired clause inside its round-13 marker**», with the original wording
preserved in a dated round-14 marker beside it — marked, not rewritten. The transferable rule is
written into the record: when a correction quotes the wording it retires, the bullet says «returns only
the quoted clause inside its marker», never «returns nothing».

**T53's marker bullet is qualified (O2).** Bullet 3 now reads «three literally, two by adjacency», with
a marker naming `sad.md:368` and `ux-flows.md:170` as mermaid labels that cannot hold a markdown
comment and pointing at the prose markers that name them. Its «none» claim keeps its original text and
gains the qualification. Substantively T53 met the bullet; what is corrected is a report of «met» over
a structural impossibility.

**A further carrier of the retired `round` was found while wiring T57's attribution, and fixed.**
<!-- «third» dropped from this heading 2026-09-10 (T66, review round 16 R16-S1-F7): it was the
third KNOWN when this was written, and the body below now gives the full count with the scope and
date it was swept. An ordinal in a heading is a count, and a count in a record goes stale -->
`test-plan.md:113` described the policy's `headerMaxH` as «tabled, floored at `panelHeadH` and
**rounded**». The policy has used `Math.floor` since T44 (round 10, R10-S2-F2). So R14-S2-F2's class had
**four** carriers, fixed in four different waves — `main-content.spec.ts:388` (round 14, T57), **this row** (round 14, T58), `DESIGN.md`'s cap-variable line (round 15, R15-S1-F4, T59) and `inspector-layout.spec.ts`'s test title, which read «rounds the cap to whole pixels» (round 16, R16-S1-F7, T64). `inspector-layout.ts`'s own FLOOR comment and
`Math.floor(Math.max(headerAllowance, panelHeadH))` beside it are **not** a carrier: that site was always right and explains the choice. **Scope swept for this count:** `grep -rn "rounds the cap|rounded to whole pixels|cap rounds"` over `src/`, `DESIGN.md`, `ARCHITECTURE.md` and every artefact under `docs/features/inspector-diff-workspace/`, on 2026-09-10 — one hit, the test-plan marker's own quotation of the retired wording.
<!-- enumeration corrected and re-scoped 2026-09-10 (T66, review round 16 R16-S1-F7). It said «four carriers» and then listed three items, one of which it described in the same breath as «always right» — i.e. not a carrier — while omitting `DESIGN.md`, the actual fourth that the same sentence credits round 15 with finding. It also gave `inspector-layout.ts:80-83`, two lines off: the FLOOR comment is `:85-89` and the operation `:90`. And neither this passage nor the live marker named the scope it swept, which is the rule this very record wrote. An enumeration of a defect class is a floor, never a total, and it must name the scope AND the date it swept -->
Corrected to
«floored to whole pixels» with a dated marker and the reason flooring is the right direction — it can
only give the list more, where rounding cost it a pixel at 434 of the heights between 40 and 1000 px
expanded. **This is the round-13 lesson repeating with a different word:** T53 found a fifth carrier of
the *share* claim by sweeping rather than taking the finding's list; T58 found a third carrier of the
*round* claim the same way. The finding's list is a starting point, never the enumeration.

**T57's attributions.** `tasks.json` T57 claims AC-03, AC-04 and AC-05, and all three now resolve:

| AC | row | what the row now says |
|---|---|---|
| AC-03 | `test-plan.md:122` (component) | T57 named; the marker records that the row's comment called the cap `round(560 − max(…))` while the policy floors, that 280 is an integer so the assertion was right, and that only the operation name was false |
| AC-04 / AC-05 | `test-plan.md:120` (unit) | T57 and T58 named, and the prose now says the empty case is decided in **one** place — the `protectedList` arm, whose removal reddens 3 rows across two tiers with the messages quoted — while the `listRows` copy T57 deleted was **vacuous** (`Math.min(0, ≥ 2) = 0`, 720 360 swept configurations, 0 differing outputs) and no test written against it could ever have failed |

**The `acs` ↔ Task-column check, re-run mechanically over all 58 tasks** with T55's predicate (parse
the `## AC coverage` table, take AC ids from the first cell and `T<n>` ids from the **Task** cell, call
an `acs` entry unattributed when no row carries both):

| predicate | count | set |
|---|---|---|
| **P1** the task appears in the Task column at least once | **12** | T2, T6, T7, T8, T12, T13, T21, T25, T29, T34, T35, T44 |
| **P2** every non-docs task | **16** | P1 plus T22, T23, T24, T38 |

**Unmoved by this wave** — same twelve and same sixteen as round 13 measured, so T56–T58 added no drift.
**T57 clean** (0 unattributed, and it does appear in the Task column). **T58 clean.** **T56** appears in
no coverage row at all, so both predicates exclude it — the docs-task convention of `test-plan.md:29`,
exactly as T53 was excluded in round 13. Stated rather than reported as «clean», because «excluded by
predicate» and «attributed» are not the same thing.

**T58's `acs` was corrected from what the review record declared.** The task file and `tasks.json`
first said `["AC-03", "AC-04", "AC-18"]`; AC-18 came from the marker-adjacency work, which is a
correction to a *task record* about AC-18's carve-out and not a coverage row this task writes. Left
declared, it would have demanded an AC-18 row naming T58 — attribution theatre, a row edited only to
satisfy a check. Changed to `["AC-03", "AC-04", "AC-05"]`, the ACs whose coverage rows this task
actually rewrites. Recorded here rather than silently adjusted, since the round-14 review record names
the old triple.

**DoD bullet that could not be satisfied as written, named as the bullet requires:** «`test-plan.md`,
`round13-code-fixes.md` and `round13-criteria-amendment.md` are this task's alone … so no two tasks in
this wave share a file». **Not met: this task also edited `tasks.json`, which is T56's file**, for the
one-line `acs` correction above. The alternative was to attribute that edit to T56, which registered
the entry — but T56 wrote what the review record asked for, and the correction is a T58 finding, so
crediting T56 would have made the record less true than the shared-file exception. One line, one key,
in the entry for this task itself, on a file no concurrent task was touching (the wave is sequential).

**Recorded observation, found by a check nobody had run before and deliberately NOT fixed here.** Every
round since 10 has verified that `files_hint` agrees between `tasks.json` and each task file. Extending
the same comparison to **`acs`** — one line of the same script — finds **two pre-existing divergences**
over all 58 tasks:

| task | task file | `tasks.json` |
|---|---|---|
| **T44** (`round10-code-fixes.md`) | AC-01, AC-03, AC-04, AC-05, AC-19 | AC-01, **AC-02**, AC-03, AC-04, AC-05, AC-19 |
| **T49** (`round11-records.md`) | AC-02, AC-03, AC-04, AC-18, AC-19 | **AC-01**, AC-02, AC-03, AC-04, AC-18, AC-19 |

In both cases the JSON claims one AC the task file does not. T49's is traceable: round 12's T52 added
`AC-01` to T49's `acs` in `tasks.json` (round-13 record, O-list «T49's `acs` gained AC-01») and did not
mirror it into the task file. T44's has the same shape. Both are **bookkeeping**, not coverage: every AC
involved has coverage rows, and the `acs` ↔ Task-column check above is computed from the JSON, which is
what `implement` consumes.

Not fixed here for two reasons. It is outside this wave's scope — the same reason round 13 left the
twelve P1 mismatches as an observation — and **which side is authoritative is an owner call**: the task
file is what a human reads and the JSON is what the engine reads, so «sync them» is not a decision a
corrections wave should take on two tasks it did not write. It belongs with the twelve, in the single
pass round-13 O15 and round-14 O12 already reserved. What this task contributes is the check itself:
**compare `acs` as well as `files_hint`**, and the divergence stops being invisible.
