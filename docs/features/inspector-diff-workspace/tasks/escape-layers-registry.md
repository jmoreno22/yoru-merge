---
id: T3
title: "Write the Esc layer registry"
layer: "domain"
deps: []
acs: ["AC-10"]
files_hint: ["src/app/core/services/escape-layers.ts", "src/app/core/services/escape-layers.spec.ts"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T3 — Write the Esc layer registry

## Why

AC-10 fixes a six-rank precedence for Esc and the NFR demands 0 mis-fires over the six-layer matrix; the order must live in one framework-free module with a table-driven test — [ADR-0002](../adr/0002-route-escape-through-a-rank-ordered-layer-registry.md), [sad §6 «Cross-cutting: Escape»](../sad.md), [spec AC-10](../spec.md).

## What

`src/app/core/services/escape-layers.ts`, framework-free:

- `EscapeRank` constants: `dialog = 6`, `commandPalette = 5`, `textField = 4`, `lineSelection = 3`, `stackedPanel = 2`, `diffWorkspace = 1`.
- a registry value type holding `{ id, rank, dismiss }` entries plus pure `register / unregister` and `resolve(registry, focusedEditable: { hasContent: boolean } | null)` → the single entry to dismiss, or the built-in `textField` action when a focused editable has content and no higher layer is open, or `null`.
- ties within a rank (two stacked panels) resolve to the most recently registered.

Plus `escape-layers.spec.ts`.

## Definition of Done

- [ ] `escape-layers.spec.ts` iterates every subset of the six layers (64 combinations, text field represented by the focused-editable input) and asserts the resolved layer is always the highest rank present, `null` when none, and that unregistering the resolved layer then re-resolving yields the next one down.
- [ ] No `@angular/core` import; `pnpm test` and `pnpm lint` green.

## Notes

The module knows nothing about DOM events; T5 wraps it in the Angular service that owns the single document `keydown` listener.
