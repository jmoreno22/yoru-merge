---
id: T62
title: "Round-15 records: T57's false grep bullet, T56's moved address, and the enumeration that says three"
layer: "docs"
deps: ["T60", "T61"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/round14-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round14-criteria-amendment.md",
  "docs/features/inspector-diff-workspace/tasks/round14-records.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T62 — Round-15 records

## Why

**R15-S1-F5**, **R15-S2-F2** and the record half of **R15-S1-F4**
(`_review/review-2026-09-09.md`). Three record defects, all inside the round-14 wave, and the wave's
own third task existed to close the fifth consecutive instance of this class.

**R15-S1-F5 — a ticked bullet its own command contradicts.** `round14-code-fixes.md:99-101`, bullet 2:
«`grep -c "fileCount === 0" src/app/core/services/inspector-layout.ts` **goes 2 → 1**». It returns
**2** — `:74`, inside the explanatory comment T57 wrote in the same wave, and `:79`, the
`protectedList` arm. The count went 2 → 2, with the second occurrence moving from code to prose. The
Outcome at `:218-219` then closes «DoD bullets that could not be satisfied as written: **none**»,
while its own prose at `:149-150` is hedged («survives **once in code**») — so the true count was known
when «none» was written.

**R15-S2-F2 — an address the edit itself moved.** `round14-criteria-amendment.md` cited
`_epic.md:206` in DoD bullet 2 (`:85`), DoD bullet 4 (`:98`), the Outcome (`:133`) and «thirty lines
below at `:206`» (`:152`); and the **live marker at the epic's goal line** sent the reader there too.
The invariant was not at `:206`: T56's own registration rows had already pushed the invariants list
down nine lines. <!-- the figures this paragraph gave for where the invariant WAS have been removed
2026-09-10 (T66, review round 16 R16-S1-F4): it gave an address, that address was moved by the next
wave's registration rows, the correction gave a new one, and that was moved too. Three consecutive
waves moved this one line, so recording the address at all was the defect rather than recording
the wrong one. Grep for the pointer's text instead -->

**R15-S1-F4 (record half) — an enumeration that says three.** `round14-records.md:130-139` and the live
marker at `test-plan.md:113` state that R14-S2-F2's class had «**three** carriers». With
`DESIGN.md:345` it had four. T59 fixed the artefact; the enumeration that would hide the next one is
here.

## What

- Re-word T57's bullet 2 to what the command actually produces, preserve the original inside a dated
  round-15 marker, and name it in that task's Outcome — the convention T53 wrote down, T54 broke,
  T58 restored for T54 and T57 then broke again.
- Correct the four `:206` citations and the goal-line marker. **Cite the invariant by its bold
  anchor** (`**List floor**`), **never** by a line number, **including inside an explanatory
  parenthesis** — a line number is what made this a finding twice, and a parenthesised one is what
  made it a finding a third time (review round 16, R16-S1-F4).
- Correct «three carriers» to four in `round14-records.md` and in the `test-plan.md:113` marker, and
  record the transferable rule: an enumeration of a defect class is a floor, and it must name the scope
  it swept, or the next carrier hides behind the count.
- Wire the coverage attributions this wave earns: every AC in `tasks.json` T60's and T61's `acs`
  resolves to a `test-plan.md` coverage row naming that task.

## Definition of Done

- [x] `round14-code-fixes.md` bullet 2 states what `grep -c` returns and why that is correct behaviour;
      the original wording survives inside a dated round-15 marker; the Outcome's «none» becomes the
      real count with the reason. Run the bullet's own command and paste its output into the Outcome.
- [x] Every `:206` citation is corrected or replaced by the anchor, and the goal-line marker no longer
      sends a reader to a blank line. Verify by **grepping for the pointer's text**, never by printing
      a line number: the address moves under the next registration row, so a reported line number is
      stale before the wave closes (amended 2026-09-10 by T66, review round 16 R16-S1-F4 — the
      original bullet asked for `sed -n '206p'` and its reported output was already false when this
      wave was reviewed).
- [x] «three carriers» reads four in both places, each with a dated round-15 marker naming
      `DESIGN.md:345` and the scope that found it.
- [x] **The `acs` ↔ Task-column check is re-run mechanically over all 62 tasks** with T55's predicate;
      T60 and T61 have **0 unattributed** entries; T59 and T62 are docs tasks and are reported as
      *excluded by the convention of `test-plan.md:29`*, not as «clean»; any movement in the
      pre-existing P1 = 12 / P2 = 16 sets is stated.
- [x] No `src/` change: `git diff --stat 805a32d -- src` is what T60 and T61 left, unchanged by this
      task.
- [x] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason —
      the practice this task exists to restore, for the second wave running.

## Notes

`deps: [T60, T61]` is real: the coverage attributions must describe the code and the rows that ship, so
this lands last — the round-9…14 pattern.

The twelve pre-existing `acs` ↔ Task-column mismatches (round-13 R13-S1-F3) and the T44 / T49 `acs`
json ↔ file divergence (round-14 T58's observation, round-15 O10) are **not** this task's to fix. They
stay recorded for the single later decision round-13 O15 and round-14 O12 reserved.

## Outcome (2026-09-09)

Landed. Records and the coverage table only; no `src/` change (`git diff --stat 805a32d -- src` is
what T60 and T61 left).

**T57's bullet 2 now says what its command returns, and its Outcome names it.** The bullet reads
«the condition goes from **two occurrences in code to one**, the `protectedList` arm; `grep -c` still
returns **2** because `:74` is the round-14 comment quoting the retired condition», with the original
wording preserved in a dated round-15 marker beside it. The Outcome's «none» became
«one, named 2026-09-09 by T62», with the command's real output pasted in:

```
$ grep -c "fileCount === 0" src/app/core/services/inspector-layout.ts
2
$ grep -n "fileCount === 0" src/app/core/services/inspector-layout.ts
74:  // repeat `fileCount === 0` vacuously, which made the two arms look
79:    fileListCollapsed || fileCount === 0
```

The transferable rule, written into the record: **a bullet whose subject is a count states what the
command returns, never what the change did to the code.** Third time this class has been fixed;
first time the rule is written down as a rule.

**The moved address is gone, and cited by anchor so it cannot move again.** The four post-edit
citations in `round14-criteria-amendment.md` (DoD bullets 2 and 4, the Outcome's byte-identity list,
and the «thirty lines below» sentence) now name **`_epic.md`'s `**List floor**` invariant** instead
of `:206`, and the live marker at the epic's goal line does the same, with the reason recorded: that
marker pointed a reader at a line the registration rows the same wave inserted had already moved the
invariant off. Verified by **grepping for the pointer's text**, which is the only check that does not
go stale.

<!-- corrected 2026-09-10 (T66, review round 16 R16-S1-F4). This paragraph read «Verified both ways -
`sed -n '206p'` prints an empty line, and the 47-character pointer greps to `:215`». Measured on the
tree this wave delivered, BOTH halves were false: `sed -n '206p'` printed the T51 registration row,
and the pointer was at `:227`, because T59's own T59-T62 registration rows moved the invariants list
another twelve lines after T62 took its measurement. The Outcome then read «DoD bullets that could
not be satisfied as written: none». Seventh consecutive round of this class and the third occurrence
on this one line, in the task written to close it. The transferable rule, which is narrower and
harder than «cite by anchor»: a task that registers tasks moves every line below its insertion
point, so no record it touches may address anything below that point by number - parentheses and
verification commands included. -->

**Four citations corrected, four left alone deliberately.** `round14-criteria-amendment.md` cites
`:206` at eight places. Four describe the state **before** the edit - the «what it says today»
table, the plan step, and two notes about how the file was edited - and a pre-edit address is correct
in a pre-edit sentence. The four that assert the **delivered** state are the ones corrected. Said here
rather than left for a reviewer to work out why half the occurrences survive.

**The enumeration reads four.** `round14-records.md` now says R14-S2-F2's class had **four** carriers,
three known when it was written and the fourth found by round 15, and the live marker at
`test-plan.md:113` carries the same correction naming `DESIGN.md:345` and the scope that found it. The
rule with it: **an enumeration of a defect class is a floor, never a total, and it must name the scope
it swept** - T58 found the third by widening the sweep from the finding's list, and T59 found the
fourth by widening it from the nine-file list to every tracked file the branch touches.

**The `acs` <-> Task-column check, re-run mechanically over all 62 tasks** with T55's predicate (parse
the 88-row `## AC coverage` table, take AC ids from the first cell and `T<n>` from the **Task** cell,
call an entry unattributed when no row carries both):

| task | result |
|---|---|
| **T60** | **0 unattributed**, appears in the Task column - rows `:43` (AC-03) and `:120` (AC-04 / AC-05) |
| **T61** | **0 unattributed**, appears in the Task column - rows `:35` (AC-01), `:43` (AC-03), `:90` (AC-18), `:93` (AC-19), `:95` (AC-20), `:99` (AC-02) |
| **T59**, **T62** | **excluded by the docs-task convention** of `test-plan.md:29` - both appear in no coverage row at all. Stated as *excluded*, not as «clean»: the two are not the same thing, which is the distinction T58 drew for T56 |

**Unmoved by this wave:** **P1 = 12** (T2, T6, T7, T8, T12, T13, T21, T25, T29, T34, T35, T44) and
**P2 = 16** (P1 plus T22, T23, T24, T38) - the same twelve and sixteen rounds 13, 14 and 15 measured,
so T59-T62 added no drift. The T44 / T49 `acs` json <-> task-file divergence (round-14 T58's
observation, round-15 **O10**) also stands untouched, as its own note says it should.

**Registration integrity, re-verified after every edit:** `tasks.json` parses, **62 tasks**, 0
duplicate ids, 0 dangling deps, DFS finds no cycle, 62 task files, no id without a file, no file
without an entry, **0 `files_hint` mismatches over all 62**, and `git diff --numstat` on it is
**419 / 0** - a textual insertion that left the 58 pre-existing entries byte for byte.

**One thing this task did that its own DoD did not ask for, disclosed.** The registration script was
run a second time by mistake and appended T59-T62 twice, taking `tasks.json` to 66 entries with four
duplicate ids. Caught by the validator in the same minute, deduped textually so the pre-existing
entries kept their formatting, and re-verified to the numbers above. The validator is now separate
from the writer and is read-only by default - a registration script that is not idempotent is a
hazard, and the fix is to never let the same file both write and check.

**DoD bullets that could not be satisfied as written: one, named 2026-09-10 by T66 (review round
16, R16-S1-F4).** Bullet 2 asked to «verify by running `sed -n '206p'` **and** by grepping for the
pointer, and report both», and the two values this Outcome reported were both false against the
tree the wave delivered: `sed -n '206p'` printed the T51 registration row rather than an empty
line, and the pointer was at `:227` rather than `:215`, because T59's registration rows moved the
invariants list twelve lines after this task measured. The substance was right - the citations
were correctly moved to the bold anchor - and only the reporting was wrong, which is the class
this task existed to close. The bullet is now phrased so it cannot go stale.

The other two that could have tripped - the
`grep` on T57's bullet and the address citations - are written against what the commands return and
against artefact anchors rather than line numbers, for exactly the reasons R14-S2-F1 and R15-S2-F2
exist.
