---
id: T18
title: "Register the six workspace shortcuts from root-alive services"
layer: "app"
deps: []
acs: ["AC-12"]
files_hint: [
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/features/diff-workspace/diff-workspace.ts",
  "src/app/features/commit-inspector/commit-inspector.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T18 — Register the six workspace shortcuts from root-alive services

## Why

Settings › Keyboard renders the live registry. `diff-workspace.close` / `.next` / `.prev` are registered by a component that exists only while the workspace is open, and the two inspector toggles by a component absent from the Changes view, so the help lists three of the six SCR-05 rows most of the time — [review 2026-09-03 F-3](../_review/review-2026-09-03.md), [spec AC-12](../spec.md), [screens.md SCR-05](../screens.md).

## What

- `DiffWorkspaceService` registers `diff-workspace.close` / `.next` / `.prev` once, with `when` guards on `isOpen` / `canNext` / `canPrev` (the `when: () => false` trick on Close goes; Esc still runs through the registry only, ADR-0002).
- The header and file-list toggles are registered by a root-provided service (they flip preferences, so they need no component alive).
- `DiffWorkspace` keeps only its Esc layer binding.

## Definition of Done

- [ ] A spec asserts the six ids are registered after root injection, with the workspace closed.
- [ ] Manual: Settings › Keyboard lists the six rows from History and from Changes.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

Dispatch is unchanged: the guards keep next / prev inert while closed, exactly as today.

**Files beyond `files_hint`:** `src/app/core/services/diff-workspace.service.spec.ts` — the DoD asks for a spec of the six registrations; `src/testing/tauri-git-stub.ts` — the stub's teardown probe blocked root injection in that spec.
