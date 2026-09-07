---
id: T29
title: "Round-3 fixes: owned focus keys, header cap feedback, the AC-03 and AC-09 rows, test hygiene"
layer: "app"
deps: ["T27", "T28"]
acs: ["AC-03", "AC-04", "AC-06", "AC-08", "AC-09", "AC-13", "AC-16"]
files_hint: [
  "src/app/features/commit-list/commit-list.ts",
  "src/app/features/commit-list/commit-list.html",
  "src/app/features/commit-list/commit-list.spec.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "src/app/core/services/inspector-layout.ts",
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/features/diff-workspace/diff-workspace.spec.ts",
  "src/app/features/working-changes/working-changes.spec.ts",
  "src/app/shared/ui/virtual-row-focus.spec.ts",
  "src/app/core/services/current-repo.service.ts",
  "AGENTS.md",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T29 — Round-3 fixes

## Why

The third review of 2026-09-04 found every earlier finding closed but three partials and one gap the two previous backstops missed — [review round 3, R1–R5, R7–R9, R11–R14](../_review/review-2026-09-04-round3.md). None violates an AC on a traced path; each is either a correctness that holds by incidental ordering, a declared row with no assertion, or a value the policy computes and nobody checks.

## What

Production, each with a pinning test written first:

- **Owned focus keys (R1, AC-08)** — `commit-list.ts` `restoreRowFocus`: expire only keys this list can own, tested positively like `changes-list.ts:123`, never `!key.includes(':')`. Preferred shape: the commit row renders a prefixed key (`commit:<sha>`) so both lists use `startsWith` and the inspector's bare path stays unambiguous; update `focusedRowKey()` consumers and the T20 pure row in `diff-workspace-state.spec.ts` that lists the real key shapes. A sha-shape match is the fallback if the prefix ripples too far. Test (component, `MainContent` rendered so both lists mount): open from an inspector file row, close → `document.activeElement` is that row and `focusRestored` ran exactly once; the row must fail if the commit list expires bare keys again — assert the inspector row keeps focus *and* that the list's own effect ran (e.g. it remounted with rows).
- **Commit-list half of D3 (R2, AC-08)** — in `commit-list.spec.ts`, from the existing AC-08 row: remove the target sha from `repo.commits` before Close → after the remount `pendingFocusKey()` is `null` and no row or viewport took focus.
- **Header cap feedback (R3, R8, R9; AC-03, AC-04, AC-06)** — `inspector-layout.ts`: `headerMaxH = Math.max(remainder − floor − fileListHeight(), panelHeadH)`, rounded to whole pixels; `diffHeight` uses `Math.min(headerHeight(), headerMaxH)` as its header term so it never reports below the floor when the cap binds. `commit-inspector.ts:577,584` then key and write the rounded value. Pure rows in `inspector-layout.spec.ts`: `headerMaxH` added to the 6 × 30 table, the `panelHeadH` floor at a tiny remainder, and `diffHeight ≥ floor` with a `headerFixedH` larger than the cap; the W-01d bonus at `commit-inspector.spec.ts:440` stays green with more rows granted, not fewer.
- **AC-03 row asserts the cap (R4)** — `main-content.spec.ts:263`: read the host's `--inspector-header-max-h` (inline custom property, as `commit-inspector.spec.ts:197` does) and assert it equals the policy's value for the fixture (560 px, 30 refs, two files) and is ≥ `panelHeadH`; keep the `headerBounds` check.
- **AC-09 component row (R7)** — `diff-workspace.spec.ts` (or the inspector spec): click another file row and press previous / next with the workspace open → exactly one `[data-testid="diff-workspace"]` in the DOM at every step, the strip shows the new path, and `open` is not called a second time (spy on the service or count state transitions).

Docs and hygiene:

- `AGENTS.md:72`: list the six `src/testing/` stand-ins or point at the directory (R5).
- `virtual-row-focus.spec.ts:66-71`: `settle()` becomes one tick (R11).
- `working-changes.spec.ts`: export `WATCHER_DEBOUNCE_MS` from `current-repo.service.ts` and derive `afterDebounce` from it (or fake timers) (R12); `await` each `emitRepoChanged` (R13); the interleave row asserts `changesOrigin() === 'own'` and an unchanged toast list after `own.resolve` (R14).
- `test-plan.md`: the AC-09 row carries T29; the round-3 rows already appended by the review keep their expected columns.

## Definition of Done

- [ ] Each production change has a test that was red before it and is green after; the two AC-08 rows fail if the commit list expires a bare key or if the dropped sha is focused.
- [ ] `headerMaxH` is asserted in the pure table and on the rendered host; `diffHeight` never reports below the floor when the cap binds.
- [ ] `AGENTS.md` matches `src/testing/` at the task's commit.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; no real-time sleep longer than the debounce it waits for.
- [ ] Any file outside `files_hint` is recorded in a «Files beyond `files_hint`» note here.

## Notes

`commit-list.ts` and `inspector-layout.ts` / `commit-inspector.ts` are independent lanes; the spec files overlap with nothing in flight. If the prefixed commit-row key is chosen, `commit-list.html` (`data-focus-key`) and the T20 shape row change together — one commit.

**Files beyond `files_hint`:** `DESIGN.md` — the `--inspector-header-max-h` range cell said «0 when they leave nothing», which the new `panelHeadH` floor made false; that cell only.

**Spec edits by lead ruling (2026-09-04):** the RED step's rows stood; two adjustments were authorised by the lead during GREEN and no assertion was weakened. `inspector-layout.spec.ts:36` — `diffHeight` expectation `196` → `210` in the pre-existing squeeze row: 196 pinned the pre-R3 semantics (the diff reporting below its 210 floor while the header exceeded its 116 px cap); `listRows` 2 / `clampLines` 1 unchanged. `commit-list.spec.ts` R2 row — the file-row click + settle the T27 row already performs was inserted before `mod+d`, because the inspector registers the opener only for an active file row; every assertion of the row stayed as written.

**RED classification (test-author):** 7 GOOD red (`inspector-layout.spec.ts:344,381,397,415`, `commit-list.spec.ts:242,270`, `main-content.spec.ts:308`), 1 BAD red by design (`WATCHER_DEBOUNCE_MS` import until exported), 3 false-pass kept as pins (`commit-list.spec.ts:308` ordering pin, `diff-workspace.spec.ts:299` AC-09, `working-changes.spec.ts:405` own origin), 1 NON-red at the 560 px fixture (`main-content.spec.ts:284`, jsdom yields integral math — strengthened by the 561 px row).
