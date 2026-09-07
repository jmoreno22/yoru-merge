---
status: Accepted
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-02"
feature_size: "M"
ticket: "none — owner interview 2026-09-02"
---

# 0003 — Re-host the single diff viewer instance with a CDK DomPortal

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno (Owner / Architect), during the design Socratic walk

## Context

The diff is rendered by one component, `DiffViewer` (options bar + `DiffView`), placed in the inspector column and fed by `repo.diffText` / `repo.diffSource`. `DiffView` is not virtualised: it paints every line. The diff workspace must show the same file's diff at full centre width, with layout / whitespace / wrap / context being *the diff viewer's own preferences, not a copy* (AC-06), while the inspector's diff viewer is hidden and its height goes to the header and the file list. The spec forbids changing how a diff renders (§3 non-goal) and the NFR asks for a first paint ≤ 150 ms on a 2 000-line diff without loading the diff a second time.

## Decision drivers

- spec §6 NFR «Open the diff workspace from a diff already shown in the viewer: first paint ≤ 150 ms; the diff is not loaded a second time».
- spec AC-06: shared preferences, inspector diff viewer hidden while the workspace is open.
- spec §3 non-goal: the workspace reuses the diff viewer's rendering and controls as they are.
- §2 constraint: `@angular/cdk` 22 is already a dependency (virtual scroll on the lists).

## Considered options

1. **One instance, re-hosted with a CDK `DomPortal`** — the live `<app-diff-viewer>` element moves from the inspector slot into the workspace's portal outlet on open and back on close; no destroy / recreate.
2. **Two conditional hosts, same signals** — `<app-diff-viewer>` under `@if (!workspaceOpen())` in the inspector and another under `@if (workspaceOpen())` in the centre, both reading the same `diffText` and preferences.

## Decision outcome

**Chosen:** Option 1. Moving the element costs no re-render, so the 150 ms budget holds by construction on an unvirtualised diff (driver 1); the option controls are literally the same widgets, so AC-06's «same preferences, not a copy» is structural rather than a synchronisation to maintain (driver 2); the inspector slot empties itself (AC-06 «hidden»); line selection and diff scroll survive the move. Option 2 is idiomatic Angular but destroys and recreates the heaviest component on every open, turning the NFR into a measurement that would likely require virtualising `DiffView` — excluded by the spec's non-goal (driver 3).

## Consequences

**Positive**
- Zero re-fetch and zero re-render on open and close; staging controls keep working unchanged because the diff source is the same.
- No duplicated component state (line selection, hunk cursor, options).

**Negative**
- A less common pattern: after the move the viewer must re-measure (its `ResizeObserver` fires on the new size) and the behaviour must be checked in both inspector placements and both densities.
- The workspace component owns only a header and a portal outlet, so its template is unusually thin; reviewers must know the diff lives elsewhere.

**Neutral**
- If `DiffView` is ever virtualised, Option 2 becomes viable without changing the workspace state model (ADR-0001).

## Links

- Spec: [[../spec.md]] — AC-06, AC-13, AC-14, US-03, US-06
- SAD: [[../sad.md]] §4 pillar 3, §5, §6
- Related ADR: [[0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot]]
