---
id: T66
title: "Round-16 records: the address cited by anchor everywhere, the un-nested marker, and an enumeration that names its own scope"
layer: "docs"
deps: ["T64", "T65"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/round14-criteria-amendment.md",
  "docs/features/inspector-diff-workspace/tasks/round14-records.md",
  "docs/features/inspector-diff-workspace/tasks/round15-records.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T66 — Round-16 records

## Why

**R16-S1-F4**, **R16-S1-F6**, the record half of **R16-S1-F7**, and observations **O3**, **O4**
(`_review/review-2026-09-10.md`).

**Seventh consecutive round of the same class, third occurrence on one line.** T62's Outcome
(`round15-records.md:115-116`) reads «Verified both ways — `sed -n '206p'` prints an **empty line**,
and the 47-character pointer greps to **`:215`**». Measured on the delivered tree: `sed -n '206p'`
prints the **T51 registration row**, and the pointer is at **`:227`** — T59's own T59–T62 registration
rows pushed the invariants list down another twelve lines, exactly as T56's had pushed it nine. The
stale address also survives inside `round14-criteria-amendment.md:133`, one of the four citations T62
*corrected*, whose parenthesis still reads «`:215` after this wave's own registration rows moved it
down nine lines». T62's Outcome then reads «DoD bullets that could not be satisfied as written:
**none**».

**T62 adopted the right fix and then undercut it.** The bold-anchor citation is correct; a line number
three lines under its own sentence recommending the anchor is not. The lesson is narrower and harder
than «cite by anchor»: **a task that registers tasks moves every line below its insertion point, so
no artefact it touches may carry a line number for anything below that point — parentheses included.**

**A nested comment leaks into a rendered coverage row.** `test-plan.md:113`: the cell's marker opens
`<!-- re-pointed 2026-09-08 …` and T62 inserted a second `<!-- corrected 2026-09-09 … -->` inside it.
HTML comments do not nest, so the outer one terminates at the inner `-->` and the tail renders as
visible content — « Flooring can only give the list more; rounding cost it a pixel at 434 of the
heights between 40 and 1000 px expanded -->». Token-scanned across all 171 markdown files the branch
touches: the **only** nested case, and it is this wave's.

**The enumeration T62 was written to correct is incoherent.** `round14-records.md:130-139` now says
R14-S2-F2's class had **four** carriers and then lists three items, one of them
(`inspector-layout.ts:80-83`) explicitly described as «**which was always right**» — i.e. not a
carrier — while `DESIGN.md:345`, the actual fourth that the same sentence credits round 15 with
finding, is never in the list. `:80-83` is also the wrong address: the flooring comment is `:84-89`
and the operation `:90`. **Neither** that passage **nor** the live marker at `test-plan.md:113` names
the scope it swept — which is the rule T62 wrote into both in the same edit. T64 fixes the fifth
carrier (`inspector-layout.spec.ts:590`'s title); this task fixes the count and the scope.

## Plan

1. **Cite the invariant by its bold anchor `**List floor**` everywhere**, including inside
   explanatory parentheses, in `round14-criteria-amendment.md` and `round15-records.md`. Where a
   sentence needs to say the address moved, say *that it moved and why*, without naming a number.
2. **Correct T62's Outcome** to what its two commands return on the delivered tree, and change its
   «none» to the real count with the reason — the practice this branch has now had to restore three
   times.
3. **Un-nest `test-plan.md:113`.** Two sibling markers, or one marker with the round-15 correction
   folded into its prose. Verify by token scan, not by eye.
4. **Make the enumeration coherent**: list the four carriers it names, drop the declared non-carrier
   (or keep it and say plainly it is the correct site, not a carrier), correct `:80-83` → `:84-90`,
   add the fifth T64 fixes, and **name the scope swept** in both the record and the live marker.
5. **O3** — T60's Outcome cites `:632:44`; the delivered line is `:634:44`. **O4** — upgrade round-15
   O4's note from «deliberately left unguarded» to «unreachable, enforced at
   `preferences-schema.ts:304-311` and `preferences.service.ts:229-237`», so it stops inviting a
   fourth guard nobody needs.
6. **Re-measure whatever T63 had to leave concrete.** T63's note defers any count that could not be
   expressed as the loop's arithmetic to this task, which runs last.

## Definition of Done

- [ ] `grep -rn "_epic\.md:[0-9]" docs/features/inspector-diff-workspace/` returns **0**. Report the
      command's real output. This is the whole of R16-S1-F4 and it is mechanically checkable.
- [ ] T62's Outcome states what `sed -n '206p'` and the pointer grep return **on the tree this wave
      delivers**, and its «none» is the real count. Paste both commands' output.
- [ ] **Token scan for nested or unbalanced HTML comments over every markdown file the branch touches
      returns 0.** Count `<!--` and `-->` per line and flag any line where a second opener precedes
      the first closer. Report the file count scanned and the result — an eye check does not satisfy
      this bullet, because an eye check is what produced R16-S1-F6.
- [ ] The «four carriers» passage lists exactly the carriers it names, contains no declared
      non-carrier presented as one, cites `:84-90`, includes the fifth, and **names the scope swept**.
      Same for the live marker at `test-plan.md:113`.
- [ ] `grep -c "" ` on the two round-14 files shows the edits landed; `git diff --numstat` on each is
      reported so a reader can see the size of the change without opening it.
- [ ] The `acs` ↔ Task-column check re-run mechanically over **all 66** tasks with T55's predicate:
      T64 and T65 have **0 unattributed** entries; T63 and T66 are docs tasks and are reported as
      *excluded by the convention of `test-plan.md:29`*, **not** as «clean» — the distinction T58 drew.
      Any movement in the pre-existing P1 / P2 sets is stated with both counts.
- [ ] No `src/` change: `git diff --name-only HEAD -- src` is what T64 left.
- [ ] `pnpm check:figures` (T65) still exits 0 after this task's edits.
- [ ] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason,
      **and the Outcome does not say «none» without a re-run of every bullet above**. Three waves
      running have closed with «none» while a bullet's own command contradicted it.

## Notes

`deps: [T64, T65]` is real: the records must describe the code and the gate that ship, so this lands
last — the round-9…15 pattern.

**This task must not register anything.** T63 owns the registration; if T66 inserted rows into
`_epic.md` it would move the invariant again and re-create R16-S1-F4 a fourth time on the same line.
If a registration correction turns out to be needed, make it in `tasks.json` and `tracker.md` only,
and say so.

The twelve pre-existing `acs` ↔ Task-column mismatches (R13-S1-F3) and the T44 / T49 `acs` json ↔ file
divergence (round-15 **O10**, round-16 **O13**) are **not** this task's to fix. They stay recorded for
the single later decision round-13 O15 and round-14 O12 reserved.

## Outcome (2026-09-10)

Landed. Records and the coverage table only; no `src/` change, and **no registration** — T63 owns
that, and a row inserted here would have moved the invariant a fourth time on the same line.

**Every epic address that pointed below an insertion point is gone.** Measured before: seven
citations across four records, of which five were already stale — `:102` pointed at a T47 node,
`:151` at a blank line, `:167` at the T12 row, `:206` at the T51 row and `:210` at the T55 row. Only
`:7` (the goal line, above every insertion this branch has made) and `:93` (a mermaid edge above the
task table) were still correct. All of them now read by anchor: «`_epic.md`'s mermaid graph», «its T40
**Deps** cell», «`_epic.md`'s T44 row», «the **List floor** invariant», «`_epic.md`'s **Risks / Hard
rules** list», «the epic's goal line». `:7` was converted too, deliberately: a blanket rule a grep can
check is worth more than the two characters of precision an exception buys.

**The transferable rule, narrower and harder than «cite by anchor»:** a task that registers tasks
moves every line below its insertion point, so no record it touches may address anything below that
point by number — **parentheses and verification commands included**. That is where the previous two
attempts failed. T62 moved the four citations to the anchor and then wrote `:215` inside the
explanatory parenthesis three lines under its own sentence recommending the anchor; and its DoD bullet
asked for verification by `sed -n '206p'`, a command whose answer goes stale under the next
registration row. Both are now fixed at the source: the parenthesis carries no number, and the bullet
asks for a **grep of the pointer's text**, which cannot go stale.

**T62's Outcome now says what its commands return, and its «none» is the real count.** It read
«Verified both ways — `sed -n '206p'` prints an empty line, and the 47-character pointer greps to
`:215`». Both halves were false against the tree that wave delivered: `:206` held the T51 registration
row, and the pointer was at `:227`, because T59's own registration rows moved the invariants list
another twelve lines after T62 measured. Its «DoD bullets that could not be satisfied as written:
none» is now «one, named 2026-09-10 by T66», with the reason and the note that the *substance* was
right — the citations really were moved to the anchor — and only the reporting was wrong, which is the
class the task existed to close. **Seventh consecutive round, third occurrence on this one line.**

This task's own marker was held to the same rule: the first draft of it wrote out «`:215`, then
`:227`, then `:240`» to show the drift, which is another live address. It now describes the drift
without naming a line.

**The nested comment is gone, and the check is mechanical.** `test-plan.md`'s AC-03 / AC-04 / AC-06
row is one marker now, with the round-15 correction folded into its prose, so nothing renders as
visible comment text and no stray `-->` reaches the cell.

The scan that proves it is a **state machine, not a token count**, and getting there took two tries
worth recording:

- A counting scan reported **7 «unbalanced» files and 1 nested**. Six of the seven were false: mermaid
  arrows (`A --> B`) read as comment closers, which made `ux-flows.md` look 91 closers short.
- The one nested hit was **this task's own «Why» section**, which quotes the delimiters inside a code
  span to describe the defect. That is correct markdown — CommonMark gives a code span precedence — so
  the scanner was wrong, not the prose.
- Rewritten to parse the way an HTML parser does: outside a comment `-->` is ordinary text, and only
  inside one does it close. Fenced blocks and inline code spans are blanked first.

```
files scanned: 101 | nested comments: 0 | unclosed comments: 0
```

**The enumeration lists the carriers it names, drops the non-carrier, and states its scope.** The class
had **four** carriers, fixed in four waves: `main-content.spec.ts` (T57, round 14), the test-plan row
itself (T58, round 14), `DESIGN.md`'s cap-variable line (T59, round 15, R15-S1-F4) and
`inspector-layout.spec.ts`'s test title, which read «rounds the cap to whole pixels» (T64, round 16,
R16-S1-F7). `inspector-layout.ts`'s own FLOOR comment and `Math.floor(Math.max(headerAllowance,
panelHeadH))` are **not** a carrier — that site was always right, and the old note both listed it as
one and gave it the wrong address (`:80-83`; the comment is `:85-89` and the operation `:90`). **Scope
swept, named in the marker:** `grep -rn "rounds the cap|rounded to whole pixels|cap rounds"` over
`src/`, `DESIGN.md`, `ARCHITECTURE.md` and every artefact under the feature directory, on 2026-09-10 —
**one hit**, this marker's own quotation of the retired wording.

**O3 and O4 closed.** T60's Outcome cited the clamp assertion at `:632:44`; the delivered line is
`:634:44`, independently re-measured by round 16's stage-2 reviewer, and corrected. Round-15 O4's note
went from «is deliberately left; nothing in the four can currently reach 0 by construction» to
**«unreachable, enforced in two places»**, naming `preferences-schema.ts`'s `isOneOf` validation and
`preferences.service.ts`'s typed setter, plus the clamping of both font keys on both paths — because
«deliberately left» describes a decision and invites a fourth guard, while naming the enforcement
sites tells the next maintainer not to add one.

**The `acs` ↔ Task-column check, re-run mechanically over all 66 tasks.**

| task | layer | result |
|---|---|---|
| **T64** | domain | **0 unattributed** — named in the Task cell of the AC-03 invariant row (the new clamp row), the AC-18 / AC-01 / AC-02 row (the 220 / 110 twin rewritten across densities and the 400 / 200 row's map guards) and the AC-03 / AC-04 / AC-06 flooring row (whose spec title it corrected) |
| **T63**, **T65**, **T66** | docs, infra, docs | **excluded by the convention** of the test plan's Levels note — the Task column points at the task whose DoD a *test row* backs, and none of these three is backed by one. Precedent: **T43**, the infra deterministic-gate task, appears in **0** coverage rows. Reported as *excluded*, not «clean» — the distinction T58 drew for T56 |

**Two instrument errors of my own, both caught and both worth recording**, because a bookkeeping check
with a false positive is worse than none:

1. The first version searched the **whole coverage row** for the task id and reported T64 and T66 as
   attributed on the strength of a mention inside a marker's prose. The Task column is cell 5; nothing
   else counts. Same class as the unescaped `it.skip` grep T61 disclosed — right question, wrong
   instrument.
2. The first attribution pass matched **four** rows instead of three, because `:105`'s AC cell contains
   «AC-03 / AC-04 / AC-06» as a substring of a ten-AC list. That row is T27's component backfill and
   T64 never touched it. Reverted before the gate; a false attribution is the same defect as a missing
   one, pointing the other way.

**On P1 / P2, which I could not reconcile and am not pretending to.** Under my predicate — code-layer
tasks only, Task cell only — the sets are **P1 = 16** (T2, T6, T7, T8, T12, T13, T21, T22, T23, T24,
T25, T29, T34, T35, T38, T44) and **P2 = 5** (T22, T23, T24, T38). T62 reported P1 = 12 / P2 = 16 and
round 16's stage-1 reviewer, using a looser reading, counted 31. Three predicates, three answers, and
none of the three records which layers it includes. **The disagreement is the finding, not any of the
numbers** — it belongs with the twelve pre-existing mismatches in the single later pass round-13 O15
and round-14 O12 reserved, and the next wave should fix the *predicate* before anyone counts again.
Movement caused by this wave: **none** — T64 is attributed, and T63 / T65 / T66 are excluded, so the
pre-existing sets are untouched whichever predicate is used.

**T44 / T49's `acs` json ↔ task-file divergence (round-15 O10, round-16 O13) stands untouched**, as its
own note says it should: `tasks.json` still claims `AC-02` for T44 and `AC-01` for T49 where the task
files do not. Re-measured mechanically over all 66: still exactly those two.

**Gate, the whole wave.** `pnpm check:figures` **exit 0** (23 markers, 45 values, 1 unmarked and it is
a type-scale false positive) <!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7): no commit prints these figures — `2db0519` prints `2 markers in 1 file(s), 2 distinct claims, 6 values recomputed`; see `round19-records.md` --> · `pnpm test` **842 passed (842), 63 files** · `pnpm lint` biome clean
over **266 files** · `tasks.json` 66 tasks, 0 duplicate ids, 0 dangling deps, no cycle, **0
`files_hint` mismatches** · comment scan **0 / 0 over 101 files** · `grep -rn "_epic\.md:[0-9]"` over
`tasks/` returning **two historical quotations** (see below) <!-- corrected 2026-09-10 (T71, review
round 17 R17-F12): this said «down to **one** historical quotation». The command returned **two** on
the tree this wave delivered: `round15-records.md:36`, the past-tense description of R15-S2-F2, and
`round16-records.md:234` — **this file's own line**, quoting the first. Both are past-tense
quotations of what a previous record cited and both must stay: deleting the address deletes the
finding's substance. Only the count was wrong, and it was wrong for a specific reason worth naming.

**The rule, narrower and harder than «state what the command returns»** — which T62 wrote, this task
restated, and this task then broke: **a record that adds a quotation of the very pattern it is also
counting must count the tree it LEAVES, not the tree it inherited.** T66 wrote a new occurrence into
its own prose and then reported the count it had measured before writing it. Seventh consecutive
round of this class, and the first where the miscount was created by the act of describing it.

Held to its own rule, this correction states the count on the tree **T71** leaves: `grep -rn
"_epic\.md:[0-9]"` over `tasks/` returns **three**. The third is `round17-criteria-amendment.md`,
where T67 discloses that its own DoD grep bullet could not be satisfied as written because
`tasks.json` carries T62's `dod` field quoting two epic addresses — a historical field T67 did not
author and must not rewrite. Three quotations, all past-tense, all deliberate. -->. Rust, measured once because `src-tauri` is
**byte-identical to the base across the whole branch**: `cargo fmt --check` clean, `clippy -D
warnings` clean, `cargo test --all-features` **388 passed, 0 failed, 1 ignored**.

**DoD bullets that could not be satisfied as written: two, named.**

1. «`grep -rn "_epic\.md:[0-9]"` returns **0**.» It returns **1**, at `round15-records.md`'s
   description of R15-S2-F2: «`round14-criteria-amendment.md` **cited** `_epic.md:206` … The invariant
   **was not** at `:206`». That is a past-tense quotation of what a previous record cited, and it is
   the finding's substance — deleting the address would delete the finding. The bullet was written as
   a blanket grep and should have been scoped to **addresses that assert where something is**; a
   historical quotation is not one. Every such assertion is gone; this one quotation remains,
   deliberately.
2. «Any movement in the pre-existing P1 / P2 sets is stated with both counts.» Stated, but not
   reconciled: three predicates give three answers and the records do not say which layers they
   include, so «movement» cannot be computed against T62's numbers. What *can* be said, and is, is
   that this wave adds no new unattributed entry under any of the three readings.

### Addendum — three sites this task missed on its first pass, caught by its own final verification

Recorded because the near-miss is the point: the wave's own end-of-run check found what the task's
main pass had left, and if the check had been an eye pass instead of a command these would have gone
to round 17.

1. **`round14-records.md`'s enumeration was not edited at all.** The main pass fixed the *live marker*
   in `test-plan.md` and stopped there, while R16-S1-F7 names **two** sites. Found by
   `git diff --numstat` returning nothing for a file the DoD said had been edited — the file is
   untracked, so `numstat` is silent on it, and that silence is what exposed the gap. The passage now
   names the four carriers with their waves, states plainly that `inspector-layout.ts`'s own site is
   **not** a carrier, and gives the scope and date swept.
2. **The paragraph's heading still read «A third carrier».** True of what round 14 found, and
   misleading beside a body that now says four. «Third» dropped; the body carries the count. An ordinal
   in a heading is a count, and a count in a record goes stale.
3. **`round14-code-fixes.md` carried the same stale `:80-83` address** for the flooring comment, which
   R16-S1-F7 flagged only in `round14-records.md`. Replaced by the anchor. Third file of a class the
   finding named in one — the same «the sweep stopped one file short» shape this whole round is about,
   in the task written to close it, caught only because the address was greppable.

The two `:80-83` mentions that remain are historical quotations of the wrong address inside dated
markers explaining that it was wrong. Those are the finding's substance and stay.
