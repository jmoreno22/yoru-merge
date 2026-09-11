---
id: T37
title: "Rewrite the three centre-wiring rows against the collapsed History diff slot"
layer: "ui"
deps: ["T35"]
acs: ["AC-03", "AC-06", "AC-18"]
files_hint: ["src/app/shared/components/main-content/main-content.spec.ts"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T37 — Rewrite the three centre-wiring rows against the collapsed History diff slot

## Why

Three rows of `main-content.spec.ts` encode the pre-reversal centre: they assert the inspector's diff slot is a growing (`flex-1`) child before the workspace opens and the only growing child at the bottom placement. After `2049df4` the slot is `h-0` in History and the file list is the growing child — the rows fail on exactly that, so they are stale, not broken code ([spec AC-06, AC-18 as amended](../spec.md), [ADR-0004 amendment](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md)).

## What

- `AC-06: the viewer option controls render once, inside the workspace, and the diff slot collapses` — before opening, the viewer element is parked in a **zero-height** slot in History, not a growing one; after opening, the controls render once inside the workspace; on close the element returns to the parking slot, still at zero height.
- `AC-03: a commit with thirty refs cannot leave the header unbounded at the minimum height` — the header is still capped, and `growingChildren` is now the file-list container.
- `AC-18: the inspector at the bottom renders both collapsible blocks and only the diff slot grows` — retitle and re-assert: at the bottom, both collapsible blocks render and the **commit file list** is the only growing child; the list keeps at least the height it keeps on the right.

## Definition of Done

- [ ] The three rows pass, each naming the amended criterion, and no assertion mentions the diff slot as a growing child in History.
- [ ] The Changes view is covered by at least one assertion that its slot still grows — the reversal is History-only.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean; test-only change (no production file touched).

## Notes

Parallel with T38 — different spec file, no overlap.

## Outcome (2026-09-07)

Landed in `27d5084`. Test-only, as scoped, plus the row T35 could not host:
**the History slot is `h-0` with the workspace open and closed**, and a new row
covers the other half of the reversal — Changes keeps a real, growing slot.

The AC-03 row re-pins the header cap at **280** (was 126): it re-derives the
value through `computeInspectorLayout` itself, so only the literal and its
comment moved, from «what the diff's floor left the header» to «what the
list's floor leaves it». `growingChildren` is now compared against a new
`inspectorBlock()` helper rather than the diff slot.
