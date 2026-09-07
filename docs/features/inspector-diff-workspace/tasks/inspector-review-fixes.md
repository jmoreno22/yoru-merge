---
id: T22
title: "Inspector fixes: header measurement, filter republish, double fetch, docs bound"
layer: "ui"
deps: ["T16"]
acs: ["AC-01", "AC-03", "AC-06", "AC-11"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.html",
  "src/app/features/commit-inspector/commit-inspector.css",
  "src/app/features/working-changes/changes-list.html",
  "src/app/features/working-changes/changes-list.ts",
  "DESIGN.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T22 — Inspector fixes: header measurement, filter republish, double fetch, docs bound

## Why

Four review findings on the inspector: the policy is fed `header.scrollHeight` while the CSS `max-height: 50%` silently stopped applying under the `flex-none` wrapper (and the code comment still describes the cap); a keystroke in the file filter republishes a list without the shown file and the workspace jumps; the two clicks of a double-click each load the diff before the open-large gesture runs; DESIGN.md caps `--inspector-list-rows` at six while the code exceeds it with the workspace open — [review 2026-09-03 F-8, F-10, F-11, F-20](../_review/review-2026-09-03.md), [spec AC-01, AC-03, AC-11, §6 NFR «not loaded a second time»](../spec.md), [ADR-0004](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md).

## What

- `applyLayout` measures the header's rendered fixed height (bounding box minus the body); remove the dead `max-height: 50%` rule and its comment; note the decision in DESIGN.md §App shell.
- Filter-driven removal of the shown file is `keep`: republish only on real content or order changes while the filter hides the shown file.
- Row click skips the diff load when the path is already active (commit file list and changes lists), so a double-click issues one request.
- DESIGN.md `--inspector-list-rows` bound cell notes the workspace-open exception.

## Definition of Done

- [ ] Manual: type in the file filter with the workspace open → the shown file stays; double-click a row → one diff request in the bridge log; long header at 960 × 640 → floors fire as AC-03 says.
- [ ] `pnpm build`, `pnpm lint` green; DESIGN.md updated.

## Notes

Depends on T16 for the token removal in the same file. Component-level assertions for these behaviours land in T24.

**Files beyond `files_hint`:** `src/app/features/working-changes/working-changes.ts` — the changes-list row click only emits `rowSelect`; the diff load lives in the panel's `onRowSelect`, so the double-fetch guard had to go there. `changes-list.html` / `changes-list.ts` were not touched.
