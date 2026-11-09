# 0001 — Model the diff workspace as in-memory centre-view state with a restore snapshot

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno

## Context

The centre view of the workbench is chosen by a `@switch` over the persisted `railView` preference in `main-content.html`; there is no Angular Router. The diff workspace is *a state of the centre view* — not a route, window, tab or overlay — that replaces the commit list (History, Reflog) or the working-changes lists and the commit composer (Changes) at full width. On Close / Esc it must restore the exact previous selection, scroll offset and keyboard focus (AC-08) within 100 ms (spec §6), at most one may exist (AC-09), and it must never survive a change of selection, rail view or repository tab (AC-17) nor an app restart. The restore logic should be a pure function, testable without a DOM.

## Decision

A framework-free `DiffWorkspaceState` (`core/services/diff-workspace-state.ts`) — closed, or open with `{ source, file, files, index, snapshot }` — consulted by `main-content` before the `railView` switch. The snapshot holds the rail view and tab it was opened from, the selected commit or side, `listScrollTop` and a focus key, and is replayed on close. One rule closes the workspace on any selection, view or tab change, wherever the change comes from.

## Alternatives considered

- **Keep-alive hidden centre** — hide the previous centre view and paint the workspace over it. Hidden scroll containers lose their scroll position in WebKit / Chromium, a focus snapshot is still needed, and the commit list and branch graph stay alive reacting to the watcher while invisible.
- **A new persisted `railView` value** (`'diff-workspace'`) — persists the workspace by construction, so it would survive restarts and tab switches (contradicting AC-17), and the rail would highlight a view that has no icon.

## Consequences

- Restore is deterministic and unit-tested; closing replays a handful of values.
- `railView` and its persistence are untouched; the rail keeps highlighting the underlying view.
- Every datum the centre view must recover has to be captured explicitly: a future centre-view control (a new filter, a second selection) must be added to the snapshot or it is lost on close.
- The commit list's scroll offset already lives in `RepoState.listScrollTop`, so the snapshot reuses it rather than reading the DOM.
- One exception to «replace, then rebuild»: the Changes panel stays mounted but hidden while the workspace is open, because it owns the file order the workspace steps through and re-publishes it after a stage or a watcher refresh (AC-13, AC-16), and a draft in the composer has to survive the round trip. History and Reflog are unmounted and rebuilt on close.

## Links

- [Spec](../spec.md) — US-03, US-04, AC-06, AC-08, AC-09, AC-17
- [ADR-0003](0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md) — what the workspace shows once open
