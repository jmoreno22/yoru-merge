---
id: T63
title: "Round-16 criteria amendment: the predicate the band actually measures, the figures a tester executes, and the closed forms that cannot go stale"
layer: "docs"
deps: []
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "DESIGN.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T63 — Round-16 criteria amendment

## Why

**R16-S2-F1**, **R16-S1-F1**, **R16-S1-F3**, **R16-S1-F5**, **R16-L-F1** and observations **O1**,
**O5** (`_review/review-2026-09-10.md`).

**The sentence certifies one quantity with the other's measurement.** «The guard binds» and «the
share is missed» are different predicates, and round 12 already separated them once (R12-S1-F1):

- **share missed** ⟺ `panelHeadH > (1 − ratio) · r` ⟺ `r < 2·panelHeadH` expanded, `r < 4·panelHeadH`
  collapsed. This is what every criterion on this branch promises, and it is what T59's
  201 474-point / 0-mismatch sweep measured. **Exact.**
- **guard binds** (`Math.max(headerAllowance, panelHeadH)` picking `panelHeadH`) ⟺ in the row-floor
  regime, `r < 2·panelHeadH + 2·fileRowH` — a band `2 × fileRowH` wider. It disagrees with the
  sentence at **5312** of those same 201 474 points, **every one expanded**, reachable in **16 of the
  21** token sets (comfortable/13 `r = 110…127.75`; relaxed/17 `r = 110…179.75`).

The canonical sentence says «except where **the header-cap guard binds** — a remainder under twice
`--panel-head-h` …», fusing them. It also **contradicts the branch's most-cited row**:
`inspector-layout.spec.ts:340-343` says the guard lifts the cap to 34 at `r = 110` comfortable — true,
measured — while `spec.md:198` says the guard binds only under 68.

**Three cells a tester executes carry the dead fixture's shares.** `test-plan.md:91` and `:167`
instruct «expects 0.691 comfortable / **0.727** compact, not 0.750»; `:90` adds «the cap is one panel
head and the share is 0.6909 … **expanded and collapsed alike**». Measured at `r = 110`, default font:

| density | expanded cap / share | collapsed cap / share | cap is one head? | states identical? |
|---|---|---|---|---|
| comfortable | 34 / 0.690909 | 34 / 0.690909 | yes | yes |
| **compact** | **36** / 0.672727 | **27** / **0.754545** | **no** | **no** |
| relaxed | 43 / 0.609091 | 43 / 0.609091 | yes | yes |

At compact the guard never binds (`4 × 26 = 104 < 110`) and the collapsed share **meets** 0.750.
`0.727273` is reachable only at compact / `uiFontSize` **16**. T59 swept the six-digit literal and
never the three-digit form in live prose.

**Four counts falsified by the wave's own code change.** `test-plan.md:35`, `:99` and `:145-151` cite
192 / 384 / 32. T61 widened `DENSITIES` to three **after** T59 ran, so the real numbers are
**288 / 576 / 48**. The ordering hazard, not carelessness — which is why the fix is to state the
loop's arithmetic instead of a literal.

**The `relaxed` decision landed at three sites of sixteen.** Thirteen live sites still say «both
densities», including every one that *schedules a measurement*: `spec.md:229` (§6's measurement
clause, which row 2 inherits via «same»), `sad.md:734` (§10 QG-1 *How verify*), `sad.md:690`,
`sad.md:742` (QG-3 *When*), `test-plan.md:38`, `:43` (twice), `:47`, `:90`, `:116`, `:165` («**4
runs**»), `:179` (the pre-release checklist). So the tester never visits the density the decision was
taken for — the one with the worst reachable share, **0.647059** at relaxed/17 column 272.

**The SAD pins a live constraint to a constant that does not exist.** `sad.md:38`: «`--file-row-h` is
pinned to the CDK virtual-scroll **`FILE_ROW_HEIGHT`** and must not be overridden in CSS.»
`grep -rn "FILE_ROW_HEIGHT" src` is empty; the `itemSize` is `rowHeight()` in all five virtual-scroll
templates. `screens.md:23`'s marker — **written by T59 in this wave** — says so in its own words.

## Plan

1. **Reword the predicate at the ten byte-identical sites.** «except where the header-cap guard
   **costs the list its ratio** — a remainder under twice `--panel-head-h` with the header expanded,
   or under four times it collapsed: …». One distinct value, byte-identical, at
   `spec.md:101`/`:198`/`:231`, `sad.md:21`/`:380`/`:733`, `ux-flows.md:179`, `screens.md:343`,
   `test-plan.md:91`/`:167`. Restate `spec.md:198`'s certification as a measurement of the
   **share-yield** predicate, which is exactly what it measured, and record the guard's own band
   (`2·panelHeadH + 2·fileRowH` expanded) as the separate fact it is.
2. **`test-plan.md:90`, `:91`, `:167`** — give the per-density figures or, better, the closed form;
   delete «the cap is one panel head» and «expanded and collapsed alike», both false at compact.
3. **`test-plan.md:35`, `:99`, `:145-151`** — express the counts as the loop's arithmetic
   (`DENSITIES.length × heights.length × fileCounts.length × 2`), so widening a dimension cannot
   falsify prose again.
4. **The three shipped densities at the thirteen remaining sites**, and `:165`'s «4 runs» → 6.
5. **`sad.md:38`** — name what the CDK `itemSize` actually reads (`rowHeight()`, fed by
   `computeMetrics`), keeping the «must not be overridden in CSS» half, which is real and which
   `styles.css:289-295` enforces.
6. **The owner's anti-recurrence decision:** replace every remaining per-density figure in the
   artefacts with the closed form in `panelHeadH` / `fileRowH`. Where a figure must stay concrete,
   label it «reference at the default font» as AC-20's row already does.
7. **O1** — the sweep's file count says when it was measured. **O5** — say where the byte-identity
   invariant is written down that `DESIGN.md`'s paraphrase is a deliberate 11th/12th statement, not
   drift.
8. Register **T63–T66** in `tasks.json`, `_epic.md` and `tracker.md`. **Cite the `_epic.md` invariant
   by its bold anchor `**List floor**`, never by line number, including inside parentheses** — the
   rule R16-S1-F4 exists for.

## Definition of Done

- [ ] The reworded sentence is **one distinct value** at the ten artefact sites: extract by regex,
      compare as byte strings, report the length and md5 and the site list. No 11th site.
- [ ] `spec.md:198`'s marker states which predicate the 201 474-point sweep measured, and gives the
      guard's own band separately. Re-run the sweep and report both numbers: `predicate ≠ shareMissed`
      and `predicate ≠ guardBinds`, over 21 pairs × 2 collapse states × `r = 1…1200` step 0.25.
- [ ] No live artefact cell instructs a tester to expect a figure the app cannot produce. Verify by
      re-deriving every share figure that survives, from `computeMetrics` and the shipped policy, and
      paste the derivation.
- [ ] `grep -rn "both densities\|both density\|two densit" ` over every **live** artefact
      (`spec.md`, `sad.md`, `ux-flows.md`, `screens.md`, `test-plan.md`, `DESIGN.md`, `adr/`,
      `tasks/_epic.md`) returns **0** outside dated markers quoting retired wording. Report the
      command's real output.
- [ ] No live artefact quotes 192, 384 or 32 as a configuration count. `grep -n` for each and report.
- [ ] `grep -rn "FILE_ROW_HEIGHT" src` is empty **and** no live artefact asserts the constant exists.
- [ ] `tasks.json` parses, has **66** tasks, no duplicate id, no dangling dep, DFS finds no cycle, and
      its `files_hint` agrees with every task file for T1…T66 — checked mechanically over all of them,
      not spot-checked. `_epic.md` edges and `tracker.md` Deps agree for T63–T66; `tracker.md` says
      «Total: 66 tasks» and links this round's record.
- [ ] No `src/` change in this task: `git diff --name-only HEAD -- src` is what the round-15 wave left.
- [ ] **No citation of `_epic.md` by line number anywhere in this task's output**, including inside
      explanatory parentheses. `grep -n "_epic\.md:[0-9]" ` over the files this task writes returns 0.
- [ ] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason —
      and the Outcome does not say «none» unless a re-run of every bullet above produced no exception.

## Notes

`deps: []`: this task fixes the wording T64's figures and T66's records must match, and it registers
the wave, so it goes first — the round-9…15 pattern.

**The ordering hazard R16-S1-F3 came from is real and this task cannot fix it alone.** T63 runs before
T64, and T64 changes the same file's arithmetic. That is why bullet 3 replaces literals with the
loop's own expression rather than with fresh numbers: a literal written here is a literal T64 can
falsify. If any count must stay concrete, T66 re-measures it last.

## Outcome (2026-09-10)

Landed. Docs only — `git diff --name-only HEAD -- src vitest.config.ts` is the same eight paths the
round-15 wave left, none of them touched by this task.

**The predicate is now the one the band measures, and both predicates are recorded.** The clause
reads «except where the header-cap guard **costs the list its ratio** — a remainder under twice
`--panel-head-h` with the header expanded, or under four times it collapsed». One distinct value,
**319 characters**, md5 `2b9b31ab551ed2f7e942a0a24e457cf5`, at the ten artefact sites, extracted by
regex and compared as byte strings. The short pointer moved with it at six sites plus `DESIGN.md`'s
`(§Density)` form, and the two deliberate paraphrases (`DESIGN.md` §Density prose, ADR-0004) were
re-worded by hand. `grep -rn "header-cap guard binds"` over every live artefact returns **0**.

**Both bands re-measured over the same grid** (21 pairs × 2 collapse states × `r = 1…1200` step 0.25
= 201 474 points):

| predicate | mismatches |
|---|---|
| the clause's band vs **the share yielding** | **0** — what the criteria promise, and what T59 actually measured |
| the clause's band vs **the guard binding** | **5312**, every one expanded — the conflation R16-S2-F1 found |
| `2·panelHeadH + 2·fileRowH` expanded / `4·panelHeadH` collapsed vs **the guard binding** | **0** — the guard's own closed form, now recorded beside the clause's |

The expanded halves differ because the list's 2-row floor sets `protectedList` throughout that
region, so the guard's boundary carries a row term; the collapsed halves coincide. Both are in
`spec.md` AC-18's marker.

**A FOURTH tester-facing carrier, not enumerated by the finding.** R16-S1-F1 named `test-plan.md`
`:90`, `:91` and `:167`. `:43` (AC-03's invariant row) carried the same class — «the two hard floors
bind (`headerMaxH` = 34, `listRows` = 2) … share 0.691 against 0.750» — all comfortable-only, stated
unqualified. Measured at `r = 110` expanded, `fileCount` 30: `headerMaxH` is **34 comfortable, 36
compact, 43 relaxed**, and at compact the guard does **not** bind; `listRows` **is** 2 in all three,
so that half was right. Corrected per-density.

**A NEW carrier of R16-L-F1's class that three reviewers and four waves missed, found by the
mechanical check rather than a sweep.** `DESIGN.md` §Density asserted that «`--row-h` and
`--file-row-h` **deliberately do not change**» and credited the pinning to `COMMIT_ROW_HEIGHT` and
`FILE_ROW_HEIGHT`. Both halves false: the tokens go **26 / 34 / 43** and **24 / 30 / 37** across the
three densities at 13 px, and `COMMIT_ROW_HEIGHT` = 34 is the *default* metric a test pins to
`computeMetrics`' comfortable output, not what the viewport uses elsewhere. Together they are the
belief that made the unreachable `{30, 30}` compact fixture plausible for fifteen rounds. Rewritten
to the real invariant: the token and `[itemSize]` move **together** because one function produces
both.

**Scope taken beyond the eleven findings, disclosed rather than slipped in.**
`ARCHITECTURE.md`'s row-height note («row heights are fixed by the density tokens in `styles.css`»)
carries the same belief and was filed as an observation twice — round-15 **O5**, round-16 **O11** —
never as a finding. It is two lines of the same family as the `DESIGN.md` carrier above, so it was
corrected with it rather than left for a seventeenth round. **This was the task's decision, not the
owner's routing**; revert it if the observation was meant to stay open.

**Counts are the loop's arithmetic now, not literals.** `test-plan.md:35`, `:99` and the
count-auditing block read `DENSITIES.length × heights.length × fileCounts.length × 2`, with «as the
suite stands: 288, 576 and 48» beside them. The block records why: T59 wrote 192 / 384 / 32
correctly and T61 falsified them **inside the same wave** by widening `DENSITIES`, and T59 runs
first by design, so no bullet in that wave could have caught it.

**The three shipped densities reach every measurement instruction.** Thirteen live sites corrected —
`spec.md` §6's measurement clause, `sad.md` §10 QG-1's *How verify*, its release-time measurements
and QG-3's *When*, and `test-plan.md` `:35`, `:38`, `:43` (×2), `:47`, `:90`, `:99`, `:116`, `:171`,
`:185`. `:171`'s manual run count goes **4 → 6**.

**Figure markers for T65: 19 placed, 1 hit unmarked.** The one is `DESIGN.md`'s
`fontSize: 0.875rem` inside a code block — a type-scale token, not a policy-derived figure, so it is
a detector false positive rather than a coverage gap.

<!-- coverage claim corrected 2026-09-10 (T71, review round 17 R17-F8): this read «Marker coverage of
derived figures is therefore **19 of 19**, and that is the number T65 inherits». Same defect as T65's
«45 of 45» and the same cause: it counted marker-carrying LINES as if they were figures, so a line
with one marker and several derived figures counted as fully covered. T65 did inherit the number, and
inherited the error with it. The measured quantity, with T70's definition, is
`unbound(line) = max(0, heuristic-visible figures in that line's prose − strict markers on that
line)`: **36 visible, 15 unbound** as the tree stands. Neither 19 nor 45 was a ratio of comparable
things. -->


**Registration: 476 / 0 on `tasks.json`, additive only, and the script is idempotent.** T62 disclosed
that its registration script double-appended to 66 entries with four duplicate ids; this one skips an
id already present, and running it twice leaves 66 both times. The first attempt used a JSON
round-trip and produced **54 lines of pure formatting churn** (every short array expanded); it was
reverted and redone as a textual insertion, so the 62 pre-existing entries are byte-identical.
Validated mechanically over all 66: parses, no duplicate id, no dangling dep, DFS finds no cycle, 66
task files, no id without a file, **0 `files_hint` mismatches**. `deps` agree across `tasks.json`,
`_epic.md` and `tracker.md` for T63–T66; `tracker.md` reads «Total: 66 tasks» and links this round's
record.

**No line-number citation of the epic anywhere this task writes** — `grep -n "_epic\.md:[0-9]"` over
its nine files returns 0. The invariant moved from `:227` to `:231` when the four registration rows
went in, exactly as it moved under T56 and T59, and that is now harmless: nothing addresses it by
number. The historical citations inside the round-14 and round-15 records are T66's.

**Gate.** `pnpm test` **841 passed (841), 63 files**; `pnpm lint` biome clean over **266 files**. The
Rust half is unchanged by the whole branch and is measured once at the end of the wave.

**DoD bullets that could not be satisfied as written: one, named.** The «no live artefact scopes a
measurement to two densities» bullet asks for `grep` to return 0 outside dated markers. It returns
two hits that are neither: `test-plan.md:91`'s «the two densities whose band reaches it», which is
this task's own new wording and is **true** (only comfortable and relaxed are inside the band at
`r = 110`), and `_epic.md`'s T54 registration row, which says «the 126 px figure carries both
densities» as an accurate description of what T54 delivered at the time — changing it would falsify
history. Neither is a live scope claim; the bullet's phrasing does not distinguish a scope claim from
a count of set members or from a past task's summary. The next wave's bullet should say «no live
artefact **scopes a measurement** to two densities».
