---
id: T17
title: "Scope the Esc text-field rule to fields that opt in"
layer: "app"
deps: []
acs: ["AC-10", "AC-15"]
files_hint: [
  "src/app/core/services/escape-layers.ts",
  "src/app/core/services/escape-layers.service.ts",
  "src/app/core/services/escape-layers.spec.ts",
  "src/app/features/commit-list/commit-search.html",
  "src/app/features/working-changes/working-changes.html",
  "src/app/shared/components/sidebar/sidebar.html",
  "docs/features/inspector-diff-workspace/tasks/escape-layers-service-migration.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T17 — Scope the Esc text-field rule to fields that opt in

## Why

The built-in rank-4 rule clears *any* focused input / textarea with content. The commit composer's subject and body had no Esc handler before this branch, so one Esc now destroys an unsent draft — the same draft the feature protects across a workspace round-trip — [review 2026-09-03 F-1, F-18](../_review/review-2026-09-03.md), [spec AC-10, AC-15](../spec.md), [ADR-0002](../adr/0002-route-escape-through-a-rank-ordered-layer-registry.md).

## What

- The rank-4 rule applies only to fields carrying an opt-in attribute (`data-escape-clears`); set it on the commit search, the working-changes filter and the sidebar filter. A focused field without it is not a layer: the press falls through to the next rank.
- `escape-layers.spec.ts`: add a `hasContent: false` axis, a field-with-content-under-rank-3 case, and a non-opted-in field case asserting fall-through.
- `tasks/escape-layers-service-migration.md`: the DoD names the two documented exceptions outside the registry (context menu, tooltip) instead of «no handler remains».

## Definition of Done

- [ ] A spec asserts Esc in the composer subject / body clears nothing and resolves to the layer below (or nothing).
- [ ] The three filters still clear on Esc; the manual six-layer matrix in DESIGN.md is unchanged.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

Opt-in beats an exclusion list: a future field is safe by default and a filter declares itself where it is written.

**Files beyond `files_hint`:** `src/app/features/commit-inspector/commit-inspector.html` — the commit file filter is a fourth field that clears on Esc and needed the same `data-escape-clears` opt-in; the hint listed three.
