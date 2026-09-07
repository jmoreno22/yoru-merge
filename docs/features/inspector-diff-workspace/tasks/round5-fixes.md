---
id: T31
title: "Round-5 fixes: pin the shared key owner, type the working sides, fix the host cap's literal, test hygiene"
layer: "app"
deps: ["T30"]
acs: ["AC-03", "AC-08"]
files_hint: [
  "src/app/core/services/diff-workspace-state.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "docs/features/inspector-diff-workspace/tasks/round4-fixes.md",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T31 — Round-5 fixes

## Why

The fifth review of 2026-09-04 found every round-4 finding closed and no acceptance criterion violated — [review round 5, V1–V5](../_review/review-2026-09-04-round5.md). What it left is test-side: the predicate T30 centralised is pinned by nobody directly, the host cap row pins equality with the policy but not the value its DoD named, and two lines of the new rows cannot fail or repeat an injection.

## What

Tests first; production changes only where a type does:

- **Pin `focusKeyOwner` on the three shapes (V1, AC-08)** — `diff-workspace-state.spec.ts:303-322`: the T20 shape row (or a sibling next to it) asserts `focusKeyOwner(commitRowKey('abc123'))` is `commit-row`, `focusKeyOwner(focusKeyFor({ kind: 'working-tree', side: 'unstaged' }, 'src/a.ts'))` is `working-tree` (and the `staged` side), and `focusKeyOwner(focusKeyFor({ kind: 'commit', sha: 'abc123' }, 'src/a.ts'))` is `commit-file`. Keep the existing `startsWith` disjointness checks. The `working-tree` arm is what stops the inspector's `=== 'commit-file'` guard (`commit-inspector.ts:341`) from expiring a `side:` key — the row must fail if that arm is removed.
- **Type `WORKING_SIDES` from the source union (V2)** — `diff-workspace-state.ts:63`: declare the constant against the side type extracted from `DiffWorkspaceSource` (`Extract<DiffWorkspaceSource, { kind: 'working-tree' }>['side']`) so a renamed side fails to compile; no runtime change.
- **The host row pins the cap's literal (V3, V5, AC-03)** — `main-content.spec.ts:320-334`: keep the equality with `computeInspectorLayout` and add `expect(expected.headerMaxH).toBe(126)` (recomputed by the review: `round(560 − 280 − (34 + 4 × 30))`); hoist the `TestBed.inject(AppearanceService)` at `:312` into the `appearance` const the block already declares. Correct the RED note at `tasks/round4-fixes.md:61`: the landed row has no literal, so the «126 → 127» mutation applies only once this task adds it; the revert-sensitive half of the row is a wrong `fileCount` or an unbounded writer breaking the equality.
- **No vacuous assertion in the Q2 row (V4, AC-08)** — `commit-inspector.spec.ts:739`: `activeRowPath(host)` is null there because the list draws no rows; assert that `document.activeElement` is not a file row, or drop the line (the `:745-748` block already proves nothing took the focus once the path returns).

Docs:

- `test-plan.md`: the two round-5 rows carry T31 and their expected columns match what the rows assert.

## Definition of Done

- [ ] The `focusKeyOwner` row fails if any of its three arms is changed or removed; `WORKING_SIDES` is typed from the union.
- [ ] `expected.headerMaxH` is asserted to be 126 next to the host equality; `AppearanceService` is injected once in that row; `round4-fixes.md` describes the mutation that really applies.
- [ ] No assertion in the Q2 row that cannot fail.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; Rust gate untouched (no `src-tauri` change).
- [ ] Any file outside `files_hint` is recorded in a «Files beyond `files_hint`» note here.

## Notes

No production behaviour changes in this task; the only non-spec edit is the type of one constant. The V6 / V7 items of the same review are accepted limitations, not work: a POSIX path whose first segment starts with `commit:` / `staged:` / `unstaged:` misclassifies its key (Windows forbids `:`; the cost is a lost focus restore), and an AC-17 close whose next selected commit carries the same path focuses that commit's row.

**V4 outcome (review round 6, T32).** The line this task landed — `expect(host.contains(document.activeElement)).toBe(false)` — could not fail either, so [round 6](../_review/review-2026-09-07.md) reopened V4 and [T32](./round6-fixes.md) removed it. The bullet's first option («assert that `document.activeElement` is not a file row») was never available: the expiry lives in the `index < 0` branch of the restore effect (`commit-inspector.ts:337-348`), which calls `focusRestored(key)` and returns without focusing, and `focusVirtualRow` is unreachable there — so **any** assertion on where the focus went passes in both branches. What landed is the bullet's second option: the line is gone and the row is proved by `pendingFocusKey()` at `:738` (verified red by removing `focusRestored`) plus the returning-path block, which observes a drawn row.
