# 0003 — Re-host the single diff viewer instance with a CDK DomPortal

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno

## Context

The diff is rendered by one component, `DiffViewer` (options bar + `DiffView`), fed by `repo.diffText` / `repo.diffSource`, whose home is the inspector's diff slot: inline in Changes, a zero-height parking slot in History, where a commit diff is read only in the diff workspace. `DiffView` is not virtualised: it paints every line. The diff workspace must show the same diff at full centre width, with layout / whitespace / wrap / context being *the diff viewer's own preferences, not a copy* (AC-06), without changing how a diff renders (spec §3), and with a first paint ≤ 150 ms on a 2 000-line diff that is not loaded a second time (spec §6). `@angular/cdk` was already a dependency.

## Decision

One instance, re-hosted with a CDK `DomPortal`: the live `<app-diff-viewer>` element moves from the inspector slot into the workspace's portal outlet on open and back on close, with no destroy / recreate.

## Alternatives considered

- **Two conditional hosts, same signals** — an `<app-diff-viewer>` in the inspector and another in the centre, both reading the same `diffText` and preferences. Idiomatic, but it destroys and recreates the heaviest component on every open, which would likely force virtualising `DiffView` to meet the budget — excluded by spec §3.

## Consequences

- Zero re-fetch and zero re-render on open and close; the budget holds by construction. Line selection, hunk cursor, options and diff scroll survive the move, and staging controls keep working because the diff source is the same.
- «Same preferences, not a copy» is structural: the option controls are literally the same widgets.
- A less common pattern: after the move the viewer re-measures (its `ResizeObserver` fires on the new size), which has to be checked in both inspector placements and the three densities.
- The workspace component owns only a header and a portal outlet, so its template is unusually thin; the diff lives elsewhere.
- If `DiffView` is ever virtualised, two hosts become viable without changing the workspace state model (ADR-0001).

## Links

- [Spec](../spec.md) — AC-06, AC-13, AC-14, US-03, US-06
- [ADR-0001](0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot.md)
