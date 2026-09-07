---
id: T30
title: "Round-4 fixes: the inspector expires its own key, the cap pinned on host and table, shared row-key shapes, exact debounce wait"
layer: "app"
deps: ["T29"]
acs: ["AC-03", "AC-08", "AC-16"]
files_hint: [
  "src/app/core/services/diff-workspace-state.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "src/app/features/commit-list/commit-list.ts",
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "src/app/core/services/inspector-layout.ts",
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/features/working-changes/working-changes.spec.ts",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T30 — Round-4 fixes

## Why

The fourth review of 2026-09-04 found every round-3 finding closed except R4, plus one net T29 removed without replacing — [review round 4, Q1–Q2, Q4–Q7](../_review/review-2026-09-04-round4.md). Scoping the commit list's expiry to its own `commit:` keys was right, but the bare-path key the inspector owns is now expired by nobody when its row is gone; and the cap the policy hands back is asserted by shape, never by value.

## What

Production, each with a pinning test written first:

- **The inspector expires its own key (Q2, AC-08)** — `commit-inspector.ts:325-334`: when `pendingFocusKey()` is a key this component owns (a commit file row's bare path — positive ownership test through the shared shapes below, never «has no colon») and no file row carries it, call `workspace.focusRestored(key)` and return, as `changes-list.ts:119-125` does for `side:` keys. Keep the `!viewport` early return as it is (a collapsed file list still restores when expanded). Component row, mirroring `working-changes.spec.ts:400`: open from a commit file row, republish the commit's files without that path (external → the workspace closes), settle → `pendingFocusKey()` is `null` and no row took focus; add the path back → still nothing focused. The row must fail if the expiry is removed. Whether the inspector also guards the AC-17 close (same path in the next selected commit) is the implementer's call; the absent-row expiry is the floor.
- **Shared row-key shapes (Q4, AC-08)** — `diff-workspace-state.ts`, next to `focusKeyFor`: export the commit-row shape (`commit:<sha>`) — a `commitRowKey(sha)` helper and whatever ownership predicate the two lists and the inspector need. `commit-list.ts` drops its private `ROW_FOCUS_PREFIX` and imports the helper; the T20 shape row in `diff-workspace-state.spec.ts:290-315` asserts the imported helper, not a local literal, so reverting the prefix fails it. `changes-list.ts` keeps `rowFocusKey` unless the predicate makes the three owners one shape family — then move it too, one commit.
- **The AC-03 host row asserts the cap's value (Q1, AC-03)** — `main-content.spec.ts:297-303`: compute the expected `headerMaxH` with `computeInspectorLayout` from the inputs jsdom hands the layout pass (`availableHeight` 560, the fixture's file count, `bodyLines` 0, header and list expanded, `stackedPanelsHeight` 0, tokens from `AppearanceService` with `lineH` 0 and `headerFixedH` 0) and assert the host's `--inspector-header-max-h` equals `${expected}px`; keep the `headerBounds` and the `≥ panelHeadH` checks. If the measured inputs differ from those, assert the literal the host writes after confirming by hand that it equals the policy's value — never loosen to a bound.
- **`headerMaxH` pinned in the pure table (Q5, AC-03)** — `inspector-layout.spec.ts:36-38,53`: `headerMaxH` 116 in the comfortable squeeze row and 120 in the compact sibling (both recomputed by the review); the R3 row at `:399` may assert the exact cap as well.
- **Policy comment (Q6, AC-03)** — `inspector-layout.ts:44-52`: one sentence saying the clamp yield keeps the header under its cap without scrolling and can only lift the reported `diffHeight` above the floor, never lower it.
- **Exact debounce wait (Q7, AC-16)** — `working-changes.spec.ts:238-241`: `afterDebounce` waits exactly `WATCHER_DEBOUNCE_MS` (two timers of equal delay fire in scheduling order) followed by a macrotask flush, or the AC-16 row runs under fake timers. If fake timers break the Tauri event bridge (`src/testing/tauri-events.ts`) or `afterNextRender`, the exact wait is the fallback. No `+ 50`.

Docs:

- `test-plan.md`: the round-4 rows carry T30 and their expected columns match what the rows assert.

## Definition of Done

- [ ] Each production change has a test that was red before it and is green after; the inspector row fails if the absent-row expiry is removed; the T20 shape row fails if the `commit:` prefix changes in one place only.
- [ ] `--inspector-header-max-h` on the rendered host equals the policy's value for the fixture; `headerMaxH` has exact values in the pure table.
- [ ] `afterDebounce` sleeps no longer than `WATCHER_DEBOUNCE_MS` of real time per call.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; Rust gate untouched (no `src-tauri` change).
- [ ] Any file outside `files_hint` is recorded in a «Files beyond `files_hint`» note here.

## Notes

`diff-workspace-state.ts` → `commit-list.ts` / `commit-inspector.ts` is one compile-coupled lane (the shared shapes); the layout rows and the debounce wait touch only spec files and are independent. The AC-08 rows of T29 (`commit-list.spec.ts:242,270,316`) must stay green: the inspector expires only when the row is absent, and a present row is still focused with exactly one `focusRestored`.

**Corrections found during RED (test-author, 2026-09-04):** the Q2 route described above («external republish without the path → the workspace closes») does not exist for a commit source — `setFiles` closes on `external` only for a working-tree side (`diff-workspace-state.ts:109`); a commit advances. The AC-17 route false-passes because the restore effect fires while the old rows are still drawn. The row therefore empties the commit list under the open workspace (AC-07 keeps it open) and then closes, so the key becomes pending with no row present; then the path returns. The Q1 `fileCount` is 4, the rows the tree view draws for the fixture (`fileRows().length`), not its two files; the expected cap at 560 px is 126.

**GREEN ruling (lead, 2026-09-04):** the literal guard «owned key and `index < 0` → expire» turned the T29 row `commit-list.spec.ts:242` red: `app-commit-inspector` is mounted on every view but Changes, so a panel with no commit loaded expired a key it knew nothing about. The landed guard expires only when `focusKeyOwner(key)` is `commit-file`, `details()` is loaded and its `files` no longer contain the path — a filter keystroke or a collapsed folder hides a row without removing it (the AC-11 reasoning already in the republish effect) and must not expire it. Shared shapes: `commitRowKey(sha)` and `focusKeyOwner(key): 'commit-row' | 'working-tree' | 'commit-file'` exported from `diff-workspace-state.ts`; `changes-list.ts` keeps its per-side `startsWith` because the owner predicate is not a one-for-one replacement. Two mutations checked by the implementer (the new `focusRestored` removed → the Q2 row fails; the prefix changed → the T20 shape row and `commit-list.spec.ts:270` fail). No file outside `files_hint`.

**RED classification (test-author):** 1 GOOD red (`commit-inspector.spec.ts:711`, `expected 'b.ts' to be null`), 1 BAD red by design (`commitRowKey` import until exported — a compile error, so the other files were verified with a temporary export, reverted), 3 false-pass pins verified by mutation (`main-content.spec.ts:311` pins the host's `--inspector-header-max-h` as equal to `computeInspectorLayout` for the fixture and carries no literal, so what fails it is a wrong `fileCount` or an unbounded writer breaking the equality, and the literal 126 was added later by T31 (V3); `inspector-layout.spec.ts:38,57` 116 → 117 and 120 → 121 fail), 1 hygiene (`working-changes.spec.ts:239` exact wait + macrotask flush, three runs 14/14 green, no fake timers because the row drives the real Tauri event bus and `afterNextRender`).
