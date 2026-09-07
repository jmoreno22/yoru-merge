---
id: T5
title: "Ship the Esc layer service and migrate the six consumers"
layer: "app"
deps: ["T3"]
acs: ["AC-10"]
files_hint: [
  "src/app/core/services/escape-layers.service.ts",
  "src/app/shared/ui/yoru-dialog.ts",
  "src/app/features/command-palette/command-palette.ts",
  "src/app/features/commit-list/commit-search.html",
  "src/app/features/commit-list/commit-search.ts",
  "src/app/features/working-changes/working-changes.html",
  "src/app/shared/components/sidebar/sidebar.html",
  "src/app/features/diff-viewer/diff-view.ts",
  "src/app/features/blame/blame-viewer.ts",
  "src/app/features/file-history/file-history-panel.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T5 — Ship the Esc layer service and migrate the six consumers

## Why

Today Esc is first-listener-wins across four `(document:keydown.escape)` hosts and two element-level handlers; the registry only works if every consumer goes through it — [ADR-0002 consequences](../adr/0002-route-escape-through-a-rank-ordered-layer-registry.md), [sad §5 tree (ranks per component)](../sad.md), [spec AC-10](../spec.md).

## What

- `src/app/core/services/escape-layers.service.ts`: `providedIn: 'root'`; owns the **single** `document.addEventListener('keydown')` for `Escape`; `register(rank, dismiss): () => void` returning the unregister; resolves via T3, passing the focused editable (`input` / `textarea` / `contenteditable` with non-empty value) for the built-in rank-4 rule, which clears the value (dispatching `input`) and keeps focus; `preventDefault` when a layer was dismissed. Registration helper tied to `DestroyRef` + an open signal (`effect`: register when open, unregister when closed) so no phantom layer survives.
- Migrate, replacing each existing Esc handler with a registration: `yoru-dialog.ts` → rank 6 (also prevent the native `<dialog>` `cancel` event); `command-palette.ts` (`case 'Escape'`) → rank 5; `diff-view.ts` line selection (`event.key === 'Escape' && selection()`) → rank 3; `blame-viewer.ts` and `file-history-panel.ts` → rank 2. Remove the element-level `(keydown.escape)` on the commit search input, the working-changes filter and the sidebar filter — the built-in text-field rule now clears them.

## Definition of Done

- [ ] `grep -rn "keydown.escape\|key === 'Escape'\|case 'Escape'" src/app` returns nothing outside `escape-layers.service.ts` and the two documented exceptions in DESIGN.md §Keyboard: `yoru-context-menu.ts`, which consumes Escape on its own element with `preventDefault` before the service sees it, and `yoru-tooltip.directive.ts`, a passive hide that closes no layer (review 2026-09-03 F-23).
- [ ] Manual matrix (record in the PR): with the palette open over a dialog, Esc closes the dialog only; with the commit filter containing text and blame stacked, Esc clears the filter first, then closes blame on the next press; with nothing open Esc is a no-op.
- [ ] `pnpm build`, `pnpm test`, `pnpm lint` green.

## Notes

Behaviour check before removing the commit-search handler: if today's Esc also *closes* the search bar, keep that as a rank-4 follow-up only when the field is already empty (AC-10 says the content clears first). Shares `working-changes.html` with T13 (lane) — keep the edit to the one `(keydown.escape)` attribute.
