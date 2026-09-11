---
id: T48
title: "Round-11 criteria amendment: the cross-placement carve-out and the KPI bullet the reversal left behind"
layer: "docs"
deps: []
acs: ["AC-03", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "CONTEXT.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T48 — Round-11 criteria amendment

## Why

Two criteria promise what the shipped policy cannot deliver, and both survived the wave that was
sent to reconcile the criteria with the reversal —
[review round 11, R11-S2-F4 and R11-S1-F4](../_review/review-2026-09-08-round11.md).

**The cross-placement share is missed in the configuration this wave made canonical (R11-S2-F4).**
Measured independently by stage 2 and the lead, at the bottom placement's 220 px minimum
(`main-content.ts` `MIN_BOTTOM_PX`) with blame and file history stacked at their fixed 30 % + 20 %
= 110 px, and the header **collapsed**:

| tokens | bottom + both stacked (remainder 110) | inspector right, same window | §6 row 3 |
|---|---|---|---|
| comfortable | cap 34 → share **0.6909** | cap 140 → **0.7500** | **missed** |
| compact | cap 30 → share **0.7273** | **0.7500** | **missed** |

The cause is legitimate policy: at a 110 px remainder the collapsed share floor (82.5) leaves an
allowance of 27.5, and `Math.max(headerAllowance, panelHeadH)` lifts the cap to a full panel head
rather than letting the header vanish behind its own scrollbar — the guard round 9 established and
that a mutation pins. <!-- corrected 2026-09-08 (T52, review round 12 R12-S1-F1 / R12-S2-F2): the sentence above is wrong
about which floor binds. `protectedList = max(94, 0.75 × 110 = 82.5) = 94`, so the **2-row floor**
binds and the allowance is **16** comfortable / **20** compact. «27.5» is `110 − 82.5`, the allowance
the share floor *would* have left had it bound — a number the policy never computes, and the suite's
own output says so: dropping the guard reddens that row with `expected 16 to be 34`, not 27. The
conclusion the sentence draws is still right (the guard lifts the cap to a full panel head and the
guard alone causes the miss); only its arithmetic was wrong. The same sentence was corrected in
`inspector-layout.spec.ts` by T51. --> What is wrong is the criterion. `spec.md:198` AC-18, `spec.md:231` §6 row 3,
`sad.md:733` §10 QG-1 and `test-plan.md:156` all state «≥ the share it has with the inspector on the
right» with no carve-out — and AC-18's own amendment marker asserts «the policy applies the same
ratios to whatever remainder it is given», which is exactly what this falsifies. Nothing can see the
miss either: the 168-configuration sweep passes `stackedPanelsHeight: 0` throughout, T40's 220 / 110
row is expanded-only, and the checklist bullet never combines the bottom minimum with both panels
and a collapsed header.

**§7's third KPI still measures the pre-reversal proportion (R11-S1-F4).** `spec.md:255` — «header +
commit file list for a one-file, subject-only commit at 1280 × 800 — baseline about 275 px (fixed
two-fifths); target ≤ 220 px expanded, ≤ 70 px collapsed». Under the allocated reading the two blocks
now consume the whole column (the History diff slot is `h-0`, the inspector block is the column's
only `flex-1` child, and the list takes what the header leaves with no upper bound). Under the drawn
reading the collapsed half fails: 34 + 34 + 30 = **98 px** with the one row a one-file commit draws,
against a 70 px target. `screens.md:50` published that arithmetic and flagged the reading as «not
decided here» on 2026-09-03; no later artefact decided it. R10-S2-F4's defect class, one bullet below
the bullet the last wave amended.

## What

### The criteria (owner decisions, 2026-09-08 round 11)

- **The cross-placement carve-out (R11-S2-F4)** — decision: **state the carve-out in the criterion**,
  the same shape round-10 decision 3 used for the empty list. The cross-placement guarantee does not
  apply where a hard floor binds — the header-cap guard or the two-row floor — i.e. at a remainder
  under **136 px comfortable / 120 px compact**, where the cap is lifted to a full panel head and the
  ratio yields to keeping the header legible. Amend all four sites together, each with a dated
  marker: `spec.md:198` **AC-18**, `spec.md:231` **§6 row 3**, `sad.md:733` **§10 QG-1**, and
  `test-plan.md:156` (that last one belongs to T49, which re-points the whole plan; state the exact
  wording here so T49 quotes it rather than inventing it). AC-18's existing marker sentence «the
  policy applies the same ratios to whatever remainder it is given» must go — it is the claim the
  measurement falsifies.
- **Drop §7's third KPI bullet (R11-S1-F4)** — decision: **remove it**. The first KPI bullet already
  measures the protected share, which is what §6 and AC-03 now define; this bullet measures the
  pre-feature `flex-[2] / flex-[3]` proportion and is unreachable under both readings. Record the
  arithmetic in the marker rather than in a commit message, as R10-S2-F4's amendment did, and close
  `screens.md:50`'s open question in the same pass — the sentence «flagged in the handoff, not
  decided here» has no owner left once the KPI is gone.

### The two routed observations

- **O3** repo-root `CONTEXT.md:12` defines the inspector as holding «the diff viewer». Round 10
  routed this to T45 with «decide it here» and it was dropped silently. **Decide it now and record
  the decision**: either amend the entry to say the inspector hosts the viewer in Changes only (in
  History it holds its parking slot at zero height), or state in the record why the two-level
  contract makes the per-feature entry sufficient. Do not leave it routed a third time.
- **O8** `sad.md:643`'s US-03 row was not extended with **F9**, the flow T41 added for AC-22; the
  AC-22 row at `:674` names it. Add F9 to the US-03 row, extend `sad.md:677`'s «F1–F8» vocabulary
  note to F9, and either move F9 after F8 in §6 or note that the coverage table is the order of
  record.

## Definition of Done

- [ ] AC-18, `spec.md` §6 row 3 and `sad.md` §10 QG-1 carry the same carve-out in the same words,
      each with a dated `amended 2026-09-08 (owner, review round 11 …)` marker; the exact wording is
      quoted in this task's Outcome so T49 can re-point `test-plan.md:156` to it verbatim.
- [ ] AC-18 no longer claims the policy applies the same ratios to whatever remainder it is given.
- [ ] `grep -n "two-fifths" spec.md` returns nothing in §7; `screens.md:50`'s «not decided here»
      sentence is resolved, not merely reworded.
      <!-- corrected 2026-09-08 (T52, review round 12 R12-S1-F4 / R12-S2-F4): the first half of this
      bullet is UNMET and was not named as such. `grep -n "two-fifths" spec.md` returns `255:`, inside
      §7 — the dropped-KPI marker quotes «baseline about 275 px (fixed two-fifths)». It is the same
      kind of grep-shaped bullet as the two this task's Outcome does name, and the same reasoning
      applies: the house convention quotes a retired claim inside the marker that retires it, and
      deleting a correct quotation to satisfy a grep would make the record worse. What was missing was
      the acknowledgement, not the work. -->
- [ ] `sad.md`'s US-03 row and its §6 vocabulary note name F9.
- [ ] Repo-root `CONTEXT.md` is either amended or explicitly declined, with the reason in the
      Outcome.
- [ ] No `src/` change in this task.

## Outcome (2026-09-08)

Landed. Docs only — `git status --porcelain -- src src-tauri` empty; `pnpm lint` clean (266 files).

**The carve-out, in the words T49 must quote verbatim:**

> except where a hard floor binds — the header-cap guard or the list's two-row floor, i.e. a
> remainder under **136 px** in comfortable density or **120 px** in compact: there the cap is
> lifted to a full panel head and the ratio yields, because a header shorter than its own head
> disappears behind its own scrollbar (AC-03).

It is in all three criteria sites in those words: `spec.md` AC-18, `spec.md` §6 NFR row 3 (which also
states that rows 1–2's empty-list carve-out applies to it), and `sad.md` §10 QG-1.
<!-- corrected 2026-09-08 (T52, review round 12 R12-S1-F4 / R12-S2-F4): «in those words» held at ONE
of the three sites. Verbatim at `spec.md` AC-18 (and, via T49, `test-plan.md`); condensed at
`spec.md` §6 row 3, which dropped «the list's» and the scrollbar reason; condensed further at
`sad.md` §10 QG-1, which dropped BOTH named mechanisms and left only «where a hard floor binds». The
substance was equivalent at all four, so this was a claim defect rather than a criterion defect — but
it is R11-S1-F3's class (a task asserting an agreement between records the records do not have) in
the wave sent to close R11-S1-F3, and QG-1 dropped exactly the half round 12 found wrong. T50 rewrote
all three sites to one sentence and verified it by diffing the extracted strings. -->
Each carries a
dated round-11 marker recording the measurement — 0.691 comfortable / 0.727 compact against 0.750 on
the right, at the bottom's 220 px minimum with both panels stacked and the header collapsed.

**AC-18's false claim is retired.** The round-9 sentence «the policy applies the same ratios to
whatever remainder it is given» no longer stands as a claim; it survives only as a quotation inside
the round-11 marker that says why it is wrong. Same for `screens.md`'s «flagged in the handoff, not
decided here»: resolved, with the old wording quoted in the marker that closes it.

**Two DoD bullets were written as greps and would have lied.** «`grep -c "applies the same ratios"`
returns 0» and «the *not decided here* sentence is gone» both still return 1 — because the retired
wording is quoted inside the marker that retires it, which is the house convention every amendment
on this branch follows. The bullets are about the *claim*, not the *string*; recorded here rather
than deleting a correct quotation to satisfy a grep. This is T45's lesson repeated one wave later.

**§7's third KPI is gone**, replaced by a marker carrying the arithmetic under both readings, so the
next reader does not have to re-derive why. §7 now has three bullets, the first of which already
measures the protected share.

**`sad.md` bookkeeping (O8).** The US-03 flow row names F9, the §6 participant-vocabulary note reads
F1–F9, and the §6 preamble records that F9 sits after F2 with the coverage table as the order of
record.

**Repo-root `CONTEXT.md` (O3) — decided *in*, amended.** The `inspector` entry now reads «the diff
viewer — inline in Changes, and in History only its parking slot at zero height, because a commit
diff is read in the diff workspace». It was routed by round 10 and dropped; leaving a project-wide
glossary entry describing a column the app no longer has is worse than the one clause it costs.
`updated_at` moved to 2026-09-08.

**T47–T49 registered.** `tasks.json` (49 tasks, DAG re-verified acyclic), `tracker.md` (totals to 49
tasks and the round-11 provenance line) and `_epic.md` (the graph edges `T48 → T47 → T49`, the
round-11 wave paragraph and the three task rows).

## Notes

The carve-out's numbers come from the round-11 measurement (`review-2026-09-08-round11.md`,
R11-S2-F4 and R11-S1-F1): the share floor is missed for a remainder `≤ 135 px` comfortable and
`≤ 119 px` collapsed-compact, so «under 136 / 120» is the boundary to state. T47 pins the collapsed
twin at the 220 / 110 remainder, which sits inside that band.

The commit must carry `SDD-Task: T48` and its `SDD-AC` trailers (R9-S1-F9).
