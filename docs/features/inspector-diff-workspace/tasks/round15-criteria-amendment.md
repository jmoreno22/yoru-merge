---
id: T59
title: "Round-15 criteria amendment: the band as the guard's closed form, the unreachable fixture's figures, and the sweep's file list"
layer: "docs"
deps: []
acs: ["AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md",
  "DESIGN.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T59 — Round-15 criteria amendment

## Why

**R15-S1-F1, R15-S1-F2, R15-S1-F3, R15-S1-F4** and observations **O2**, **O3**, **O7**
(`_review/review-2026-09-09.md`). Four waves — rounds 12, 13 and 14 — spent themselves carrying one
carve-out sentence to every artefact that states the list-share guarantee, and made it byte-identical
at nine sites. Round 15 found that **the sentence itself is wrong**, in two independent ways, and that
the sweep which was supposed to find every carrier was still scoped to a hand-written list of nine
files.

**The band was derived from the fixtures, not from the generator.** The sentence named
«68 px comfortable / 60 px compact expanded, 136 / 120 collapsed». Those four figures are the guard's
closed form evaluated at the two spec fixtures. But `panelHeadH = Math.round(uiFontSize × 1.15 + 19 ×
padScale)` (`appearance-metrics.ts:78-98`), and the app ships **three** densities
(`preferences-schema.ts:214`) × `uiFontSize` 11…17 (`:234-235`) = **21 reachable pairs**, over which
the collapsed band runs **96…192 px**. **688** reachable integer columns miss their floor at a
remainder at or above the figure the sentence gave their density, in 12 of the 21 pairs, worst
**0.647059** (relaxed / 17 px, column 272). The comfortable half fails at fonts 14–17 without changing
density.

**The compact half of every scoped figure came from a token pair the app cannot produce.**
`COMPACT_TOKENS = { fileRowH: 30, panelHeadH: 30 }` matches none of the 21 pairs — compact at the
default 13 px is **24 / 26**. Two consequences in the criteria: AC-20's only verification row asked a
release engineer to measure «30 px and 30 px» where the app renders 26 and 24, and the share
**0.727273** cited in two markers — both written by T56 in the round-14 wave — is false, because real
compact in that configuration gives **0.754545** and **meets** the floor.

**`DESIGN.md` was in no sweep's file list**, and it is the document `_epic.md`'s **Risks / Hard
rules** list and `ARCHITECTURE.md` both call canonical.
<!-- addresses replaced by anchors 2026-09-10 (T66, review round 16 R16-S1-F4): the line number
this sentence used to give now points at a later wave's registration row --> It stated the guarantee bare twice (`:347-349`, `:401`),
mis-stated what the cap guard does (`:353-354`), and still described the cap as «rounded to whole
pixels» — the fourth carrier of a class T58 had just enumerated as three. `adr/` was outside every
sweep too.

## What this task does

1. **The band becomes the guard's own closed form**, at all sites, byte-identical.
2. **The three shipped densities** replace «both densities» wherever the criteria scope a measurement.
3. **The unreachable fixture's figures leave the criteria**: AC-20's row, `screens.md:23`, `:345`, the
   two `0.727273` markers, and `spec.md:198`'s fixture-derived bounds clause.
4. **`DESIGN.md` and ADR-0004** state the exception.
5. **The sweep is re-scoped** to every tracked file the branch touches, and re-run under that scope.
6. **T59–T62 are registered.**

## Definition of Done

- [x] The canonical sentence is **one distinct value** at every artefact site, extracted by regex off
      disk and compared as byte strings — not eyeballed — and the new value is reported with its
      length and md5.
- [x] **The band is verified, not asserted.** Sweep the shipped policy over all 21 reachable
      (density, `uiFontSize`) pairs × both collapse states × a remainder grid finer than 1 px, and
      report the number of points at which the sentence's predicate disagrees with the measured guard.
      It must be **0**. State the point count.
- [x] Every figure this task writes is derived from `computeMetrics`, and the derivation is stated:
      the three default-font token pairs, the compact counter-example, and the worst reachable share.
- [x] **The sweep runs over every tracked file the branch touches** — `git diff --name-only
      7cd47b4..HEAD`, `git diff --name-only HEAD` and `git ls-files --others --exclude-standard`,
      unioned — by **meaning** and not by a phrase list, and every hit is classified. Report the file
      count and the class counts, and name every BARE hit that is a live criterion.
- [x] `DESIGN.md:345`, `:347-349`, `:353-354`, `:401` and `adr/0004:58-59`, `:71` are corrected.
- [x] AC-20's row names no fixed pixel figure that a density cannot produce.
- [x] `tasks.json` has 62 tasks, parses, no duplicate id, no dangling dep, DFS finds no cycle, and its
      `files_hint` agrees with every task file for T1…T62 (0 mismatches, checked mechanically over all
      62). `_epic.md` edges and `tracker.md` Deps agree for T59–T62; `tracker.md` says «Total: 62
      tasks» and links this round's record.
- [x] No `src/` change in this task.
- [x] Any DoD bullet that cannot be satisfied as written — including one whose grep still hits because
      the retired wording survives inside its own marker — is **named in the Outcome** with the reason.

## Notes

`deps: []`: this task writes the wording T61's figures and T62's records must match, and it registers
the wave, so it goes first — the round-9…14 pattern.

`_epic.md` is edited for two reasons (the T59–T62 registration and the `:7` goal line stays as T56 left
it). Do them in one pass. **Cite the invariant by its bold anchor, not by line number** — R15-S2-F2 is
on this branch precisely because T56 wrote `:206` and its own insertion moved the line.

## Outcome (2026-09-09)

Landed. Docs only: `git diff --stat 805a32d -- src src-tauri` is unchanged by this task (still the six
files / +454 / −31 T57 left).

**The band is now the guard, and it is exact.** The sentence reads «a remainder under twice
`--panel-head-h` with the header expanded, or under four times it collapsed». Verified rather than
argued: the shipped policy swept over all **21** reachable (density, `uiFontSize`) pairs × both
collapse states × remainders 1…1200 in 0.25 px steps — **201 474 points, 0 mismatches** between the
sentence's predicate and the measured guard. The old four figures are that same closed form at the two
fixtures only (`4 × 34 − 1 = 135` → «under 136»), which is why they were right for comfortable at
13 px and wrong everywhere above it.

**One distinct value at ten sites, not nine.** 300 characters, md5
`c9c64c1ea1332557710af4baacbda9a5`, extracted by regex and compared as strings: `spec.md:101`
(**AC-02, new**), `spec.md:198` (AC-18), `spec.md:231` (§6 row 3), `sad.md:21` (§1 QG-1),
`sad.md:380` (§6 F2), `sad.md:733` (§10 QG-1), `ux-flows.md:179`, `screens.md:343`,
`test-plan.md:91`, `test-plan.md:167`.

**The tenth site is what the widened sweep bought, and it is a criterion.** **AC-02** —
«**Then** … the commit file list takes at least three quarters of the inspector height» — carries the
collapsed 75 % claim with **no placement scope and no exception**, and unlike the expanded 50 % band
the collapsed one is reachable. It was in none of the four waves that carved AC-18, spec §6 row 3,
§10 QG-1, §6 F2, the test plan, the screen manifest, the UX flows and §1 QG-1, because it carries none
of the phrasings any of those sweeps enumerated: not «share», not «never less», not «keeps at least
the share». A sweep by meaning over the branch's own files finds it in one pass. This is the fifth
consecutive round of the class and the first time the miss is the acceptance criterion itself.

**The sweep, re-scoped and re-run.** `git diff --name-only 7cd47b4..HEAD` ∪ `git diff --name-only
HEAD` ∪ `git ls-files --others --exclude-standard` = **167 tracked files as measured on 2026-09-09** (the union is 171 on 2026-09-10; the four
added are this wave's own task files), against T56's hand-written nine.
<!-- date added 2026-09-10 (T63, review round 16 O1): a file count is a figure like any other
and goes stale on the next commit, so it now says when it was taken --> Fourteen meaning-level patterns, classified: **12 CARVED**, **12 ROW-FLOOR** (`never falls below
2 rows` — a different guarantee the policy never breaks), **10 TEST** (a spec asserting, not an
artefact promising), **64 HISTORICAL** (63 in `_review/` and `tasks/round*`, whose job is to quote
retired wording, plus `CHANGELOG.md:78` in a published release's notes), and **53 BARE**. Of the 53,
the ones that are live criteria were fixed by this task; the remainder are the **expanded** 50 %
statements, whose band is unreachable — re-derived over all 21 pairs, the largest expanded band is
95 px at relaxed / 17 px and the smallest reachable remainder is 110 px at the 220 px bottom minimum
with both panels stacked, so the expanded guarantee is true as written everywhere the app can go. The
full classification is reproducible: the sweep script and its `sweep-r15.txt` output are in the round's
evidence directory.

**The fixture's figures are out of the criteria.** AC-20's row now says to measure `--panel-head-h`
and `--file-row-h` as `computeMetrics` derives them for the active font, and gives the three
default-font pairs (26 / 24 compact, 34 / 30 comfortable, 43 / 37 relaxed) as a reference rather than
as the expected constant. `screens.md:23` no longer pins `--file-row-h` to `FILE_ROW_HEIGHT`, a
constant that does not exist in the repo; `screens.md:345` no longer gives 30 px for both. The two
`0.727273` markers (`sad.md:21`, `_epic.md`'s `List floor` invariant) now give the reachable compact
counter-example, **0.741667 at compact / 17 px, column 240**, and say where the old figure came from.
`spec.md:198`'s «measured bounds» clause carries the closed form instead of the four fixture values.

**A correction to the review record, made here rather than left for round 16.** The record says the
false `0.727273` appears in «four markers». Measured, it appears in **two** — `sad.md:21` and the
`_epic.md` `List floor` invariant, both written by T56 in the round-14 wave. What `spec.md:198` and
`spec.md:231` carry is the *fixture-derived bounds* (`r ≤ 59` / `r ≤ 119` compact), a different wrong
figure from the same cause; both are corrected. Four sites, two distinct defects, not four copies of
one.

**`DESIGN.md`, all four lines.** `:345` «floored to whole pixels» with the reason and the round-10
citation; `:347-349` states the one exception in the same terms as the criteria and gives the
reachable counter-example; `:353-354` now says what *can* push the list under its share; `:401`'s
table row scopes itself to the column left by the stacked panels and points at §Density.
**ADR-0004** `:58-59` and `:71` take the 47-character pointer, per the owner's decision — the ADR is
Accepted and part of the chain, and leaving it as the one carrier that refers rather than states was
a decision the next sweep would have had to take again.

**Registration.** `tasks.json` parses, **62 tasks**, 0 duplicate ids, 0 dangling deps, DFS finds no
cycle; 62 task files, no id without a file, **0 `files_hint` mismatches over all 62**. `T59 → T60`,
`T59 → T61`, `T60 → T62`, `T61 → T62` mirrored in `_epic.md` and `tracker.md`, which reads «Total: 62
tasks» and links the round-15 record. The invariant in `_epic.md` is cited by its **bold anchor**
(`**List floor**`), not by line number.

**DoD bullets that could not be satisfied as written: none.** The two that could have tripped are
written against artefact anchors and against `805a32d` rather than `HEAD`, for the reasons R14-S2-F1
and R15-S2-F2 exist.
