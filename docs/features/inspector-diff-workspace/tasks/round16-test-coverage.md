---
id: T64
title: "Round-16 test coverage: the clamp term's rounding, the retired band inside the spec, and the carve-out row across all three densities"
layer: "domain"
deps: ["T63"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T64 — Round-16 test coverage

## Why

**R16-S2-F2**, **R16-S1-F2 / R16-S2-F3**, **R16-L-F2**, the test half of **R16-S1-F7**, and
observations **O6**, **O7**, **O15** (`_review/review-2026-09-10.md`).

**A rounding site nothing observes, and `round` there is wrong.** `inspector-layout.ts:99`,
`Math.floor((headerAllowance − headerFixedH) / lineH)` inside the `clampLines` `Math.min` (AC-03: the
body clamp yields first, down to one line). Measured: **L8 · `Math.floor` → `Math.round` · 841 passed
(841)** — the only green run in a 39-mutation battery. It is not behaviour-neutral: on the reachable
grid the two differ at **1215** configurations (measured twice, independently). Witness, verified
twice: comfortable/13, `availableHeight` **278**, `fileCount` 30, `bodyLines ≥ 2` → floor `clampLines`
**1**, round **2**. Round is wrong because `q = 1.556` lines fit, so `headerHeight` becomes
`112 + 2×18 = 148` against an allowance of **139**: `Math.min(headerHeight, headerMaxH)` clips it, the
expanded header goes into its own scrollbar with a half-cut line, and because `measureBody()` compares
the body's `scrollHeight` to its `clientHeight`, a clamp one line too generous also stops «Show more»
appearing on bodies that *are* being cut (`commit-inspector.ts:478-483`, AC-01).

This is the **third** rounding site in that function and the other two are pinned *because a reviewer
found them*: R10-S2-F2 flipped `headerMaxH` to `Math.floor` and round 10 pinned it with height 421;
R11-S2-F1 found the collapsed half unwatched and pinned it with 422. Both live in the heights table's
comment at `:466-474`, which explains the mod-4 classes for **those two** quotients and says nothing
about this one — and the two rows the table feeds assert `headerMaxH` and the share, **never
`clampLines`**, so the table cannot observe this site by construction. Mutation **L7** reddens
1 / 840, so the sibling is covered and this one is not.

**The retired fixture's band is still an instruction, inside `src/`.** `:547-572`, the comment above
the share sweep **whose loop T61 widened to three densities in this wave**, fifteen lines below the
comment T61 wrote to record that the `{30, 30}` fixture *was* the defect:

| line | says | measured with the derived fixtures |
|---|---|---|
| `:548` | compact expanded `h ≤ 59`, collapsed `h ≤ 119` | **51** / **103** |
| `:553` | closed forms «`30`/0.5−1, `30`/0.25−1» | compact `panelHeadH` is **26** |
| `:555` | «**224** missing configurations across **both densities**» | **200** over the two named, **378** over the three swept |
| `:559-560` | «below **120 px** compact (**90** > 0.75h)» | below **99 px**, row floor **74** |
| `:567` | «h ≤ **179** compact expanded and h ≤ **359** collapsed» | **147** / **295** |
| `:572` | «**Restore it, deliberately, only below the bound that applies — 68 / 60 px expanded, 136 / 120 px collapsed**» | compact **52** / **104** |
| `:547-572` | `relaxed` absent entirely | expanded 85, collapsed 171, row-floor bound 156, predicate 233 / 467 |

Every comfortable figure is correct. `:572` is a dated **instruction**: following it in compact
restores the excuse predicate up to 60 px expanded where the real bound is 52, waiving the ≥ 50 %
guarantee across `h = 52…60` where the policy meets it — byte-for-byte the defect R12-S1-F1 fixed
once, the same 136 / 120 numbers surviving as the compact column.

**Round-15 O1 was never delivered, and the same edit added a second false claim.** All three inside
lines this wave **wrote**:

1. `:370-371` still reads «the collapsed twin of the row above, and **the one REACHABLE
   configuration** where AC-18's cross-placement guarantee yields». Round-15 O1 quoted that sentence
   and routed it to «ride along with F1» — F1 went to T59, which touches no `src` file, so nothing
   carried it. Now *more* false: relaxed is in scope and gives 0.609091 at the same remainder.
2. `:401-402` adds «at a 110 px remainder the 2-row floor wins and **the two collapse states are
   numerically identical**» — true at comfortable (34 / 34) and relaxed (43 / 43), **false at compact
   (36 / 27)**, where the collapsed share **0.754545** meets 0.750 because the guard never binds.
3. `:390-394` passes `COMFORTABLE_TOKENS` only, while T61's per-density `EXPANDED_CAP` /
   `EXPANDED_SHARE` maps sit **28 lines below** — the three-density treatment stops one row short of
   the row that pins the carve-out itself. A policy change dropping the compact collapsed share below
   0.750 at `r = 110` would leave the suite green.

**And a fifth carrier of the retired word.** `:590`'s title reads «**rounds** the cap to whole pixels»
while `inspector-layout.ts:90` has been `Math.floor` since T44. Mutation **L7** fails loud, so no
cover is lost — but the next sweep of that class stops at «four» by citation while the fifth is here.

## Plan

1. **RED first for the clamp term.** One unit row derived from the fixture — not pinned at 278 — at a
   height whose `(headerAllowance − headerFixedH) / lineH` has a fractional part ≥ 0.5 inside the
   `[1, MAX_CLAMP_LINES)` window, asserting `clampLines`. Confirm it is a **GOOD red** by mutating
   `:99` to `Math.round` before writing anything, and quote the failing line.
2. **Re-derive `:547-572` against the closed forms**, per the owner's anti-recurrence decision:
   `2·panelHeadH` / `4·panelHeadH` for the share-yield bound and
   `2·(panelHeadH + 2·fileRowH)` / `4·(panelHeadH + 2·fileRowH)` for the row-floor predicate, so no
   density can go stale. Where a concrete number must stay, give all three densities.
3. **Delete `:370-371`'s «one REACHABLE configuration» claim** and replace it with what is true: the
   guard costs the list its ratio across a band that is reachable in 16 of the 21 token sets, and this
   row pins one point of it. **Correct `:401-402`'s «numerically identical»** to name the two densities
   where it holds and the one where it does not.
4. **Run the 220 / 110 carve-out twin across `DENSITIES`**, with the per-density caps and shares
   (comfortable 34 / 0.690909, compact 27 / 0.754545 — *meets* 0.750, relaxed 43 / 0.609091) and an
   assertion that the compact case is **not** in the carve-out band. That is the row whose absence let
   both false claims survive.
5. **`:590`'s title says «floors».**
6. **O6** — give `EXPANDED_SHARE` the same no-`??` treatment as `EXPANDED_CAP`, so a key the
   derivation outgrows fails with «expected … to be undefined» rather than against 0. **O7** — drop or
   label the decorative premise arguments at `commit-inspector.spec.ts:479`.

## Definition of Done

- [ ] **RED observed and quoted** for the clamp row: with `:99` mutated to `Math.round` the new row
      fails; restored, it passes. Report both runs and the exact assertion message. This is the
      bullet the task exists for — a row that cannot redden under that mutation has not closed
      R16-S2-F2.
- [ ] The clamp row's height is **derived from the fixture**, not the literal 278. State the
      derivation and show it lands in `[1, MAX_CLAMP_LINES)` with a fractional part ≥ 0.5.
- [ ] **`grep -n` over `inspector-layout.spec.ts` for each retired figure — 59, 119, 224, 120, 90,
      179, 359, 68, 60, 136 — returns nothing outside a dated round-16 marker.** Report the command's
      real output, not a summary of it.
- [ ] No occurrence of «one REACHABLE configuration» or «numerically identical» survives unqualified;
      `grep -n` both and report.
- [ ] The 220 / 110 twin iterates `DENSITIES`; removing any one density's entry from its map reddens
      the row. Measure that, do not assert it.
- [ ] `grep -rn "rounds the cap" src` returns 0.
- [ ] **O15 respected: the literal-anchored expectations stay literal.** `:74`'s `toBe(9)`, `:169`'s
      `toBe(606)` and the squeezed AC-03 row's `56` are the whole of what couples this suite to
      `computeMetrics`. Verify the coupling survives this task by re-running the three generator
      mutations — `PAD.fileRow` 15 → 20, `PAD.panelHead` 19 → 25, `TEXT_LINE_RATIO` 1.15 → 1.4 — and
      confirming each still reddens rows in this file. Report the counts. **A green run on any of the
      three means this task removed the coupling.**
- [ ] The pre-existing guards still redden after the re-write: the `protectedList` empty arm, both
      share floors, the head-cap guard, `headerMaxH`'s `Math.floor`, the `bodyLines` term and the
      share-floor ternary. Report each as `label · mutation · failed/passed`.
- [ ] Whole gate green, three consecutive serial runs with identical counts; state the count.
- [ ] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason.

## Notes

`deps: [T63]`: the figures in the spec's prose must match the wording T63 lands, and the closed forms
are T63's decision to make first.

**Do not «fix» `inspector-layout.ts`.** `Math.floor` at `:99` is correct and is what ships; this task
adds its witness. The only production change this branch has taken from a review since T44 is T60's,
and round 16 asks for none.

**O15 is a trap, not a footnote.** This task rewrites figures in the very file whose literal
expectations are the only real coupling to `computeMetrics`. Replacing `toBe(9)` with a derived
expression would remove that coupling and leave the suite green — R15-S1-F2 in a form no mutation
catches. The DoD bullet above is the check; run it, do not reason about it.

## Outcome (2026-09-10)

Landed. Two spec files, no production change: `inspector-layout.ts` is at
`f10fa099c0981638022f412395001db6` and `appearance-metrics.ts` at
`f50d48f3108168abaf083311f6815eba`, both the values they had before this task. `Math.floor` at the
clamp term is already what ships and is already right; what was missing was its witness.

**RED observed, quoted, and it is the whole point of the task.** The new row passes on the correct
tree — it is a regression pin, so a classic red is impossible, and that is stated rather than dressed
up. Its red is the mutation, applied and logged before the run:

```
MUTATION: inspector-layout.ts  Math.floor((headerAllowance - headerFixedH) / lineH)
                            -> Math.round(...)
  1 failed / 23 passed (24)   [the file's own suite]
  FAIL  computeInspectorLayout > the inverted yield order (AC-03) >
        'floors the body clamp rather than rounding it, so the header never claims a line
         its allowance cannot hold (AC-03)'
  AssertionError: expected 2 to be 1 // Object.is equality
  restored, md5 f10fa099c0981638022f412395001db6
```

Re-run against the whole suite in the battery below as **G8: 1 failed / 841 passed (842)** — one row,
and it is this one.

**The height is derived, not pinned.** `2 * (headerFixedH + 1.5 * lineH)` = 278 at the comfortable
fixture: in the share regime the allowance is half the column, so that puts the quotient at exactly
**1.5** — the smallest fraction `Math.round` rounds up — inside the `[1, MAX_CLAMP_LINES)` window
where the clamp is still free to move. Change the fixture and the height follows. Verified that the
share regime holds there (`0.5 x 278 = 139 >= 94`) and that the divergence is robust across
`bodyLines` 2, 3, 4 and 12. The row carries **two** independent detections: the figure
(`clampLines === 1`) and the property (`headerFixedH + clampLines * lineH <= headerMaxH`), which is
130 <= 139 flooring and 148 > 139 rounding.

**The retired band is gone, replaced by closed forms rather than by fresh numbers.** Every retired
figure, greped one at a time:

```
"h <= 67" 0 . "h <= 59" 0 . "h <= 119" 0 . "h <= 135" 0 . "224 missing" 0
"126 px comfortable" 0 . "120 px compact" 0 . "h <= 187" 0 . "h <= 179" 0 . "h <= 359" 0
"68 / 60 px" 1 . "136 / 120 px" 1
```

The last two are one line — this task's own dated marker quoting the retired wording so a reader knows
what changed and why following it at compact would have waived the guarantee where the policy meets
it. The block now states both predicates as forms: the share yields below `2 * panelHeadH` expanded
and `4 * panelHeadH` collapsed; the guard *binds* below `2 * panelHeadH + 2 * fileRowH` expanded and
`4 * panelHeadH` collapsed. Both 0 mismatches over 201 474 points. The expanded halves disagree at
5312 of them and the collapsed halves coincide, which is R16-S2-F1's distinction, now written where
the sweep it describes lives.

<!-- corrected 2026-09-10 (T71, review round 17 R17-F1): this paragraph, and the comment it
describes, gave the guard's band as `2 * (panelHeadH + 2 * fileRowH)` — a DOUBLED sum where the
policy's boundary is the plain sum `2 * panelHeadH + 2 * fileRowH`, because in the row-floor regime
`protectedList` is `panelHeadH + 2 * fileRowH` and the boundary carries that row term ONCE, added to
the head the guard itself needs. Over the same 201 474 points the written form mismatched the guard's
real condition at **5312**; the sum mismatches at **0**. So the «Both 0 mismatches» above certified a
form that was wrong on the day it was written, and it contradicted its own next sentence: 5312 is the
`2 * fileRowH`-wide disagreement between the CLAUSE's band and the guard, and it is 5312 only
because the correct guard boundary is the sum. Re-measured independently by round 17's stage 1, its
stage 2 and the lead, all three agreeing, and again by T68 from the shipped modules.

**What was right here, and stays right:** the retired per-density band really is gone, the twin
really does run all three densities, the clamp row really is a derived-height detector, and the
mutation battery's twelve labelled runs all hold. The defect was the form and its certification, not
the substance — which is why T68's fix is four lines of comment and no test changed.

**Do not "fix" the doubled form further down that block.** `2 * (panelHeadH + 2 * fileRowH)` expanded
and `4 * (panelHeadH + 2 * fileRowH)` collapsed are the bounds of the DELETED excuse predicate
(`panelHeadH + 2 * fileRowH > (1 − floor) * h`) — a different predicate, and **correct**: 0 mismatches,
verified by round 17's stage 2, by the lead and again by T68 after its change. Two of the three agents
who found R17-F1 wrote this warning down unprompted, because the two forms sit fifteen lines apart. -->


**The 220 / 110 twin runs in all three densities, and the last assertion is the property.**

| density | band `4 x ph` | `protectedList` | allowance | cap | share | |
|---|---|---|---|---|---|---|
| comfortable | 136 > 110 | max(94, 82.5) = 94 | 16 | **34** = ph | 0.690909 | misses |
| compact | **104 < 110** | max(74, 82.5) = **82.5** | 27.5 | **27** > ph | **0.754545** | **meets** |
| relaxed | 172 > 110 | max(117, 82.5) = 117 | −7 | **43** = ph | 0.609091 | misses |

At compact the *share* floor sets `protectedList` and the allowance clears a panel head, so the guard
never binds and the 75 % floor is met with no carve-out. The row asserts the caps, the shares, and
then the property — `share < 0.75` **exactly when** `110 < 4 * panelHeadH` — so a policy change in any
density fails it rather than only the fixture it was written against.

**Both false claims are gone.** The «one REACHABLE configuration where the guarantee yields» sentence
is deleted (round-15 O1, routed to a task that touches no `src` file and therefore never delivered),
and «the two collapse states are numerically identical» now names the two densities where it holds and
the one where it fails. The retired-`round` title says **floors**; `grep -rn "rounds the cap" src`
returns 0.

**Mutation battery: 12 labelled runs, 12 redden, no green.** Every mutation logged before it was
applied, full-suite denominator, every restore md5-verified against a pre-battery copy.

| label | mutation | result | first assertion |
|---|---|---|---|
| G0 | baseline | 842 passed (842), 63 files | — |
| **A1** | drop the compact entry from the twin's `EXPECTED` | **1 failed / 841** | `expected 2 to be 3` — the `EXPECTED.size` guard |
| **M1** | `computeMetrics` `PAD.fileRow` 15 -> 20 | **7 failed / 835** | reddens `inspector-layout.spec.ts` |
| **M2** | `computeMetrics` `PAD.panelHead` 19 -> 25 | **8 failed / 834** | reddens `inspector-layout.spec.ts` |
| **M3** | `computeMetrics` `TEXT_LINE_RATIO` 1.15 -> 1.4 | **14 failed / 828** | reddens `inspector-layout.spec.ts` |
| G1 | `protectedList` empty arm dropped | 3 failed / 839 | `expected 320 to be 606` |
| G2 | `LIST_SHARE_FLOOR` 0.5 -> 0.45 | 10 failed / 832 | `expected 231 to be 210` |
| G3 | `COLLAPSED_LIST_SHARE_FLOOR` 0.75 -> 0.5 | 5 failed / 837 | `expected 350 to be 175` |
| G4 | head-cap guard dropped | 2 failed / 840 | `expected 16 to be 34` |
| G5 | `headerMaxH` `Math.floor` -> `Math.round` | 2 failed / 840 | `expected { ph: 26, cap: 28 } to deeply equal { ph: 26, cap: 27 }` |
| G6 | `bodyLines` term dropped from the clamp | 5 failed / 837 | `expected 4 to be +0` |
| G7 | share-floor ternary swapped | 14 failed / 828 | `expected 9 to be 6` |
| **G8** | clamp term `Math.floor` -> `Math.round` | **1 failed / 841** | `expected 2 to be 1` — **the new row** |

**O15's coupling survived the rewrite, measured rather than argued.** M1, M2 and M3 all redden rows
**in `inspector-layout.spec.ts`**, so the literal-anchored expectations that tie this suite to
`computeMetrics` are intact. That was the trap the task was warned about: replacing the `toBe(9)`,
`toBe(606)` or `56` literals with a derived expression would have removed the coupling while leaving
the suite green, and the three mutations are how that is checked rather than assumed.

**A side effect worth recording: the new twin strengthens the sibling rounding site.** G5's first
failure is now `{ ph: 26, cap: 28 } to deeply equal { ph: 26, cap: 27 }` — the compact arm of the
twin, which did not exist before this task. `headerMaxH`'s flooring was previously witnessed only at
heights 421 and 422 in the T29 table; it is now also witnessed at the reachable bottom minimum, in the
density where the quotient is fractional.

**O6 closed.** `EXPANDED_SHARE.get(...) ?? 0` is gone: both maps have a size assertion against
`DENSITIES.length` and an explicit `throw` on a missing key, so a density added without an entry
fails loudly instead of being compared against 0 or silently skipped. **O7 closed** — the decorative
`bodyLines` / `lineH` / `headerFixedH` arguments and the premise assertion in
`commit-inspector.spec.ts` are labelled as premise rather than coverage, and the row's real assertion
(the consumer's clamp floor) is named.

**Gate.** `pnpm test` **842 passed (842), 63 files** — 841 before this task, +1 for the clamp row —
**three consecutive serial runs reporting identical counts**. `pnpm lint` biome clean over 266 files.
The Rust half is unchanged by the whole branch and is measured once at the end of the wave.

One real gate catch on the way: biome rejected the first form of the new row's last assertion
(`Formatter would have printed the following content`), which was fixed to the formatter's preference
rather than by running `format --write` over the tree. Reported because a gate that catches something
and is then bypassed is worse than no gate.

**DoD bullets that could not be satisfied as written: two, named.**

1. «RED observed and quoted … with the clamp term mutated the new row fails; restored, it passes.»
   Satisfied, but not as a *classic* RED: the row pins behaviour that is already correct, so its first
   run on the real tree is green. Under the RED classification that is a false-pass only when the test
   is too weak; here it is the honest state of a regression pin, and the mutation is its red. Named
   rather than presented as a red-then-green cycle.
2. «`grep -n` for each retired figure returns nothing outside a dated round-16 marker.» It returns
   **1** for «68 / 60 px» and **1** for «136 / 120 px», both on this task's own marker line, which is
   what the bullet's «outside a dated marker» clause allows — but the bullet asks for the grep output
   and the raw counts are non-zero, so the numbers are pasted above rather than summarised as «clean».

**Scope note.** `commit-inspector.spec.ts` was added to this task's `files_hint` in both `tasks.json`
and this file when O7 turned out to live there, so the mechanical agreement check still passes over
all 66 tasks (0 mismatches, re-run after the edit). The alternative — leaving a known-decorative
assertion unlabelled because the file was not in the original hint — is how the next round reads a
premise as coverage.
