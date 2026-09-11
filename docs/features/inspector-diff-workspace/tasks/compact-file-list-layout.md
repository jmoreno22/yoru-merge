---
id: T11
title: "Make the commit file list compact and apply the layout policy"
layer: "ui"
deps: ["T1", "T4", "T9"]
acs: ["AC-03", "AC-04", "AC-05", "AC-12", "AC-18", "AC-19", "AC-20"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.html",
  "src/app/features/commit-inspector/commit-inspector.css"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T11 — Make the commit file list compact and apply the layout policy

## Why

The file list is bounded to six rows, exact when fewer, collapsible to its header, and the whole inspector is sized by the T1 policy so the diff never drops below half — [ADR-0004](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md), [spec AC-03, AC-04, AC-05](../spec.md), [screens SCR-01 file-list-overflow · file-list-collapsed · empty·no files · squeezed](../screens.md).

## What

In `features/commit-inspector/`:

- `ResizeObserver` on the inspector host → read the density tokens (`--file-row-h`, `--panel-head-h`, `--panel-pad`, line height) and the fixed header parts' height → call the T1 policy → set `--inspector-list-rows` and `--inspector-clamp-lines` (the latter consumed by T9's clamp). The `cdk-virtual-scroll-viewport` height = `rows × var(--file-row-h)`; `--file-row-h` itself is never overridden.
- Files header (`existing: files-header`) shows the total count; collapse control `lucideChevronUp` (`inspector-collapse-files`) → header only (W-01b bottom strip), active file unchanged; state from `PreferencesService.commitFileListCollapsed`, synchronous at render. Register `inspector.toggle-files` (`mod+shift+l`, «Collapse or expand commit file list»).
- 0 files → header with `0` + one muted line **«No files changed»** (copy change mandated by AC-04, W-01e).
- Squeezed (W-01c): rows floor 2 with own scroll, then clamp floor 1 — purely the policy's output.
- Stacked panels: pass their measured height as `stackedPanelsHeight` so floors apply to the remainder (AC-19); bottom placement runs the same code (AC-18).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual measurement at 960 × 640 and 1280 × 800, both densities, inspector right, no stacked panels: diff share ≥ 50 % expanded, ≥ 75 % collapsed header (NFR); 30-file commit → 6 rows + scroll; 2-file commit → exactly 2 rows; 0 files → «No files changed» (AC-04).
- [ ] Manual: collapse the list → header only, released height to the diff, active file unchanged; restart → paints collapsed with 0 px shift (AC-05).
- [ ] Manual: header collapsed + list collapsed at comfortable density = 68 px (spec §7 KPI ≤ 70 px).
- [ ] Keyboard settings page lists «Collapse or expand commit file list · Ctrl+Shift+L» (AC-12).

## Notes

Third in the `commit-inspector` lane. `--file-row-h`, `--panel-head-h` and `--panel-pad` all change with density, and all three come from `computeMetrics` (AC-20). <!-- corrected 2026-09-10 (T67, review round 17 O2, under owner decision D4 which puts task records in the sweep's scope): this read «Row height stays 30 px in both densities (pinned to `FILE_ROW_HEIGHT`)» and both halves were false. The file-row token goes 24 / 30 / 37 across compact / comfortable / relaxed at the default 13 px, and `FILE_ROW_HEIGHT` does not exist in the repo — the CDK `itemSize` is `rowHeight()`, fed by the same `computeMetrics` output as the token, which is why the token must not be overridden in CSS. This is the belief that made the unreachable `{30, 30}` compact fixture plausible for fifteen rounds (R15-S1-F2, R16-L-F1) -->
