---
id: T35
title: "Feed the amended policy into the commit inspector and drop the diff-share patch"
layer: "ui"
deps: ["T34"]
acs: ["AC-03", "AC-04", "AC-06"]
files_hint: ["src/app/core/services/inspector-layout.ts", "src/app/features/commit-inspector/commit-inspector.ts", "src/app/features/commit-inspector/commit-inspector.html", "src/app/features/commit-inspector/commit-inspector.spec.ts"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T35 — Feed the amended policy into the commit inspector and drop the diff-share patch

## Why

`2049df4` made the History diff slot a zero-height parking home and left the file list as the only growing child, but it did it in the template: `commit-inspector.ts:597` still reads `layout.diffHeight` and adds `Math.floor(layout.diffHeight / fileRowH)` to `--inspector-list-rows` to undo the policy's 6-row cap. With T34 the policy reports the right number directly, and four rows of `commit-inspector.spec.ts` still assert the old design (six-row cap, a growing diff slot, a click that only selects) — [spec AC-03, AC-04, AC-06 as amended](../spec.md).

## What

- `--inspector-list-rows` comes straight from the policy; the `diffHeight` arithmetic and the local field it feeds are removed.
- The History diff slot stays zero-height whether the workspace is open or closed (AC-06); the Changes view keeps its real, growing slot and its inline viewer untouched.
- Rewrite the four failing rows against the amended criteria:
  - `AC-03: the minimum height writes two list rows and one clamp line (T27)` — the squeezed column now yields the clamp first and the rows last.
  - `AC-04: thirty files get six rows of height and the total count` — no cap; the row count is what the column fits, with the total count still shown.
  - `AC-04 / AC-06: the list takes the diff share while the workspace is open (T27)` — the list keeps the same rows open or closed, because there is no diff share to take.
  - `AC-06: mod+d opens the workspace once on the active row` — the shortcut still opens exactly once with the click-opens-workspace default on.

## Definition of Done

- [ ] No occurrence of `diffHeight` remains in `commit-inspector.ts`; `--inspector-list-rows` is written from the policy's `listRows` alone.
- [ ] A component row asserts the History diff slot has zero height with the workspace closed and with it open, and that the Changes view's slot still grows.
- [ ] The four rows above pass against the amended ACs, each naming the criterion it encodes.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean; no `src-tauri` change.

## Notes

Compile-coupled lane with T34 through `inspector-layout.ts` (see T34's note). Serialized with T36 through `commit-inspector.spec.ts`.

## Outcome (2026-09-07)

Landed in `a1694d7` together with T34, under one gate: removing `diffHeight`
from `InspectorLayout` breaks `commit-inspector.ts` at compile time, so neither
task can be green on its own — the compile-coupled lane the breakdown
predicted.

**Boundary:** the DoD asked this task for the row asserting the History diff
slot has zero height. The slot is rendered by `main-content.html`, not the
inspector's own template, so that assertion could not be written here; it
landed in **T37**, which mounts the workbench and can see it.

The AC-03 row could not keep pinning a row COUNT: jsdom gives every box zero
height, so at the squeezed column the policy has room it never has at
960×640 and nothing yields. The row now stubs the header's `scrollHeight`
(`measureHeaderAs`, new helper) to make the header cost something, and asserts
the clamp at its floor with the list still at or above two rows. The exact
arithmetic stays in `inspector-layout.spec.ts`, which is where the repo's own
testing policy wants it.
