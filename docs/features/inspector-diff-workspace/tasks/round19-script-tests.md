---
id: T76
title: "Round-19 script test tier: the gates' parsers get a suite, because three reconstructions a wave is not enough"
layer: "infra"
deps: ["T75"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "scripts/registry-parse.spec.ts",
  "angular.json",
  "tsconfig.spec.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T76 — Round-19 script test tier

## Why

Owner decision **D4** of `_review/review-2026-09-11.md`.

`scripts/` held ~1 240 lines of load-bearing logic that CI runs on every PR and that **nothing under
`src/` covers**: `angular.json`'s test target discovers `**/*.spec.ts` under the project root only,
and `tsconfig.spec.json` did not reach the directory either. The wave that wrote the newest of those
scripts proved it with **three** reconstructions; round 19's stage-2 reviewer ran **24** and found
**four** silent passes, three of which are the defects T75 fixes.

The argument that won the decision is that arithmetic, not the principle: three attacks per
instrument is what a wave sustains by hand, and it is not what the defect needs. A suite does not get
tired between waves.

## Plan

1. **Reach the directory.** `angular.json`'s `include` gains `../scripts/**/*.spec.ts`;
   `tsconfig.spec.json`'s `include` gains `scripts/**/*.spec.ts` and `allowJs`, so a `.ts` spec can
   import a plain `.mjs` helper. → verify: a spec under `scripts/` runs in `pnpm test` and the file
   count goes up by one.
2. **Cover the parsers T75 extracted**, case by case, each one either a defect round 19 measured or
   the control that proves the fix did not trade one hole for another. → verify: green.
3. **Prove the cases are real detectors** by reverting each parser to its pre-fix form. → verify:
   each control reddens, and the module is md5-verified back to pristine after each.

## Definition of Done

- `pnpm test` discovers and runs the `scripts` tier; the file and test counts both rise.
- Every defect R19-F3 and R19-F4 name has a case, and each has a control that passes.
- Each of the three parser fixes has a measured revert that reddens the suite.
- What the tier does **not** cover is stated here, not left to be re-discovered.
- `pnpm lint` covers the new files.

## Outcome (2026-09-11)

Landed. Test infrastructure only. **This task edited no file under `src/`** and the five production
md5s are unchanged.

### The tier exists, and `pnpm test` is what runs it

`angular.json` `include: ["**/*.spec.ts", "../scripts/**/*.spec.ts"]`, `tsconfig.spec.json`
`include: [… , "scripts/**/*.spec.ts"]` with `allowJs: true`. Nothing else moved: `types` stays `[]`,
so the tier gets no ambient node globals and no new dependency was added — `@types/node` is not
installed in this repo and this task did not install it.

`pnpm test` goes **63 files / 844 tests → 64 files / 866 tests**. The new file is
`scripts/registry-parse.spec.ts`, **22 cases**. `pnpm lint` goes 268 → 269 files.

### What is covered, and why these cases

`listField` — both list layouts, an inline list spread over several lines, an inline empty list, a
block sequence quoted and unquoted, a block sequence stopping at the next field, an absent field
reported as absent rather than empty, a field whose name is a suffix of another, and a body that
looks like frontmatter but is not.

`graphBlock` / `graphNodes` / `graphEdges` — a commented-out line dropped at any indentation, only
the block under `## Task map` read, the fallback when that heading is absent, a node not invented
from an edge reference, `T7` told from `T70`, and edge direction preserved.

`trackerRows` / `trackerTotal` — a duplicated row kept so the caller can see it, and a missing total
reported as `null` rather than `0`.

### The three controls, measured

TDD was not reachable here in its strict form: the parsers were extracted from working code and the
spec was written against the extraction, so there was no red to start from. Each case was verified
against the **pre-fix** parser instead, which is the substitute this branch has used since T36 — and
the module was restored from a copy held outside the repo and md5-verified (`0b33494c6b8acfbee2cb…`)
after each.

| control | the parser reverted to | suite |
|---|---|---|
| **C1** | `stripMermaidComments` without its `%%` filter — the raw read | **2 failed** / 20 passed |
| **C2** | `listField` matching `field: [...]` only, returning absent otherwise | **3 failed** / 19 passed |
| **C3** | `graphBlock` joining every mermaid block instead of slicing `## Task map` | **1 failed** / 21 passed |

### What this tier does NOT cover, stated rather than implied

**The orchestration of both scripts is still uncovered.** `check-tasks.mjs` and `check-figures.mjs`
are top-level scripts that read the filesystem, shell out to `git` and call `process.exit`; they
cannot be imported without running. What has a suite is the parsing they are built on, which is where
all three of round 19's silent passes lived — but the scope derivation, the rung chain, the marker
sweep and the D4 assertion are covered only by their own reconstructions and by CI.

A black-box spec that spawns each script against a fixture registry was written and **set aside**:
it needs `node:child_process`, `node:fs` and `process`, and `tsconfig.spec.json` sets `types: []`
with no `@types/node` installed. Adding that dependency widens the ambient globals of all 63 existing
specs, which is not a change to make as a side effect of a gate fix. `check-tasks.mjs` was left ready
for it — `SDD_TASKS_BASE` overrides the registry path, and CI never sets it — so the spec is a
dependency decision away, not a redesign. The draft is kept at `C:\wt\reports-r19\`.

That is the honest boundary of this tier, and the next round should read it as a stated limit rather
than as a gap nobody noticed.
