---
id: T77
title: "Round-19 D3 completion: the four rows the migration did not reach, and the share floors nobody had looked for"
layer: "docs"
deps: ["T75"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-18", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/spec.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T77 — Round-19 D3 completion

## Why

**R19-F5**, **R19-F6** and owner decision **D2** of `_review/review-2026-09-11.md`.

T73 performed the D3 construction and took the gate's coverage line from `36 / 15` to `1 / 1`. Round
19 found two things that number could not see.

**F5 — four live rows still carried policy outputs.** `screens.md`'s compact token pair, and three
`test-plan.md` rows. None appears in T73's classification of the 17 survivors, and the gate is blind
to all four by construction: it blanks inline code spans before the coverage heuristic and its figure
regex matches only a `0.ddd`–`0.dddddd` decimal or a 20–49 px `a / b` pair, so `606`, `320`, `36`,
`27` and «26 and 24» are invisible. **The coverage line was therefore never evidence of D3
compliance**, which is the finding's real content.

**F6 — a whole class nobody had ever swept for.** `LIST_SHARE_FLOOR` and
`COLLAPSED_LIST_SHARE_FLOOR` are written into live prose as «50 %», «75 %», «half» and «three
quarters». D3's own text names «a share» first. No sweep in nineteen rounds enumerated a percentage
or a words-form, so the class was never counted — not in the 68, not in the 17.

## Plan

1. Re-derive all four F5 figures from the shipped modules before touching them, so the migration is
   not written from the prose it is replacing. → verify: each stated figure reproduces.
2. Migrate the four rows to closed forms or a pointer at the generated table, resolving **O11**'s
   density ambiguity in the same edit. → verify: a comment-blanked scan finds no policy output left in
   live prose across the eight artefacts D3 names.
3. **F6 per D2:** name the share-floor class as an input with its reason, and correct `spec.md`'s
   deferral, which asserts that no live row states a figure. → verify: the corrected sentence is true
   of the tree it is written on.
4. Re-run `pnpm figures:write` and report the coverage line the task leaves. → verify: gate exit 0.

## Definition of Done

- Every figure this task writes was measured on the tree the task leaves, not carried over.
- No policy or `computeMetrics` output remains in live prose in the eight artefacts D3 names.
- The share-floor class is named with its reason and its addresses counted, per D4.
- `spec.md`'s deferral states what is true rather than what was hoped.
- `pnpm check:figures` and `pnpm check:tasks` exit 0.

## Outcome (2026-09-13)

Landed. Docs only. **This task edited no file under `src/`**, no `scripts/` file, and the generated
table is byte-identical afterwards — md5 `22bc618fc949c02810ae689f61ad65c1`, unchanged, because no
marker moved: the four rows carried figures that never had one.

### The four figures, re-derived before they were touched

Measured by importing `computeMetrics` and `computeInspectorLayout` directly, with the same
`lineH: 18` / `headerFixedH: 112` stand-ins the gate uses:

| site | what it said | re-derived |
|---|---|---|
| `screens.md` compact row | «26 and 24 at the default 13 px» | `panelHeadH` 26, `fileRowH` 24 at compact — **correct** |
| `test-plan.md` AC-03 row | «`headerMaxH` is 34 — the `panelHeadH` guard, not the 16 px allowance» | 34 at **comfortable** only. Compact gives **36**, relaxed **43** |
| `test-plan.md` AC-04/05 row | «606 … not the 320» at 640 px | `fileCount: 0` → **606**; `fileCount: 30` → **320** — both correct |
| `test-plan.md` release bullet | «36 expanded against 27 collapsed» at compact | **correct** |

**Every one was true.** The defect was never accuracy — it was that a true figure in live prose is a
figure that goes stale silently, which is the whole of D3.

### O11 closed in the same edit, and it was a second defect on that line

The AC-03 row named **one** expected value and no density. The allowance term
`remainder − protectedList` is 16 at comfortable, **36 at compact** and **−7 at relaxed**, so
`max(allowance, panelHeadH)` resolves differently: the `panelHeadH` guard binds at comfortable and
relaxed, while **at compact the allowance is the larger term and wins**. The row asserted the guard
binds, full stop. It now says the row has three expected values, names which term wins where, and
points at the table's expanded 110 px rows.

### What the four rows say now

`screens.md` → a pointer at §Density tokens, under a dated marker. `test-plan.md` AC-03 →
`max(remainder − protectedList, panelHeadH)`, `LIST_ROWS_FLOOR`, the per-density split, and a pointer.
AC-04/05 → `remainder − panelHeadH` against `(1 − LIST_SHARE_FLOOR) × remainder`, with the two
assertion-output quotations replaced by what the assertion reports rather than the pixels it prints.
The release bullet → a back-reference to the table rows it already names two sentences earlier.

**A comment- and fence-blanked scan over `spec.md`, `sad.md`, `ux-flows.md`, `screens.md`,
`test-plan.md`, `DESIGN.md` and `ARCHITECTURE.md` for `606`, `766`, `0.754545`, `0.690909`,
`0.609091`, `0.672727`, `0.585` and `0.727273` returns nothing.**

### The exclusion D4 requires me to name: the share floors are INPUTS

Owner decision **D2** of round 19. `LIST_SHARE_FLOOR = 0.5` and `COLLAPSED_LIST_SHARE_FLOOR = 0.75`
(`inspector-layout.ts:35-36`) stay in live prose as «50 %», «75 %», «half» and «three quarters».

**The reason, stated so a future sweep does not "fix" them.** An acceptance criterion states the
requirement and the constant implements it, so the direction of truth runs prose → code. AC-02 says
the collapsed list takes at least three quarters *because that is the requirement*; the constant is
how the code meets it. Moving one of those constants is an owner act that amends the criterion — it
is not drift, and a gate that flagged it would be flagging the spec for disagreeing with an
implementation detail. This is the `MIN_BOTTOM_PX` precedent T73 already applied to window minimums
and remainders.

**The exposure this leaves, named rather than implied.** If the owner *does* amend one of those
constants without amending the criteria, nothing catches it: the gate's heuristic sees no percentage
and no words-form, and the reference table has no row for a floor. That is a deliberate consequence
of calling them inputs, not an oversight.

**The addresses, counted on the tree this task leaves.** A comment- and fence-blanked scan for
`50 %|75 %|three quarters|half of it|at least half` over the seven live artefacts returns **31 lines
/ 42 occurrences** — of which **one line is this decision's own record** in `spec.md`, leaving **30
live lines / 39 occurrences**: `spec.md` ×8, `sad.md` ×5, `ux-flows.md` ×1, `screens.md` ×3,
`test-plan.md` ×10, `DESIGN.md` ×3. Round 19's finding reported «ten addresses» from a narrower
vocabulary; that figure was short by twenty lines, and the correction is recorded here rather than
left to the next reviewer to find.

### `spec.md`'s deferral now states what is true

It ended «the row states no figure». That was false twice: four rows stated policy outputs, and
thirty state a share floor. It now says what was actually established — **no live row states a figure
the policy or `computeMetrics` PRODUCES**, and what rows do state are the inputs those functions are
fed — and names the share-floor ruling with its reason.

### Gate

- `pnpm check:figures` — exit **0**. `figures: 2 markers in 1 file(s), 2 distinct claims, 6 values
  recomputed`; `coverage: 1 figure(s) … 1 of them`, still `DESIGN.md:73`'s type-scale false positive.
- **The coverage line did not move: 1 → 1.** That is the point of F5. Four rows carrying policy
  outputs were migrated and the gate's own number is unchanged, because it could not see them.
  **A coverage of 1 is not evidence that D3 holds**, and the next wave should not read it as such.
- `pnpm figures:write` — round-trips byte-identically, md5 `22bc618fc949c02810ae689f61ad65c1`.
- `pnpm check:tasks` — exit 0.
- `pnpm test`, `pnpm lint`, the Rust half: untouched by this task, measured at the end of the wave.
