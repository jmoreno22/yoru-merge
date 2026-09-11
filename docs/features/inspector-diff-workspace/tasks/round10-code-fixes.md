---
id: T44
title: "Round-10 code fixes: floor the header cap, restore a full assertion per configuration, pin the fixed flex bases"
layer: "domain"
deps: ["T45"]
acs: ["AC-01", "AC-03", "AC-04", "AC-05", "AC-19"]
files_hint: [
  "src/app/core/services/inspector-layout.ts",
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T44 — Round-10 code fixes

## Why

Three defects of the same family as the ones rounds 6–9 spent four rounds removing: a live
guard, or a live invariant, that the suite cannot see — [review round 10, R10-S1-F8, R10-S2-F1,
R10-S2-F2](../_review/review-2026-09-08-round10.md).

**The fixed flex bases are unpinned (R10-S1-F8).** `main-content.ts:270-276` freezes blame and
file history on a fixed basis (`0 0 30%` / `0 0 37.5%` and `0 0 20%` / `0 0 28.6%`) so that a
stacked panel cannot take a cut of what the commit inspector releases. That is the whole of
AC-19, and it is the reason the owner corrected AC-05 to «left empty» unconditionally in round 9.
Measured by stage 1 and reproduced by the lead, each on a tree verified clean before and after:

```
main-content.ts:270-271  blameFlex '0 0 30%' / '0 0 37.5%' → '1 1 30%' / '1 1 37.5%'
  → 63 files / 834 passed
```

`growingChildren()` (`main-content.spec.ts:199-206`) filters on the `flex-1` **class** while the
panels set `[style.flex]` (`main-content.html:137`, `:151`), so the four
`growingChildren(...) === [inspectorBlock(...)]` assertions cannot reach them — and none of those
rows opens blame or file history in the first place. AC-19's only automated cover
(`test-plan.md:89`) subtracts a stacked height the caller supplies; it never checks that the
caller's panels are fixed.

**The 144-configuration loop asserts 120 (R10-S2-F1).** T40's `nothingToDraw` exemption
(`inspector-layout.spec.ts:413`, `:427`) switches off exactly the 24 configurations that exercise
the arm T40 added. Measured outside vitest against the shipped policy, and reproduced by the lead
at 12 of 72 per token set:

```
{ total: 144, share_below_floor: 24, nothingToDraw_true: 24, oldHatch_actually_needed: 0 }
```

The broadest row in the suite now says nothing about the new arm; its only cover anywhere is the
single 640 px row at `:124-152` (header expanded, comfortable tokens only).

**`Math.round` takes the half pixel from the list (R10-S2-F2).** `inspector-layout.ts:80` rounds a
`.5` cap **up**, so the protected share lands just under its floor for most column heights:

```
h = 189  headerMaxH = 95   share = 0.497354      h = 200  headerMaxH = 100  share = 0.500000
h = 421  headerMaxH = 211  share = 0.498812      h = 420  headerMaxH = 210  share = 0.500000
h = 701  headerMaxH = 351  share = 0.499287      h = 700  headerMaxH = 350  share = 0.500000
```

Sweeping 40…1000 px with 30 files: **434 heights miss the 0.5 floor expanded** (all odd, from 189)
and **312 miss 0.75 collapsed** (from 378 — `round(0.25h)` rounds up for `h ≡ 2, 3 (mod 4)`, i.e.
half of all heights). The loop sees none of it: `heights = [200, 300, 420, 560, 700, 900]` are all
`≡ 0 (mod 4)`, the single residue class where `0.25h` and `0.5h` are integers. The behaviour cost
is one pixel; what matters is that `spec.md` §6 now defines the NFR as literally this quotient.

## What

- **Pin the fixed bases (R10-S1-F8, AC-19, AC-05)** — a row that opens blame (and one that opens
  both panels) and asserts the panels are **not** growing children: assert the resolved
  `[style.flex]` starts with `0 0`, or widen `growingChildren()` to see inline flex and assert the
  inspector block is still the only one. Both mutations must redden it:
  `blameFlex → '1 1 …'` and `fileHistoryFlex → '1 1 …'`. Record the run output.
- **Restore a full assertion per configuration (R10-S2-F1, AC-04)** — the loop had 144 then; it
  landed at 168 with the seventh height, and T47 took it to 192 (review round 11 O6: four records
  carried «144» as a current property after the count had moved twice) — replace the skip with an assertion of
  the bare head, verified against the shipped policy for every `fileCount === 0` row of the table:

  ```ts
  ok: nothingToDraw
    ? result.headerMaxH === availableHeight - tokens.panelHeadH
    : share >= floor,
  ```

  The mutation that reverts the `fileCount === 0` arm must redden this row too, not only the
  640 px row at `:124-152`.
- **Floor the cap (R10-S2-F2, AC-01, AC-03) — owner decision 2026-09-08** —
  `inspector-layout.ts:80` `Math.round` → `Math.floor`. Flooring can only give the list more, and
  every pinned literal stays green (606, 320, 210, 175, 100, 56, 34 are integers), including the
  fractional-input row at `:436-450` where `stackedPanelsHeight: 33.4` yields 303 under either
  function. **Add `421` to the loop's `heights`** (a non-multiple of 4) so the residue class the
  table hid is watched from now on; the loop must be green with it and must redden if `Math.floor`
  goes back to `Math.round`.
- **Correct the restore threshold (R10-S2-F5)** — `inspector-layout.spec.ts:414-421` tells a
  maintainer to restore the deleted clause «if a height under ~190 px (comfortable) ever joins the
  table». Measured, the clause is actually needed only for **h ≤ 67 expanded** and **h ≤ 125
  collapsed**; 190 px is where its *predicate* flips, and for a collapsed header the predicate is
  true for every height below 376 px — so 200 and 300, already in the table, are inside its range.
  Following the comment would restore a clause that silently excuses the rounding failures above.
  State the measured thresholds.

## Definition of Done

- [ ] `blameFlex → '1 1 …'` and `fileHistoryFlex → '1 1 …'` each redden the new row and only it;
      the failing row, its `file:line` and the run output are recorded here.
- [ ] Reverting the `fileCount === 0` arm reddens both the 640 px row and the loop.
- [ ] `Math.floor` → `Math.round` reddens the loop at the new height; with `Math.floor` the loop is
      green at all 168 configurations (7 heights × 6 counts × 2 collapse states × 2 token sets).
- [ ] The loop has no unconditional escape hatch left: every configuration asserts something.
- [ ] No existing assertion relaxed, removed or emptied; `expect(` counts per touched spec file
      recorded before and after.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit -p tsconfig.spec.json` clean;
      no `src-tauri/` change.
- [ ] Every mutation run in a tree verified clean before and after (`git status --porcelain -- src`
      empty of anything but the wave), per the round-8 standing note.

## Outcome (2026-09-08)

Landed. Gate: **835 tests / 63 files green, three consecutive runs** (the T43 rule), `pnpm lint`
clean (266 files), `tsc --noEmit -p tsconfig.spec.json` clean, `pnpm build` 908.12 kB, no budget
warning. Rust gate skipped: `git status --porcelain -- src-tauri` empty.

**RED classification.** One genuine red, one characterisation row verified by mutation:

| row | first run | evidence |
|---|---|---|
| `keeps the list at or over its share…` (the loop, with `421` added) | **GOOD red** — `expected { availableHeight: 421, …} to deeply equal {…}`, 1 failed / 834 | R10-S2-F2 reproduced by the table itself before a line of production code moved |
| `AC-19: blame and file history hold a fixed basis…` | false-pass (the bases are correct; their *cover* was the gap) | MUT-F, MUT-G below |

**Mutations.** Each on a tree verified clean before and after; each reddens exactly one row:

| # | Mutation | Result |
|---|---|---|
| MUT-F | `main-content.ts` `blameFlex` → `'1 1 30%' / '1 1 37.5%'` | 1 failed / 834 — AC-19 row, `expected [ <div>, …(1) ] to deeply equal [ <div> ]` |
| MUT-G | `main-content.ts` `fileHistoryFlex` → `'1 1 20%' / '1 1 28.6%'` | 1 failed / 834 — same row, same assertion |
| MUT-H | `inspector-layout.ts` `Math.floor` → `Math.round` | 1 failed / 834 — the loop, at `availableHeight: 421` |
| MUT-C′ | revert the `fileCount === 0` arm | **2 failed / 833** — the 640 px row *and* the loop at 200 px. Before this task it reddened the 640 px row alone |
| MUT-A′ | `inspector-layout.ts` drop `Math.max(…, panelHeadH)` | 1 failed / 834 — T40's guard row, `expected 16 to be 34`; unchanged by the floor |

**What changed, and one widening.** `growingChildren()` (`main-content.spec.ts:198-212`) now counts a
child as growing by the `flex-1` class **or** by an inline `flex` whose grow term is not `0`. That is
what made R10-S1-F8 invisible: the stacked panels take their basis through `[style.flex]`, so a
class-only filter could not see them however they were set. The four existing rows that call it are
strictly stronger for the change and stay green — none of them opens a stacked panel, so none of
them was relying on the blind spot.

**The empty case is asserted, not skipped.** The loop's `nothingToDraw` branch now asserts the
invariant that actually holds there — `headerMaxH === availableHeight - panelHeadH`, the bare head —
so all 168 configurations (7 heights × 6 counts × 2 collapse states × 2 token sets) assert something.
MUT-C′ is the proof: reverting the arm now reddens the loop too.

**O-9 taken.** `commit-inspector.spec.ts:516`'s title said «keeps … the file in the viewer»; amended
AC-05 says the active file. Title only, no assertion touched.

`expect(` counts: `inspector-layout.spec.ts` 47 → 52, `main-content.spec.ts` 45 → 49,
`commit-inspector.spec.ts` 106 → 106. None removed or relaxed.

## Notes

`deps: [T45]` is for the criteria text only: AC-04's new empty-list clause is what the loop's
`nothingToDraw` branch pins, and the §6 carve-out is what makes the 24 configurations legal. If
T45 slips, the code changes are still correct.

The commit must carry `SDD-Task: T44` and its `SDD-AC` trailers (R9-S1-F9).
