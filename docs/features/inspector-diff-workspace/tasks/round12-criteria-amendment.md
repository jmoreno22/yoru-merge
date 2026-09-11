---
id: T50
title: "Round-12 criteria amendment: the carve-out's real cause, its per-collapse-state band, and the two artefacts it never reached"
layer: "docs"
deps: []
acs: ["AC-03", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T50 — Round-12 criteria amendment

## Why

Round 11's owner decision 1 added a carve-out to the cross-placement share, and the wording it
prescribed is wrong in two independent ways — one measured by the lead, one by both reviewers
(`_review/review-2026-09-08-round12.md`, **R12-L-F1** and **R12-S1-F1**).

**The cause is misattributed.** The carve-out reads «where a hard floor binds — the header-cap guard
**or the list's two-row floor**». Swept over 40…2000 px in both densities and both collapse states:
of the **224** configurations that miss the share floor, **224** are fixed by removing
`Math.max(headerAllowance, panelHeadH)` and **0** by removing the two-row floor. Setting the list's
row floor to 0, 1, 3 or 6 rows moves none of the four bounds, because the bound is the closed form
`panelHeadH / (1 − ratio) − 1`, which carries no term from that floor. The two-row floor does set
`protectedList` in part of the band, but it is never the reason the ratio yields: it only ever raises
the list's protected height, which raises the share.

**The band is over-broad for the expanded share.** The criterion waives the guarantee for «a
remainder under 136 px comfortable / 120 px compact» in both collapse states. Measured, the expanded
share is met from **68 px** comfortable / **60 px** compact upward, so `r ∈ [68, 135]` is waived and
met — and that band contains the whole reachable bottom remainder (`r ≥ 110`, both stacked panels
taking 30 % + 20 % of a column with a 220 px minimum). At 220 / 110 **expanded** — the configuration
the round-11 wave canonicalised — the share is 0.6909 against a 0.50 floor, comfortably met and
waived by the criterion as written. A regression anywhere in that band would not violate AC-18.

**And the carve-out never reached two artefacts** that state the un-carved claim (**R12-S1-F2**):
`test-plan.md:90`, AC-18's manual `e2e-through-UI` row — which is the step a tester executes, and at
the bottom minimum with both panels stacked and the header collapsed records a FAIL against a
criterion the owner deliberately carved out, three sections from the bullet that carves it out — and
`ux-flows.md:179`, the US-07 flow prose.

## What

- **The canonical carve-out wording**, to be used verbatim at every criteria site and quoted verbatim
  by T52 in `test-plan.md`:

  > except where the header-cap guard binds — a remainder under **68 px** comfortable / **60 px**
  > compact with the header expanded, or under **136 px** / **120 px** collapsed: there the cap is
  > lifted to a full panel head and the ratio yields, because a header shorter than its own head
  > disappears behind its own scrollbar (AC-03).

- Amend **`spec.md` AC-18** (`:198`), **`spec.md` §6 NFR row 3** (`:231`) and **`sad.md` §10 QG-1**
  (`:733`) to that wording, **in the same words at all three sites** — round 11's own DoD asked for
  this and got two of three (R12-S1-F4). Each carries a dated
  `amended 2026-09-08 (owner, review round 12 R12-L-F1 / R12-S1-F1)` marker recording the closed form
  `panelHeadH / (1 − ratio) − 1`, the four bounds it yields (67 / 135 comfortable, 59 / 119 compact),
  and that the round-11 enumeration named a floor that causes none of the 224 misses. Keep the
  round-11 marker as history; do not delete the wording it retires — the house convention quotes a
  retired claim inside the marker that retires it.
- Amend **`ux-flows.md:179`** (US-07 flow prose) and **`test-plan.md:90`** is T52's — this task takes
  only `ux-flows.md`, so the two docs tasks do not share a file.
- **`screens.md`**: `:16` still cites `sad.md` §6 as «F1–F8» after F9 exists (O9); `:50`'s prose still
  asserts it «meets the spec §7 KPI «≤ 70 px collapsed»» after the same wave deleted that KPI (O10).
  Fix the first; for the second, move the stale claim inside a dated marker rather than leaving it as
  live prose.
- Register **T50–T52** in `tasks.json`, `tracker.md` and `_epic.md` (graph edges `T50 → T51 → T52`
  and `T50 → T52`), and re-verify the DAG is acyclic.

## Definition of Done

- [ ] AC-18, `spec.md` §6 row 3 and `sad.md` §10 QG-1 carry the canonical wording **byte-identical**
      to the block above — diff the three extracted sentences against each other, do not eyeball them
      (this is the bullet round 11 reported as met and was not).
- [ ] No criteria site still names the list's two-row floor as a cause of the ratio yielding, and no
      site still waives the expanded guarantee above 68 px comfortable / 60 px compact.
- [ ] `ux-flows.md:179` states the guarantee with the carve-out and carries a dated round-12 marker.
- [ ] `screens.md` cites F1–F9; `screens.md:50`'s KPI claim is inside a marker, not live prose.
- [ ] `tasks.json` has 52 tasks, the DAG is acyclic with no dangling dep, and `deps` agrees with
      `_epic.md`'s edges and `tracker.md`'s Deps column.
- [ ] No `src/` change in this task.
- [ ] Any DoD bullet written as a grep that cannot be satisfied because the retired wording survives
      inside its own marker is **named in the Outcome**, with the reason — all of them, not two of
      three (R12-S1-F4).

## Outcome (2026-09-08)

Landed. Docs only — `git diff --stat HEAD -- src src-tauri` is unchanged by this task (still the six
spec files the earlier waves left, 324 / 22); `pnpm lint` clean, 266 files.

**The canonical sentence, and it is byte-identical at four sites.** Extracted by regex from each site
and compared as strings, not read:

> `**except where the header-cap guard binds — a remainder under 68 px comfortable / 60 px compact with the header expanded, or under 136 px / 120 px collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**`

313 characters at `spec.md:198` (AC-18), `spec.md:231` (§6 NFR row 3), `sad.md:733` (§10 QG-1) and
`ux-flows.md:179` (US-07 prose) — `len(set(...)) == 1` over all four. Round 11's DoD asked for three
and got two; this one is verified mechanically, which is the only reason it can be claimed.

**What each marker records.** The measurement, so the next reader does not re-derive it: 224 of 224
misses are fixed by removing `Math.max(headerAllowance, panelHeadH)` and **0** by removing the
two-row floor; the bound is `panelHeadH / (1 − ratio) − 1`, invariant under a 0 / 1 / 3 / 6-row floor;
the four bounds are `r ≤ 67` / `r ≤ 135` comfortable and `r ≤ 59` / `r ≤ 119` compact
(expanded / collapsed); and the single 136 / 120 band had waived the expanded guarantee over
`r ∈ [68, 135]`, which contains the whole reachable bottom remainder. The round-11 wording survives
only as a quotation inside the marker that retires it, per the house convention.

**`ux-flows.md:179` is now a fifth carrier of the same sentence** — round 11 carved the guarantee out
of four sites and this prose was not among them (R12-S1-F2). `test-plan.md:90` is the sixth and is
**T52's**, so the two docs tasks share no file.

**`screens.md`:** `:16` cites `sad.md` §6 as «F1–F9» (`grep -c "F1–F8"` → 0); `:50`'s claim «68 px,
which meets the spec §7 KPI «≤ 70 px collapsed»» is gone from the prose and quoted inside a dated
round-12 marker instead, which is where every other retired claim on this branch lives.

**T50–T52 registered.** `tasks.json` 52 tasks, appended textually so the file's own formatting
convention survives — `git diff` on it reports **280 insertions and 0 deletions** (232 are the
round-11 wave's still-uncommitted T47–T49, 48 are mine), so nothing reflowed. DAG re-verified by DFS:
acyclic, no dangling dep. `tracker.md` rows + «Total: 52 tasks» + the round-12 provenance link;
`_epic.md` the three graph edges (`T50 → T51 → T52`, `T50 → T52`), the wave paragraph and the three
rows.

### One DoD bullet I could not satisfy, and why

**«No criteria site still names the list's two-row floor as a cause of the ratio yielding»** is
**unmet for one site**, and the bullet was mis-scoped rather than the work incomplete:
`test-plan.md:166` still carries the round-11 wording verbatim, and `test-plan.md` is **T52's file**
by the split this task's own Notes describe — T50 owns `ux-flows.md`, T52 owns `test-plan.md`, so the
two docs tasks can never contend. The bullet should have read «no criteria site *this task owns*».
Recorded here rather than reached across a lane boundary to make a grep pass; T52's DoD carries the
same requirement for its own file.

Two other mentions of the two-row floor are **correct and left alone**: `sad.md:655` and
`ux-flows.md:65` say the list *keeps* its two-row floor, which is what the floor does. The defect was
only ever naming it as a cause of the *share* yielding.

## Notes

`deps: []` — this task writes the wording T51's comments and T52's test-plan quote must both match,
so it goes first. It touches no file T52 touches (`test-plan.md` is T52's, `ux-flows.md` is this
task's) so the two docs tasks can never contend for a file.

The commit must carry `SDD-Task: T50` and its `SDD-AC` trailers (R9-S1-F9).
