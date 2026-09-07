---
status: Draft
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-02"
feature_size: "M"
---

# Spec — inspector-diff-workspace

> **Glossary:** [feature CONTEXT](./CONTEXT.md) · [project CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** owner interview (2026-09-02); `DESIGN.md` §«App shell» and §«Density»; the current templates `src/app/shared/components/main-content/main-content.html`, `src/app/features/commit-inspector/commit-inspector.html`, `src/app/features/diff-viewer/diff-viewer.html`, `src/app/features/working-changes/working-changes.html`; `docs/screenshots/`. No external tickets.

## 1. Context

In the History view the inspector stacks three blocks in a fixed two-to-three proportion: the commit header (author, dates, sha, subject, body, ref badges and six action buttons), the commit file list, and the diff viewer. The header never collapses and the file list keeps its share even for a one-file commit, so the diff, the thing the developer actually reads when reviewing a commit, gets about three fifths of the narrowest workbench column and can only ever be read at inspector width. A developer reviewing history, their own or a collaborator's, has no way to hand a single file's diff the centre of the window.

Why now: the 1.0.5 release closed the toolchain upgrade work, and the owner's daily use since then surfaced this as the top friction: the commit file list and the diff read as two views of the same thing competing for space in one column. No roadmap item touches the workbench layout, so a layout change now does not collide with other UI work. A survey of ten adjacent products (desktop Git clients, terminal clients and web review tools) found none that combines a collapsible commit header, a diff-dominant column and a click-to-open large view with a one-gesture return and file-to-file navigation; two terminal clients each have half of it. The combination is a genuine differentiator.

Committed approach: the commit header opens expanded, with a long message body clamped to four lines and expandable in place, and collapses on demand into a one-line summary (subject, author, short sha) that keeps the commit actions one gesture away. The commit file list becomes compact, bounded in height and collapsible. The diff viewer takes all remaining height and never receives less than half the inspector: header and file list yield first. Any file can be opened in the **diff workspace**, a centre view state that replaces the commit list (or, in Changes, the working-changes lists and the commit composer) at full width and is closed by Esc or Close, restoring the exact previous selection, scroll and focus. «Split» stays the existing unified / side-by-side diff layout. History, and every view that shows a selected commit, gets the full treatment; Changes gets only the diff workspace gesture. The sharpest risk found in the failure-mode review is keyboard precedence: Esc and the hunk shortcuts already have several consumers and the app has no priority order between them, so layer precedence and shortcut distinctness are acceptance criteria here rather than design details. Success is measured as the share of inspector height the diff viewer receives (expanded and collapsed) and as the gesture count to read a file at full width and return.

Traceability: the shell vocabulary (rail, refs panel, centre view, inspector, workbench) follows `DESIGN.md` §«App shell» and is fixed in the project glossary; density and minimum-window figures follow `DESIGN.md` §«Density» and the app's minimum window size (960 × 640). Decision overrides from the critic pass, if any, are listed below.

## 2. Goals

- The diff viewer is the dominant surface of the inspector whenever a commit is selected; the commit header and the commit file list shrink to orientation aids that yield height before the diff does.
- A developer can read any single file's diff at full centre width and come back to exactly where they were, one gesture each way, from both the History and the Changes view.
- Every existing layout mode (inspector right or bottom, compact density, stacked blame and file history, persisted splitter, light theme) keeps working unchanged, so the redesign is additive for existing habits.

## 3. Non-goals

- Splitting the centre view into two side-by-side diffs (two files, or one file in two commits) · the owner limited «split» to the existing unified / side-by-side diff layout; a two-pane layout is a new subsystem that would push the feature to L.
- Editor-style document tabs in the centre view · «replace + Close / Esc» covers the review flow without tab-state persistence or an extra row of height.
- Redesigning the Changes view itself (commit composer, staged / unstaged lists) · only the diff workspace gesture applies there; the composer is the densest surface in the app and deserves its own spec.
- Changing how a diff renders (syntax highlighting, image diff, hunk and line staging) · the diff workspace reuses the diff viewer's rendering and controls as they are.
- Toolbar and rail button contrast, and worktree visibility · split into their own spec (`workbench-contrast-worktrees`).
- A continuous multi-file diff of the whole commit in one scroll · the one-file-at-a-time model stays; the diff workspace is per file.

## 4. User stories

### US-01: Read the commit message without scrolling, collapse it when reviewing

**As a** developer
**I want** the commit header to open expanded with a long message body clamped to four lines (expandable in place) and to collapse the whole header into a one-line summary (subject, author, short sha)
**So that** I read the message without scrolling and hand the whole column to the diff when I am reviewing the changes

### US-02: Keep the commit file list compact

**As a** developer
**I want** the commit file list bounded to six rows with its own scroll, shrinking to the real file count and collapsible to its header
**So that** a thirty-file commit never pushes the diff off the column

### US-03: Open a file in the diff workspace

**As a** developer
**I want** to open the active file's diff in the centre view by double-click, a visible control or a shortcut
**So that** I can read a wide diff at full width without leaving the workbench

### US-04: Return from the diff workspace

**As a** developer
**I want** Esc or Close to bring the previous centre view back with my selection, scroll position and keyboard focus intact
**So that** opening a diff never costs me my place in the history or in my changes

### US-05: Step through files inside the diff workspace

**As a** developer
**I want** previous / next file controls and shortcuts that are distinct from the hunk shortcuts
**So that** I can review a whole commit without returning to the list for every file

### US-06: Review working-tree changes in the diff workspace

**As a** developer in the Changes view
**I want** to open a staged or unstaged file in the diff workspace and stage or unstage hunks and lines there
**So that** I can review my own changes at full width before committing

### US-07: Keep existing layout modes

**As a** developer using inspector-at-bottom, compact density, stacked blame or file history, or the light theme
**I want** the redesigned inspector to work in those modes
**So that** I do not have to change my habits to benefit from it

### US-08: Reach commit actions from the collapsed header

**As a** developer
**I want** Branch, Tag, Cherry-pick, Revert, Reset and More reachable from the collapsed header in one gesture
**So that** collapsing the header never hides an action I use

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a developer selects a commit whose message has a subject and a long body
**When** the inspector shows the commit
**Then** the commit header opens expanded with the body clamped to four lines (no height is reserved when the body is shorter) plus a «show more» control, author, dates, short sha, ref badges and commit actions visible, and the diff viewer keeps at least half the inspector height

### AC-02 (US-01) — happy path

**Given** the commit header is expanded
**When** the developer collapses it with its control or shortcut
**Then** the header becomes one summary line (subject, author, short sha), the diff viewer takes at least three quarters of the inspector height, and expanding it again restores the previous state; the collapsed / expanded state is remembered across app restarts, like the workbench splitters

### AC-03 (US-01) — domain invariant

**Given** the window is at its minimum supported size and the selected commit has a long body and many changed files
**When** the inspector lays out
**Then** the diff viewer never receives less than half the inspector height: the commit file list shrinks first, down to two visible rows with its own scroll, then the body clamp shrinks, down to one line plus «show more»; neither goes below those floors, and the diff never shrinks below half

### AC-04 (US-02) — happy path

**Given** a commit with thirty changed files
**When** the inspector shows it
**Then** the commit file list shows at most six rows in either density (the row height follows the density token), with its own scroll and the total file count; given a commit with two changed files, the list takes exactly two rows with no reserved empty space; and given a commit with no changed files, only the list header with the count 0 and a single «No files changed» line show

### AC-05 (US-02) — happy path

**Given** the commit file list is visible
**When** the developer collapses it
**Then** only its header with the file count remains, the released height goes to the diff viewer, and the active file stays the one shown in the diff viewer; the collapsed state is remembered across app restarts

### AC-06 (US-03) — happy path

**Given** a file is active in the commit file list
**When** the developer double-clicks it, uses its open-large control, or presses the open-large shortcut
**Then** the centre view becomes the diff workspace showing that file's diff, with a header carrying the file path, the source commit (short sha and subject), previous / next file controls and Close, and with layout, whitespace, wrap and context settings matching the diff viewer's current ones; those four settings are the diff viewer's own preferences, not a copy: changing one in the diff workspace changes it in the diff viewer and persists as today. While the diff workspace is open the inspector's diff viewer is hidden and its height goes to the commit header and the commit file list, which then shows as many file rows as fit; closing the diff workspace brings the inspector's diff viewer back

### AC-07 (US-03) — error

**Given** a file whose diff cannot be shown as text (a binary file without preview)
**When** the developer opens it in the diff workspace
**Then** the diff workspace shows the same plain explanation the diff viewer shows for that case instead of an empty centre, and Close still returns to the previous view. A refresh (repository watcher, fetch, history rewritten outside the app) that removes the shown commit is a selection change and follows AC-17: the diff workspace closes and the view shows its list with whatever selection still exists; only when the commit stays selected but its file list has been emptied does the diff workspace stay open showing the viewer's plain explanation, with previous / next disabled <!-- amended-by-review 2026-09-03: the AC-07 / AC-17 collision is resolved in favour of AC-17 -->


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
**Then** the commit header (expanded or collapsed) and the compact commit file list apply, and the diff viewer keeps at least the height it has today in that placement; collapsing the header or the file list hands the released height to the diff viewer exactly as on the right (the 50 % and 75 % shares are measured only with the inspector on the right)

### AC-19 (US-07) — cross-context

**Given** blame or file history is open under the diff viewer
**When** the developer collapses the commit header
**Then** blame and file history keep their current share and the released height goes to the diff viewer; the three-quarters target is measured only without stacked panels

### AC-20 (US-07) — happy path

**Given** compact density or the light theme is active
**When** the redesigned inspector renders
**Then** the summary line, rows and controls follow the density tokens and every text meets the same contrast rule as the rest of the app

### AC-21 (US-08) — happy path

**Given** the commit header is collapsed
**When** the developer looks at the summary line
**Then** the same six action buttons as in the expanded header (Branch, Tag, Cherry-pick, Revert, Reset, More) sit inline as icons with tooltips, one click each; buttons that do not fit the available width move into More, and Reset keeps its confirmation

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Diff viewer share of inspector height · header expanded (default), no stacked panels, inspector right | ≥ 50 % at every window size from 960 × 640 upward | element-height measurement in the built app at 960 × 640 and 1280 × 800, both densities |
| Diff viewer share of inspector height · header collapsed, no stacked panels, inspector right | ≥ 75 % | same |
| Diff viewer height · inspector at the bottom, or blame / file history stacked | ≥ the height it has in the 1.0.5 build in the same configuration | side-by-side measurement against the 1.0.5 build |
| Open the diff workspace from a diff already shown in the viewer | first paint ≤ 150 ms; the diff is not loaded a second time | performance-panel timing on a 2 000-line diff |
| Close the diff workspace | previous centre view back in ≤ 100 ms with the identical scroll offset and selection | pure-TypeScript unit test on the restore logic, plus manual check |
| Keyboard reachability | 100 % of diff workspace actions (open, close, previous / next file, hunk navigation) have a shortcut listed in the shortcuts help; focus returns to the originating row on close | keyboard-only accessibility pass |
| Esc layer precedence | 0 cases where Esc closes a layer that is not the topmost | keyboard matrix over the six layers of AC-10: dialog · command palette · text field with content · diff line selection · stacked blame / file history · diff workspace |
| Layout regressions in existing modes | 0 | release checklist: both themes × both densities × both placements |
| First paint of remembered header / file-list state | inspector layout shift between the first painted frame and the settled state = 0 px (header and file list paint directly in their remembered state) | layout-shift measurement on launch, in both the expanded and the collapsed state |

## 6.1 Security / privacy

- **Data classification:** internal · repository content already on the developer's machine; nothing leaves the app.
- **Personal data touched:** none new · author name and email are shown in the commit header today.
- **AuthZ/AuthN impact:** none (single-user desktop application). The only permission-like rule is business: staging is offered solely for working-tree diffs (AC-14). No new capability that writes to the repository is introduced; the diff workspace reuses the existing diff-reading and staging surfaces.
- **Abuse cases:**
  - blind commit while the composer is hidden → the composer's shortcuts are inactive while the diff workspace is open (AC-15).
  - staging a stale hunk after the file changed on disk → the diff workspace refreshes on watcher events (AC-16); a stage action on stale content fails with today's plain message and nothing is half-applied.
  - file names or commit subjects crafted to look like controls or links → rendered as text in the diff workspace header, never interpreted, as in the diff viewer header today.
  - destructive action from the collapsed header → Reset keeps its confirmation (AC-21); no destructive action gains a one-key shortcut.
- **Security review:** N/A · no new authorization boundary, no new personal data, no new write capability; the feature rearranges existing read and stage surfaces.

## 7. Metrics / KPIs

- **Diff viewer share of inspector height** (History, commit selected, inspector right, no stacked panels) — baseline: 60 % fixed (today's two-to-three split); target at release: ≥ 50 % with the header expanded at 960 × 640, ≥ 60 % with the header expanded for a subject-only commit with two or fewer files (parity with today), ≥ 75 % with the header collapsed.
- **Gestures to read a file at full centre width and return** — baseline: not possible; target at release: one gesture to open and one to return, from both History and Changes.
- **Inspector height consumed by the commit header plus the commit file list** for a one-file, subject-only commit (comfortable density, inspector right, 1280 × 800) — baseline: about 275 px (fixed two-fifths); target at release: ≤ 220 px expanded, ≤ 70 px collapsed.
- **Layout regressions in existing modes** reported during the first release cycle — baseline: 0; target: 0.

## 8. Open questions

- [x] Should a sticky «always open diffs in the diff workspace» preference exist (the single-file mode some web review tools offer) besides the per-file gesture? — owner: Jhoan Moreno · **Resolved 2026-09-02 (ux-flows): no, gesture only**; a single click keeps showing the diff in the inspector (see `ux-flows.md` §Platform decisions).
- [x] Where do blame and file history open when launched from inside the diff workspace: stacked in the inspector as today, or replacing the diff workspace content? — owner: Jhoan Moreno · **Resolved 2026-09-02 (ux-flows): stacked in the inspector, the diff workspace stays open** (see `ux-flows.md` flow US-03).
- [ ] Does WebKitGTK omit a scroll container's bottom padding from `scrollHeight`, so the header measurement in `commit-inspector.ts` understates the fixed part by one `--panel-pad` and the header cap lands low on the Linux build only? — owner: Jhoan Moreno · due: ship (manual check of the expanded header with 30 refs at 960 × 640 on Linux; if confirmed, measure an inner content wrapper instead of the scroll container). Raised by [review 2026-09-04 round 3](./_review/review-2026-09-04-round3.md), R15 (PLAUSIBLE).
