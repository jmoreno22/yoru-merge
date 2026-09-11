---
id: T49
title: "Round-11 records: the test-plan re-point and the files_hint drift T45 claimed it had closed"
layer: "docs"
deps: ["T47", "T48"]
acs: ["AC-02", "AC-03", "AC-04", "AC-18", "AC-19"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/round9-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round10-criteria-and-chain.md",
  "docs/features/inspector-diff-workspace/tasks/round10-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T49 — Round-11 records

## Why

`test-plan.md` is the AC → test map every review round reads as its baseline, and two of its rows
now describe a sweep and a criterion that T47 and T48 change. Separately, T45's DoD and Outcome both
claim an agreement between `tasks.json` and the task files that two of seven records do not have —
[review round 11, R11-S1-F3, plus O6, O7 and O9](../_review/review-2026-09-08-round11.md).

**The `files_hint` drift (R11-S1-F3).** Checked by parsing both records for all seven tasks of the
last two waves:

| task | task-file frontmatter | `tasks.json` |
|---|---|---|
| **T40** (`round9-code-fixes.md:8`) | `src/app/features/diff-viewer/diff-view.spec.ts` | `src/app/features/diff-workspace/diff-workspace.spec.ts` |
| **T45** (`round10-criteria-and-chain.md:6-13`) | omits `screens.md` and `ux-flows.md` | includes both |
| T41, T42, T43, T44, T46 | — | agree exactly |

Round 10's O7 was fixed on the machine side and left stale on the human side, so the two records now
disagree in the opposite direction to the observation. T45's own entry is worse: its Outcome reports
amending five lines across `screens.md` and `ux-flows.md` — the diff confirms all five — while its
own `files_hint` names neither. `files_hint` is the machine contract `implement` reads to build
lanes, and both waves were kept strictly serial precisely because two lanes cannot touch one file.

## What

- **Re-point §NFR validation's third bullet (R11-S2-F4)** — `test-plan.md:156` prescribes «3 runs
  (bottom; blame stacked; file history stacked) … ≥ the share the same window and density give with
  the inspector on the right». Quote T48's carve-out **verbatim**, and add the fourth run the miss
  lives in: the bottom minimum with **both** panels stacked and the header **collapsed**, whose
  expected result under the carve-out is the panel-head cap, not the ratio. Name the row T47 adds as
  its automated counterpart.
- **The sweep rows (R11-S2-F1)** — `:35` (AC-01) and `:96` (AC-02) state «168 configurations». After
  T47 the table has eight heights, so the count changes again; state the number T47 leaves, say which
  height watches which residue class (odd for the expanded half, `≡ 2, 3 (mod 4)` for the collapsed
  one) and stop describing the class as «≡ 0 (mod 4)», which is the expanded condition only. Add
  **T47** to the Task column of every row whose subject it changed.
- **The new rows (R11-S1-F2, R11-S2-F6)** — AC-04 gains the component row that pins the
  displayed-row-count wiring (filter matching nothing → bare-head cap, `--inspector-list-rows` 0) and
  AC-03 gains the one that pins the caller's clamp guard (`--inspector-clamp-lines` is 1 while the
  policy returns 0). Both rows exist only after T47; state what each asserts, not what it is about.
- **AC-19's cover (R11-S2-F2)** — `:90` names the fixed-basis row; extend it with what T47 adds (the
  declared basis and the absence of a growth utility class), and record the tier limit the review
  measured: with no stylesheet in jsdom a class-based grow is invisible to `getComputedStyle`, so the
  automated cover is the declared mechanism and the manual checklist keeps the rendered one.
- **Close the `files_hint` drift (R11-S1-F3)** — add `src/app/features/diff-workspace/diff-workspace.spec.ts`
  to `round9-code-fixes.md`'s `files_hint` (keeping the honest note at `:96`), and `screens.md` +
  `ux-flows.md` to `round10-criteria-and-chain.md`'s. Correct T45's DoD and Outcome sentences so they
  no longer claim an agreement that did not hold.
- **The remaining observations** — **O6** T44's title says «144 assertions» in four places
  (`round10-code-fixes.md:3`, `tasks.json` T44 `title`, `tracker.md:51`, `_epic.md`'s T44 row)
  <!-- address replaced by an anchor 2026-09-10 (T66, review round 16 R16-S1-F4): `:167` now points
  at the T12 row -->
  where the
  loop has 168, soon more; **O7** `test-plan.md:96` names T44 in an **AC-02** row while `tasks.json`
  T44 `acs` has no `AC-02`, and T44 touched `commit-inspector.spec.ts` without naming it in either
  `files_hint`; **O9** record that the sweep's empty branch ignores `headerCollapsed` (14 of its 28
  empty configurations are duplicates) and that the sibling loop at `:362-397` is 336 configurations,
  so a quoted count means one specific loop.

## Definition of Done

- [ ] `test-plan.md`'s third §NFR bullet quotes T48's carve-out verbatim and lists the fourth run.
- [ ] The sweep rows state the configuration count T47 leaves and which height watches which residue
      class; no row describes the residue class as «≡ 0 (mod 4)».
- [ ] Every row whose subject T47 changed names T47 in its Task column; the two new rows and AC-19's
      extension name a test that exists at HEAD and assert what the row says, spot-checked by opening
      each `file:line`.
      <!-- corrected 2026-09-08 (T52, review round 12 R12-S2-F5 / R12-S1-F2): this bullet was reported
      met and had one gap. T47's collapsed twin is an **AC-18** subject and was recorded only in the
      AC-03 row at `:43`; neither AC-18 row named T47, so `tasks.json` T47 `acs` carried an `AC-18` no
      row attributed — round-11 O7's own pattern, in the wave that closed O7 for T44. Worse for the
      chain: AC-18's only rows were a component row that does not measure the share and a manual row,
      so a reader tracing AC-18 to a test never reached the automated rows that pin its carve-out.
      T52 added an AC-18 unit row naming T40 / T47 / T51, which is that attribution. -->
- [ ] `files_hint` agrees between `tasks.json` and all task files for T40–T49; T45's DoD and Outcome
      no longer claim otherwise.
- [ ] `updated_at` moves to the day this lands in every artefact this task touches.
- [ ] No `src/` change in this task.

## Outcome (2026-09-08)

Landed after T47 and T48, so the counts and the carve-out wording are the ones that are now true.
Docs only — `git status --porcelain -- src src-tauri` shows nothing this task touched; `pnpm lint`
clean.

**The third §NFR bullet quotes T48 verbatim and gained a fourth run.** The three runs it prescribed
(bottom; blame stacked; file history stacked) never combined the bottom minimum with *both* panels
*and* a collapsed header, which is the only configuration where the cross-placement share is missed.
The fourth run is that case, with its expected result stated as a cap of one panel head and a share
of 0.691 comfortable / 0.727 compact — not the 0.750 the right-hand column gives — and it names the
collapsed twin T47 added as its automated counterpart.

**The sweep rows say 192, and say which height watches which formula.** `421` is odd, for the
expanded quotient `0.5h`; `422` is `≡ 2 (mod 4)`, for the collapsed `0.25h`. Both rows now state that
rounding half up on **either** path alone reddens them, which is the property the row is for — the
previous wording described the residue class as «≡ 0 (mod 4)», which is only the expanded condition.
Both name **T47** in the Task column, as do the AC-03 unit row and the AC-19 component row whose
subjects it changed.

**Three rows gained or extended.** AC-04 has the filter-matching-nothing component row, stated as
what it asserts — the bare-head cap and `--inspector-list-rows: 0` — and why the unit tier cannot
reach it. AC-03 has the collapsed-clamp row. AC-19's component row carries T47's mechanism half and,
explicitly, the tier limit that makes it the right assertion: with no stylesheet loaded, jsdom's
`getComputedStyle(el).flexGrow` reports the initial `0` for a class-based grow exactly as it does for
a fixed panel, so the declared mechanism is what is observable and the rendered one stays manual.

**A configuration count now says which loop it means.** A short note above §Test data records that
the share sweep is 192 (it fixes `fileListCollapsed: false`, because a collapsed list claims no share
by design) while the whole-pixel-cap row above it iterates that flag too and is 384 — and that the 32
empty configurations inside the share sweep assert an invariant independent of `headerCollapsed`, so
half of them are duplicates. Breadth is 192 rows of assertion, not 192 distinct behaviours (O9).

**The `files_hint` drift is closed, and the two records that claimed otherwise are corrected.**
`round9-code-fixes.md` names `diff-workspace/diff-workspace.spec.ts`; `round10-criteria-and-chain.md`
names `screens.md` and `ux-flows.md`, the two files its own Outcome reports amending. Both its DoD
bullet and its Outcome sentence — which asserted an agreement that two of seven records did not have
— now carry dated corrections rather than being quietly rewritten. Verified mechanically: `tasks.json`
and every task file of T40…T49 agree on `files_hint`, **0 mismatches**.

**O6 and O7.** «Restore the loop to 144 assertions» survived in four records as a current property
after the count had moved twice; T44's title and the two places that asserted it as fact now say
«a full assertion per configuration», and T44's What bullet records the sequence (144 asked → 168
landed → 192 after T47). The historical quotations of 144 in T44's Why and in its measured
`{ total: 144, … }` output are left as history, which is what they are. `tasks.json` T44 gained
`AC-02` (`test-plan.md`'s AC-02 sweep row names T44) and `commit-inspector.spec.ts`, the file its O9
title fix touched.

**Limit of the DoD's «open each named file», restated.** The coverage table names tests by intent,
not by path, so «the named test exists» still cannot be checked mechanically for the rows this wave
did not touch. The rows changed here were opened and read; the rest rest on round 11 stage 1's
mechanical trace, which walked all 22 ACs to a test. Recorded rather than claimed, as T46 did.

## Notes

`deps: [T47, T48]` is real: the sweep rows cannot state a truthful count before T47 lands, and the
NFR bullet quotes the wording T48 finalises.

The commit must carry `SDD-Task: T49` and its `SDD-AC` trailers (R9-S1-F9).
