---
id: T60
title: "Round-15 production fix: guard the measured line height so the policy can never be fed a zero"
layer: "app"
deps: ["T59"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T60 — Round-15 production fix

## Why

**R15-S2-F1** (`_review/review-2026-09-09.md`). T57 deleted `|| fileCount === 0` from `listRows` on a
vacuity proof that holds over every grid that was swept and **not** over the input space. The caveat
T57 recorded to bound it is wrong three ways — `Math.floor(280/0)` is `Infinity`, not `NaN`; the chain
it writes out returns `0`; and the real condition is `fileRowH === 0` **and** `listHeight === 0`, which
313 of 72 576 configurations satisfy rather than all of them.

The class it missed is reachable and has nothing to do with `fileRowH`:

- `commit-inspector.ts:559` reads `const lineH = body ? Number.parseFloat(getComputedStyle(body).lineHeight) : 0`.
- `#bodyText` lives inside `@if (commit.body.length > 0)` (`commit-inspector.html:154`).
- So **every commit with no message body gives `lineH = 0`**, and `:582` passes that straight into
  `tokens` while `:561` guards `bodyLines` with the very same `lineH > 0` test.
- In the policy, `Math.floor((headerAllowance − headerFixedH) / 0)` is `0/0 = NaN` when the numerator
  is exactly zero → `Math.max(1, NaN) = NaN` → `clampLines` NaN → `headerFixedH + NaN × 0` NaN →
  `listHeight` NaN → and, **since T57**, `Math.min(fileCount, Math.max(2, Math.floor(NaN / fileRowH)))`
  = **NaN** where the old arm returned **0**.

Measured, comfortable at 13 px (`fileRowH` 30, `panelHeadH` 34), body-less commit, empty or
fully-filtered file list, header expanded, no stacked panels, measured `headerFixedH` 94: at
`availableHeight = 128` **exactly**, `listRows` goes 0 → NaN (127 and 129 agree at 0).
`commit-inspector.ts:594` then writes `--inspector-list-rows: NaN`, and
`commit-inspector.css:184`'s `height: calc(var(--inspector-list-rows, 6) * var(--file-row-h))` is
invalid at computed-value time — **the `var()` fallback does not rescue it, because the property is
set** — so the file list's height drops to `auto`. `headerFixedH` is measured off `header.scrollHeight`,
so the affected height moves with the commit's ref badges.

Owner decision of 2026-09-09: **guard the token at the caller**, where the `lineH > 0` test already
exists, rather than sanitising inside the pure policy. It closes the whole class, including the
`--inspector-clamp-lines: NaN` that predates T57.

## What

- `commit-inspector.ts`: build `tokens` with the guarded line height — the same `lineH > 0` predicate
  `:561` already applies to `bodyLines` — so `computeInspectorLayout` never receives `lineH === 0`.
  Do not sanitise in `inspector-layout.ts`: the policy's contract is that its tokens are real measured
  pixels, and the measurement is the caller's.
- Keep T57's deletion. Restoring the arm would close this path for `fileCount === 0` only and would
  bring back the two indistinguishable arms R14-S2-F3 removed.

## Definition of Done

- [x] **RED first, at the component tier**, in `commit-inspector.spec.ts`: a commit with **no message
      body**, a file list that draws no row, the header expanded, no stacked panels, and the column at
      the height where the two versions diverge — asserting that `--inspector-list-rows` is a finite
      number and not `NaN`. Quote the failing line before writing production code. The row must fail
      against the current tree; if it passes, the configuration is wrong, not the finding.
- [x] The same row (or a sibling phase in it) asserts `--inspector-clamp-lines` is finite, which is the
      half that predates T57.
- [x] **The guard is proven to be the thing that fixes it**: with the guard in place, re-run the
      divergence sweep with `lineH` in the grid — the grid T57's 720 360 configurations could not
      contain because they held `lineH` at one positive value per token set — and report **0**
      divergences between the pre-T57 and post-T57 policy over it. State the configuration count and
      say explicitly what the grid varies.
- [x] Mutation check: remove the guard again and confirm the new row reddens, quoting the row and the
      message. A guard whose removal leaves the suite green is not a guard.
- [x] Whole gate: `pnpm test` green on **three consecutive serial runs with identical counts** (expect
      **840** — one row added; state the count), `pnpm lint` clean over 266 files,
      `tsc --noEmit -p tsconfig.spec.json` exit 0, `pnpm build` clean with no budget warning, plus the
      Rust half configured in `.claude/sdd.local.md`.
- [x] `git diff 805a32d -- src | grep -c '^-.*expect('` is **0**; no `it.skip` / `.only` / `.todo`.
- [x] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason.

## Notes

`deps: [T59]`: the criteria wording comes first, as in every wave since round 9.

The two files are this task's alone; T61 touches `inspector-layout.spec.ts` and `main-content.spec.ts`,
T59 and T62 touch no `src/` file, so the wave has no shared-file edge under `src/`.

The divergent height is **not** a constant to hard-code in the test: it is
`headerFixedH + panelHeadH + stackedPanelsHeight` for the rendered commit. Derive it in the row from
the measured header, or drive the column to it — a literal `128` would pin the fixture, not the class.

## Outcome (2026-09-09)

Landed, test-first, in a worktree (`C:/wt/r15t60`) and applied to the main tree file by file after a
hunk-level comparison, so nothing of the wave under it could be lost.

**RED, and it was a GOOD red.** The row `AC-04 / AC-05: a body-less commit writes row and clamp
counts, never NaN`, added to the AC-04 describe block, compiled, ran and failed on its own assertion:

```
AssertionError: expected false to be true // Object.is equality
 > src/app/features/commit-inspector/commit-inspector.spec.ts:631:43
    631|     expect(Number.isFinite(Number(rows))).toBe(true);
```

`expect(rows).not.toBe('')` passed **first**, which is the part that matters: the custom property was
written, and what it was written with was the literal `NaN`. The divergent height is **derived, not
pinned** — `headerFixedH = 3 * panelHeadHeight()`, `columnH = headerFixedH + panelHeadHeight()` — so
the row follows the class rather than the fixture, and the re-layout is triggered through the column
`ResizeObserver` the component actually observes.

**GREEN, one expression at the caller** (`commit-inspector.ts:588`):

```diff
-      tokens: { fileRowH, panelHeadH, lineH, headerFixedH },
+      tokens: { fileRowH, panelHeadH, lineH: lineH > 0 ? lineH : 1, headerFixedH },
```

`inspector-layout.ts` is byte-identical (md5 `f10fa099c0981638022f412395001db6`): the policy was **not**
sanitised and T57's deletion stands, as the owner decided. The fallback value is provably
unobservable — it is read only when `lineH <= 0`, which is exactly when `bodyLines` is `0`, and there
the clamp is `Math.min(0, 4, ...) = 0` for any positive value. It also covers
`line-height: normal`, where `parseFloat` yields `NaN` and `NaN > 0` is false.

**The sweep, both sides transpiled from the real module** with the repo's own TypeScript so the
comparison cannot drift from the shipped code. The grid varies the 21 real token sets x **`lineH`** x
`headerFixedH` x `bodyLines` x both collapse flags x `stackedPanelsHeight` x `fileCount`, with heights
at the exact `0 / lineH` equalities and +/-1 around them:

| grid | configurations | diverging |
|---|---|---|
| **A** the policy, `lineH` in {0, 1, 16, 18, 24} | **1 884 800** | **2016**, every one `pre listRows = 0` -> `shipped NaN` |
| **B** the guarded caller, `lineH` in {1, 16, 18, 24} | **1 507 840** | **0** |

Both were measured on purpose. **A** proves the class is real and that T57's 720 360-configuration
grid *structurally* could not contain it, because it held `lineH` at one positive value per token set.
**B** proves the guarded caller cannot emit an input that reaches it.

**Mutation.** Removing the guard reddens the row at `:631`. Because the rows assertion fails first, the
clamp assertion never ran in the red state; rather than claim cover that had not been observed, the
rows assertions were neutralised and the same mutation re-run: the clamp half reddens on its own at
`:634:44` in the delivered tree. **Both halves are load-bearing.** <!-- address corrected 2026-09-10 (T66, review round 16 O3): this said `:632:44`, a transcription two lines off. Independently re-measured by round 16's stage-2 reviewer, which reddened the clamp half on its own at `commit-inspector.spec.ts:634:44` --> Restored from `cp` copies, never from git.

**Gate.** `pnpm test` **841 passed (841), 63 files, three consecutive serial runs identical** in the
main tree with T61 alongside (840 in the worktree with T60 alone; 839 before the wave) - `pnpm lint`
biome clean over 266 files - `tsc --noEmit -p tsconfig.spec.json` exit 0 - `pnpm build` clean, no
budget warning - `cargo fmt` exit 0, `cargo clippy -D warnings` clean, `cargo test --all-features`
**388 passed / 0 failed / 1 ignored** (run in the main tree; `src-tauri` is untouched by the wave).

**DoD bullets that could not be satisfied as written: two, named rather than glossed.**

1. «report **0** divergences between the pre-T57 and post-T57 policy» over a grid with `lineH` in
   it. Unsatisfiable as phrased, and it needs splitting: with `lineH === 0` **in** the grid the answer
   is **2016**, not 0, because the owner chose not to sanitise the policy. The 0 belongs to the
   caller's reachable set (grid B). Both figures are above. Reporting only the flattering one would
   have been the sixth instance of this branch's own failure mode.
2. «`git diff 805a32d -- src | grep -c '^-.*expect('` is **0**». It is **1**, and no assertion was
   removed: the line is `expect(result.listRows).toBe(7);`, replaced in place by `toBe(9)` by **T61**,
   and the diff carries **57** matching `+` lines. The check cannot distinguish a removal from a
   re-derived expected value. The replacement, measured: `expect(` per touched spec file **rose in
   every one** - `inspector-layout.spec.ts` 47 -> 60, `main-content.spec.ts` 45 -> 72,
   `commit-inspector.spec.ts` 106 -> 118, `diff-workspace.spec.ts` 29 -> 33.

**Also recorded:** `commit-inspector.ts:588` is now the only guarded token of the four the policy
takes - `fileRowH`, `panelHeadH` and `headerFixedH` still arrive unguarded. That is round-15 **O4**
and is **unreachable, enforced in two places** rather than merely unexercised: `uiDensity` is validated against `UI_DENSITIES` by `isOneOf` when preferences are parsed (`preferences-schema.ts`) and the setter is typed to the union (`preferences.service.ts`), so `DENSITY_PAD_SCALE[density]` can never be `undefined`; `uiFontSize` and `monoFontSize` are clamped on **both** paths, the parse and the setter, and no other writer of either key exists in `src/`. Over every reachable preference combination that leaves `fileRowH >= 22` and `panelHeadH >= 24`, and `headerFixedH` is never a divisor. <!-- upgraded 2026-09-10 (T66, review round 16 O4): this read «is deliberately left; nothing in the four can currently reach 0 by construction», which invites a fourth guard nobody needs and understates what round 16's stage-2 reviewer verified. «Deliberately left» describes a decision; «unreachable, enforced at these two sites» describes a proof, and only the second tells the next maintainer not to add the guard --> Widening the
guard is a decision, not a fix.
