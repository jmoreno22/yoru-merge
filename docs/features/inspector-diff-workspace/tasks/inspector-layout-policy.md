---
id: T1
title: "Write the inspector layout policy"
layer: "domain"
deps: []
acs: ["AC-01", "AC-03", "AC-04"]
files_hint: ["src/app/core/services/inspector-layout.ts", "src/app/core/services/inspector-layout.spec.ts"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T1 — Write the inspector layout policy

## Why

The sequential yield of AC-03 (file list first to a floor of 2 rows, then the body clamp to a floor of 1 line, diff never below 50 %) is not expressible in CSS and must be a unit-tested pure function — [ADR-0004](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md), [sad §4 pillar 4](../sad.md), [spec AC-01, AC-03, AC-04](../spec.md).

## What

`src/app/core/services/inspector-layout.ts`, framework-free (same pattern as `appearance-metrics.ts`): one exported function mapping `{ availableHeight, fileCount, bodyLines, headerCollapsed, fileListCollapsed, stackedPanelsHeight, tokens: { fileRowH, panelHeadH, panelPad, lineH, headerFixedH } }` to `{ listRows, clampLines, diffHeight }` with these rules:

- list rows: `min(fileCount, 6)` when not collapsed; `0` when collapsed or `fileCount === 0` (the empty line is not a row); never below 2 while yielding when `fileCount ≥ 2`;
- clamp lines: `min(bodyLines, 4)` (no reserved height when shorter), floor 1 while yielding; `0` when the header is collapsed;
- diff floor: 50 % of `availableHeight - stackedPanelsHeight` (stacked shares are fixed, [AC-19](../spec.md));
- yield order: shrink `listRows` to 2, then `clampLines` to 1, then stop (floors hold even if the diff would fall under half — the policy reports the resulting `diffHeight` so the caller can measure).

Plus `inspector-layout.spec.ts`, a table-driven Vitest spec.

## Definition of Done

- [ ] `inspector-layout.spec.ts` passes with rows for: 960 × 640 + long body + 30 files (rows 2, clamp 1); 1280 × 800 + subject-only + 2 files (rows 2, clamp 0, diff ≥ 60 %); 0 files (rows 0); 7+ files at comfortable height (rows 6); header collapsed (clamp 0, diff ≥ 75 % at 1280 × 800 right); stacked panels (floor computed on the remainder); both density token sets.
- [ ] The function never returns `listRows < 2` when `fileCount ≥ 2` and not collapsed, nor `clampLines < 1` when `bodyLines ≥ 1` and not collapsed.
- [ ] No `@angular/core` import; `pnpm test` and `pnpm lint` green.

## Notes

Token values are inputs, never constants: the caller (T11) reads them from the density CSS variables. Height of the fixed header parts (avatar row, meta row, subject, badges, actions) is passed in as `headerFixedH`, measured by the component.
