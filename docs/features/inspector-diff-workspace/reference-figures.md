<!-- GENERATED FILE — do not edit by hand. Run `pnpm figures:write`. -->

# Reference figures — inspector-diff-workspace

Generated from `computeMetrics` and `computeInspectorLayout` by `scripts/check-figures.mjs`, and
byte-compared on every `pnpm check:figures`: a stale copy fails the gate. Owner decision **D3**
(2026-09-10, review round 17) makes this the single home of concrete reference figures — no live
artefact writes a figure derived from the code; prose carries the closed form instead.

The density-token table is at the SHIPPED defaults read out of `preferences-schema.ts` — `uiFontSize` 13 px, `monoFontSize` 12 px. Everything below it is at `uiFontSize` = `monoFontSize` = 13 px (the marker schema's `font=` default; `monoFontSize` never reaches `headerMaxH`) with 30 files, no stacked
panels and a 12-line body, unless the row says otherwise.

## Density tokens — every value `computeMetrics` produces

| token | compact | comfortable | relaxed |
| --- | --- | --- | --- |
| `--row-h` | 26 | 34 | 43 |
| `--file-row-h` | 24 | 30 | 37 |
| `--ref-row-h` | 24 | 30 | 37 |
| history row | 40 | 46 | 54 |
| code line | 20 | 20 | 20 |
| `--panel-head-h` | 26 | 34 | 43 |
| `--titlebar-h` | 29 | 38 | 49 |
| `--toolbar-h` | 35 | 48 | 64 |
| `--rail-w` | 35 | 48 | 64 |
| `--statusbar-h` | 22 | 26 | 31 |
| `--panel-pad` | 10 | 16 | 24 |

`code line` ignores density by design — its spacing *is* the code line height, and padding it on
the density axis would slide the line numbers off the lines they number.

## Header cap and list share, at the remainders the criteria measure

| remainder | header | density | `headerMaxH` | list share |
| --- | --- | --- | --- | --- |
| 110 | expanded | compact | 36 | 0.672727 |
| 110 | expanded | comfortable | 34 | 0.690909 |
| 110 | expanded | relaxed | 43 | 0.609091 |
| 110 | collapsed | compact | 27 | 0.754545 |
| 110 | collapsed | comfortable | 34 | 0.690909 |
| 110 | collapsed | relaxed | 43 | 0.609091 |
| 200 | expanded | compact | 100 | 0.500000 |
| 200 | expanded | comfortable | 100 | 0.500000 |
| 200 | expanded | relaxed | 83 | 0.585000 |
| 200 | collapsed | compact | 50 | 0.750000 |
| 200 | collapsed | comfortable | 50 | 0.750000 |
| 200 | collapsed | relaxed | 50 | 0.750000 |
| 420 | expanded | compact | 210 | 0.500000 |
| 420 | expanded | comfortable | 210 | 0.500000 |
| 420 | expanded | relaxed | 210 | 0.500000 |
| 420 | collapsed | compact | 105 | 0.750000 |
| 420 | collapsed | comfortable | 105 | 0.750000 |
| 420 | collapsed | relaxed | 105 | 0.750000 |

## The header-cap carve-out, measured

The largest integer remainder at which the list share falls under the floor the spec guarantees
(0.5 expanded, 0.75 collapsed — both read out of `src/app/core/services/inspector-layout.ts`), scanned over
20…2000 px. Above it the ratio holds; at or below it the guard has lifted the cap.

| density | header | top of the band |
| --- | --- | --- |
| compact | expanded | 51 |
| compact | collapsed | 103 |
| comfortable | expanded | 67 |
| comfortable | collapsed | 135 |
| relaxed | expanded | 85 |
| relaxed | collapsed | 171 |

## Sweep configuration counts

Read out of `src/app/core/services/inspector-layout.spec.ts`: the product of the dimensions each loop walks.

| loop | dimensions | configurations |
| --- | --- | --- |
| share | tokens 3 × availableHeight 8 × fileCount 6 × headerCollapsed 2 | 288 |
| cap | tokens 3 × availableHeight 8 × fileCount 6 × headerCollapsed 2 × fileListCollapsed 2 | 576 |
| share, `fileCount` = 0 | the share loop's zero-file subset | 48 |

## Marker inventory

Pinned so that a DELETED marker is loud: the gate recounts the markers it finds and fails when
the inventory differs, so removing a check takes a deliberate `pnpm figures:write` that shows up
in the diff (R17-F6).

| file | markers |
| --- | --- |
| `docs/features/inspector-diff-workspace/test-plan.md` | 2 |
| **total** | **2** |
