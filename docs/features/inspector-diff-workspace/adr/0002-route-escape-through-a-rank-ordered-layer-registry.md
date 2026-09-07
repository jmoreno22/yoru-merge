---
status: Accepted
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-02"
feature_size: "M"
ticket: "none — owner interview 2026-09-02"
---

# 0002 — Route Escape through a rank-ordered layer registry

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno (Owner / Architect), during the design Socratic walk

## Context

Esc already has several consumers, each with its own listener: `YoruDialog`, the blame viewer, the file-history panel and the commit search bind `(document:keydown.escape)`; the command palette and the diff line selection handle `keydown` on their own elements. Nothing orders them — the first listener to run wins. The diff workspace adds a sixth consumer, and AC-10 fixes the precedence: dialog, then command palette, then text field with content (the commit filter included, whose content clears), then diff line selection, then stacked blame or file history, then diff workspace. The NFR asks for 0 cases where Esc closes a layer that is not the topmost, verified over the six-layer matrix.

## Decision drivers

- spec AC-10 (fixed order) and §6 NFR «Esc layer precedence: 0 cases … keyboard matrix over the six layers».
- spec §6 NFR «Keyboard reachability: 100 % of diff workspace actions have a shortcut listed in the shortcuts help» — Esc-dismissal must not pollute that list.
- §2 constraint: testable logic lives in pure-TypeScript modules.
- §2 convention: `KeyboardShortcutsService` is a flat first-match list whose entries render in the palette and the Keyboard settings page.

## Considered options

1. **Rank-ordered layer registry** — a framework-free `escape-layers.ts` holds the open layers with fixed ranks (6 … 1); one document `keydown` handler closes only the highest-ranked open layer; consumers register on open and unregister on close; «text field with content» is a built-in rule on the focused editable.
2. **`priority` on `KeyboardShortcutsService`** — extend the existing `Shortcut` with a priority, sort dispatch, and register one `esc.<layer>` shortcut per consumer with a `when` guard.
3. **Keep the ad-hoc handlers, order by `defaultPrevented`** — each listener checks `event.defaultPrevented` and calls `preventDefault()` when it consumes Esc.

## Decision outcome

**Chosen:** Option 1. The order lives in one framework-free module and the AC-10 matrix is a table-driven Vitest test with no DOM (drivers 1 and 3); Esc never appears as a «shortcut» in the palette or the settings page (driver 2). Option 2 reuses an existing registry but mixes command shortcuts with layer dismissal in a user-visible list (needing a `hidden` flag) and still needs special code to inspect the event target for the text-field rule. Option 3 depends on component mount order, which is not stable (a dialog opened after the workspace registers after it), and cannot be tested without a browser.

## Consequences

**Positive**
- One place defines the six ranks; adding a seventh layer is one registration with a rank.
- The four existing `(document:keydown.escape)` handlers and the two element-level handlers are replaced by register / unregister calls — the current first-listener-wins behaviour disappears.
- The rule «a text field with content clears on Esc» becomes uniform across the app.

**Negative**
- Six existing components change (small edits each); `YoruDialog` gains a dependency on the registry.
- A consumer that forgets to unregister on close leaves a phantom layer that swallows Esc — mitigated by tying registration to the component's `DestroyRef` and to the open signal.

**Neutral**
- The native `<dialog>` `cancel` event (if any) must be prevented so the registry, not the browser, decides.

## Links

- Spec: [[../spec.md]] — AC-10, AC-12, US-04
- SAD: [[../sad.md]] §4 pillar 2, §5, §8
- Related ADR: [[0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot]] (the workspace is the rank-1 layer)
