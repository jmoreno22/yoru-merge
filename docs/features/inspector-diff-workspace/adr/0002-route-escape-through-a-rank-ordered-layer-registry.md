# 0002 — Route Escape through a rank-ordered layer registry

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Jhoan Moreno

## Context

Esc had several consumers, each with its own listener: `YoruDialog`, the blame viewer, the file-history panel and the commit search bound `(document:keydown.escape)`; the command palette and the diff line selection handled `keydown` on their own elements. Nothing ordered them — the first listener to run won. The diff workspace adds a sixth consumer, and AC-10 fixes the precedence: dialog, then command palette, then text field with content (whose content clears), then diff line selection, then stacked blame or file history, then diff workspace. Esc must never close a layer that is not the topmost (spec §6), and Esc-dismissal must not show up as a command in the shortcuts help. `KeyboardShortcutsService` is a flat first-match list whose entries render in the palette and the Keyboard settings page.

## Decision

A framework-free registry (`core/services/escape-layers.ts`, wired by `escape-layers.service.ts`) holds the open layers with fixed ranks, 6 to 1. One document `keydown` handler closes only the highest-ranked open layer; consumers register on open and unregister on close. «Text field with content» is a built-in rule on the focused editable that declares `data-escape-clears`, not a registration.

## Alternatives considered

- **A `priority` on `KeyboardShortcutsService`** — reuses the registry, but mixes command shortcuts with layer dismissal in a user-visible list (needing a `hidden` flag) and still needs special code to inspect the event target for the text-field rule.
- **Keep the ad-hoc handlers, order by `defaultPrevented`** — depends on component mount order, which is not stable (a dialog opened after the workspace registers after it), and cannot be tested without a browser.

## Consequences

- One module defines the ranks, and the AC-10 matrix is a table-driven test with no DOM; adding a layer is one registration with a rank.
- The first-listener-wins behaviour is gone, and «a text field with content clears on Esc» is uniform wherever a field opts in.
- Every existing Esc consumer moved onto the registry or the `data-escape-clears` rule, and `YoruDialog` depends on the registry.
- A consumer that forgets to unregister leaves a phantom layer that swallows Esc — mitigated by tying registration to the component's `DestroyRef` and to its open signal.
- The native `<dialog>` `cancel` event must be prevented so the registry, not the browser, decides.

## Links

- [Spec](../spec.md) — AC-10, AC-12, US-04
- [ADR-0001](0001-model-the-diff-workspace-as-in-memory-centre-state-with-a-restore-snapshot.md) — the workspace is the rank-1 layer
