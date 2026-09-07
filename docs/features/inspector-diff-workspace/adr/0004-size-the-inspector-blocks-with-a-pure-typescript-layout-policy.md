---
status: Accepted
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-02"
feature_size: "M"
ticket: "none — owner interview 2026-09-02"
---

# 0004 — Size the inspector blocks with a pure-TypeScript layout policy

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno (Owner / Architect), during the design Socratic walk

## Context

The inspector column is a fixed flex split today: commit inspector `flex-[2]`, diff viewer `flex-[3]`, with blame `flex-[3]` and file history `flex-[2]` stacked below. The spec replaces it with a content-sized commit header (body clamped to 4 lines, floor 1), a bounded commit file list (6 rows max, 2 min, exact count when fewer, header-only when collapsed) and a diff viewer that takes the remainder with a floor of 50 % of the inspector (AC-01…AC-05). AC-03 requires the yield to be *sequential*: when the window is at its minimum size the file list shrinks first, then the body clamp, and the diff never goes below half. The quality goal is measured as height shares (≥ 50 % expanded, ≥ 75 % collapsed).

## Decision drivers

- spec AC-03 (sequential yield with floors) and §6 NFR «Diff viewer share of inspector height ≥ 50 % / ≥ 75 %, element-height measurement at 960 × 640 and 1280 × 800, both densities».
- spec AC-18 / AC-19: the same behaviour at the bottom placement and with stacked panels.
- §2 constraint: testable logic lives in pure-TypeScript modules; there is no browser test tier.
- `DESIGN.md` §Density: `--file-row-h` is pinned to the CDK `itemSize` and must not be overridden in CSS.

## Considered options

1. **Pure-TS layout policy + `ResizeObserver`** — `inspector-layout.ts` maps (available height, file count, density tokens, collapsed states) to (visible file rows, clamp lines); the component applies the result as CSS variables.
2. **CSS-only** — header `flex: 0 1 auto` with `-webkit-line-clamp: 4`, list `max-height` / `min-height` from `--file-row-h`, diff `flex: 1 1 50%` with `min-height: 50%`.

## Decision outcome

**Chosen:** Option 1. Flex shrinks siblings proportionally and `line-clamp` cannot step from 4 to 1 on its own, so the sequential order of AC-03 is not expressible in CSS alone; a pure function makes the order and the floors a Vitest table over the four spec configurations (drivers 1 and 3) and serves the bottom placement and the stacked panels with the same code (driver 2). The cost is one JS layout pass per resize, not per frame.

## Consequences

**Positive**
- AC-03 and the height-share NFRs are unit-tested numbers, not visual approximations.
- One function documents the policy; the bottom placement and stacked panels reuse it.

**Negative**
- The component must keep its CSS variables aligned with the density tokens (`--file-row-h`, `--panel-head-h`); a `ResizeObserver` and a signal per computed value are new moving parts in `CommitInspector`.

**Neutral**
- The 50 % floor is measured on the inspector column as a whole; with blame or file history stacked, the policy treats their share as fixed (AC-19) and computes floors on the remainder.

## Links

- Spec: [[../spec.md]] — AC-01…AC-05, AC-18, AC-19, US-01, US-02, US-07
- SAD: [[../sad.md]] §4 pillar 4, §5, §10 QG-1
- Related ADR: none
