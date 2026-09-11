---
status: Living
updated_at: "2026-09-08"
---

# Domain Context — inspector-diff-workspace

## Glossary

- active file — the file whose diff the diff viewer (or the diff workspace) currently shows; there is at most one, chosen in the commit file list or in one of the working-changes lists. NOT a multi-row selection (several files highlighted in a list without their diff shown).
- commit file list — the list of files changed by the selected commit, shown in the inspector under the commit header, as a tree or a flat list; in this feature it is compact, collapsible and the block the layout policy protects — it takes the height the commit header leaves, with no upper bound on its rows, and claims no share at all when it has no row to draw. NOT the working-changes lists (staged / unstaged files in the Changes centre view). <!-- amended 2026-09-08 (owner, review round 10 R10-S1-F7): the canonical entry still placed the list «between the commit header and the diff viewer» and called it bounded in height, both reversed on 2026-09-07 -->
- commit header — the top block of the inspector for a selected commit: author, dates, sha, subject, body, ref badges and the commit actions (Branch, Tag, Cherry-pick, Revert, Reset, More). In this feature it has a collapsed state (subject, author, short sha) and an expanded state (everything). NOT the diff viewer header (the strip above a diff carrying path, stats and file actions).
- diff viewer — the single diff pane with its layout (unified / side-by-side), whitespace, wrap, context-lines and hunk-navigation controls; it is inline in the Changes view and re-hosted into the diff workspace (ADR-0003). In History the inspector holds only its parking slot, at zero height: a commit diff is read in the diff workspace. NOT the diff workspace. <!-- amended 2026-09-08 (owner, review round 10 R10-S1-F7) -->
- diff workspace — the centre view state in which one file's diff replaces the commit list (or the working-changes lists and the commit composer) at full centre width, with its own header (file path, source commit or working-tree side, previous / next file, Close). NOT the diff viewer, and NOT a new window, tab or overlay.

## Invariants

- At most one diff workspace can be open at a time; opening another file replaces its content.
- Closing the diff workspace always must restore the centre view that was replaced, with the same selection and scroll position.
- The diff workspace never changes which commit or which working-tree side is selected; it only changes where the diff is shown.
- The diff workspace exists only while the selection that opened it stays current: any change of the selected commit or of the working-tree side, from wherever it comes, closes it.

## Out of scope

- Splitting the centre view into two side-by-side diffs · the owner limited «split» to the existing unified / side-by-side diff layout (2026-09-02).
- Editor-style document tabs in the centre view · the owner chose «replace + Close/Esc» over tabs to avoid tab-state persistence (2026-09-02).
- A full-screen overlay for diffs · breaks the panel model of the rest of the app (2026-09-02).
