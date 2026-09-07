---
id: T26
title: "Record the task-boundary widenings and refresh the screenshots"
layer: "docs"
deps: ["T22", "T23"]
acs: []
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/collapsed-header-actions.md",
  "docs/features/inspector-diff-workspace/tasks/centre-and-portal-wiring.md",
  "docs/features/inspector-diff-workspace/tasks/docs-design-shell.md",
  "docs/screenshots/",
  "README.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T26 — Record the task-boundary widenings and refresh the screenshots

## Why

Three commits edited files outside their task's `files_hint` (T10 → `commit-menu.ts`, `commit-actions.service.ts`; T8 → `commit-list.ts`; T14 → `README.md`), and T14 shipped without the screenshot refresh its DoD requires — [review 2026-09-03 F-21, F-22](../_review/review-2026-09-03.md).

## What

- In the three task files, add a «Files beyond `files_hint`» line naming each extra file and the one-line reason.
- Recapture `docs/screenshots/history-dark.png` and `changes-light.png` from the built app after T22 / T23, plus one new shot with the diff workspace open; reference it from README.md.

## Definition of Done

- [ ] The three task files record the widening.
- [ ] Screenshots recaptured and referenced; or, if the capture cannot run unattended, the task is reported **blocked for the owner** rather than marked done.

## Notes

Screenshots are the last step: they must show the post-fix inspector.
