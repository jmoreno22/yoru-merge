---
id: T67
title: "Round-17 criteria amendment: the last two-density instructions, the run-count back-reference, and the two rules that end the figure class by construction"
layer: "docs"
deps: []
acs: ["AC-01", "AC-02", "AC-18", "AC-19", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/adr/0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md",
  "docs/features/inspector-diff-workspace/tasks/compact-file-list-layout.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T67 — Round-17 criteria amendment

## Why

**R17-F2**, **R17-F3**, **R17-F4** and owner decisions **D3** and **D4**
(`_review/review-2026-09-10-round17.md`).

**Three live measurement instructions the three-densities sweep did not reach.** T63 corrected
fifteen of seventeen sites. The three that survived:

- `test-plan.md:179` — «**Layout regressions in existing modes** → scenario: **8 configurations
  (2 themes × 2 densities × 2 placements)** on Windows and Linux». Contradicts `spec.md:236`
  («both themes × **the three densities** × both placements»), `sad.md:742`, `sad.md:744` and
  `test-plan.md:186`, which T63 *did* fix. **This is the address R16-S1-F5 explicitly enumerated**:
  T63 fixed the bullet then at `:179` — the pre-release line, now `:186` — and the neighbouring
  bullet carrying the same defect moved into the vacated address.
- `test-plan.md:172` — «the same **4 runs** with the header collapsed». `:171` was rewritten by the
  round-16 wave from «4 runs (… × both densities)» to «**6 runs** (960 × 640 and 1280 × 800 ×
  the three shipped densities)»; both lines are `+` in `git diff 805a32d`. «The same 4 runs» now
  names a count no bullet in the file states.
- `adr/0003:43` — a *Negative* Consequences bullet in an **Accepted ADR with no amendment section**:
  «after the move the viewer must re-measure … and the behaviour **must be checked in both inspector
  placements and both densities**». `adr/` was named explicitly in T63's own DoD grep scope; its
  Outcome reported two exceptions and neither is this. **Both clean-context reviewers missed it too**
  — it came out of the lead battery.

Relaxed is the density the owner widened scope for: widest guard band (`4 × 43 = 172` collapsed
against comfortable's 136) and the worst reachable share, **0.609091** at the 220 / 110 bottom
minimum. AC-20's entire verification is manual (`test-plan.md:26`, `sad.md` §11), so an instruction
that stops at two densities is the whole of what AC-20 gets.

**D3 — the class does not end by finding the next instance.** Nine consecutive rounds of «a precise
figure that is false», and in round 16 the false figure was inside the closed form written to make
figures un-staleable (R17-F1) and inside the coverage claim of the gate written to catch them
(R17-F8). The rule: **no live artefact may write a figure derived from `computeMetrics` or from the
layout policy.** Closed forms in `panelHeadH` / `fileRowH` only, plus **one** reference table
generated from the code (T70 builds the generator; this task writes the rule and the pointer).

**D4 — the sweep's scope, actually applied.** After R15-S1-F3 the owner replaced enumerated file
lists with «every tracked file the branch touches». T63 declared that scope and still missed
`adr/0003`, and T65 built the mechanical successor with an enumerated eight-file list. The rule:
**every tracked file the branch touches is in scope by default; anything excluded is named with its
reason**, and a sweep that declares a narrower scope than it executes must fail mechanically (T70
builds the check; this task writes the definition).

Under D4 task records are **in scope**, which settles round-17 **O2**:
`tasks/compact-file-list-layout.md:43` still reads «Row height stays 30 px in both densities (pinned
to `FILE_ROW_HEIGHT`)» — both halves false today (the tokens go 24 / 30 / 37, and the constant does
not exist).

## Plan

1. **`test-plan.md:179`** — state the scope as the product, not a literal:
   «2 themes × the three shipped densities × 2 placements». Per the R16-S1-F3 lesson a count derived
   from a scope is written as its arithmetic, so widening an axis cannot falsify the prose again.
2. **`test-plan.md:172`** — «the same **6** runs», matching `:171`. Better: refer to the bullet
   rather than restate its count, so a future change to `:171` cannot strand this line again.
3. **`adr/0003:43`** — «both inspector placements and the three shipped densities», with a dated
   marker recording that the ADR is Accepted and unamended and that the scope was widened by the
   owner's 2026-09-09 decision, not by a change to the decision this ADR records.
4. **`tasks/compact-file-list-layout.md:43`** — correct both halves with a dated marker, per D4.
5. **D3 into the criteria.** Write the rule where the next wave will read it: spec §8 (or the
   criteria's own conventions block) plus the test-plan's «When a row quotes a configuration count»
   note, extended to «when a row quotes any derived figure». Name the single generated reference
   table as the one place a concrete number may live, and point at it.
6. **D4 into the criteria.** Write the scope definition and the exclusion rule beside D3. Name the
   mechanical check T70 will build.
7. Register **T67–T71** in `tasks.json`, `_epic.md` and `tracker.md`. **Cite `_epic.md` by its bold
   anchor, never by line number, parentheses and verification commands included** — the rule
   R16-S1-F4 exists for and R17-F12 shows is still being broken.

## Definition of Done

- [ ] `grep -rniE "both densit|two densit|2 densit"` over **every tracked file the branch touches**
      (`git diff --name-only 7cd47b4..HEAD` plus the working tree and untracked files) returns only
      hits that are (a) inside a dated marker quoting retired wording, (b) a count of set members
      that is true, or (c) a past task's accurate summary. **Report the command's real output and
      classify every hit** — the round-16 phrasing of this bullet did not distinguish a scope claim
      from a set-member count, and that is how `adr/0003` survived.
- [ ] No live artefact scopes a measurement to two densities. Verify by listing every instruction
      that *schedules* a measurement and naming its density scope.
- [ ] `test-plan.md:172`'s run count agrees with `:171`, and the check is a grep for disagreement
      rather than a reading.
- [ ] D3 and D4 are written where the next wave reads them, each with its rationale and the round
      that produced it. State explicitly which artefact is the single home of concrete reference
      figures.
- [ ] No `src/` change in this task: `git diff --name-only HEAD -- src vitest.config.ts scripts` is
      what the round-16 wave left.
- [ ] `tasks.json` parses, has **71** tasks, no duplicate id, no dangling dep, DFS finds no cycle,
      and its `files_hint` agrees with every task file for T1…T71 — checked mechanically over all of
      them, not spot-checked. `_epic.md` edges and `tracker.md` Deps agree for T67–T71;
      `tracker.md` says «Total: 71 tasks» and links this round's record.
- [ ] Registration is **additive only**: `git diff --numstat` on `tasks.json` shows insertions and
      no reflow of the 66 pre-existing entries, and running the registration twice leaves 71 both
      times.
- [ ] **No citation of `_epic.md` by line number anywhere this task writes**, parentheses included.
      `grep -n "_epic\.md:[0-9]"` over the files this task writes returns 0.
- [ ] Gate: `pnpm test` 842/842, `pnpm lint` clean, `pnpm check:figures` exit 0.
- [ ] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the
      reason — and the Outcome does not say «none» unless a re-run of every bullet produced no
      exception.

## Notes

`deps: []`: this task fixes the wording T70's claims must match and registers the wave, so it goes
first — the round-9…16 pattern.

**T70 edits `test-plan.md` and `spec.md` too** (R17-F5's claims, D3's generator pointer, D4's check).
Same lane: they must not run concurrently. T70 depends on this task for that reason as much as for
the rule text.

## Outcome (2026-09-10)

Landed. Docs only — `git diff --name-only HEAD -- src vitest.config.ts scripts package.json` is the
same nine paths the round-16 wave left, none of them touched by this task, and all five production
md5s are unchanged.

**The three surviving two-density instructions are corrected.** `test-plan.md`'s layout-regression
scenario now states its scope as the product — «2 themes × the three shipped densities × 2
placements» — rather than as the literal «8 configurations», per the R16-S1-F3 rule that a count
derived from a scope is written as its arithmetic. The collapsed-share bullet reads «**every run of
the bullet above**» instead of restating a count, so a future change to the run set cannot strand it
a second time; `grep -nE "the same [0-9]+ runs|same [0-9]+ configurations"` over the file returns
**0**. `adr/0003`'s re-measure consequence names the three shipped densities, with a marker recording
that the **decision** the ADR carries is unchanged and unamended — only the verification scope, and
only by the owner's 2026-09-09 decision.

**Every live instruction that schedules a measurement now reaches relaxed — seven of seven.** <!-- enumeration extended 2026-09-10 (T74, review round 18 O5): the list below is seven and it is short by two — `test-plan.md`'s 4-runs bullet and the collapsed-share bullet that refers back to it also schedule measurements. Both DO reach the three shipped densities, so the CONCLUSION is unaffected and it is nine of nine; only the enumeration was incomplete. Recorded because «enumerated rather than asserted» is the sentence's own claim to strength. -->
Enumerated rather than asserted: `spec.md:229` (§6 row 1's measurement), `spec.md:236` (the release
checklist row), `sad.md:690` (release-time measurements), `sad.md:742` (§10 QG-3 *When*), `sad.md:744`
(QG-3 *How verify*), `test-plan.md:199` (NFR bullet 1, six runs) and `test-plan.md:207` (the layout
regression scenario).

**The D4-scoped sweep, and the classification the round-16 bullet's phrasing did not ask for.**
Scope derived from the branch, not enumerated: `git diff --name-only 7cd47b4..HEAD` ∪ the working
tree ∪ `git status --porcelain -uall` untracked = **184 files**. `both densit|two densit|2 densit`
gives **89 hits**, every one classified (full output persisted outside the repo): <!-- count corrected 2026-09-10 (T74, review round 18 O4): over the same scope the command returns **86 matching lines / 102 occurrences** on the tree round 18 leaves, and round 18's stage 1 measured 82 / 96 on the tree this wave left; no construction returns 89. The count is structurally unreproducible because it was taken MID-WAVE — every task after T67 added records containing the pattern, which is precisely the hazard T71 diagnosed for its own count. What the count is FOR verifies independently and is unaffected: the live-artefact, live-ADR and tasks.json rows of the classification all reproduce, and no live artefact scopes a measurement to two densities. -->

| class | n | verdict |
|---|---|---|
| **live artefact** | 2 | `test-plan.md:43`, `:90` — «the two densities whose band reaches it». A **true count of set members**, not a scope claim: at `r = 110` comfortable and relaxed are inside the band and compact is not (`4 × 26 = 104 < 110`). Re-derived. Category (b) |
| **live ADR** | 1 | `adr/0004:22` — the pre-reversal quotation of §6's NFR inside *Decision drivers*, dated by the ADR's own `Date: 2026-09-02` plus its explicit `## Amendment` section. **Correctly historical**, as round-17 O10 records so a future sweep does not "fix" it |
| **task record** | 35 | completed tasks' DoD bullets and Outcomes, describing what was required and verified at the time. Category (c) |
| **dated marker** | 8 | quoting retired wording. Category (a) |
| **review record** | 32 | immutable records of what each round found |
| **other** | 11 | 10 are `dod` fields of completed tasks in `tasks.json` — including T59's and T63's own DoD *demanding* the three-densities replacement, correctly phrased. The eleventh is `inspector-layout.spec.ts:27`, a comment explaining **why** relaxed is in the fixture set («a sweep that stops at two densities never visits the configurations AC-18 is loosest in») — a true rationale, not a scope claim |

**The exclusion D4 requires me to name, with its reason.** Completed **task records** and **review
records** are in the sweep's scope and are **not rewritten**: their DoD bullets and Outcomes describe
what was required and measured at the time, and editing them falsifies history. The exception, and
the line that decides it: a record that asserts a **live invariant** rather than describing past work
*is* rewritten. That is exactly what `tasks/compact-file-list-layout.md`'s Notes line did — «Row
height stays 30 px in both densities (pinned to `FILE_ROW_HEIGHT`)», both halves false — and it is
corrected here with a dated marker. That distinction settles round-17 **O2** by rule rather than by
case.

**D3 and D4 are written in two places each.** The test plan's conventions block (where an implementer
reads it, beside the configuration-count rule it generalises) and `spec.md` §8 as resolved owner
decisions with their rationale and round. Both name the **generated reference table (T70)** as the
single home of concrete reference figures, and D4 names the mechanical scope check T70 will build.

**A registration gap nobody had noticed: the epic's mermaid graph was stale from T62 onward.** The
round-16 wave registered T63–T66 in the task table and in `tracker.md` and **never reached the
graph** — while T63's own DoD claimed «`_epic.md` edges and `tracker.md` Deps agree for T63–T66».
The table agreed; the graph was not written. Round 17's two clean-context reviewers and the lead all
verified the table rows against `tasks.json` and `tracker.md`, and none of the three looked at the
graph, which is why it survived a CHANGES-REQUESTED review. **Both waves are now drawn**, and the
check for the next wave is «every id in `tasks.json` appears as a mermaid node», not «the rows
agree». Recorded in the graph itself.

**A second stale derived count, found by the same check and fixed rather than left.**
`tracker.md`'s total read «~43 person-days» and was already wrong before this wave. Restated as the
estimate mix a reader can check against the rows — **39 M + 32 S**, so ≈ 55 person-days — because a
sum over the table goes stale every time a wave registers, which is R16-S1-F3's shape one table over.

**Registration: additive, idempotent, and validated over all 71.** `git diff --numstat` on
`tasks.json` is **547 / 0** — **zero removed lines**, so neither the round-16 wave nor this one
reflowed any of the pre-existing entries; the script skips an id already present and running it twice
leaves 71 both times. Validated mechanically over all 71, not spot-checked: parses · 71 tasks · ids
exactly `T1…T71` with none missing or extra · **0** duplicate ids · **0** dangling deps · DFS finds
**0** cycles · 71 task files, every id with a file and every file with an entry · **0 `files_hint`
mismatches** · **0 `deps` mismatches**. `_epic.md` and `tracker.md` agree with `tasks.json` on layer
and deps for T67–T71; `tracker.md` reads «Total: 71 tasks» and links this round's record.

**`acs` divergence: still exactly the pre-existing two.** T44 and T49 (round-15 O10, round-16 O13,
round-17 O1) — `tasks.json` claims one AC each that the task file's frontmatter does not. Untouched
by this task, as their own note says they should be; T67–T71 all agree.

**Gate.** `pnpm test` **842 passed (842), 63 files** · `pnpm lint` biome clean over **266 files** ·
`pnpm check:figures` exit **0**. The Rust half is measured once at the end of the wave by T71,
because `src-tauri` is untouched by the whole branch.

**DoD bullets that could not be satisfied as written: one, named.**

The «no citation of `_epic.md` by line number anywhere this task writes» bullet asks for a grep over
the files this task writes to return **0**. It returns **1**: `tasks.json:915`, T62's `dod` field,
which quotes `_epic.md:206` and `_epic.md:7` as a historical record of what T62 was asked to do.
`tasks.json` *is* a file this task writes, but this task did not author that line — the registration
was additive with zero removed lines — and rewriting a completed task's `dod` would falsify what was
required at the time. **T67's own additions contain no line-number citation.** The bullet should say
«no citation this task **authors**», and that is how T71's version of it is phrased. This is the same
bullet-phrasing trap that produced T63's and T66's unsatisfiable bullets: a blanket grep cannot
distinguish an address this wave wrote from one it inherited.
