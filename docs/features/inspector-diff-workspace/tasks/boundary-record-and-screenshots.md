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

- [x] The three task files record the widening.
- [x] Screenshots recaptured and referenced; or, if the capture cannot run unattended, the task is reported **blocked for the owner** rather than marked done.

## Notes

Screenshots are the last step: they must show the post-fix inspector.

## Outcome (2026-09-13)

Unblocked and closed. The capture did **not** have to run unattended in the end: the owner gave the
dev-build window focus and the three shots were driven from there.

**What was captured**, all at **1296 x 809** to match the two the set already had, from
`pnpm tauri dev` on `feat/inspector-diff-workspace` with this repository open:

| file | what it shows |
|---|---|
| `history-dark.png` | History, dark. The **post-reversal** inspector: commit header, the action row, and `70 FILES` filling the rest of the column — **no diff viewer**, which is what the 2026-09-07 reversal and `main-content.html`'s `h-0` slot describe. The previously active file row is still focused, because the shot was taken right after Esc closed the workspace — AC-08's restore, visible |
| `changes-light.png` | Changes, light. Refs tree, staged / changes lists, the commit composer, and the diff viewer holding the whole inspector column, which is the `view() === 'changes'` branch of the same slot |
| `diff-workspace-dark.png` | **new.** A file opened from the History inspector: the workspace replaces the commit list at full centre width with its own header, file navigation and close, while the inspector keeps its header and file list with the open row marked (AC-22) |

`README.md` gains a line for the new one, inside the «More screenshots» block beside the other two.

**A capture that was thrown away, and why it matters.** The first three attempts drove the **installed
1.0.6**, not the dev build — the updater had installed it hours earlier, both binaries are called
`yoru-merge`, and the capture helper matched on process name. The installed build is `main`, which
does not carry the reversal, so its inspector still hosts a diff viewer; that produced a confident
report of a discrepancy that did not exist. The helper now matches the **executable path** under this
repository. A screenshot proves what it was pointed at, and nothing else.

**Not covered by these shots**, so it is not implied: the three densities, and Linux. Both belong to
the manual release checklist, which has still never been run.
