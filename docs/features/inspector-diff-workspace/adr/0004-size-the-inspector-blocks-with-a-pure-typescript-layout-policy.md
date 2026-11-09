# 0004 — Size the inspector blocks with a pure-TypeScript layout policy

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno

## Context

The inspector column used to be a fixed flex split: commit inspector `flex-[2]`, diff viewer `flex-[3]`, with blame and file history stacked below. The spec replaces it with a content-sized commit header (body clamped to 4 lines, floor 1) and a commit file list that is the protected block: at least 50 % of the column left by the stacked panels with the header expanded, 75 % with it collapsed, never under 2 rows, and a bare head when collapsed or empty (AC-01…AC-05). AC-03 requires the yield to be *sequential*: the body clamp shrinks first, then the expanded header scrolls inside a cap, and the list gives up nothing. The same behaviour must hold at the bottom placement and with stacked panels (AC-18, AC-19). `--file-row-h` and `--panel-head-h` come from `computeMetrics` per density and must not be overridden in CSS.

## Decision

A pure function, `computeInspectorLayout` (`core/services/inspector-layout.ts`), fed by a `ResizeObserver`. It maps (available height, stacked panels' height, displayed file count, body lines, collapsed states, density tokens) to (visible list rows, clamp lines, header max height), and `CommitInspector` writes the result as CSS variables on its host (`DESIGN.md` §«Density»). Stacked panels are fixed and come off the top before any floor is computed on the remainder.

## Alternatives considered

- **CSS-only** — header `flex: 0 1 auto` with `-webkit-line-clamp: 4`, list `min-height` from `--file-row-h`. Flex shrinks siblings proportionally and `line-clamp` cannot step from 4 to 1 on its own, so AC-03's sequential order is not expressible in CSS; and jsdom computes no layout, so a CSS policy could not be unit-tested at all.

## Consequences

- AC-03 and the share requirements are unit-tested numbers (`inspector-layout.spec.ts`), not visual approximations; one function serves both placements and the stacked panels.
- The cost is one JS layout pass per resize, not per frame.
- The component must keep its CSS variables aligned with the density tokens; a `ResizeObserver` and a signal per computed value are moving parts in `CommitInspector`.
- The ratio can lose to the header cap on a very short remainder (the header-cap exception, spec §5), because the cap never goes under one panel head.
- History keeps its diff slot only as a zero-height parking home for the portalled viewer (ADR-0003); the policy produces no diff height.

## Links

- [Spec](../spec.md) — AC-01…AC-05, AC-18, AC-19, US-01, US-02, US-07
- [ADR-0003](0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md)
