---
status: draft
feature_size: "M"
updated_at: "2026-09-02"
---

# UX flows — inspector-diff-workspace

> User flows for every UI-touching §4 user story, produced by `ux-flows` (after `clarify`, before
> `design`) and read by `design` (evidence for the target-surface + UI-architecture decisions),
> `sequences` (UI-driven flows align on SCR ids), `screens` (details every inventory row) and
> `plan-tests` (the e2e-through-UI paths). **Always markdown + mermaid `flowchart`**, whatever the
> design tool — this artifact is flow-altitude, not visual design.

> **Glossary:** [feature CONTEXT](./CONTEXT.md) · [project CONTEXT](../../../CONTEXT.md)
> **Derived from:** [spec.md](./spec.md) §4 user stories + §5 acceptance criteria; owner decisions of 2026-09-02 recorded below.

## Platform decisions

- **Posture:** desktop-first — `docs/design-system.md` does not exist, so the posture is deduced from `DESIGN.md` §Layout («desktop productivity app»), the Tauri desktop binary and the minimum window of 960 × 640, and confirmed by the owner on 2026-09-02. Pointer + keyboard only: double-click, shortcuts and Esc are first-class gestures; no touch or narrow-window variants.
- **Navigation shape:** the diff workspace is a *state of the centre view*, not a route, window, tab or overlay (spec §3, feature CONTEXT «Out of scope»). It replaces the centre content in place and Close / Esc restores exactly what it replaced.
- **Modality:** no new dialog. The only dialog these flows visit is Reset's existing confirmation (AC-21). The two notices (AC-13, AC-16) are non-blocking and never take focus.
- **Esc is layered:** one fixed precedence — dialog, then command palette, then text field with content, then diff line selection, then stacked blame / file history, then diff workspace (AC-10). Flow US-04 draws it; the mechanism that enforces the order is a `design` decision, not made here.
- **Where the inspector flows apply:** US-01, US-02, US-07 and US-08 are drawn on the History view (SCR-01) and apply verbatim to every view that shows a selected commit (Reflog); a diff workspace opened from such a view returns to that view's list.
- **Open questions resolved for this stage (spec §8, both due before `ux-flows`):** (1) no sticky «always open diffs in the diff workspace» preference — the gesture per file is the only way in, a single click keeps showing the diff in the inspector; (2) blame and file history launched from inside the diff workspace open stacked in the inspector as today and the diff workspace stays open.
- **Design inputs flagged, not decided:** (a) an owner for keyboard-layer precedence; (b) a snapshot of selection + scroll + focus taken when the diff workspace opens, so Close can restore it (AC-08, NFR ≤ 100 ms); (c) one shared settings source for the diff viewer and the diff workspace (AC-06).
- **Backend-only user stories:** none — all eight §4 stories touch the UI, so all eight have a flow.

## Screen inventory

| ID | Screen | Purpose | Entry | Exit |
|---|---|---|---|---|
| SCR-01 | History view | Commit list in the centre; inspector with the commit header (expanded / collapsed), the compact commit file list, the diff viewer and any stacked blame / file history | Rail «History», app launch, Close / Esc from SCR-02, any selection change while SCR-02 is open | SCR-02 (open gesture on a file), SCR-05, SCR-06, other rail views |
| SCR-02 | Diff workspace · commit | One file of the selected commit at full centre width; header with file path, source commit (short sha + subject), previous / next file, Close; the inspector keeps header + file list and hides its diff viewer | Double-click, open-large control or shortcut on the active file in SCR-01 | SCR-01 (Close, Esc, or any change of the selected commit / rail view / repository tab) |
| SCR-03 | Changes view | Staged and unstaged lists with the commit composer in the centre; inspector diff viewer | Rail «Changes», Close / Esc from SCR-04, a side left with no changes | SCR-04 (open gesture on a staged or unstaged file), other rail views |
| SCR-04 | Diff workspace · working tree | One staged or unstaged file at full centre width with hunk / line stage and unstage controls; header with file path, side, previous / next file (same side only), Close | Double-click, open-large control or shortcut on the active file in SCR-03 | SCR-03 (Close, Esc, side emptied by own or external action, any selection change) |
| SCR-05 | Shortcuts help | The existing shortcuts list, now carrying the diff workspace set (open, close, previous / next file) next to the hunk set | Shortcuts-help shortcut or menu from any view | Back to the view it was opened from |
| SCR-06 | Reset confirmation | The existing confirmation before Reset, unchanged | Reset from the expanded or the collapsed commit header | Back to SCR-01 (confirm runs the reset, cancel does nothing) |

## Flows

### Flow: US-01 — Read the commit message without scrolling, collapse it when reviewing

```mermaid
flowchart TD
    A["SCR-01 History view: developer selects a commit"] --> B{"Body longer than four lines?"}
    B -->|"yes"| C["SCR-01 header expanded: body clamped to 4 lines + show more, author, dates, short sha, ref badges, actions"]
    B -->|"no"| D["SCR-01 header expanded: full body, no reserved height"]
    C -->|"show more"| E["SCR-01 header expanded: body unclamped in place"]
    C -->|"collapse control or shortcut"| F["SCR-01 header collapsed: one line with subject, author, short sha"]
    D -->|"collapse control or shortcut"| F
    E -->|"collapse control or shortcut"| F
    F -->|"expand control or shortcut"| G["SCR-01 header expanded: previous state restored"]
    C -->|"window at minimum size, long body, many files"| H{"Diff viewer below half the inspector?"}
    H -->|"yes"| I["SCR-01: commit file list shrinks first, down to 2 rows with its own scroll"]
    I --> J{"Still below half?"}
    J -->|"yes"| K["SCR-01: body clamp shrinks, down to 1 line + show more"]
    J -->|"no"| L["SCR-01: layout settled, diff viewer keeps at least half"]
    K --> L
    H -->|"no"| L
    F -->|"app restart"| M["SCR-01: header paints directly in the remembered collapsed state"]
    G -->|"app restart"| N["SCR-01: header paints directly in the remembered expanded state"]
```

The developer selects a commit in the History view. If the message body is longer than four lines the header opens expanded with the body clamped to four lines plus a «show more» control; a shorter body shows in full without reserving height. Either way author, dates, short sha, ref badges and the six actions are visible and the diff viewer keeps at least half the inspector. «Show more» unclamps the body in place. The collapse control or its shortcut turns the header into one summary line (subject, author, short sha) and the diff viewer takes at least three quarters; the expand control restores the previous state. When the window is at its minimum size with a long body and many files, the commit file list shrinks first (down to two rows with its own scroll), then the body clamp shrinks (down to one line plus «show more»), and the diff viewer never goes below half. The collapsed or expanded state is remembered and, on restart, the header paints directly in that state with no layout shift.

### Flow: US-02 — Keep the commit file list compact

```mermaid
flowchart TD
    A["SCR-01 History view: commit selected"] --> B{"Changed files?"}
    B -->|"0"| C["SCR-01 file list: header with count 0 + one No files changed line"]
    B -->|"1 to 6"| D["SCR-01 file list: exactly N rows, no reserved empty space"]
    B -->|"more than 6"| E["SCR-01 file list: 6 rows, own scroll, total count in the header"]
    D -->|"collapse"| F["SCR-01 file list collapsed: header with count only, height goes to the diff viewer, active file unchanged"]
    E -->|"collapse"| F
    F -->|"expand"| G["SCR-01 file list expanded again with the same active file"]
    F -->|"app restart"| H["SCR-01 file list paints directly collapsed"]
    E -->|"inspector squeezed (see US-01)"| I["SCR-01 file list: down to 2 rows with scroll, never fewer"]
```

When a commit is selected, the commit file list sizes itself to the real file count: zero files show only the list header with count 0 and a single «No files changed» line; one to six files take exactly that many rows with no empty space; more than six files show six rows (the row height follows the density token) with the list's own scroll and the total count in the header. Collapsing the list leaves only its header with the count, hands the released height to the diff viewer and keeps the active file in the diff viewer; expanding brings the rows back with the same active file. The collapsed state is remembered across restarts and paints directly. When the inspector is squeezed (the US-01 minimum-size branch) the list shrinks down to two rows with scroll and never fewer.

### Flow: US-03 — Open a file in the diff workspace

```mermaid
flowchart TD
    A["SCR-01 History view: a file is active in the commit file list"] -->|"double-click, open-large control or shortcut"| B{"Diff shown as text?"}
    B -->|"yes"| C["SCR-02 diff workspace: file diff at full width, header with path, short sha + subject, previous / next, Close"]
    B -->|"no (binary without preview)"| D["SCR-02 diff workspace: the diff viewer's plain explanation for that case"]
    C -.->|"meanwhile"| E["SCR-01 inspector: diff viewer hidden, header + file list take its height, list shows as many rows as fit"]
    C -->|"change layout, whitespace, wrap or context"| F["SCR-02: setting applied, it is the diff viewer's own preference and persists as today"]
    C -->|"open blame or file history"| G["SCR-02 stays open, the panel stacks in the inspector"]
    C -->|"refresh empties the commit's file list, the commit stays selected"| H["SCR-02: diff cleared, plain explanation instead of an empty centre, previous / next disabled"]
    H -->|"Close"| I["SCR-01 with whatever selection still exists"]
    D -->|"Close"| I
    C -->|"rail view, repository tab, refs panel click, commit search, palette command or a refresh that removes the shown commit changes the selection"| J["Diff workspace closes, the view shows its normal centre with the new selection"]
    J -->|"return to the original view"| K["SCR-01 commit list, not the diff workspace"]
    C -->|"Close or Esc"| L["Flow US-04"]
```

With a file active in the commit file list, a double-click, the open-large control or the open-large shortcut turns the centre view into the diff workspace showing that file's diff at full width. Its header carries the file path, the source commit (short sha and subject), previous / next file controls and Close, and its layout, whitespace, wrap and context settings are the diff viewer's own preferences (changing one here changes the diff viewer and persists). Meanwhile the inspector hides its diff viewer and the commit header plus the file list take that height. If the file cannot be shown as text (a binary without preview) the workspace shows the diff viewer's plain explanation instead of an empty centre. Blame or file history launched from here stack in the inspector while the workspace stays. If a refresh leaves the commit selected but empties its file list, the diff is cleared so the same plain explanation replaces it with previous / next disabled, and Close returns to the History view with whatever selection still exists. Any change of selection (rail view, repository tab, refs panel click, commit search, palette command, or a refresh that removes the shown commit) closes the workspace, the view shows its normal centre with the new selection, and coming back to the original view shows its commit list. Close or Esc is the US-04 flow.

### Flow: US-04 — Return from the diff workspace

```mermaid
flowchart TD
    A["SCR-02 diff workspace open, from SCR-01"] -->|"Esc"| B{"Topmost open layer?"}
    B -->|"dialog"| C["Dialog closes, SCR-02 stays"]
    B -->|"command palette"| D["Palette closes, SCR-02 stays"]
    B -->|"text field with content (commit filter included)"| E["Field content clears, SCR-02 stays"]
    B -->|"diff line selection"| F["Selection clears, SCR-02 stays"]
    B -->|"stacked blame or file history"| G["Stacked panel closes, SCR-02 stays"]
    B -->|"none"| H["Diff workspace closes"]
    A -->|"Close control"| H
    H --> I["SCR-01 History view: same selected commit, same scroll offset"]
    I --> J{"Did previous / next change the active file?"}
    J -->|"no"| K["Focus on the originating element: the file row, or the commit row when opened by shortcut from the centre"]
    J -->|"yes"| L["Focus on the now-active file row"]
    A -->|"open another file from the file list or previous / next"| M["SCR-02: the new file replaces the current one, still one workspace"]
    M --> A
```

With the diff workspace open, Esc first asks which layer is topmost: an open dialog closes, else the command palette closes, else a text field with content (the commit filter included) clears, else a diff line selection clears, else a stacked blame or file-history panel closes, and each of those leaves the workspace open. Only when none of the five is open does Esc close the workspace; the Close control closes it directly. Closing brings the History view back with the same selected commit and the same scroll offset. Keyboard focus returns to the element that had it when the workspace opened (the file row in the commit file list, or the commit row when opened by shortcut from the centre), unless previous / next changed the active file, in which case focus lands on the now-active file row. Opening another file while the workspace is open, from the file list or with previous / next, replaces the content: there is never more than one workspace.

### Flow: US-05 — Step through files inside the diff workspace

```mermaid
flowchart TD
    A["SCR-02 diff workspace: file k of n"] -->|"next file (control or shortcut)"| B{"On the last file?"}
    B -->|"no"| C["SCR-02: file k+1 in the file list's current order (tree or flat, folders skipped), header updated, row marked active"]
    B -->|"yes"| D["Next control disabled, nothing happens"]
    A -->|"previous file (control or shortcut)"| E{"On the first file?"}
    E -->|"no"| F["SCR-02: file k-1, header updated, row marked active"]
    E -->|"yes"| G["Previous control disabled, nothing happens"]
    A -->|"hunk shortcuts"| H["SCR-02: moves between hunks exactly as in the diff viewer"]
    A -->|"shortcuts help"| I["SCR-05 shortcuts help: hunk set and file-navigation set listed as distinct shortcuts"]
    I -->|"close"| A
```

Inside the diff workspace on file k of n, «next file» (control or shortcut) shows file k+1 in the order the commit file list currently displays (tree or flat, folders skipped), updates the workspace header and marks that row active in the list; on the last file the next control is disabled and nothing happens. «Previous file» mirrors it, disabled on the first file. The existing hunk shortcuts keep moving between hunks exactly as in the diff viewer; file navigation uses distinct shortcuts, and opening the shortcuts help lists both sets side by side before returning to the workspace.

### Flow: US-06 — Review working-tree changes in the diff workspace

```mermaid
flowchart TD
    A["SCR-03 Changes view: an unstaged (or staged) file is active"] -->|"double-click, open-large control or shortcut"| B["SCR-04 diff workspace: lists + composer hidden, diff with hunk / line stage and unstage controls, header with path, side, previous / next, Close"]
    B -->|"stage or unstage a hunk or line"| C{"Shown side still has changes in this file?"}
    C -->|"yes"| D["SCR-04: diff refreshes, counts updated for the return"]
    C -->|"no"| E{"Other files left on that side?"}
    E -->|"yes"| F["SCR-04: advances to the next file on the same side"]
    E -->|"no"| G["SCR-03 Changes view + brief notice: no changes left on that side"]
    B -->|"previous / next"| H["SCR-04: walks only the side the file was opened from, never crossing"]
    B -->|"commit or commit-draft shortcut"| I["Nothing committed: composer shortcuts inactive while SCR-04 is open"]
    B -->|"watcher: file changed on disk or staged from outside"| J{"Side still has changes in this file?"}
    J -->|"yes"| K["SCR-04 refreshes to the new content"]
    J -->|"no"| L["SCR-03 Changes view + plain notice saying why"]
    B -->|"Close or Esc"| M["SCR-03 Changes view: same selection and scroll, staged / unstaged counts reflect the staging done"]
    N["SCR-02 diff workspace, source is a commit"] -->|"stage control or staging shortcut"| O["No staging control offered, staging shortcuts inactive wherever focus is"]
```

In the Changes view, opening the active staged or unstaged file with the same gesture hides the staged and unstaged lists and the commit composer and shows the diff at full width with hunk and line stage / unstage controls; the header names the path and the side. Staging or unstaging there refreshes the diff and the counts the developer will see on return; when the action leaves the shown side with no changes in that file, the workspace advances to the next file on the same side, or closes with a brief notice when none remains. Previous / next walk only the side the file was opened from and never cross to the other side. The commit and commit-draft shortcuts do nothing while the workspace is open. When the watcher reports the file changed on disk or was staged from outside, the workspace refreshes; if that leaves the side with no changes, it closes and the Changes view returns with a plain notice saying why. Close or Esc returns to the Changes view with the same selection and scroll and with the counts reflecting the staging done. In the commit-sourced workspace (SCR-02) no staging control is offered and the staging shortcuts stay inactive wherever focus is.

### Flow: US-07 — Keep existing layout modes

```mermaid
flowchart TD
    A["SCR-01 History view: commit selected"] --> B{"Layout mode?"}
    B -->|"inspector at the bottom"| C["SCR-01: header (expanded or collapsed) + compact file list apply, diff viewer keeps at least today's height"]
    C -->|"collapse header or file list"| D["Released height goes to the diff viewer, exactly as on the right"]
    B -->|"blame or file history stacked"| E["SCR-01: stacked panels under the diff viewer"]
    E -->|"collapse header"| F["Stacked panels keep their share, released height goes to the diff viewer"]
    B -->|"compact density or light theme"| G["SCR-01: summary line, rows and controls follow the density tokens, every text meets the app contrast rule"]
    B -->|"inspector right, comfortable, dark"| H["Flows US-01 and US-02 as drawn"]
```

The redesigned inspector behaves the same in every existing layout mode. With the inspector at the bottom, the commit header (expanded or collapsed) and the compact file list apply and the diff viewer keeps at least the height it has today; collapsing the header or the list hands the released height to the diff viewer exactly as on the right. With blame or file history stacked under the diff viewer, collapsing the header leaves the stacked panels their share and gives the released height to the diff viewer. In compact density or the light theme, the summary line, rows and controls follow the density tokens and every text meets the app's contrast rule. The default placement (right, comfortable, dark) is the US-01 and US-02 flows as drawn.

### Flow: US-08 — Reach commit actions from the collapsed header

```mermaid
flowchart TD
    A["SCR-01 header collapsed: summary line"] --> B{"All six actions fit the available width?"}
    B -->|"yes"| C["Branch, Tag, Cherry-pick, Revert, Reset, More inline as icons with tooltips"]
    B -->|"no"| D["Actions that do not fit move into More, the rest stay inline"]
    C -->|"click Reset"| E["SCR-06 Reset confirmation"]
    D -->|"More, then Reset"| E
    E -->|"confirm"| F["Reset runs, SCR-01 refreshes"]
    E -->|"cancel"| A
    C -->|"click any other action"| G["Action runs exactly as from the expanded header"]
    D -->|"More, then any other action"| G
```

With the header collapsed, the summary line carries the same six actions as the expanded header (Branch, Tag, Cherry-pick, Revert, Reset, More) inline as icons with tooltips, one click each. When they do not all fit the available width, the ones that do not fit move into More and the rest stay inline. Reset keeps its confirmation: clicking it (inline or from More) opens the Reset confirmation, confirm runs the reset and refreshes the History view, cancel returns to the collapsed header. Every other action runs exactly as it does from the expanded header.

## AC coverage

| AC | Shown by | Notes |
|---|---|---|
| AC-01 | Flow US-01 → B → C / D | Clamp to 4 lines + show more, or full short body with no reserved height; diff ≥ half |
| AC-02 | Flow US-01 → F, F → G, F → M, G → N | Collapse to the summary line, expand restores, state remembered across restart |
| AC-03 | Flow US-01 → H → I → J → K → L | File list shrinks first (floor 2 rows), then the clamp (floor 1 line); diff never below half |
| AC-04 | Flow US-02 → B → C / D / E | 0 files, 1–6 exact rows, > 6 → six rows + scroll + count |
| AC-05 | Flow US-02 → F, H | Collapsed list keeps count, height to the diff, active file unchanged, remembered |
| AC-06 | Flow US-03 → A → C, E, F | Three open gestures, workspace header contents, shared settings, inspector diff viewer hidden meanwhile |
| AC-07 | Flow US-03 → D, H → I | Binary without preview; the commit stays selected with an emptied file list; Close still returns (a removed commit moves the selection and follows AC-17 → J) |
| AC-08 | Flow US-04 → H → I → J → K / L | Same commit + scroll, focus to the originating row or the now-active file row |
| AC-09 | Flow US-04 → M | Another file replaces the current one, one workspace at most |
| AC-10 | Flow US-04 → B branches C–H | Fixed Esc precedence over the six layers |
| AC-11 | Flow US-05 → B → C / D, E → F / G | Order of the file list, folders skipped, disabled at the ends |
| AC-12 | Flow US-05 → H, I | Hunk shortcuts unchanged, distinct file shortcuts, both in SCR-05 |
| AC-13 | Flow US-06 → B, C → D / E → F / G, H | Lists + composer hidden, staging controls, advance on empty side, same-side navigation |
| AC-14 | Flow US-06 → N → O | Commit-sourced workspace offers no staging and its shortcuts are inactive |
| AC-15 | Flow US-06 → I | Commit / commit-draft shortcuts inert while SCR-04 is open |
| AC-16 | Flow US-06 → J → K / L | Watcher refresh; external emptying closes with a notice |
| AC-17 | Flow US-03 → J → K | Any selection change closes the workspace; the original view returns to its list |
| AC-18 | Flow US-07 → C → D | Inspector at the bottom |
| AC-19 | Flow US-07 → E → F | Stacked blame / file history keep their share |
| AC-20 | Flow US-07 → G | Compact density and light theme |
| AC-21 | Flow US-08 → B → C / D, E → F / A, G | Six inline actions, overflow into More, Reset confirmation kept |
