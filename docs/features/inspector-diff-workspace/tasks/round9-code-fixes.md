---
id: T40
title: "Round-9 code fixes: pin the two live layout guards, cover the workspace chevron gate, release the empty list's share"
layer: "domain"
deps: ["T41", "T43"]
acs: ["AC-03", "AC-04", "AC-05", "AC-06"]
files_hint: [
  "src/app/core/services/inspector-layout.ts",
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/diff-workspace/diff-workspace.spec.ts",
  "src/app/shared/components/main-content/main-content.ts",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T40 — Round-9 code fixes

## Why

`a1694d7` rewrote `inspector-layout.spec.ts` around the amended subject and, in the same edit, deleted three rows: the 12-case `it.each` table (whose subject `diffHeight` no longer exists — correctly gone), **and two rows that were the only cover for two guards that are still live**. Measured on the whole suite by stage 2 and re-run independently by the lead, each on a tree verified clean before and after — [review round 9, R9-S2-F1…F4 and R9-S1-F10](../_review/review-2026-09-08.md):

```
inspector-layout.ts:77  Math.round(Math.max(headerAllowance, panelHeadH)) → Math.round(headerAllowance)
  → 63 files / 831 passed
inspector-layout.ts:98  Math.max(LIST_ROWS_FLOOR, Math.floor(listHeight / fileRowH)) → Math.floor(listHeight / fileRowH)
  → 63 files / 831 passed
diff-view.ts:239        computed(() => false)  → 63 files / 831 passed
diff-view.ts:239        computed(() => true)   → 63 files / 831 passed
```

The two layout guards are not decorative. In a configuration the app ships — inspector at the bottom minimum (`main-content.ts:46` `MIN_BOTTOM_PX = 220`) with blame **and** file history stacked (`main-content.ts:268,272` → 30 % + 20 % = 110 px) — the policy's own arithmetic gives:

```
remainder=110  headerAllowance=16  → headerMaxH = 34 (the panelHeadH guard binds; without it, 16)
listHeight=42  floor(42/30)=1      → listRows  = 2  (the floor binds; without it, 1)
```

A 16 px cap is exactly the «hidden behind its own scrollbar» failure the comment at `inspector-layout.ts:22-28` says the guard prevents, and on a shorter remainder `Math.floor` goes negative and a negative integer reaches `--inspector-list-rows` (`commit-inspector.css:184`). The nominal replacement rows do not see either: `:277-293` pins `headerMaxH === 56` at 150 px, where the guard does not bind, and the 144-configuration loop's smallest height is 200 px, where `atLeastAHead` is satisfied by arithmetic rather than by the guard.

The fourth item is a behaviour gap the reversal opened. The `fileListCollapsed` branch at `inspector-layout.ts:68-72` exists precisely because a block with nothing to show must not claim a share; `fileCount === 0` is the same situation and is not handled:

```
right 640 px, 0 files          → headerMaxH = 320   (half the column reserved for a list of zero rows)
right 640 px, list collapsed   → headerMaxH = 606
```

Reachability is higher than «a commit with no files»: the policy is fed the *displayed* rows, not the commit's files (`commit-inspector.ts:547`), so a filter matching nothing puts any commit into that state — a one-line «no match» message plus half a blank column, with the header artificially capped and scrollable. Under the pre-reversal policy that space was the diff slot, so it was never visible.

## What

- **Pin both guards with one row (R9-S2-F1, R9-S2-F2, AC-03)** — `inspector-layout.spec.ts`: add the bottom-minimum-with-both-panels configuration (`availableHeight: 220, stackedPanelsHeight: 110, fileCount: 30`, comfortable tokens) asserting `headerMaxH === COMFORTABLE_TOKENS.panelHeadH` (34) and `listRows === 2`. Verify by running both mutations above: each must redden this row and only it. Compact tokens are worth a second row only if the numbers differ meaningfully.
- **Cover the chevron gate (R9-S2-F3 / R9-S1-F10, AC-06)** — the per-file collapse control must be asserted present in the Changes inline viewer and absent inside the workspace. Both directions must redden: `inWorkspace` forced to `false` and forced to `true`. Put it where the repo keeps diff-viewer component rows; there is no `diff-view.spec.ts` today, so creating one is expected. T41 gives AC-06 the clause this row pins.
- **Release the empty list's share (R9-S2-F4, AC-04, AC-05)** — extend the branch at `inspector-layout.ts:68-72` to `fileListCollapsed || fileCount === 0`, so a list with nothing to draw claims a bare head like a collapsed one. The comment above it already states the rule; widen it to name both cases. Pin it: 0 files at 640 px must give `headerMaxH === 606`, matching the collapsed row at `:185-199`. Check the two consumers of `listRows === 0` (`commit-inspector.ts:594`, the empty-state copy at `commit-inspector.html:296-303`) still render as they did.
- **Correct the stale comment (O4)** — `main-content.ts:264-266` still says the pixels the commit inspector releases «belong to the diff slot alone (AC-19)». Amended AC-19 gives them to the commit file list. One sentence; the file was missed by the reversal because only its `.html` and `.spec.ts` were in the wave.
- **Optional, zero-cost (O3)** — `inspector-layout.spec.ts:356-364`'s escape hatch is taken by 0 of the 144 configurations (reproduced). Deleting the clause makes the row strictly stronger; do it unless it turns a configuration red, in which case that configuration is a finding of its own.

## Definition of Done

- [ ] Both layout mutations above redden the suite; the exact failing row and its `file:line` are recorded here with the run output.
- [ ] Both `inWorkspace` mutations redden the suite; same recording.
- [ ] 0 files at 640 px yields `headerMaxH === 606`, and the mutation that reverts the `fileCount === 0` clause reddens the new row.
- [ ] `grep -rn "diff slot\|diff share" src --include=*.ts --include=*.html --include=*.css | grep -v spec` returns only the dated historical note at `inspector-layout.ts:51`.
- [ ] No existing assertion relaxed, removed or emptied; `expect(` counts per touched spec file recorded before and after.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit -p tsconfig.spec.json` clean; no `src-tauri/` change.
- [ ] Every mutation run in a tree verified clean before and after (`git status --porcelain -- src` empty), per the round-8 standing note.

## Outcome (2026-09-08)

Landed. Every measurement below was taken **after T43**, on a serial, deterministic gate — the parallel gate this task started against gave 1, 0 or 4 random failures a run and no measurement on it was worth quoting.

**RED classification.** One genuine red was reachable, the other two rows characterise code that already existed and are verified against named mutations instead:

| row | first run | evidence |
|---|---|---|
| `claims no share when there is nothing to draw…` | **GOOD red** — `AssertionError: expected 320 to be 606`, 1 failed / 831 passed | the finding reproduced before a line of production code moved |
| `binds both hard floors at the bottom placement…` | false-pass (the guards are correct; their *cover* was the gap) | MUT-A, MUT-B below |
| `AC-06: the workspace withholds the per-file collapse chevron…` | false-pass (the gate shipped in `2049df4`) | MUT-D, MUT-E below |

**Mutations.** Each on a tree verified clean before and after; each reddens exactly one row:

| # | Mutation | Result |
|---|---|---|
| MUT-A | `inspector-layout.ts:77` drop `Math.max(…, panelHeadH)` | 1 failed / 833 — `binds both hard floors…`, `expected 16 to be 34` |
| MUT-B | `inspector-layout.ts:98` drop `Math.max(LIST_ROWS_FLOOR, …)` | 1 failed / 833 — same row, `expected 1 to be 2` |
| MUT-C | revert the `fileCount === 0` arm | 1 failed / 833 — `claims no share…`, `expected 320 to be 606` |
| MUT-D | `diff-view.ts` `inWorkspace` → `computed(() => false)` | 1 failed / 833 — chevron row, `expected <button …> to be null` |
| MUT-E | `diff-view.ts` `inWorkspace` → `computed(() => true)` | 1 failed / 833 — chevron row, `expected null not to be null` |

Before T43, MUT-A and MUT-B each left **831/831 green** — reproduced serially at pristine HEAD, which is what confirms R9-S2-F1 and R9-S2-F2 rather than the parallel noise.

**Where the rows landed, and one deviation from the plan.** The chevron row went into `diff-workspace.spec.ts` rather than a new `diff-view.spec.ts`: that file already hosts `MainContent` for the AC-06 rows, so the row can drive the real open path and assert **both** directions in one arrange — the chevron is gone inside the workspace and comes back when the element returns to its parking slot. A bare `DiffView` fixture would have tested the `computed`, not the gate. The 144-configuration loop also needed a `nothingToDraw` exemption: `fileCounts` includes 0, and an empty list no longer claims a share by design.

**O-3 taken.** The loop's `twoRowFloorBinds` escape hatch is gone — measured dead (0 of 144 configurations reach it) and the loop stays green without it. The comment records the height at which it would be needed again, so it can be restored deliberately rather than rediscovered.

**O-4 taken.** `main-content.ts:264-266` now says the released pixels belong to the commit file list, and names AC-05's «left empty» rule beside it.

**Gate:** `pnpm test` 834 tests / 63 files green · `pnpm lint` (biome, 266 files) clean · `tsc --noEmit -p tsconfig.spec.json` clean · `pnpm build` 908.10 kB, no budget warning. Rust gate skipped: `git status --porcelain -- src-tauri` empty, this branch's precedent. `expect(` counts rose 47 → 52 and 29 → 33; none was removed or relaxed.

## Notes

`deps: [T41]` is for the criteria text only: AC-05's correction and AC-06's new clause are what the third and second bullets pin. If T41 slips, the code changes are still correct — the wording they cite is not.

The commit must carry `SDD-Task: T40` and its `SDD-AC` trailers (R9-S1-F9).
