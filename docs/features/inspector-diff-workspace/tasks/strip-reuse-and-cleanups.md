---
id: T23
title: "Reuse the diff strip, hide the composer once, break the core→shared barrel import"
layer: "ui"
deps: []
acs: ["AC-06", "AC-13"]
files_hint: [
  "src/app/core/services/diff-workspace.service.ts",
  "src/app/features/diff-workspace/diff-workspace.html",
  "src/app/features/diff-workspace/diff-workspace.ts",
  "src/app/features/diff-viewer/diff-viewer.html",
  "src/app/features/diff-viewer/diff-viewer.ts",
  "src/app/features/commit-inspector/commit-inspector.html",
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/working-changes/file-row.html",
  "src/app/features/working-changes/file-row.ts",
  "src/app/features/working-changes/working-changes.html",
  "src/app/shared/components/main-content/main-content.html",
  "src/app/shared/ui/",
  "DESIGN.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T23 — Reuse the diff strip, hide the composer once, break the core→shared barrel import

## Why

Three quality findings: `core` imports the `shared/ui` barrel and closes an import cycle through `yoru-dialog`; the composer is hidden by three independent mechanisms; the workspace strip duplicates the diff viewer's source chip and path spans verbatim, and the tooltips hardcode key combos as prose — [review 2026-09-03 F-13, F-17, F-19](../_review/review-2026-09-03.md), [screens.md SCR-02](../screens.md), [ARCHITECTURE.md layers](../../../ARCHITECTURE.md).

## What

- `diff-workspace.service.ts` imports `KeyboardShortcutsService` by module path; no file under `core/` imports the `shared/ui` barrel (grep-checked).
- Hide the composer and lists through the panel-level guards only (drop the outer `hidden` class binding in `main-content.html`); the draft still survives a workspace round-trip.
- Extract the source chip + faint-dirname / strong-basename path spans into one shared piece used by `diff-viewer.html` and `diff-workspace.html`; register it in DESIGN.md.
- Tooltips for open-large, Close, next and previous derive their key hint from `formatCombo` of the registered combo (`diff-workspace.html`, `commit-inspector.html`, `file-row.html`).

## Definition of Done

- [ ] `grep -rn "shared/ui'" src/app/core` returns nothing; the composer hides through one mechanism; the shared piece exists and both strips use it; tooltips show the combo from the registry.
- [ ] Manual: type a draft, open a file in the workspace, close → the draft is intact.
- [ ] `pnpm build`, `pnpm lint` green.

## Notes

Compile-coupled with T22 through `commit-inspector.html` / `.ts`; serialize after it or share the lane.

**Files beyond `files_hint`:** `src/app/features/working-changes/changes-list.ts` and `working-changes.ts` — removing the inner hide guards left the viewports with a cached height of 0, which forced the re-measure after the workspace closes.
