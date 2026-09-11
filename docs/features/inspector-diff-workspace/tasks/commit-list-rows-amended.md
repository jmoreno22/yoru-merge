---
id: T38
title: "Rewrite the two AC-08 restore rows for the click-opens-workspace default"
layer: "ui"
deps: []
acs: ["AC-08"]
files_hint: ["src/app/features/commit-list/commit-list.spec.ts"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T38 — Rewrite the two AC-08 restore rows for the click-opens-workspace default

## Why

The two `Commit list restore on close (AC-08)` rows were written when a single click on a file row only selected it. With `commitFileClickOpensWorkspace` defaulting to on ([AC-22](../spec.md)), the sequence they drive reaches Close in a different state: the first row fails at `expect(document.activeElement).toBe(restored.elementRef.nativeElement)` and the second throws `No commit row rendered` from its `commitRow` helper. [AC-08](../spec.md) itself is unchanged — the scroll offset is replayed and the originating row is focused on close — so the rows must be re-driven, not relaxed.

## What

- `AC-08: mod+d from a scrolled commit row replays the offset and focuses that row on close (T27)` — drive the open through `mod+d` in the state the default preference produces, and keep the three assertions (selected sha, `pendingFocusKey()` null, focus back on the restored row with its `aria-activedescendant`).
- `AC-08: a sha dropped from the history before Close expires without focusing anything (T29 — R2)` — re-establish the precondition so the row exists before it is dropped, then assert the key expires and nothing is focused.
- Pin the preference explicitly in both rows rather than relying on the default, so a later default flip does not silently change what they prove.

## Definition of Done

- [ ] Both rows pass with the preference pinned on, and a mutation that removes the focus restore in `commit-list` reddens the first row (run it, record the output in this file, restore the tree with `git checkout --`).
- [ ] No assertion was dropped or weakened relative to the T27 / T29 versions — the diff is the setup, not the expectations.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean; test-only change.

## Notes

Parallel start — independent file. The mutation-verification bar is the one review rounds 6 and 7 set on the Q2 row (T32, T33): no assertion advertised against a mutation it cannot detect.

## Outcome (2026-09-07)

Landed in `ff1582e`. The cause was the AC-22 default, exactly as scoped: both
rows click a file row to make it active before driving their gesture, and with
`commitFileClickOpensWorkspace` on that click opened the workspace itself and
unmounted the list — so `mod+d` never reached the list, and the dropped-sha row
could not find its commit row at all.

Fixed by pinning the preference off in `renderHistoryWorkbench`, which is also
the mode AC-06 names for these three gestures. No assertion was relaxed.

**Mutation run (DoD):** removing `viewport.getElementRef().nativeElement.focus()`
at `commit-list.ts:285` reddens the first row at
`expect(document.activeElement)` — `expected <body> to be
<cdk-virtual-scroll-viewport>`, 1 failed / 3 passed. Tree restored with
`git checkout --`.
