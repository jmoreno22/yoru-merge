---
id: T69
title: "Round-17 test coverage: a witness for the collapsed header's own height, and one for the stacked-panels sum the consumer measures"
layer: "domain"
deps: ["T68"]
acs: ["AC-02", "AC-19"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T69 — Round-17 test coverage

## Why

**R17-F10** and **R17-F11** (`_review/review-2026-09-10-round17.md`), from stage 2's 48-mutation
battery — 40 redden, 8 stay green, and these are the two greens that are real holes rather than
equivalent mutants or boundary gaps.

### R17-F10 — the collapsed header's own height is unobserved

`inspector-layout.ts:103`:

```ts
const headerHeight = headerCollapsed ? panelHeadH : headerFixedH + clampLines * lineH;
```

Mutating the collapsed arm to `0` leaves the suite at **842 / 842 green**. It is not an equivalent
mutant: `listHeight = remainder − Math.min(headerHeight, headerMaxH) − panelHeadH`, and because
`headerMaxH ≥ panelHeadH` always, `Math.min(panelHeadH, cap)` is `panelHeadH`, so the mutation hands
the list a whole panel head of extra height. Measured:

- **400** configurations of stage 2's fixture space differ in `listRows`.
- **30 of the 576** in the suite's own T29 table differ (lead re-measurement), including
  **compact at the 220 / 110 carve-out remainder** — real **2** rows, mutated **3** — and
  `comfortable h = 200, files ≥ 6` (4 vs 5) and `comfortable h = 300, files 30` (7 vs 8).

`listRows` under a collapsed header is **AC-02's only observable** («collapsing the header hands the
released height to the file list»), and it is the term the round-16 wave rewrote the surrounding rows
around: the twin at `:401` asserts caps and shares under collapse and never a row count. Every other
term of the policy has an assertion. This is the one that does not.

### R17-F11 — the consumer half of AC-19 is unwitnessed

`commit-inspector.ts:570-573`:

```ts
let stackedPanelsHeight = 0;
for (const panel of column.querySelectorAll(STACKED_PANELS)) {
  stackedPanelsHeight += panel.getBoundingClientRect().height;
}
```

Neutering the sum leaves **842 / 842 green**. `commit-inspector.spec.ts` never renders a stacked
panel inside the inspector column, and both of that file's own policy calls pass
`stackedPanelsHeight: 0` (`:468`, `:573`).

The «fixed 110 px» remainder that **AC-18's carve-out band**, T51's collapsed twin and the fourth
manual run are all derived from comes from exactly this loop. `main-content.spec.ts`'s AC-19 rows pin
the flex *bases*; battery mutation `L22` pins the *policy* side (`remainder = availableHeight −
stackedPanelsHeight`); **nothing joins them.** If the inspector stopped subtracting the stacked
panels it would size against the full column and the list would overflow its box at every window
size, with the suite green.

Stage 2 confirmed it is constructible: the suite already stubs rects (`observer.resize`,
`more.getBoundingClientRect`).

## Plan

1. **F10 — the collapsed row-count witness**, in `inspector-layout.spec.ts`, in the AC-02 describe.
   Pick a configuration where the mutation actually changes `listRows` — `compact` at the
   220 / 110 carve-out remainder is the right one, because it is the configuration the whole branch
   is built around and it is the density where the collapsed states diverge. Assert the row count,
   and assert it **as a property as well as a figure** so a policy change fails it rather than only
   the fixture: the collapsed header costs the list exactly one panel head against a header charged
   nothing.
2. **F11 — the stacked-panels witness**, in `commit-inspector.spec.ts`, component tier
   (`// @vitest-environment jsdom`). Render a stacked panel inside the inspector column with a
   stubbed rect and assert that what reaches the policy is the column height **minus** that panel's
   height — observable through the written `--inspector-*` variables, which is the consumer's real
   output. Two panels summing to the branch's canonical 110 px would tie it to the figure every
   artefact quotes.
3. **RED first, both.** These pin behaviour that is already correct, so a classic red is impossible
   and the mutation **is** the red: apply it, log it, quote the failing line, restore it, re-verify
   the md5. Say that plainly rather than dressing it as a red-then-green cycle.

## Definition of Done

- [ ] **F10's row reddens under the mutation** `headerHeight = headerCollapsed ? 0 : …` and passes
      restored. Log the mutation before applying it, quote the first failing assertion, restore, and
      re-verify `md5sum src/app/core/services/inspector-layout.ts` =
      `f10fa099c0981638022f412395001db6`.
- [ ] **F11's row reddens** when the `stackedPanelsHeight` accumulation is neutered and passes
      restored. Same discipline; `commit-inspector.ts` md5 back to
      `44f017a4c415d7a1c001f7e0362d6a9c`.
- [ ] Neither row is satisfied by a premise. State, for each, **which assertion is the detector** and
      which lines are only setup — the round-16 **O7** lesson.
- [ ] F10's assertion is per-density or explicitly justified as single-density with the reason. If a
      map is used, it carries a size assertion against `DENSITIES.length` and throws on a missing key
      (the T64 **O6** pattern), so a fourth density fails loudly instead of being skipped.
- [ ] **No production change.** All five production md5s unchanged; `git diff --name-only HEAD --
      src` lists only the two spec files.
- [ ] **Re-run the two mutations that were green before this task and confirm both now redden**, with
      the full-suite failed/passed counts. That is the whole point of the task and the only proof it
      landed.
- [ ] Gate: `pnpm test` green with the new count stated (842 + the rows added), `pnpm lint` clean,
      `pnpm check:figures` exit 0.
- [ ] Any figure written into a comment or a test title is **re-derived by this task** and pasted.
      Per **D3** no derived figure may be written into a live artefact; a spec file's assertion is
      the figure's home, so the assertion may carry it — a *comment* may not restate it.
- [ ] Any DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Notes

Depends on **T68** because both tasks edit `inspector-layout.spec.ts` — same lane, no concurrent
edits.

**Do not chase the other six green mutations here.** Round-17 **O4** and **O5** record them: `C7`
(the `applyLayout` write dedup) is green and **is not a hole** — the dedup has no observable effect,
so a test for it would assert nothing. `C2` / `C3` (`measureBody`'s one-pixel slack), `C5`
(`bodyLines` rounding), `C6` (`headerFixedH`'s body subtraction) and `C8` (the action-count clamp)
are genuine but low-severity boundary gaps, all in `commit-inspector.ts`, and all cheap to close
inside the existing `measureBodyAs` / `measureSummaryAs` helpers. If they come for free while
building F11's fixture, take them and say so; do not widen the task for them.
## Outcome (2026-09-10)

Landed. Two rows, in the two files the hint names, **no production change**. All five production md5s
are the values they had on entry, verified after every mutation was restored:

```
f10fa099c0981638022f412395001db6  inspector-layout.ts
f50d48f3108168abaf083311f6815eba  appearance-metrics.ts
44f017a4c415d7a1c001f7e0362d6a9c  commit-inspector.ts
720244ba837d5fa7229ea935bb6d4704  main-content.ts
d1fbdf2ef79301507843b0053f8b6586  main-content.html
```

**Both rows are regression pins, so a classic RED is impossible and the mutation IS the red.** That
is stated rather than dressed up as a red-then-green cycle that did not happen: both rows pass on the
first run against the correct tree, because the behaviour they pin is already right. What was missing
was the observation. Each mutation was logged before it was applied, applied with Python
(`newline=''` — never `sed -i`), run against the **full suite**, then restored from a pristine copy
taken before the battery and md5-verified.

### The mutation table

| label | mutation | result | first failing assertion |
|---|---|---|---|
| baseline | — | **844 passed (844), 63 files** | — |
| **M-F10** | `inspector-layout.ts:103` `headerCollapsed ? panelHeadH :` → `headerCollapsed ? 0 :` | **1 failed / 843 passed (844)** | `expected { ph: 34, remainder: 300, rows: 8 } to deeply equal { ph: 34, remainder: 300, rows: 7 }` |
| **M-F11** | `commit-inspector.ts:571` `stackedPanelsHeight += panel.getBoundingClientRect().height;` → `+= 0 * panel.getBoundingClientRect().height;` | **1 failed / 843 passed (844)** | `expected '6' to be '2'` |

Both were **842 / 842 green** before this task (stage 2's battery, R17-F10 and R17-F11). Both now
redden, each reddening **exactly one row — its own**, which is the only proof the task landed.
M-F10 was run twice: once with the F10 row alone in the tree (1 failed / 842 passed of 843) and again
at the final tree with both rows present (the row above). The figures agree.

M-F11's form is chosen so the loop still runs and `panel` stays used — the accumulation is neutered
without deleting the statement, which keeps `tsc` and biome silent and makes the run measure the sum
rather than a compile error.

Restores verified: `inspector-layout.ts` back to `f10fa099c0981638022f412395001db6`,
`commit-inspector.ts` back to `44f017a4c415d7a1c001f7e0362d6a9c`, both from
`C:\wt\reports-r17\pristine-laneA` copies taken before the first mutation.

### F10 — the collapsed header's own height, `inspector-layout.spec.ts`

Added beside the two existing collapsed AC-02 rows (the 75 % floor at comfortable and at compact),
which is where the criterion already lives.

**Which assertion is the detector, and which lines are only setup.** The row asserts twice per cell:
the **figure** (`listRows` against the density's entry in `EXPECTED`) and the **property**
(`listRows === Math.max(2, Math.floor((remainder − 2 × panelHeadH) / fileRowH))`). Both are
detectors, and under M-F10 both fire in every density at the 300 px remainder. `EXPECTED.size` and
the `throw` on a missing key are **guards, not coverage** — they fail when a fourth density is added
without an expectation, which is the T64 **O6** pattern, and they detect no policy change. The
`bodyLines: 12` argument is **premise**: `headerCollapsed: true` zeroes the clamp through the
policy's own branch, so its value cannot be observed here.

**Why the property is a closed form and not a second figure.** Under collapse
`headerMaxH = floor(max(allowance, panelHeadH)) ≥ panelHeadH`, so
`Math.min(headerHeight, headerMaxH)` is `panelHeadH` exactly — the collapsed header is charged its own
head and nothing more. The list then pays its own head out of what is left, so
`listHeight = remainder − 2 × panelHeadH` and the rows are that over `fileRowH`, floored, held at the
2-row floor. That is the form the row asserts, so a policy change fails it rather than only the
fixture.

**Per-density, and every arm a detector.** The DoD allows a justified single density; this row is
per-density instead, which needed a second remainder. Re-derived in this run against the shipped
modules (comfortable / compact / relaxed at `uiFontSize` 13, `panelHeadH` 34 / 26 / 43,
`fileRowH` 30 / 24 / 37):

| remainder | density | `protectedList` | allowance | cap | `listHeight` | rows | rows with M-F10 | separates |
|---|---|---|---|---|---|---|---|---|
| 220 − 110 = **110** | comfortable | max(94, 82.5) = 94 | 16 | 34 | 110 − 34 − 34 = 42 | **2** | 2 | no |
| | compact | max(74, 82.5) = 82.5 | 27.5 | 27 | 110 − 26 − 26 = 58 | **2** | **3** | **yes** |
| | relaxed | max(117, 82.5) = 117 | −7 | 43 | 110 − 43 − 43 = 24 | **2** | 2 | no |
| 300 − 0 = **300** | comfortable | max(94, 225) = 225 | 75 | 75 | 300 − 34 − 34 = 232 | **7** | **8** | **yes** |
| | compact | max(74, 225) = 225 | 75 | 75 | 300 − 26 − 26 = 248 | **10** | **11** | **yes** |
| | relaxed | max(117, 225) = 225 | 75 | 75 | 300 − 43 − 43 = 214 | **5** | **6** | **yes** |

At the carve-out remainder **only compact separates the mutant**: the list's 2-row floor pins
comfortable and relaxed at 2 rows whether the head is charged or not, so a row written at 110 px
alone would have been a single-density detector wearing a three-density loop. The 300 px remainder
separates in all three. The carve-out remainder is kept because it is the configuration the branch is
built around — and the comfortable / 300 cell reproduces the review's own re-measurement of the T29
table («`comfortable h = 300, files 30` — 7 vs 8») exactly, which is the cross-check that the fixture
and the finding are describing the same behaviour.

The six cells in the row (3 densities × 2 remainders), and the 12 assertions plus the size guard
over them, were derived by importing the shipped modules in a throwaway script outside the repo —
not copied from the task file or the review record.

### F11 — the stacked-panels sum, `commit-inspector.spec.ts`

A new `describe('CommitInspector stacked panels (AC-19)')` with one row, placed after the AC-05
file-list-collapse describe: both concern how the column's height budget is spent.

**Which assertion is the detector, and which lines are only setup.** The detectors are the four
assertions on the written custom properties: `--inspector-list-rows` and `--inspector-header-max-h`
must equal what the policy returns for `availableHeight − (blame + file history)`, and must **not**
equal what it returns for the whole column. `expect(minusPanels).not.toEqual(wholeColumn)` is
**premise, not coverage** — without it the row could pass against a policy that ignored its
`stackedPanelsHeight` argument entirely, because the two expectations would then be the same number;
it detects nothing about the consumer. The `mount()`, `stackPanelIn` and `observer.resize` calls are
**setup**.

**The fixture is the real split, not a round number.** `BOTTOM_MIN_H` is `main-content.ts`'s
`MIN_BOTTOM_PX` (220) and the two panel heights are its `blameFlex` `0 0 30%` and `fileHistoryFlex`
`0 0 20%` — the values both panels take when both are open. 66 + 44 leaves the remainder AC-18's
carve-out band, T51's collapsed twin and the fourth manual run are all measured at, which is what
ties the consumer row to the figure every artefact quotes.

**Nothing is pinned; the expectation is derived from the policy.** The row's job is to prove *which*
height reached it, so both expected values come from `computeInspectorLayout` — the idiom the
neighbouring rows already use (`:567`, and the collapsed-clamp row). Measured in this run at the
default density: with the panels subtracted the policy returns `listRows` **2** and `headerMaxH`
**34**; against the whole column, **6** and **110**. That gap of four rows and 76 px is what M-F11
walks into — `expected '6' to be '2'` is the first assertion to fire, and it is a detector, not the
premise.

**Constructible as stage 2 predicted.** `applyLayout` finds the panels with a plain
`querySelectorAll(STACKED_PANELS)` over the column, so a `stackPanelIn` helper that creates an element
carrying the production selector's tag and stubs its `getBoundingClientRect` is enough; the layout
pass is retriggered with the `observer.resize(column, …)` + `TestBed.tick()` pattern the body-less
commit row already uses. No production selector, component or template was touched.

### The six other green mutations

Not chased, per the task's note. **C7** (the `applyLayout` write dedup) is green and is **not** a
hole — the dedup has no observable effect, so a test for it would assert nothing. **C2 / C3**
(`measureBody`'s one-pixel slack), **C5** (`bodyLines` rounding), **C6** (`headerFixedH`'s body
subtraction) and **C8** (the action-count clamp) are genuine low-severity boundary gaps. **None of
them came for free while building F11's fixture** — F11 uses a body-less commit, so it never touches
`measureBodyAs` or `measureSummaryAs` — so none was taken, and the task was not widened for them.
Round-17 **O4** / **O5** still record them.

### Gate

- `pnpm test` → **844 passed (844), 63 files**. 842 on entry, **+1** for F10 and **+1** for F11.
- `pnpm lint` (biome) → **clean, 266 files, no fixes applied**. No formatter was run over the tree.
- `pnpm check:figures` → exit **0**. On the tree this wave delivered the run prints
  `figures: 23 markers in 3 file(s), 10 distinct claims, 45 values recomputed` and
  `coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer
  markers than figures` — there is no `unmarked` line.
<!-- gate bullet restated 2026-09-10 (T74, review round 18 R18-F7): this read «`23 markers, 45 values
checked, 1 unmarked` — `DESIGN.md:73`, the known heuristic false positive». Exit 0 was and is true; the
parenthetical was not. `1 unmarked` is the exact figure **R17-F8** named as false — it counted 45 VALUES
against 1 LINE and exempted a marker-carrying line entirely — and **T70 deleted that output line in the
same wave this bullet was written in**, replacing it with the defined coverage pair. So the bullet quoted
a gate output the tree it delivered could not produce, which is R17-F12's class one round later. The
figures above are what the command printed on the tree this wave left. -->
- `npx tsc --noEmit -p tsconfig.spec.json` → exit **0**. Run because biome does not typecheck and
  both rows add new fixture code.
- **The Rust half was skipped deliberately**: `src-tauri` is byte-identical to the base across the
  whole branch and this task adds two TypeScript rows, so `cargo` could not observe it. T71 measures
  it once at the end of the wave.

### DoD bullets that could not be satisfied as written: two, named

1. «`git diff --name-only HEAD -- src` lists only the two spec files.» It lists **seven**:
   `inspector-layout.spec.ts`, `inspector-layout.ts`, `commit-inspector.spec.ts`,
   `commit-inspector.ts`, `diff-workspace.spec.ts`, `main-content.spec.ts`, `main-content.ts`. That is
   the **pre-existing uncommitted T40–T67 patch** against `805a32d`, which this worktree carries by
   design — the bullet's command cannot separate this task's change from the branch's working patch,
   because nothing in the wave is committed. What it was asking for is proven the other way instead,
   and more strictly: **all five production md5s are byte-identical to their entry values**, checked
   after every restore, so no production file changed in this task. The two files this task edited are
   `src/app/core/services/inspector-layout.spec.ts` and
   `src/app/features/commit-inspector/commit-inspector.spec.ts`.
2. «F10's assertion is per-density **or** explicitly justified as single-density with the reason.»
   Satisfied on the per-density branch, but **only by adding a second remainder** the plan did not
   name. At the 220 / 110 carve-out remainder the plan prescribes, two of the three densities do not
   separate the mutant at all (the 2-row floor pins them), so a three-density loop there would have
   been decoration in two arms — the **O7** failure mode, one round after it was recorded. The 300 px
   remainder was added so every arm is a real detector; the carve-out remainder is kept for the reason
   the plan gives. Disclosed here rather than presented as the plan executed verbatim.

### Scope note

`commit-inspector.spec.ts` is already in this task's `files_hint`, so no hint amendment was needed.
Nothing outside the two rows, the `stackPanelIn` helper and the three fixture constants was touched:
no existing row was reformatted, renamed or "improved", and T68’s correction further down the same file is
untouched by this task.
