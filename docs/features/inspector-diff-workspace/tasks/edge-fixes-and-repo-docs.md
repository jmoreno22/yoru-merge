---
id: T28
title: "Edge fixes: refresh race, shared origin, expiring focus key, residual AC-07 reset, bounded header, view-scoped toggles, zero-height restore; repo docs"
layer: "app"
deps: ["T19", "T20", "T21", "T22", "T23"]
acs: ["AC-03", "AC-07", "AC-08", "AC-12", "AC-13", "AC-16"]
files_hint: [
  "src/app/core/services/ops/repo-ops.ts",
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/core/services/diff-workspace.service.spec.ts",
  "src/app/features/working-changes/changes-list.ts",
  "src/app/features/commit-list/commit-list.ts",
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.css",
  "src/app/shared/components/main-content/main-content.html",
  "src/app/shared/ui/virtual-row-focus.ts",
  "src/app/shared/ui/index.ts",
  "src/app/shared/ui/README.md",
  "DESIGN.md",
  "AGENTS.md",
  "ARCHITECTURE.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T28 — Edge fixes and repo docs

## Why

The stage-2 pass of the re-review of 2026-09-04 found seven narrow behavioural edges in the code T19–T23 wrote, and five places where the repo's own docs describe the pre-fix behaviour — [review 2026-09-04 D1–D5, D12, C2, C6–C9, D15, D16](../_review/review-2026-09-04.md). None violates an AC on the happy path; each can put a stale patch, a wrong notice, a stolen focus or a starved diff slot on screen.

## What

Fixes, each with a pinning test written first:

- **Refresh race (AC-16)** — `repo-ops.ts` `refreshActiveDiff`: re-read `diffSource` after the `await` and drop the response when the source moved, as `loadDiff` already does with `isSelectedFile`. Test: source changes mid-flight → `diffText` is not overwritten.
- **Shared origin (AC-13, AC-16)** — `repo-ops.ts` `loadChanges`: capture the origin before the `await` and write it in the same synchronous step as `changes` (or carry it in the payload), so a staging refresh and a watcher refresh in flight together cannot publish under each other's origin. Test: interleave the two loads; each publish carries its own origin.
- **Expiring focus key (AC-08)** — `changes-list.ts` / `commit-list.ts`: when the pending key belongs to this list's side but the row is gone, call `focusRestored(key)` without focusing, so a path that reappears later does not steal focus. Test: AC-16 close with the row gone, then the row returns → nothing is focused.
- **Residual AC-07 reset (AC-07)** — `diff-workspace.service.ts`: the branch that clears `diffText` for an emptied commit list also resets `activeCommitFile`, so the file reloads once the list repopulates. Test: empty → repopulate → click the same file → one `get_commit_file_diff` call.
- **Bounded header (AC-03)** — `commit-inspector.css` / `main-content.html`: the header gets a bound again — a `max-height` derived from the policy's available height with `overflow-y: auto`, or a wrapper that can shrink — so a commit with many refs at 960 × 640 cannot take the `flex-1` diff slot below the 50 % floor. Keep the F-8 measurement (`headerFixedH` from the laid-out box). Test: 30 ref badges at the minimum height → the diff slot keeps its floor.
- **View-scoped toggles (AC-12)** — `diff-workspace.service.ts`: the `when` of `inspector.toggle-header` / `inspector.toggle-files` also requires the inspector to be mounted (`railView() !== 'changes'`). Test: `mod+shift+h` in the Changes view flips no preference.
- **Zero-height restore (AC-08)** — `virtual-row-focus.ts`: when the viewport's cached height is 0 (list hidden while the workspace was open) call `checkViewportSize()` before `scrollToIndex`, or bound the wait on `renderedRangeStream`; confirm with the manual close-from-Changes check. Test: stand-in viewport reporting a zero range → the row is still focused.

Docs, so they match `HEAD`:

- `DESIGN.md` §Keyboard rank-4 row: «text field that declares `data-escape-clears`, with content — clears the value; any other field falls through to the next layer».
- `DESIGN.md` §Density prose: add the 75 % floor with the header collapsed and its place in the yield order.
- `AGENTS.md` §TESTING: name the four `src/testing/` stand-ins (`resize-observer.ts`, `virtual-scroll.ts`, `tauri-git-stub.ts`, `repo-fixtures.ts`) or point at the directory.
- `src/app/shared/ui/README.md`: list `focusVirtualRow` as a DOM-only helper next to the pure helpers.
- `ARCHITECTURE.md` §Layers: record the exception — `core` may import a template-less service from `shared/ui` by module path, never the barrel (the barrel re-exports `yoru-dialog`, which imports `core`).
- `src/app/shared/ui/index.ts`: drop the unused `DiffSourceSide` type export.

## Definition of Done

- [ ] Each of the seven fixes has a test that was red before the change and is green after.
- [ ] The five doc edits match the code as of the task's commit; no other prose in those files changes.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

Shares `diff-workspace.service.ts` and `commit-inspector.ts` with T27's specs: land T28 first or run the two in one lane. The bounded-header choice (CSS cap vs shrinkable wrapper) is the only design call here; prefer the cap derived from the policy so the F-8 measurement stays truthful.

**Files beyond `files_hint`** (recorded by review round 3, R6): `src/app/core/services/inspector-layout.ts` — the bounded header was implemented as a policy-derived cap (`headerMaxH`), so the pure policy had to return it; `src/app/features/commit-inspector/commit-inspector.spec.ts`, `src/app/features/working-changes/working-changes.spec.ts`, `src/app/shared/components/main-content/main-content.spec.ts` and the new `src/app/shared/ui/virtual-row-focus.spec.ts` — the pinning tests the DoD requires, placed in the specs that already host each surface.
