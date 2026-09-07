---
status: Accepted
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-02"
feature_size: "M"
ticket: "none — owner interview 2026-09-02"
---

# 0001 — Model the diff workspace as in-memory centre-view state with a restore snapshot

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno (Owner / Architect), during the design Socratic walk

## Context

The centre view of the workbench is chosen by a `@switch` over the persisted `railView` preference in `main-content.html`; there is no Angular Router. The spec (§1, §3) and the feature glossary fix the diff workspace as *a state of the centre view* — not a route, window, tab or overlay — that replaces the commit list (History, Reflog) or the working-changes lists and the commit composer (Changes) at full width, and that on Close / Esc restores the exact previous selection, scroll offset and keyboard focus (AC-08). It must never survive a change of selection, rail view or repository tab (AC-17) nor an app restart. We need to decide how that state exists at runtime and how the restore works.

## Decision drivers

- spec §6 NFR «Close the diff workspace: previous centre view back in ≤ 100 ms with the identical scroll offset and selection — pure-TypeScript unit test on the restore logic».
- spec §6 NFR «Keyboard reachability: focus returns to the originating row on close».
- Feature CONTEXT invariants: at most one workspace; closing always restores the replaced view; the workspace exists only while the selection that opened it stays current.
- §2 constraint: frontend unit tests are pure TypeScript (no `@angular/core`), so testable logic must live in framework-free modules.
- §2 constraint: `railView` is a durable preference persisted to `preferences.json`.

## Considered options

1. **In-memory state + restore snapshot** — a framework-free `DiffWorkspaceState` (closed | open `{ source, file, snapshot }`) consulted by `main-content` before the `railView` switch; the snapshot holds selected commit or side, active file, `listScrollTop` and a focus key, replayed on close.
2. **In-memory state + keep-alive hidden centre** — the previous centre view is hidden (`hidden` / `display:none`) rather than destroyed and the workspace is painted over it; on close it is shown again.
3. **A new persisted `railView` value** — `'diff-workspace'` becomes one more rail view handled by the existing `@switch`.

## Decision outcome

**Chosen:** Option 1. It is the only option whose restore logic is a pure function testable in Vitest without a DOM (driver 1), it puts the «what is shown in the centre» decision in one place, and the close-on-selection-change invariant becomes a single rule. Option 2 loses the scroll position of hidden scroll containers in WebKit / Chromium and still needs a focus snapshot, while keeping the commit list and branch graph alive and reacting to the watcher while invisible. Option 3 persists the workspace by construction (it would survive restarts and tab switches, contradicting AC-17 and the glossary invariant) and would make the rail highlight a view that has no icon.

## Consequences

**Positive**
- Restore is deterministic and unit-tested; the ≤ 100 ms close budget is a matter of replaying four values.
- `railView` and its persistence are untouched; the rail keeps highlighting the underlying view.
- One rule closes the workspace on any selection / view / tab change, wherever the change comes from.

**Negative**
- Every datum the centre view must recover has to be captured explicitly; a future centre-view control (a new filter, a second selection) must be added to the snapshot or it is lost on close.
- `main-content` gains a pre-switch branch and the workspace needs its own thin component.

**Neutral**
- The commit list's scroll offset already lives in `RepoState.listScrollTop`, so the snapshot reuses it rather than reading the DOM.
- Switching to Option 2 later is possible without touching the `railView` model.

## Links

- Spec: [[../spec.md]] — US-03, US-04, AC-06, AC-08, AC-09, AC-17
- SAD: [[../sad.md]] §4 pillar 1, §5, §6
- Related ADR: [[0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal]] (what the workspace shows once open)
