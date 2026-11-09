---
status: Implemented
owner: "Jhoan Moreno"
updated_at: "2026-11-09"
---

# Spec — inspector-diff-workspace

> **Glossary:** [project CONTEXT](../../../CONTEXT.md) · **Design:** `DESIGN.md` §«Density», §«App shell», §«Keyboard» · **Decisions:** [adr/](./adr/)

## 1. Context

Before this feature the History inspector stacked three blocks in a fixed two-to-three proportion: the commit header (author, dates, sha, subject, body, ref badges and six action buttons), the commit file list, and the diff viewer. The header never collapsed, the file list kept its share even for a one-file commit, and the diff could only ever be read at inspector width.

What shipped: the commit header opens expanded, with a long body clamped to four lines and expandable in place, and collapses on demand into a one-line summary (subject, author, short sha) that keeps the commit actions one gesture away. The commit file list is collapsible and takes all remaining height in the inspector, never less than half of it: the header yields first. The History inspector hosts no diff viewer — every commit diff is read in the **diff workspace**, a centre view state that replaces the commit list (or, in Changes, the working-changes lists and the commit composer) at full width and is closed by Esc or Close, restoring the exact previous selection, scroll and focus. Blame and file history opened from inside the diff workspace stack in the inspector as before, and the workspace stays open. «Split» stays the existing unified / side-by-side diff layout.

History, and every view that shows a selected commit, gets the full treatment; Changes gets only the diff workspace gesture. Esc and the hunk shortcuts already had several consumers with no priority order between them, so layer precedence and shortcut distinctness are acceptance criteria (AC-10, AC-12) rather than design details.

## 2. Goals

- The commit file list is the dominant surface of the inspector whenever a commit is selected, and the diff is read at centre width in the diff workspace; the commit header is an orientation aid that yields height before the list does.
- Any single file's diff can be read at full centre width and left again, one gesture each way, from both History and Changes, returning to exactly where the developer was.
- Every existing layout mode (inspector right or bottom, every density, stacked blame and file history, persisted splitter, light theme) keeps working.

## 3. Non-goals

- Two diffs side by side in the centre view (two files, or one file in two commits).
- Editor-style document tabs in the centre view · «replace + Close / Esc» covers the review flow.
- Redesigning the Changes view (commit composer, staged / unstaged lists) · only the diff workspace gesture applies there.
- Changing how a diff renders (syntax highlighting, image diff, hunk and line staging) · the diff workspace reuses the diff viewer as it is.
- A continuous multi-file diff of the whole commit in one scroll · the diff workspace is per file.

## 4. User stories

- **US-01 — Read the commit message, collapse it when reviewing.** As a developer I want the commit header to open expanded with a long body clamped to four lines (expandable in place) and to collapse into a one-line summary, so that I read the message without scrolling and hand the column to the file list when I review the changes.
- **US-02 — Keep the commit file list compact.** As a developer I want the file list to take the height the column has left, with its own scroll, shrinking to the real file count and collapsible to its header, so that a thirty-file commit is reachable at a glance.
- **US-03 — Open a file in the diff workspace.** As a developer I want to open the active file's diff in the centre view by a single click, a double-click, a visible control or a shortcut, and to choose from the file list which of the two a single click does, so that I read a wide diff at full width without leaving the workbench.
- **US-04 — Return from the diff workspace.** As a developer I want Esc or Close to bring the previous centre view back with my selection, scroll position and keyboard focus intact, so that opening a diff never costs me my place.
- **US-05 — Step through files inside the diff workspace.** As a developer I want previous / next file controls and shortcuts distinct from the hunk shortcuts, so that I review a whole commit without returning to the list for every file.
- **US-06 — Review working-tree changes in the diff workspace.** As a developer in the Changes view I want to open a staged or unstaged file in the diff workspace and stage or unstage hunks and lines there, so that I review my own changes at full width before committing.
- **US-07 — Keep existing layout modes.** As a developer using inspector-at-bottom, a non-default density, stacked blame or file history, or the light theme, I want the redesigned inspector to work in those modes, so that I keep my habits.
- **US-08 — Reach commit actions from the collapsed header.** As a developer I want Branch, Tag, Cherry-pick, Revert, Reset and More reachable from the collapsed header in one gesture, so that collapsing the header never hides an action.

## 5. Acceptance criteria

**Header-cap exception** (cited by AC-02, AC-18 and §6). The *remainder* is the inspector height left after any stacked blame or file history. Where it is under twice `--panel-head-h` with the header expanded, or under four times it collapsed, the header cap is lifted to one full panel head and the list's ratio yields, because a header shorter than its own head would disappear behind its own scrollbar.

### AC-01 (US-01) — happy path

**Given** a developer selects a commit whose message has a subject and a long body
**When** the inspector shows the commit
**Then** the commit header opens expanded with the body clamped to four lines (no height is reserved when the body is shorter) plus a «show more» control, author, dates, short sha, ref badges and commit actions visible, and the commit file list keeps at least half the inspector height

### AC-02 (US-01) — happy path

**Given** the commit header is expanded
**When** the developer collapses it with its control or shortcut
**Then** the header becomes one summary line (subject, author, short sha) and the commit file list takes at least three quarters of the inspector height, subject to the header-cap exception; expanding it again restores the previous state, and the collapsed / expanded state is remembered across app restarts, like the workbench splitters

### AC-03 (US-01) — domain invariant

**Given** the window is at its minimum supported size (960 × 640) and the selected commit has a long body and many changed files
**When** the inspector lays out
**Then** the commit file list never receives less than half the inspector height: the body clamp shrinks first, down to one line plus «show more», and past that the expanded header scrolls inside its cap; the file list keeps at least two visible rows with its own scroll and never goes below that floor

### AC-04 (US-02) — happy path

**Given** a commit with thirty changed files, or a commit whose list has no row to draw — no changed files at all, or a filter that matches none of them
**When** the inspector shows it
**Then** the commit file list shows as many rows as the inspector column fits in every density (the row height follows the density token), with its own scroll and the total file count; given a commit with two changed files, the list takes exactly two rows with no reserved empty space; and given a list with no row to draw, only the list header with the count and a single «No files changed» (or the existing «no match») line show, and the list claims no share of the inspector: it keeps its head and nothing more, exactly as a collapsed list does (AC-05)

### AC-05 (US-02) — happy path

**Given** the commit file list is visible
**When** the developer collapses it
**Then** only its header with the file count remains, the released height is left empty inside the inspector column (stacked blame and file history keep their fixed share, AC-19), and the active file stays the one the diff workspace shows; the collapsed state is remembered across app restarts

### AC-06 (US-03) — happy path

**Given** a file is active in the commit file list
**When** the developer clicks it with the open-on-click preference on (the default), double-clicks it, uses its open-large control, or presses the open-large shortcut
**Then** the centre view becomes the diff workspace showing that file's diff, with a header carrying the file path, the source commit (short sha and subject), previous / next file controls and Close. Layout, whitespace, wrap and context are the diff viewer's own preferences, not a copy: changing one in the diff workspace changes it in the diff viewer and persists. The commit inspector hosts no diff viewer: its column is the commit header and the commit file list, which shows as many rows as fit, whether the diff workspace is open or closed, and closing the diff workspace returns the centre view to its list without changing the inspector's shape. The working-tree side keeps its inline diff viewer, which the diff workspace hides while it is open and restores on close (AC-13). Inside the diff workspace the viewer's per-file collapse control is not shown — collapsing the one file would leave the centre empty; every other control of the viewer comes with it unchanged

### AC-07 (US-03) — error

**Given** a file whose diff cannot be shown as text (a binary file without preview)
**When** the developer opens it in the diff workspace
**Then** the diff workspace shows the same plain explanation the diff viewer shows for that case instead of an empty centre, and Close still returns to the previous view. A refresh (repository watcher, fetch, history rewritten outside the app) that removes the shown commit is a selection change and follows AC-17; only when the commit stays selected but its file list has been emptied does the diff workspace stay open showing the viewer's plain explanation, with previous / next disabled

### AC-08 (US-04) — happy path

**Given** the diff workspace is open from the History view
**When** the developer presses Esc or uses Close
**Then** the commit list returns with the same selected commit and the same scroll offset, and keyboard focus returns to the element that had it when the diff workspace opened (the file row in the commit file list, or the commit row when opened by shortcut from the centre); if previous / next changed the active file, focus lands on the now-active file row instead

### AC-09 (US-04) — domain invariant

**Given** the diff workspace is open
**When** the developer opens another file from the commit file list or with previous / next
**Then** the new file replaces the current one; at most one diff workspace exists at any time

### AC-10 (US-04) — domain invariant

**Given** the diff workspace is open and one or more of these layers is open above it: a dialog, the command palette, a text field with content (the commit filter included), a diff line selection, a stacked blame or file-history panel
**When** the developer presses Esc
**Then** only the topmost open layer closes, in the fixed order dialog, then command palette, then text field (its content clears), then diff line selection, then stacked blame or file history, then diff workspace; the diff workspace closes only when none of the other five is open

### AC-11 (US-05) — happy path

**Given** the diff workspace shows the second of five files
**When** the developer uses next file (control or shortcut)
**Then** the third file shows, the workspace header updates and the commit file list marks it active; previous / next follow the order in which the commit file list currently shows the files (tree or flat), skipping folders; on the last file the next control is disabled and on the first file the previous control is disabled

### AC-12 (US-05) — domain invariant

**Given** the diff workspace is open
**When** the developer presses the existing hunk shortcuts
**Then** they still move between hunks exactly as in the diff viewer; file navigation uses distinct shortcuts, and both sets appear in the shortcuts help

### AC-13 (US-06) — happy path

**Given** the Changes view with an unstaged file active
**When** the developer opens it in the diff workspace
**Then** the staged and unstaged lists and the commit composer hide, the diff shows with hunk and line stage / unstage controls, and a hunk staged there is reflected in the staged and unstaged counts when the developer returns; previous / next controls exist here too and walk only the list the file was opened from (unstaged or staged), never crossing to the other side; when the developer's own stage or unstage action leaves the shown side with no changes, the diff workspace advances to the next file on that side, and closes with a brief notice when none remains

### AC-14 (US-06) — authorization

**Given** the diff workspace was opened from the History view (a file of a commit)
**When** the developer tries to stage or unstage a hunk or a line, by control or by shortcut
**Then** no staging control is offered and the diff viewer's staging shortcuts (line selection and its keyboard stage / unstage) stay inactive wherever focus is, because the diff's source is a commit and not the working tree

### AC-15 (US-06) — domain invariant

**Given** the diff workspace is open in the Changes view and the commit composer is hidden
**When** the developer presses the commit or the commit-draft shortcut
**Then** nothing is committed; the composer's shortcuts stay inactive until the diff workspace closes

### AC-16 (US-06) — cross-context

**Given** the diff workspace shows an unstaged file
**When** the repository watcher reports that the file changed on disk or was staged from outside the app
**Then** the diff workspace refreshes to the new content; if that external change leaves the file with no changes on that side, the diff workspace closes, the Changes view returns and a plain notice says why (changes made from inside the diff workspace follow AC-13 instead)

### AC-17 (US-03) — cross-context

**Given** the diff workspace is open
**When** the developer switches the rail view or the repository tab, or any action changes the selected commit or the working-tree side (a refs panel click, the commit search, a command-palette command)
**Then** the diff workspace closes and the view shows its normal centre content with the new selection; returning to the original view shows its list, not the diff workspace

### AC-18 (US-07) — happy path

**Given** the inspector is placed at the bottom
**When** a commit is selected
**Then** the commit header (expanded or collapsed) and the commit file list apply, and the commit file list keeps at least the share of the column it keeps with the inspector on the right, subject to the header-cap exception; collapsing the header hands the released height to the file list exactly as on the right (the 50 % and 75 % shares are measured only with the inspector on the right)

### AC-19 (US-07) — cross-context

**Given** blame or file history is open under the commit file list
**When** the developer collapses the commit header
**Then** blame and file history keep their current share and the released height goes to the commit file list; the three-quarters target is measured only without stacked panels

### AC-20 (US-07) — happy path

**Given** compact or relaxed density, or the light theme, is active
**When** the redesigned inspector renders
**Then** the summary line, rows and controls follow the density tokens and every text meets the same contrast rule as the rest of the app

### AC-21 (US-08) — happy path

**Given** the commit header is collapsed
**When** the developer looks at the summary line
**Then** the same six action buttons as in the expanded header (Branch, Tag, Cherry-pick, Revert, Reset, More) sit inline as icons with tooltips, one click each; buttons that do not fit the available width move into More, and Reset keeps its confirmation

### AC-22 (US-03) — happy path

**Given** the commit file list is visible
**When** the developer uses the open-behaviour control in the file list header
**Then** the list switches between «a single click opens the diff workspace» and «a single click only makes the row active, and the workspace opens on double-click, the open-large control or the shortcut»; the control shows which of the two is active, and the choice is remembered across app restarts like the header and file-list collapse states. The control changes nothing else: both modes keep the double-click, the open-large control and the shortcut working

## 6. Non-functional requirements

| Aspect | Target |
|---|---|
| Commit file list protected share · header expanded, no stacked panels, inspector right | ≥ 50 % at every window size from 960 × 640 upward, in every density |
| Commit file list protected share · header collapsed, no stacked panels, inspector right | ≥ 75 % |
| Commit file list protected share · inspector at the bottom, or blame / file history stacked | ≥ the share it has with the inspector on the right at the same window size and density, computed on the remainder; subject to the header-cap exception (§5) |
| Open the diff workspace from a diff already shown in the viewer | first paint ≤ 150 ms on a 2 000-line diff; the diff is not loaded a second time |
| Close the diff workspace | previous centre view back in ≤ 100 ms with the identical scroll offset and selection |
| Keyboard reachability | every diff workspace action (open, close, previous / next file, hunk navigation) has a shortcut listed in the shortcuts help; focus returns to the originating row on close |
| Esc layer precedence | Esc never closes a layer that is not the topmost of the six in AC-10 |
| First paint of the remembered header / file-list state | no layout shift: both paint directly in their remembered state |
| Existing modes | no layout regression across both themes × the three densities × both placements |

The **protected share** is `(remainder − headerMaxH) / remainder`: the part of the column the commit header may not cross, not the drawn height of a list that stops at its file count (AC-04). It is not measured when the list has no row to draw (AC-04, AC-05). The floors and the yield order live in [`inspector-layout.ts`](../../../src/app/core/services/inspector-layout.ts).

## 7. Security / privacy

- Repository content already on the developer's machine; nothing leaves the app, and no new personal data is shown (author name and email were already in the commit header).
- No new write capability: the diff workspace reuses the existing diff-reading and staging surfaces. Staging is offered solely for working-tree diffs (AC-14).
- Abuse cases: a blind commit while the composer is hidden is blocked by AC-15; staging a stale hunk after the file changed on disk is prevented by the refresh in AC-16, and a stage action on stale content fails with the existing plain message, half-applying nothing; file names and commit subjects render as text in the workspace header, never interpreted; Reset keeps its confirmation from the collapsed header (AC-21) and no destructive action gains a one-key shortcut.

## 8. Open questions

- [ ] Does WebKitGTK omit a scroll container's bottom padding from `scrollHeight`, so the header measurement in `commit-inspector.ts` understates the fixed part by one `--panel-pad` and the header cap lands low on the Linux build only? — owner: Jhoan Moreno · check before release: the expanded header with 30 refs at 960 × 640 on Linux; if confirmed, measure an inner content wrapper instead of the scroll container.
