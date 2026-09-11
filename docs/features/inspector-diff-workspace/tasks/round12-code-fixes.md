---
id: T51
title: "Round-12 code fixes: the note's causal text, the collapsed share's own cover, and the constants the 110 px anchor rests on"
layer: "domain"
deps: ["T50"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-19"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T51 — Round-12 code fixes

## Why

Three things from `_review/review-2026-09-08-round12.md`, all in the spec tier.

**R12-S1-F1 — the restore-threshold note has the right numbers and the wrong cause.** The note
(`inspector-layout.spec.ts:465-478`) claims the misses «have TWO causes, not one» and tells the next
reader to restore a `twoRowFloorBinds`-shaped predicate «only for the cause that applies». Measured
three times independently: **224** of 224 misses are fixed by removing
`Math.max(headerAllowance, panelHeadH)`, **0** by removing the two-row floor, and the bound
`panelHeadH / (1 − ratio) − 1` does not move when the row floor is 0, 1, 3 or 6 rows. This is the
third consecutive round on this note (R10-S2-F5, R11-S1-F1), and the reason it keeps coming back is
that a wrong statement here sends a maintainer to change the policy instead of the table. Two further
figures are wrong: `:470-471` says the deleted predicate held for «h < 190 expanded and h < 376
collapsed» where it held for `h ≤ 187` / `h ≤ 179` expanded and `h ≤ 375` / `h ≤ 359` collapsed, and
the causal paragraph at `:465-469` gives the comfortable numbers only. And the collapsed twin's
comment (`:353-363`) says «the collapsed 75 % floor (82.5) leaves an allowance of 27.5» where
`protectedList = max(94, 82.5) = 94` leaves **16** — a number the policy never computes, contradicted
by the sweep note 130 lines below in the same file.

**R12-S2-F2 — the collapsed twin does not pin the collapsed share it is named for.** At 220 / 110
expanded and collapsed are numerically identical (`protectedList = 94` either way, allowance 16, cap
34, share 0.6909), so the twin exercises no path its expanded sibling does not. **MY-M3** — remove
`COLLAPSED_LIST_SHARE_FLOOR` outright — reddens three rows and **not the twin**. Yet `test-plan.md:43`
and `:166` both describe it as the pin for the collapsed cross-placement share.

**R12-S2-F1 ≡ R12-S1-F3 — the 110 px anchor is observed by nothing.** The new AC-19 assertion pins
the *shape* of the stacked panels' basis (`/^0 0 /`, no growth utility) and nothing pins its *size*.
Four mutations each leave **838/838 green**: the two bases doubled (MY-M1), widened to 45 % / 35 %
(MUT-G), a `[style.minHeight]="'400px'"` on the blame wrapper with the basis kept (MY-M2), and
`MIN_BOTTOM_PX` 220 → 400 (MY-M5). Under MY-M1 the two panels take 90 % of the column instead of
50 %; under MY-M2 blame takes 400 px whatever it declares — which is AC-19's subject in the words
`main-content.ts:266` uses. Those three constants are exactly what T47's comment and T48's carve-out
band are derived from.

## What

- **Rewrite the note's causal paragraph** (`inspector-layout.spec.ts:465-478`): one cause, the
  header-cap guard, with the closed form `panelHeadH / (1 − ratio) − 1` and the four bounds it yields
  in both densities; record that the two-row floor sets `protectedList` below 126 px collapsed but
  causes none of the misses, with the measurement that shows it (row floor at 0 / 1 / 3 / 6 rows moves
  no bound). Correct `:470-471` to the deleted predicate's real bounds — `h ≤ 187` / `h ≤ 179`
  expanded, `h ≤ 375` / `h ≤ 359` collapsed. The closing instruction must point at the guard, not at
  a `twoRowFloorBinds`-shaped predicate, and must give both collapse states' thresholds.
- **Correct the collapsed twin's comment** (`:353-363`) to the arithmetic the policy actually runs:
  `protectedList = max(94, 82.5) = 94`, allowance **16**, cap 34, share 0.6909 — the two-row floor
  binds and the header-cap guard is what makes the ratio yield. Quote T50's carve-out wording, and
  say plainly that at this remainder the expanded and collapsed paths are numerically identical, so
  this row pins the guard at the carve-out remainder and **not** the collapsed floor. Spell the share
  as `listShare(availableHeight, stacked, cap)` like every sibling row (O8).
- **Add a bottom-placement row where the 75 % floor binds** — owner decision 3. Measured for the
  review record: `availableHeight: 400, stackedPanelsHeight: 200` gives cap **50** / share **0.7500**
  collapsed against cap **100** / share **0.5000** expanded, in both densities; MY-M3 moves the
  collapsed cap 50 → 100, so the row reddens. Assert both halves (the collapsed cap and that it
  differs from the expanded one) so the row cannot pass on a coincidence.
- **Pin the three constants** — owner decision 2. Extend the AC-19 row (`main-content.spec.ts:406-441`)
  from the basis shape to its **value**: `'0 0 30%'` / `'0 0 20%'` with both panels stacked,
  `'0 0 37.5%'` / `'0 0 28.6%'` with one <!-- corrected 2026-09-08 (T55, review round 13
  R13-S1-F2 ≡ R13-S2-F2): three of these four landed. `'0 0 28.6%'` — file history opened ALONE — was
  pinned by nothing: mutating it left all 839 tests green, the row never opens that panel by itself,
  and this task's Outcome did not name the gap. T54 pins it by closing blame at the end of the AC-19
  row and asserting the value together with the wrapper count. -->, and assert no wrapper carries a
  min-height or max-height —
  inline or by utility (`min-h-`, `max-h-`, `[style.minHeight]`, `[style.maxHeight]`). Pin
  `MIN_BOTTOM_PX` where the bottom splitter clamp is already tested rather than adding a new file for
  it.

## Definition of Done

- [ ] Each of these mutations reddens exactly the row it should, on a tree verified clean before and
      after; the failing row, its `file:line` and the run output recorded here: **MY-M1** (bases
      doubled), **MY-M2** (`min-height` on a wrapper, basis kept), **MY-M5** (`MIN_BOTTOM_PX` 220 →
      400), **MY-M3** (`COLLAPSED_LIST_SHARE_FLOOR` removed — must now redden the new bottom row),
      **MUT-E** (`Math.max(…, panelHeadH)` dropped — must still redden the 220 / 110 pair).
- [ ] The new bottom row is green against the shipped policy in **both** densities, and its two
      halves are asserted separately.
- [ ] No sentence anywhere in `inspector-layout.spec.ts` names the list's two-row floor as a cause of
      the share yielding; no figure in the note is un-sourced or single-density. Re-derive all four
      bounds and the deleted predicate's four bounds from the policy and record them in the Outcome.
- [ ] The collapsed twin's comment matches T50's carve-out wording and states that it pins the guard,
      not the collapsed floor.
- [ ] No existing assertion relaxed, removed or emptied; `expect(` counts per touched spec file
      recorded before and after.
- [ ] `pnpm test` green three consecutive runs (the T43 rule), `pnpm lint`, `pnpm build` green;
      `tsc --noEmit -p tsconfig.spec.json` clean; no `src-tauri/` change.
- [ ] **No `src/**` production file changed by this task** — tests and comments only. State the
      command that shows it and, because round 11's own Outcome quoted a command that was literally
      false, quote one that is true of *this task's* delta rather than of the whole working tree.

## Outcome (2026-09-08)

Landed. **Tests and comments only** — proved by the check round 12 asked for, one that is true of
*this task's* delta rather than of the whole working tree: the four production files
(`inspector-layout.ts`, `main-content.ts`, `main-content.html`, `commit-inspector.ts`) are
**md5-identical to the review-time reviewer worktree** `C:\wt\r12s1`, so nothing this task touched is
production. `git status --porcelain -- src-tauri` empty.

**RED classification: one BAD red of my own, then three false-passes by design.** The first run
failed on my own assertion, not on the code: `expected [ 'min-h-0' ] to deeply equal []`. The
wrappers carry `min-h-0`, which is the *opposite* hazard — it is what lets a flex child shrink below
its content — so the filter was wrong, and per the TDD rule I fixed the test, not the code. The
corrected filter exempts `min-h-0` and `max-h-none` and rejects any real floor or ceiling, with the
reason in the comment. After that the new rows went green on their first run, which is the correct
result here: round 12 found the policy right across the whole reachable space and the cover missing,
so a red would have meant the policy was wrong. Their value is established by mutation. Count moved
838 → **839** (one new `it`, two extended rows).

**Mutations.** Each applied in the detached worktree `C:\wt\r12lead` carrying the wave as a working
patch, run through the serial suite, then restored from a pristine snapshot (the first attempt
restored with `git checkout -- src`, which reverted the *wave* rather than the mutation — caught by
the md5 check, redone with file copies). Tree verified at `6 files changed, 418 insertions, 22
deletions` before and after the battery; baseline 839/839.

| # | Mutation | Result |
|---|---|---|
| **MY-M1** | `main-content.ts` stacked bases doubled (`30% / 37.5%` → `60% / 75%`, `20% / 28.6%` → `40% / 57.2%`) | **1 failed / 838** — the AC-19 row, `expected '0 0 75%' to be '0 0 37.5%'`. Before this task: 839 green |
| **MY-M2** | `main-content.html` blame wrapper gains `[style.minHeight]="'400px'"`, basis kept | **1 failed / 838** — the AC-19 row, `expected '400px' to be ''`. Before this task: 839 green |
| **MY-M5** | `main-content.ts` `MIN_BOTTOM_PX` 220 → 400 | **1 failed / 838** — the AC-18 bottom row, `expected '400px' to be '580px'`. Before this task: 839 green |
| **MY-M3** | `inspector-layout.ts` `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 | **4 failed / 835** — the two 75 %-floor unit rows (`expected 350 to be 175`), the sweep at 200 px, **and the new 400 / 200 row** (`expected 0.5 to be close to 0.75`). Before this task the twin was absent from the failures, which was R12-S2-F2 |
| **MUT-E** | `inspector-layout.ts` `Math.max(headerAllowance, panelHeadH)` dropped | **2 failed / 837** — the 220 / 110 pair, both `expected 16 to be 34`, unchanged from round 11 |

**The collapsed floor now has cover where it binds.** `availableHeight: 400, stackedPanelsHeight: 200`
was chosen because it is the smallest round remainder above the carve-out band where the collapsed
floor actually binds (`0.75 × 200 = 150 > 94`) *and* the two collapse states diverge: collapsed gives
cap 50 / share 0.7500, expanded cap 100 / share 0.5000, in both densities. The row asserts both halves
separately, so it cannot pass on a coincidence, and MY-M3 moves the collapsed cap 50 → 100.

**The note states one cause, with every figure re-derived.** The causal paragraph now says the bound
is the closed form `panelHeadH / (1 - shareRatio) - 1`, carries no term from the row floor, and does
not move when that floor is 0, 1, 3 or 6 rows — 224 of 224 misses fixed by removing the head-cap
guard, 0 by removing the 2-row floor. It keeps the fact the round-11 note mistook for a second cause
(the 2-row floor does *set* `protectedList` below 126 px collapsed) and says why that cannot be a
cause: it only ever raises the protected height. The worked example carries both sides (`h = 130`:
cap 34 → 0.7385, and 32 → 0.7538 without the guard). The deleted predicate's own bounds are corrected
to `h ≤ 187` / `h ≤ 179` expanded and `h ≤ 375` / `h ≤ 359` collapsed — the round-11 note's «h < 190
expanded and h < 376 collapsed» was neither density's bound in the first case and comfortable-only in
the second. The closing instruction points at the head-cap guard and gives both collapse states'
thresholds.

**The twin's comment says what the twin pins.** It now shows the real arithmetic
(`protectedList = max(94, 82.5) = 94` → allowance **16** → cap 34 → 0.6909), says the expanded sibling
computes the same numbers — which is why MUT-E reddens both with `expected 16 to be 34` — and states
plainly that it pins the **guard**, not the collapsed floor, naming the row below as the floor's
cover. `listShare` is spelled `listShare(220, 110, …)` from the row's own inputs, matching every
sibling row (round-12 O8).

**Gate.** `pnpm test` **839 / 839 green, three consecutive serial runs** · `pnpm lint` clean, 266
files · `tsc --noEmit -p tsconfig.spec.json` exit 0 · `pnpm build` clean, no budget warning ·
`src-tauri` untouched.

`expect(` counts, `HEAD` → now: `inspector-layout.spec.ts` 47 → **59**, `main-content.spec.ts`
45 → **60**, `commit-inspector.spec.ts` 106 → 113 (untouched here), `diff-workspace.spec.ts` 29 → 33
(untouched here). The only removed assertion-bearing line in the whole `src` patch is still round-10's
`it(...)` title rename; nothing relaxed, emptied or deleted.

**One measurement worth recording rather than glossing.** `pnpm build` reports **908.38 kB** here
against 908.22 kB in the same tree earlier today and 908.33 kB in the reviewer worktree — and this
task changes no bundled file (the md5 check above). Two consecutive rebuilds in this tree both report
908.38, and a rebuild after touching only a spec file also reports 908.38, so the figure is stable
per tree and varies by build-cache state, not by content. Round-12 O16 read the same 0.1 kB drift as
measurement noise; this is the same thing, measured deliberately. Well inside budget either way.

## Notes

`deps: [T50]` is real: the twin's corrected comment quotes the carve-out wording T50 finalises, and
the new bottom row's comment cites the band per collapse state.

Expect the new rows to go green on their first run. That is the correct result and not a false pass:
round 12 found the policy right across the whole reachable space and the cover missing, so a row that
reddened here would mean the policy is wrong. Their value is established by the mutation battery
above, which is what the DoD asks for — the same reasoning T47 recorded, and it held up under review.

The commit must carry `SDD-Task: T51` and its `SDD-AC` trailers (R9-S1-F9). Per round 11 O1, the
uncommitted tree still carries the T40–T49 halves, so the next commit's trailers are T40–T52.

## Addendum (2026-09-08, T55 — review round 13)

**The mutation table above records five; four more were run in round 13 and belong beside them.** Three
hold and were not claimed by this task: **MUT-G** (bases widened to 45 % / 35 %) → 1 failed / 838 at
`main-content.spec.ts:463`; **MY-M2b** (`min-height` on the **file-history** wrapper, the second panel)
→ 1 failed / 838 at `:447`; **MY-M2c** (`max-height` on the blame wrapper) → 1 failed / 838 at `:448`.
A class-based floor (`min-h-40`, `min-h-[400px]`) reddens too, measured three times independently.

One did **not** hold: **MY-N3**, `'0 0 28.6%'` → `'0 0 58.6%'` (or `'0 0 29%'`) → **839 passed, green**.
That is R13-S1-F2 ≡ R13-S2-F2, and it is the reason this addendum exists: probing the fourth value
would have exposed the gap to this task rather than to the next review. The lesson for the next code
wave — **when an owner decision enumerates N values, run N mutations, not the ones the row happens to
walk.**
