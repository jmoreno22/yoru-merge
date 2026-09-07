---
id: T4
title: "Add the two collapsed-state durable preferences"
layer: "infra"
deps: []
acs: ["AC-02", "AC-05"]
files_hint: ["src/app/core/services/preferences-schema.ts", "src/app/core/services/preferences-schema.spec.ts"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T4 — Add the two collapsed-state durable preferences

## Why

The collapsed / expanded state of the commit header and the commit file list is remembered across restarts «like the workbench splitters» — [spec AC-02, AC-05](../spec.md), [sad §4 pillar 5](../sad.md) (inline decision: ordinary durable preferences, no localStorage mirror).

## What

In `src/app/core/services/preferences-schema.ts`: add `commitHeaderCollapsed: boolean` and `commitFileListCollapsed: boolean` to `DurablePreferences`, defaults `false`, and the boolean parsing branch in the normaliser (same shape as the existing boolean keys). Extend `preferences-schema.spec.ts` for both keys.

## Definition of Done

- [ ] `preferences-schema.spec.ts` asserts: defaults are `false`; `true` / `false` round-trip through the normaliser; a non-boolean raw value falls back to the default.
- [ ] `pnpm build` green (the type change and its defaults land in the same file, so no implementer breaks — contract folded, no standalone contract task).
- [ ] `pnpm test` and `pnpm lint` green.

## Notes

Read by T9 and T11 through `PreferencesService` at first render (0 px layout shift NFR — no async read).
