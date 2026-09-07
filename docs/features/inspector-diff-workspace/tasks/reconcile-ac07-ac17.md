---
id: T21
title: "Reconcile AC-07 with AC-17 and clear the stale diff"
layer: "app"
deps: []
acs: ["AC-07", "AC-17"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/core/services/diff-workspace-state.ts",
  "src/app/core/services/diff-workspace-state.spec.ts",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T21 — Reconcile AC-07 with AC-17 and clear the stale diff

## Why

The close-on-change effect closes the workspace as soon as the selected sha moves, while the original AC-07 wanted a workspace whose commit a refresh removed to stay open on the viewer's explanation. The owner resolved the collision in favour of AC-17 (review 2026-09-03) and the spec is amended; the residual case (sha stays, published list empties) still shows the stale diff because nothing clears `diffText` — [review 2026-09-03 F-7](../_review/review-2026-09-03.md), [spec AC-07 (amended), AC-17](../spec.md).

## What

- When the published commit list empties for a commit source, clear `repo.diffText` so the hosted viewer renders its existing empty explanation; previous / next stay disabled; Close returns as today.
- Update the republish comment in `commit-inspector.ts`, `sad.md` flow F4 and `ux-flows.md` US-03 branch H→I to describe the residual case only (a removed commit that moves the selection closes via F7 / AC-17).

## Definition of Done

- [ ] A spec asserts that `setFiles([])` on a commit source leads to a cleared diff text (state effect or service call) — red first, then green.
- [ ] `sad.md` / `ux-flows.md` wording matches the amended AC-07.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

No detection of «commit removed» is added: revalidating the selection on refresh is out of scope by the owner's decision.

**Files beyond `files_hint`:** `src/app/core/services/diff-workspace.service.spec.ts` — the DoD requires a spec asserting the cleared diff text.
