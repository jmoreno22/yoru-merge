---
status: Draft
owner: "Jhoan Moreno"
reviewers: ["Tech Lead"]
updated_at: "2026-09-08"
feature_size: "M"
---

# Spec — inspector-diff-workspace

> **Glossary:** [feature CONTEXT](./CONTEXT.md) · [project CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** owner interview (2026-09-02); `DESIGN.md` §«App shell» and §«Density»; the current templates `src/app/shared/components/main-content/main-content.html`, `src/app/features/commit-inspector/commit-inspector.html`, `src/app/features/diff-viewer/diff-viewer.html`, `src/app/features/working-changes/working-changes.html`; `docs/screenshots/`. No external tickets.

## 1. Context

In the History view the inspector stacks three blocks in a fixed two-to-three proportion: the commit header (author, dates, sha, subject, body, ref badges and six action buttons), the commit file list, and the diff viewer. The header never collapses and the file list keeps its share even for a one-file commit, so the diff, the thing the developer actually reads when reviewing a commit, gets about three fifths of the narrowest workbench column and can only ever be read at inspector width. A developer reviewing history, their own or a collaborator's, has no way to hand a single file's diff the centre of the window.

Why now: the 1.0.5 release closed the toolchain upgrade work, and the owner's daily use since then surfaced this as the top friction: the commit file list and the diff read as two views of the same thing competing for space in one column. No roadmap item touches the workbench layout, so a layout change now does not collide with other UI work. A survey of ten adjacent products (desktop Git clients, terminal clients and web review tools) found none that combines a collapsible commit header, a diff-dominant column and a click-to-open large view with a one-gesture return and file-to-file navigation; two terminal clients each have half of it. The combination is a genuine differentiator.

Committed approach: the commit header opens expanded, with a long message body clamped to four lines and expandable in place, and collapses on demand into a one-line summary (subject, author, short sha) that keeps the commit actions one gesture away. The commit file list becomes collapsible and takes all remaining height in the inspector, never receiving less than half of it: the header yields first. The inspector hosts no diff viewer of its own — every commit diff is read in the diff workspace <!-- amended 2026-09-07 (owner): the inspector's diff slot is dropped; see AC-06 and AC-22 -->. Any file can be opened in the **diff workspace**, a centre view state that replaces the commit list (or, in Changes, the working-changes lists and the commit composer) at full width and is closed by Esc or Close, restoring the exact previous selection, scroll and focus. «Split» stays the existing unified / side-by-side diff layout. History, and every view that shows a selected commit, gets the full treatment; Changes gets only the diff workspace gesture. The sharpest risk found in the failure-mode review is keyboard precedence: Esc and the hunk shortcuts already have several consumers and the app has no priority order between them, so layer precedence and shortcut distinctness are acceptance criteria here rather than design details. Success is measured as the share of inspector height the commit file list receives (header expanded and collapsed) and as the gesture count to read a file at full width and return.

Traceability: the shell vocabulary (rail, refs panel, centre view, inspector, workbench) follows `DESIGN.md` §«App shell» and is fixed in the project glossary; density and minimum-window figures follow `DESIGN.md` §«Density» and the app's minimum window size (960 × 640). Decision overrides from the critic pass, if any, are listed below.

## 2. Goals

- The commit file list is the dominant surface of the inspector whenever a commit is selected, and the diff itself is read at centre width in the diff workspace; the commit header shrinks to an orientation aid that yields height before the list does.
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
**So that** I read the message without scrolling and hand the whole column to the commit file list when I am reviewing the changes

### US-02: Keep the commit file list compact

**As a** developer
**I want** the commit file list to take the height the inspector column has left, with its own scroll, shrinking to the real file count and collapsible to its header
**So that** a thirty-file commit is reachable at a glance instead of through a six-row window

### US-03: Open a file in the diff workspace

**As a** developer
**I want** to open the active file's diff in the centre view by a single click, by double-click, a visible control or a shortcut, and to choose from the file list itself which of the two a single click does
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
**Then** the commit header opens expanded with the body clamped to four lines (no height is reserved when the body is shorter) plus a «show more» control, author, dates, short sha, ref badges and commit actions visible, and the commit file list keeps at least half the inspector height <!-- amended 2026-09-07 (owner): the commit inspector no longer hosts a diff viewer; the diff is read only in the workspace -->

### AC-02 (US-01) — happy path

**Given** the commit header is expanded
**When** the developer collapses it with its control or shortcut
**Then** the header becomes one summary line (subject, author, short sha), the commit file list takes at least three quarters of the inspector height, **except where the header-cap guard costs the list its ratio — a remainder under twice `--panel-head-h` with the header expanded, or under four times it collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**, and expanding it again restores the previous state; the collapsed / expanded state is remembered across app restarts, like the workbench splitters <!-- carve-out added 2026-09-09 (owner, review round 15 R15-S1-F1): AC-02 states the collapsed 75 % share with no placement scope and no exception, and unlike the expanded 50 % band the collapsed one is reachable — at the bottom placement with both panels stacked the guard binds up to a 191 px remainder. Rounds 12–14 carved AC-18, spec §6 row 3, §10 QG-1, §6 F2, the test plan, the screen manifest, the UX flows and §1 QG-1; AC-02 carries the same claim and was in none of those waves because it carries none of the phrasings any sweep enumerated. Found by the file-scoped sweep this task widened to every tracked file the branch touches -->

### AC-03 (US-01) — domain invariant

**Given** the window is at its minimum supported size and the selected commit has a long body and many changed files
**When** the inspector lays out
**Then** the commit file list never receives less than half the inspector height: the body clamp shrinks first, down to one line plus «show more», and past that the expanded header scrolls inside its cap; the file list keeps at least two visible rows with its own scroll and never goes below that floor <!-- amended 2026-09-07 (owner): the yield order is inverted — the diff slot is gone, so the header now yields to the file list rather than the list to the diff -->

### AC-04 (US-02) — happy path

**Given** a commit with thirty changed files, or a commit whose list has no row to draw — no changed files at all, or a filter that matches none of them
**When** the inspector shows it
**Then** the commit file list shows as many rows as the inspector column fits in either density (the row height follows the density token), with its own scroll and the total file count; given a commit with two changed files, the list takes exactly two rows with no reserved empty space; and given a list with no row to draw, only the list header with the count and a single «No files changed» (or the existing «no match») line show, **and the list claims no share of the inspector: it keeps its head and nothing more, exactly as a collapsed list does (AC-05)** <!-- amended 2026-09-07 (owner): the six-row cap existed to protect the diff slot and is dropped with it; amended 2026-09-08 (owner, review round 10 R10-S1-F1): the no-share rule shipped in the code and four artefacts with no criterion, and the reachable case is a filter matching nothing, because the policy is fed the displayed row count -->

### AC-05 (US-02) — happy path

**Given** the commit file list is visible
**When** the developer collapses it
**Then** only its header with the file count remains, the released height is left empty inside the inspector column, and the active file stays the one the diff workspace shows; the collapsed state is remembered across app restarts <!-- amended 2026-09-07 (owner); corrected 2026-09-08 (owner, review round 9 R9-S1-F8): the 2026-09-07 wording sent the released height to a stacked blame or file history, which AC-19 forbids — both panels hold a fixed share precisely so they cannot take a cut of what the inspector releases, so the height stays empty in every configuration -->

### AC-06 (US-03) — happy path

**Given** a file is active in the commit file list
**When** the developer clicks it with the open-on-click preference on, or — with that preference off — double-clicks it, uses its open-large control, or presses the open-large shortcut
**Then** the centre view becomes the diff workspace showing that file's diff, with a header carrying the file path, the source commit (short sha and subject), previous / next file controls and Close, and with layout, whitespace, wrap and context settings matching the diff viewer's current ones; those four settings are the diff viewer's own preferences, not a copy: changing one in the diff workspace changes it in the diff viewer and persists as today. The commit inspector hosts no diff viewer at all: its column is the commit header and the commit file list, which shows as many file rows as fit, whether the diff workspace is open or closed. Closing the diff workspace returns the centre view to its list, and the inspector column does not change shape. The working-tree side keeps its inline diff viewer, which the diff workspace hides while it is open and restores on close (AC-13). Inside the diff workspace the per-file collapse control the diff viewer offers is not shown: the workspace exists to read one file at full width, and collapsing it would leave the centre empty; every other control of the viewer comes with it unchanged <!-- amended 2026-09-07 (owner); the collapse-control clause added 2026-09-08 (owner, review round 9 R9-S1-F10): it shipped in `2049df4` with no criterion behind it -->

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
**Then** the commit header (expanded or collapsed) and the commit file list apply, and the commit file list keeps at least the share of the column it keeps with the inspector on the right, **except where the header-cap guard costs the list its ratio — a remainder under twice `--panel-head-h` with the header expanded, or under four times it collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**; collapsing the header hands the released height to the file list exactly as on the right (the 50 % and 75 % shares are measured only with the inspector on the right) <!-- amended 2026-09-07 (owner); «height» → «share of the column» 2026-09-08 (owner, review round 9 R9-S2-F6b): the bottom placement is bounded by its own 220 px minimum against a full-height right column, so no cross-placement height guarantee is possible; carve-out added 2026-09-08 (owner, review round 11 R11-S2-F4): the round-9 amendment also claimed «the policy applies the same ratios to whatever remainder it is given», and it does not — at the bottom's 220 px minimum with blame and file history stacked (a fixed 110 px) and the header collapsed the share is 0.691 comfortable / 0.727 compact against 0.750 on the right, because `Math.max(headerAllowance, panelHeadH)` lifts the cap to a full panel head. The policy is right and the criterion overreached; the band is pinned by the collapsed twin of the 220 / 110 row; carve-out corrected 2026-09-08 (owner, review round 12 R12-L-F1 / R12-S1-F1): the round-11 wording read «a hard floor binds — the header-cap guard or the list's two-row floor, i.e. a remainder under 136 px in comfortable density or 120 px in compact» and was wrong twice. The list's two-row floor causes no miss at all — of the 224 configurations that miss the floor across both densities and both collapse states, 224 are fixed by removing `Math.max(headerAllowance, panelHeadH)` and **0** by removing the two-row floor, and the bound is the closed form `panelHeadH / (1 − ratio) − 1`, which carries no term from that floor and does not move when it is set to 0, 1, 3 or 6 rows. And one 136 / 120 band waived the EXPANDED guarantee across a remainder of 68…135 px where the policy meets it — including the whole reachable bottom band (`r ≥ 110`), where at 220 / 110 expanded the share is 0.6909 against a 0.50 floor. Measured bounds, generalised 2026-09-09 (owner, review round 15 R15-S1-F1): the band is `r < 2 × panelHeadH` expanded and `r < 4 × panelHeadH` collapsed — verified at 201 474 points over the 21 reachable density × font pairs, 0 mismatches. The four figures this clause used to give (67 / 135 comfortable, 59 / 119 compact) are that closed form at the two spec fixtures only, and one of those fixtures is unreachable (R15-S1-F2). Predicate corrected 2026-09-10 (owner, review round 16 R16-S2-F1): the clause said the guard **binds**, and the band it gives is not that — it is where the guard **costs the list its ratio**, which is what this criterion promises and what the 201 474-point sweep measured (0 mismatches). The guard's own band is wider: it binds for `r < 2 × panelHeadH + 2 × fileRowH` expanded (the list's 2-row floor sets `protectedList` throughout that region, so the boundary carries a row term) and `r < 4 × panelHeadH` collapsed — also 0 mismatches over the same 201 474 points. The two disagree at **5312** of them, every one expanded, reachable in 16 of the 21 token sets: at comfortable / 13 px the guard binds across `r = 110…127.75` while the share is met at 0.6909 against a 0.50 floor, which is why `inspector-layout.spec.ts`'s 220 / 110 expanded row correctly asserts a 34 px cap there. Round 12 separated these two predicates once (R12-S1-F1) and the round-15 wording re-fused them; **the collapsed halves coincide, the expanded halves do not** -->

### AC-19 (US-07) — cross-context

**Given** blame or file history is open under the commit file list
**When** the developer collapses the commit header
**Then** blame and file history keep their current share and the released height goes to the commit file list; the three-quarters target is measured only without stacked panels <!-- amended 2026-09-07 (owner) -->

### AC-20 (US-07) — happy path

**Given** compact density or the light theme is active
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
<!-- added 2026-09-07 (owner): reverses the 2026-09-02 «gesture only» resolution in §8 -->

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Commit file list **protected share** of inspector height · header expanded (default), no stacked panels, inspector right | ≥ 50 % at every window size from 960 × 640 upward | the height the commit header may not cross, `(inspector height − headerMaxH) / inspector height`, measured at 960 × 640 and 1280 × 800 in the three shipped densities. **Does not apply when the list has no row to draw** (no changed files, or a filter matching none): the list keeps only its head by design and the share is not measured (AC-04, AC-05) | <!-- amended 2026-09-07 (owner); measurement restated 2026-09-08 (owner, review round 9 R9-S2-F6a); carve-out added 2026-09-08 (owner, review round 10 R10-S1-F1) -->
| Commit file list **protected share** of inspector height · header collapsed, no stacked panels, inspector right | ≥ 75 % | same, including the empty-list carve-out | <!-- amended 2026-09-07 (owner); measurement restated 2026-09-08 (owner); carve-out added 2026-09-08 (owner, review round 10 R10-S1-F1) -->
| Commit file list protected share · inspector at the bottom, or blame / file history stacked | ≥ the share it has with the inspector on the right in the same window size and density | same measurement, applied to the remainder left after the stacked panels' fixed shares, **except where the header-cap guard costs the list its ratio — a remainder under twice `--panel-head-h` with the header expanded, or under four times it collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**. The empty-list carve-out of rows 1–2 applies here too | <!-- re-pointed 2026-09-08 (owner, review round 9 R9-S1-F7 / R9-S2-F6c): the row measured the inspector's diff viewer, which the 2026-09-07 reversal removed, against a 1.0.5 baseline that amended AC-18 replaced; carve-out added 2026-09-08 (owner, review round 11 R11-S2-F4): measured 0.691 comfortable / 0.727 compact against 0.750 on the right at the bottom's 220 px minimum with both panels stacked and the header collapsed; carve-out corrected 2026-09-08 (owner, review round 12 R12-L-F1 / R12-S1-F1): the round-11 wording named the list's two-row floor as a second cause, and it causes none of the 224 misses (all 224 are fixed by removing `Math.max(headerAllowance, panelHeadH)`, 0 by removing the two-row floor); it also waived the expanded guarantee over a remainder of 68…135 px where the policy meets it. Now byte-identical to AC-18's sentence. Band restated 2026-09-09 (owner, review round 15 R15-S1-F1): the two fixed pixel pairs were derived from the spec fixtures, so the exception was narrower than the guard over 12 of the 21 reachable density × font pairs; it is now the guard’s own closed form, exact at 201 474 measured points -->
| Open the diff workspace from a diff already shown in the viewer | first paint ≤ 150 ms; the diff is not loaded a second time | performance-panel timing on a 2 000-line diff |
| Close the diff workspace | previous centre view back in ≤ 100 ms with the identical scroll offset and selection | pure-TypeScript unit test on the restore logic, plus manual check |
| Keyboard reachability | 100 % of diff workspace actions (open, close, previous / next file, hunk navigation) have a shortcut listed in the shortcuts help; focus returns to the originating row on close | keyboard-only accessibility pass |
| Esc layer precedence | 0 cases where Esc closes a layer that is not the topmost | keyboard matrix over the six layers of AC-10: dialog · command palette · text field with content · diff line selection · stacked blame / file history · diff workspace |
| Layout regressions in existing modes | 0 | release checklist: both themes × the three densities × both placements |
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

- **Commit file list protected share of inspector height** (History, commit selected, inspector right, no stacked panels) — baseline: 40 % fixed (today's two-to-three split leaves the list the smaller half); target at release: ≥ 50 % with the header expanded at 960 × 640, ≥ 75 % with the header collapsed. Measured as the §6 rows measure it — the share the header may not cross, not the drawn height of a list that stops at its file count (AC-04), and not measured at all when the list has no row to draw. <!-- re-pointed 2026-09-08 (owner, review round 9 R9-S1-F7): the KPI still measured the inspector's diff viewer after §6 and §5 had moved to the file list; the History inspector has no diff viewer to measure. Amended 2026-09-08 (owner, review round 10 R10-S2-F4): the «≥ 60 % for a subject-only commit with two or fewer files» clause was dropped — under this measurement the protected share is max(panelHeadH + 2·fileRowH, 0.5·remainder) / remainder, i.e. exactly 0.50 for every remainder ≥ 188 px, independent of file count and body length. It made sense against the pre-reversal diff-viewer share; a protected share is a flat floor -->
- **Gestures to read a file at full centre width and return** — baseline: not possible; target at release: one gesture to open and one to return, from both History and Changes.
<!-- dropped 2026-09-08 (owner, review round 11 R11-S1-F4): the bullet «Inspector height consumed by the commit header plus the commit file list … baseline about 275 px (fixed two-fifths); target ≤ 220 px expanded, ≤ 70 px collapsed» measured the pre-reversal proportion and is unreachable under both available readings. Allocated: the History diff slot is `h-0` and the commit inspector block is the column's only growing child, so the two blocks consume the whole column. Drawn: 34 + 34 + 30 = 98 px collapsed with the one row a one-file commit draws, against a 70 px target (the token arithmetic is at screens.md's «Heights (comfortable)» note, which flagged the reading as undecided on 2026-09-03). The first KPI bullet already measures what §6 and AC-03 define — the protected share — so nothing is lost -->
- **Layout regressions in existing modes** reported during the first release cycle — baseline: 0; target: 0.

## 8. Open questions

- [x] After nine review rounds of the same defect — a precise figure that is false — does the branch keep correcting instances, or change what artefacts are allowed to say? — owner: Jhoan Moreno · **Resolved 2026-09-10 (review round 17, decision D3): no live artefact may write a figure derived from `computeMetrics` or the layout policy.** Closed forms in `panelHeadH` / `fileRowH` only, plus one reference table generated from the shipped modules as the single home of concrete figures. Rounds 16 and 17 found the false figure inside the two instruments built to prevent it (R17-F1, R17-F8), which is why the answer is a constraint on the artefacts rather than another checker. Written into the test plan's conventions block; enforced by T70.
- [x] How is a sweep's scope defined, given that round 16 declared «every tracked file the branch touches» and still missed an Accepted ADR? — owner: Jhoan Moreno · **Resolved 2026-09-10 (review round 17, decision D4): the branch, not a list.** Every tracked file the branch touches is in scope by default — ADRs and task records included; exclusions are named with their reason where the sweep is reported; and a sweep that declares a narrower scope than it executed fails mechanically (T70). The failure R17-F4 exposed was not the scope rule but the gap between the declared and the executed scope.
- [x] Should a sticky «always open diffs in the diff workspace» preference exist (the single-file mode some web review tools offer) besides the per-file gesture? — owner: Jhoan Moreno · Resolved 2026-09-02 (ux-flows): no, gesture only — **reopened and reversed 2026-09-07 (owner): yes**. The preference exists (AC-22) and the inspector loses its diff viewer entirely, so a single click can no longer «show the diff in the inspector»: with the preference off it only makes the row active. `ux-flows.md` §Platform decisions carries the same reversal.
- [x] Where do blame and file history open when launched from inside the diff workspace: stacked in the inspector as today, or replacing the diff workspace content? — owner: Jhoan Moreno · **Resolved 2026-09-02 (ux-flows): stacked in the inspector, the diff workspace stays open** (see `ux-flows.md` flow US-03).
- [ ] Should a `figure:` marker be bound to the figure in the prose beside it, so that a wrong figure written into a row whose marker is correct fails? — owner: Jhoan Moreno · due: before the next review round, as its own spec. **Deferred 2026-09-10 (review round 17, decision D1).** The gate compares a marker's `expect=` against the recomputed value and never reads the sentence next to it, so an instance reconstructed in the prose with the marker left untouched exits 0 — T70 re-measured all four the reviewer named (R15-S1-F2's unreachable compact pair, R15-S1-F1's retired share, R16-S1-F3's sweep counts, and a marked row's own cap figure contradicting its marker) and every one passed. Binding the two is a prose parser — where a figure ends, which of a line's figures a marker owns, how a closed form is told from a literal — and does not belong inside a review wave (R17-F5). Until it exists the mitigation is D3: a figure that is never written in prose cannot be unbound, and the gate reports, per line, how many figures its heuristic can see beyond the markers beside them. **The mitigation is now in force, and this is what makes the deferral safe (2026-09-10, T73, review round 18 R18-F2): when this was written the mitigation did not exist — 36 derived figures were still in live prose, so the deferral rested on a construction nobody had performed.** T73 migrated them: the eight artefacts this decision names now carry the closed form or a pointer at the generated table, and the gate's own coverage line reports **1** heuristic-visible figure left in live prose, which is `DESIGN.md`'s `fontSize: 0.875rem` type-scale token — a false positive, not a derived figure. What remains in prose is inputs (window sizes, the bottom minimum, font sizes) and dated historical quotations, each named with its reason in T73's Outcome per decision D4. So a wrong figure can no longer be written into a row whose marker is right, for the plain reason that the row states no figure.
- [ ] Does WebKitGTK omit a scroll container's bottom padding from `scrollHeight`, so the header measurement in `commit-inspector.ts` understates the fixed part by one `--panel-pad` and the header cap lands low on the Linux build only? — owner: Jhoan Moreno · due: ship (manual check of the expanded header with 30 refs at 960 × 640 on Linux; if confirmed, measure an inner content wrapper instead of the scroll container). Raised by [review 2026-09-04 round 3](./_review/review-2026-09-04-round3.md), R15 (PLAUSIBLE).
