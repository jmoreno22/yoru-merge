---
status: draft
feature_size: "M"
tool: "code"
updated_at: "2026-09-08"
---

# Screens — inspector-diff-workspace

> The canonical **screen manifest** — every screen in every state — produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest** — never the raw Figma / `.pen` file.

> **Glossary:** [feature CONTEXT](./CONTEXT.md) · [project CONTEXT](../../../CONTEXT.md)
> **Derived from:** [ux-flows.md](./ux-flows.md) §Screen inventory (SCR-01…06) · [spec.md](./spec.md) §5 AC-01…22 · [sad.md](./sad.md) §6 flows (critical flows 1–2, F1–F9, Cross-cutting Esc) + §8 crosscutting concepts · ADR-0001…0004. No `contracts/` exist (`api` was N/A: no schema or contract change), so no contract error responses feed the error states — every error state below traces to an AC or a §6 branch. Owner confirmations of 2026-09-03 are recorded per screen.

## Source

- **Tool:** code — **degradation, named:** `docs/design-system.md` does not exist, so there is no canon `tool` to copy. The component inventory used below is the UI kit table of `DESIGN.md` §Components (`yoru-*` primitives + `yoruTooltip`, `ContextMenuService`, `ToastService`, `KeyboardShortcutsService`) as documented in `src/app/shared/ui/README.md`. Recommend `/sdd:design-system` after this feature so the next UI feature has a canon.
- **File:** inline wireframes below (one `W-NN` block per state that needs a distinct layout; states that reuse a block say so in their Source-ref cell).
- **Component vocabulary in the tables.** Names without prefix are inventory primitives. `existing: <name>` marks feature-level markup already built in the repo and reused verbatim (for example `existing: sha-chip`, `existing: file-row`, `existing: diff-source-chip`); it is neither inventory nor NEW — reusing it is the surgical path. `NEW:` never appears: every screen composes the inventory plus existing markup (see §New components).
- **Density.** Every fixed height is a token: summary line and list header = `--panel-head-h`, file rows = `--file-row-h`, panel padding = `--panel-pad` — all three computed per density and `uiFontSize` by `computeMetrics` (`appearance-metrics.ts`), which is also the source of the CDK `itemSize`, so none is ever overridden in CSS. The value each takes at every density is in [`reference-figures.md`](./reference-figures.md) §Density tokens. <!-- corrected 2026-09-09 (T59, review round 15 R15-S1-F2): the figures were the two spec fixtures, one of which (`{30, 30}` compact) no density produces, and `FILE_ROW_HEIGHT` does not exist in the repo; figures replaced by a pointer 2026-09-10 (T73, review round 18 R18-F2, per owner decision D2): this line read «At the default 13 px: 34 / 30 comfortable, 26 / 24 compact, 43 / 37 relaxed» with two `figure:` markers beside it. The markers were correct and checked, but D3 forbids a live artefact from writing a figure derived from `computeMetrics` at all — a marker verifies the marker, never the sentence (R17-F5, deferred), so the only construction that cannot go stale is not writing the number --> Wireframes are drawn at comfortable density, inspector on the right, dark theme; §Rendering variants says what changes elsewhere.

## Screens

### SCR-01 — History view (inspector column)

The centre column (commit search, branch graph, commit list) is unchanged by this feature; SCR-01 details the **inspector column**: commit header, commit file list, optional stacked blame / file history — plus the diff viewer's parking slot, which stays at zero height here because the History inspector shows no diff (AC-06). <!-- amended 2026-09-08 (owner, review round 9 R9-S1-F5): the manifest still described the pre-reversal column --> Applies verbatim to every view that shows a selected commit (Reflog).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Commit selected; body longer than four lines is clamped to 4 + «show more», a shorter body shows in full with no reserved height; fewer changed files than the column fits take exactly that many rows; the commit file list keeps ≥ 50 % of the inspector (AC-01, AC-04; F1 «the height fits» branch) | `existing: inspector-header` markup, yoru-avatar (28), yoru-badge (refs), yoru-button sm × 6 (Branch, Tag, Cherry-pick, Revert, Reset, More), yoru-button ghost sm icon-only + yoruTooltip (collapse header `lucideChevronUp`, collapse list `lucideChevronUp`, «show more» as ghost sm text button), `existing: files-header` (count, filter, tree / list, **open-behaviour toggle**: `.mode-button` with `aria-pressed` naming the live mode, `data-testid="inspector-click-opens"`, AC-22), `existing: file-row` + yoru-button ghost sm icon-only `lucideMaximize2` (open-large, visible on hover, focus and on the active row) | W-01a | <!-- amended 2026-09-08 (owner, review round 9 R9-S1-F5) -->
| click-opens-off | The open-behaviour toggle is switched off (AC-22; F9) | Same components as `default`; the toggle reports the **off** mode and a single click on a row only makes it active — double-click, the open-large control and the shortcut still open SCR-02. The default (`on`) state is the `default` row above | W-01a, toggle in its off state | <!-- added 2026-09-08 (owner, review round 9 R9-S1-F5): AC-22 had no screen state -->
| loading | Commit details in flight (F1 steps 2–5) | yoru-skeleton — the existing `inspector-loading` / `inspector-skeleton` blocks, unchanged | existing, no new wireframe |
| empty · no commit | No commit selected (F1 precondition; also where a commit removed by a refresh lands, F7) | yoru-empty-state «No commit selected» — existing, unchanged | existing, no new wireframe |
| empty · no files | Commit with 0 changed files (AC-04) | `existing: files-header` with count `0` + one line **«No files changed»** (replaces today's «This commit does not change any file.» — copy change mandated by AC-04, not an adjacent edit) | W-01e |
| body-expanded | «show more» pressed (AC-01; US-01 node E) | Same as default with the clamp removed in place; the control disappears | W-01a, body unclamped |
| header-collapsed | Collapse control or `mod+shift+h` (AC-02, AC-21; F2 «header collapsed», F3) | Summary line at `--panel-head-h`: yoru-avatar (16), subject (truncate), author (muted), `existing: sha-chip`; the six actions as yoru-button ghost sm icon-only + yoruTooltip + `aria-label` (Branch `lucideGitBranchPlus`, Tag `lucideTag`, Cherry-pick `lucideCherry`, Revert `lucideUndo2`, Reset `lucideRotateCcw`, More `lucideEllipsisVertical`); actions that do not fit the measured width move into More (ContextMenuService, one submenu level); expand control `lucideChevronDown` | W-01b |
| file-list-overflow | More changed files than the column fits (AC-04; F1 «more rows than the column fits» branch) | `existing: file-row` inside the existing `cdk-virtual-scroll-viewport` sized at `listRows × --file-row-h` with no upper bound, `.neon-scroll`, total count in `existing: files-header` | W-01a with the column full + scrollbar | <!-- amended 2026-09-08 (owner, R9-S1-F5): the 6-row cap went with the diff slot -->
| file-list-collapsed | Collapse control or `mod+shift+l` (AC-05; F2 «file list collapsed») | `existing: files-header` with the count and the expand control only; the released height is left empty; active file unchanged | W-01b (bottom strip) | <!-- amended 2026-09-08 (owner, R9-S1-F5 / R9-S1-F8) -->
| squeezed | Window at 960 × 640, long body, many files; the layout policy yields the body clamp first (floor 1 line + «show more»), then caps the expanded header so it scrolls inside the cap; the list never drops below 2 rows with scroll (AC-03; F1 «would fall below its share» branch; ADR-0004) | Same components as default; only `clampLines`, `headerMaxH` and `listRows` change | W-01c | <!-- amended 2026-09-08 (owner, R9-S1-F5): the yield order was the pre-reversal one -->
| workspace-open | SCR-02 is open on a file of this commit (AC-06; critical flow 1) | Unchanged in shape from `default`: the parking slot is already at zero height, so header + list are the only flex children either way and the list shows the same rows; the active row follows previous / next | W-01d | <!-- amended 2026-09-08 (owner, R9-S1-F5): the column no longer changes when the workspace opens -->
| filter · no match | Filter typed, 0 matching files — existing message, and the list claims no share of the column, exactly as `empty · no files` (AC-04). Note for `tasks`: the filter input is a rank-4 Esc layer while it has content (ADR-0002) | Existing message | existing, no new wireframe | <!-- amended 2026-09-08 (owner, review round 9 R9-S2-F4): the policy is fed the displayed rows, so an empty filter match is the same layout case as an empty commit -->
| error | N/A: the inspector renders no failure state of its own — a commit removed by a refresh resolves to `empty · no commit` (F7), a details-load failure surfaces through the existing failure toast (SAD §8 Error handling) | — | — |
| validation / success | N/A: no form and no submit on this screen; commit actions run through their existing dialogs and toasts (SCR-06 for Reset) | — | — |

**Persisted state.** `header-collapsed`, `file-list-collapsed` and the open-behaviour toggle are the durable preferences `commitHeaderCollapsed` / `commitFileListCollapsed` / `commitFileClickOpensWorkspace` (the last defaulting to on, AC-22); on launch the inspector paints directly in the remembered state, 0 px shift (AC-02, AC-05; F1 reads them synchronously).

**Heights, as forms.** Summary line and files header are each one `--panel-head-h`; a file row is one `--file-row-h`. Header collapsed + list collapsed = `2 × panelHeadH`. Header collapsed with one visible row = `2 × panelHeadH + fileRowH`. Per-density pixel values: [`reference-figures.md`](./reference-figures.md) §Density tokens. <!-- heights restated as their forms 2026-09-10 (T73, review round 18 R18-F2, per owner decision D2): this read «Summary line 34 px; files header 34 px; row 30 px. Header collapsed + list collapsed = 68 px. Header collapsed with one visible row = 98 px» — five figures derived from `computeMetrics`, none of them marked, at comfortable only, so the two sums were unverifiable at the other two densities and the bare `34 px` / `30 px` / `68 px` / `98 px` shapes are exactly what the gate's heuristic cannot see (R17-F8). The forms hold at every density; the table carries the numbers --> <!-- resolved 2026-09-08 (owner, review round 11 R11-S1-F4): the sentence «the KPI wording does not say whether «collapsed» means both blocks; flagged in the handoff, not decided here» had no owner left — the §7 bullet it referred to was dropped, because header + list now consume the whole column and 98 px cannot meet its 70 px target. The two figures stay as the density arithmetic they are; no KPI reads them. Stale claim removed 2026-09-08 (owner, review round 12 O10): the body still read «68 px, **which meets the spec §7 KPI «≤ 70 px collapsed»**» — a live reference to the KPI this same wave deleted, sitting in the prose rather than quoted inside the marker that retires it -->

**Test ids for the new controls** (SAD §8): `inspector-collapse-header`, `inspector-expand-header`, `inspector-collapse-files`, `inspector-show-more`, `inspector-open-large-<path>`, `inspector-diff-slot`, `inspector-click-opens` (AC-22). <!-- amended 2026-09-08 (owner, review round 10 O4 / O10): the header still cited AC-01…21 after AC-22 joined §5, and the open-behaviour control's test id was named in SCR-01 but missing here -->

```text
W-01a · SCR-01 default — header expanded, 3 files, inspector right, comfortable
+--------------------------------------------------------------+
| (JM) Jhoan Moreno <jmoreno@…>                          [ ^ ]  |  header · collapse control
|      authored 2026-09-02 14:10 · 3h ago                       |
| [# 7cd47b4] parent a4848bd   signed   +12 -3                  |  meta row (existing)
| chore(release): version 1.0.5 — Angular 22, TypeScript 6 …    |  subject
| Body line 1 …                                                 |  body · clamped to 4 lines
| Body line 2 …                                                 |
| Body line 3 …                                                 |
| Body line 4 …                                   [show more]   |
| [main] [origin/main] [v1.0.5]                                 |  ref badges
| [Branch] [Tag] [Cherry-pick] [Revert] [Reset] [More v]        |  6 actions, yoru-button sm
+--------------------------------------------------------------+
| 3 FILES [Filter files      ] [tree][list] [click=>opens] [ ^ ]|  files header · open-behaviour toggle · collapse
| M  src/app/app.ts                              +4 -1   [⤢]    |  active row · open-large icon shown
| A  src/app/foo.ts                              +8 -0          |  (icon appears on hover / focus)
| D  README.md                                   +0 -2          |
|                                                               |  the list holds the rest of the column,
|                                                               |  never under 50 % — no diff viewer here
+--------------------------------------------------------------+
```

```text
W-01b · SCR-01 header-collapsed + file-list-collapsed
+--------------------------------------------------------------+
| (jm) chore(release): version 1.0.5 — …  Jhoan · 7cd47b4       |  summary line · --panel-head-h
|                    [⑂][tag][cherry][undo][reset][ ⋮ ]   [ v ]  |  6 icon actions + expand control
+--------------------------------------------------------------+
| 3 FILES                                                 [ v ]  |  files header only · --panel-head-h
+--------------------------------------------------------------+
|                                                               |  both blocks collapsed: the released
|                                                               |  height is left empty (AC-05)
+--------------------------------------------------------------+
  with the list expanded, the collapsed header is the >= 75 % case (right, no stacked panels).

  narrow inspector — actions that do not fit move into More:
| (jm) chore(release): …  Jhoan · 7cd47b4   [⑂][tag][ ⋮ ] [ v ] |
                                                  └ More: Cherry-pick · Revert · Reset > Soft / Mixed / Hard…
```

```text
W-01c · SCR-01 squeezed — 960 × 640, long body, 30 files
+----------------------------------------------+
| (JM) Jhoan Moreno <…>                  [ ^ ]  |
| [# 7cd47b4] parent a4848bd  +120 -80         |
| chore(release): version 1.0.5 — …            |
| Body line 1 …                   [show more]  |  clamp floor · 1 line
| [main]                                       |
| [Branch] [Tag] [Cherry-pick] [Revert] [Reset] [More v] |
+----------------------------------------------+
| 30 FILES [Filter] [tree][list] [click=>opens]|
| M  src/app/app.ts                +4 -1  [⤢]  |  list floor · 2 rows, own scroll
| A  src/app/foo.ts                +8 -0    ▒  |
+----------------------------------------------+
|                                              |  the list keeps at least half; the header
|                                              |  above scrolls inside its cap once the
|                                              |  clamp is down to one line
+----------------------------------------------+
```

```text
W-01d · SCR-01 workspace-open — the diff viewer element is away in SCR-02; the column keeps the shape of W-01a
+--------------------------------------------------------------+
| (JM) Jhoan Moreno <…>                                  [ ^ ]  |  header as remembered
| …                                                             |
| [Branch] [Tag] [Cherry-pick] [Revert] [Reset] [More v]        |
+--------------------------------------------------------------+
| 12 FILES [Filter files    ] [tree][list] [click=>opens] [ ^ ] |
| M  src/app/app.ts                              +4 -1          |
| M  src/app/foo.ts                              +8 -0   [⤢]    |  active row follows previous / next
| A  src/app/bar.ts                              +2 -0          |
| …  as many rows as fit, own scroll                            |
+--------------------------------------------------------------+
|                                                               |  parking slot at 0 px — as it also is
|                                                               |  with the workspace closed (AC-06)
+--------------------------------------------------------------+
```

```text
W-01e · SCR-01 empty · no files
+--------------------------------------------------------------+
| header as W-01a                                               |
+--------------------------------------------------------------+
| 0 FILES [Filter files      ] [tree][list] [click=>opens] [ ^ ]|
| No files changed                                              |  one muted line
+--------------------------------------------------------------+
  the list claims no share here, so the commit header keeps the column (AC-04, AC-05).
```

### SCR-02 — Diff workspace · commit (centre column)

One file of the selected commit at full centre width. The diff viewer is the **same live element** as the inspector's, re-hosted through the portal outlet (ADR-0003): its options bar, hunk navigation and Blame / History / Open / Reveal actions come with it unchanged. The one exception is the per-file collapse chevron, which the workspace does not offer: it shows a single file at full width and collapsing it would leave the centre empty (AC-06). <!-- amended 2026-09-08 (owner, review round 9 R9-S1-F10): the gate shipped in `2049df4` with no criterion and no note here --> Owner note (2026-09-03): the path shows in the workspace strip (AC-06 literal) **and** in the hosted viewer strip beneath it; the duplication is accepted for v1 because hiding the viewer strip would drop its actions — flagged in the handoff.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Open-large gesture on the active file (double-click, row control, `mod+d`) with a text diff (AC-06; critical flow 1). Workspace strip at `--panel-head-h`: `existing: diff-source-chip` «COMMIT», short sha + subject (truncate), file path (mono, dirname faint / basename strong, truncate), spacer, Previous / Next, Close. Below: the hosted diff viewer. No staging control anywhere (AC-14) | `existing: diff-source-chip`, yoru-button ghost sm icon-only + yoruTooltip (`lucideChevronLeft` Previous file, `lucideChevronRight` Next file, `lucideX` Close), yoru-kbd in the tooltips, hosted `existing: diff-viewer` (yoru-segmented, existing option toggles, `app-diff-view`) | W-02a |
| edge · first / last | Shown file is the first (Previous disabled) or the last (Next disabled) in the list's current display order, folders skipped (AC-11; F5 edge branch) | Same as default; the disabled yoru-button keeps its tooltip | W-02a, one control disabled |
| loading · navigate | Previous / Next or another file clicked in the list: the current diff stays on screen until the neighbour's diff arrives, then replaces it in place — the diff viewer has no skeleton today and critical flow 1 adds none (AC-09, AC-11) | Same as default | W-02a, content swap |
| error · not text | File is binary without preview (AC-07; F4 «binary without preview»): the hosted diff view renders its existing explanation «Binary file. There is no text diff to show.» / hint «Git reported this change as binary or larger than 10 MB.»; strip and navigation stay active | yoru-empty-state via the existing `app-diff-view` empty branch | W-02b |
| error · file list emptied | A refresh leaves the commit selected but its file list empty (AC-07 as amended 2026-09-03; F4 «lose the commit's file list»): the same explanation replaces the diff, the strip keeps path + sha, Previous / Next are disabled because the owning list re-publishes an empty file set (SAD §5 list-owner rule), Close returns to SCR-01 with the same selection. A refresh that removes the shown commit is a selection change: the workspace closes through AC-17 (F7) and no workspace state is shown | Same as `error · not text` | W-02b, both controls disabled |
| with stacked panel | Blame or file history launched from the hosted viewer strip (US-03 node G): the panel stacks in the inspector under the commit file list, the workspace stays; Esc closes the panel first (rank 2 over rank 1) | Unchanged in the centre; inspector = W-01d + the existing blame / file-history panel | W-01d + existing panel |
| empty | N/A: the workspace never renders empty — a diff that cannot be shown renders the explanation (AC-07), and every «nothing left to show» condition closes it instead (AC-13, AC-16, AC-17) | — | — |
| validation / success | N/A: no form, no submit; the four diff settings are the viewer's own preferences and persist as today (AC-06) | — | — |

**Non-visual rules for `tasks`.** The workspace registers the rank-1 Esc layer and the shortcuts of SCR-05 while open (ADR-0002); Esc with any higher layer open leaves it untouched (AC-10). Any selection, rail-view or tab change closes it without replaying the snapshot (AC-17; F7). Close / Esc replays the snapshot: same commit, same `listScrollTop`, focus on the originating row or the now-active file row (AC-08).

**Test ids.** `diff-workspace`, `diff-workspace-source`, `diff-workspace-path`, `diff-workspace-prev`, `diff-workspace-next`, `diff-workspace-close`, `diff-workspace-outlet`.

```text
W-02a · SCR-02 default — file 2 of 5, inspector right (W-01d beside it)
+------------------------------------------------------------------------------+
| COMMIT  7cd47b4 · chore(release): version 1.0.5 …   src/app/│app.ts  [<] [>] [x] |  workspace strip · --panel-head-h
+------------------------------------------------------------------------------+
| COMMIT src/app/│app.ts [copy]  1 file +4 -1        [Blame][History][Open][Reveal] |  hosted viewer strip (existing)
| [Unified|Split] [Whitespace] [Wrap]  CONTEXT [3|5|10|All]           1 / 3 [^][v] |  hosted options bar (existing)
| @@ -12,7 +12,9 @@                                                             |
|  import { signal } from '@angular/core';                                      |
| -const rows = 5;                                                              |
| +const rows = 6;                                                              |
| +const floor = 2;                                                             |
|  …                                                                            |
+------------------------------------------------------------------------------+
  tooltips: Previous file (Shift+P) · Next file (Shift+N) · Close (Esc)
  first file → [<] disabled · last file → [>] disabled
```

```text
W-02b · SCR-02 error · not text / commit removed
+------------------------------------------------------------------------------+
| COMMIT  7cd47b4 · chore(release): …          assets/│logo.png    [<] [>] [x]  |
+------------------------------------------------------------------------------+
|                                                                              |
|                       (file-diff icon)                                       |
|                  Binary file. There is no text diff to show.                 |  existing app-diff-view explanation
|         Git reported this change as binary or larger than 10 MB.             |
|                                                                              |
+------------------------------------------------------------------------------+
  commit removed: same block, [<] [>] both disabled, [x] returns to SCR-01
```

### SCR-03 — Changes view (centre column)

Out of scope to redesign (spec §3): staged / unstaged lists and the commit composer stay as they are. This feature adds the open-large gesture on file rows and the two return notices. Owner decision (2026-09-03): the **Conflicts** section does not offer open-large — its rows keep today's behaviour (Resolve); AC-13 covers only the staged and unstaged sides.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Changes view with the existing filter strip, Conflicts (when any), Staged, Changes lists and the commit composer; a staged or unstaged row shows the open-large control on hover, focus and when active (AC-06, AC-13) | Existing `app-changes-list` rows + yoru-button ghost sm icon-only `lucideMaximize2` + yoruTooltip «Open in diff workspace (Ctrl+D)»; existing yoru-segmented (tree / list), existing composer | W-03a |
| notice · own side emptied | Returned from SCR-04 because the developer's own stage / unstage left the shown side with no file left (AC-13; critical flow 2 «no file remains»): view restored with the same selection and scroll, counts refreshed, `ToastService.info` «No changes left in Unstaged» (or «… in Staged»), non-blocking, never takes focus | yoru-toast-host (existing, `--z-toast`) | W-03a, toast |
| notice · external side emptied | Returned from SCR-04 because a change from outside the app emptied the side (AC-16; F8): same restore, `ToastService.info` «src/app/app.ts no longer has unstaged changes (changed outside the app)» | yoru-toast-host | W-03a, toast |
| empty | No changes at all — the existing `hasChanges() === false` state, unchanged; also the state reached when a side is left with no changes and no toast applies | Existing | existing, no new wireframe |
| loading / error | N/A for this feature: the existing loading and failure behaviour of the Changes view is untouched | — | — |
| validation / success | N/A: the composer's validation and commit success are out of scope (spec §3); while SCR-04 is open the composer is hidden and its shortcuts inert (AC-15) | — | — |

**Test ids.** `changes-open-large-<side>-<path>`.

```text
W-03a · SCR-03 default with the return notice
+------------------------------------------------------------------------------+
| [filter] Filter files                                  [x]   [tree][list]    |  existing strip
+------------------------------------------------------------------------------+
| STAGED  1                                                  [Unstage all]     |  existing app-changes-list
| M  src/app/app.ts                                       +4 -1                |
+------------------------------------------------------------------------------+
| CHANGES  2                                                 [Discard all]     |
| M  src/app/foo.ts                                       +8 -0   [⤢]          |  hover / focus / active → open-large
| A  src/app/bar.ts                                       +2 -0                |
+------------------------------------------------------------------------------+
| Summary                                                                      |  existing composer
| [                                                            ]               |
| [Commit]                                                    Ctrl+Enter       |
+------------------------------------------------------------------------------+
                                                   +----------------------------+
                                                   | i  No changes left in      |  ToastService.info · bottom-right
                                                   |    Unstaged                |  role="status", never focused
                                                   +----------------------------+
```

### SCR-04 — Diff workspace · working tree (centre column)

One staged or unstaged file at full centre width, with the hunk and line stage / unstage controls the diff view already offers for a working-tree source. The lists and the composer are hidden while it is open.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Open-large gesture on an active staged or unstaged row (AC-13; critical flow 2). Workspace strip: `existing: diff-source-chip` «UNSTAGED» or «STAGED», file path, spacer, Previous / Next (same side only), Close. Below: the hosted diff viewer with `stageTarget` set, so hunk and line stage / unstage controls render | `existing: diff-source-chip`, yoru-button ghost sm icon-only + yoruTooltip (Previous file, Next file, Close), hosted `existing: diff-viewer` with its existing hunk / line staging controls | W-04a |
| edge · first / last | First or last file of the shown side in display order (AC-11 via AC-13; F5 edge branch) | Same as default, one control disabled | W-04a, one control disabled |
| refreshing | After the developer's own stage / unstage, or a watcher event (critical flow 2; F8): the current diff stays on screen and the hunk buttons show the existing `busy` state until the fresh diff arrives; if the file still has changes on the side the content swaps in place, otherwise the workspace advances to the next file on the same side, or closes into SCR-03 `notice · …` | Same as default; existing `busy` on the diff view's hunk buttons | W-04a, buttons busy |
| error · not text | Binary file without preview (AC-07 applies to any source; F4 branch) | yoru-empty-state via the existing `app-diff-view` empty branch | W-02b with the side chip |
| empty | N/A: when the shown side has no change left the workspace advances or closes with a notice (AC-13, AC-16) — it never renders empty | — | — |
| validation / success | N/A: a successful stage is visible as the refreshed diff here and as the updated Staged / Unstaged counts on return (AC-13); a stage on stale content fails with today's failure toast, nothing half-applied (spec §6.1) | — | — |

**Non-visual rules for `tasks`.** Previous / Next never cross to the other side (AC-13). Commit and commit-draft shortcuts are inert while open (AC-15). Same Esc layering and close-on-selection-change as SCR-02 (AC-10, AC-17).

**Test ids.** Same as SCR-02 (`diff-workspace-*`); the source chip carries `data-side="staged|unstaged"`.

```text
W-04a · SCR-04 default — Unstaged side, file 1 of 2
+------------------------------------------------------------------------------+
| UNSTAGED   src/app/│foo.ts                                         [<] [>] [x] |  workspace strip · [<] disabled (first)
+------------------------------------------------------------------------------+
| UNSTAGED src/app/│foo.ts [copy]  1 file +8 -0       [Blame][History][Open][Reveal] |  hosted viewer strip (existing)
| [Unified|Split] [Whitespace] [Wrap]  CONTEXT [3|5|10|All]           1 / 2 [^][v] |
| @@ -1,3 +1,8 @@                                          [Stage hunk] [Discard] |  existing hunk controls (working tree)
|  export const a = 1;                                                          |
| +export const b = 2;                                                          |  line selection → stage / unstage lines
| +export const c = 3;                                                          |
| …                                                                             |
+------------------------------------------------------------------------------+
  lists + composer hidden while open · Ctrl+Enter / Ctrl+Shift+Enter do nothing
```

### SCR-05 — Shortcuts help (Keyboard settings page + command palette)

Both surfaces render `KeyboardShortcutsService.shortcuts()`; registering the six shortcuts below lists them (AC-12). Owner decision (2026-09-03): the concrete combos, chosen here per SAD §8 / §11 accepted debt. Checked against the 21 registered combos: no collision; `shift+n` / `shift+p` are distinct from the hunk keys `n` / `p` because modifier matching is exact.

| Id | Label (English, as registered) | Combo | `when` |
|---|---|---|---|
| `diff-workspace.open` | Open in diff workspace | `mod+d` | a file row is active in the commit file list or in a staged / unstaged list, and the workspace is closed |
| `diff-workspace.close` | Close diff workspace | `escape` (listed for the help; the dismissal itself runs through the rank-1 Esc layer of ADR-0002) | workspace open |
| `diff-workspace.next` | Next file | `shift+n` | workspace open and not on the last file |
| `diff-workspace.prev` | Previous file | `shift+p` | workspace open and not on the first file |
| `inspector.toggle-header` | Collapse or expand commit header | `mod+shift+h` | a commit is selected |
| `inspector.toggle-files` | Collapse or expand commit file list | `mod+shift+l` | a commit is selected |

`[` / `]` were rejected: they need AltGr on Spanish and German layouts.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Keyboard page of the settings dialog (or the command palette) after the six registrations: a «Diff workspace» group of six rows next to the existing diff rows «Next hunk n» / «Previous hunk p» (AC-12; F5 note) | yoru-dialog (existing settings dialog), existing shortcut rows, yoru-kbd per combo | W-05a |
| empty / loading / error / validation | N/A: the list is static and derived from the registry; nothing loads, fails or validates | — | — |

```text
W-05a · SCR-05 default — Keyboard page, diff rows
+------------------------------------------------------------------------------+
| Settings › Keyboard                                                    [x]   |  existing yoru-dialog
|                                                                              |
|  DIFF                                                                        |
|  Next hunk                                                        [N]        |  existing
|  Previous hunk                                                    [P]        |  existing
|                                                                              |
|  DIFF WORKSPACE                                                              |  new group (registration order)
|  Open in diff workspace                                    [Ctrl] [D]        |
|  Close diff workspace                                          [Esc]         |
|  Next file                                                [Shift] [N]        |
|  Previous file                                            [Shift] [P]        |
|  Collapse or expand commit header                [Ctrl] [Shift] [H]         |
|  Collapse or expand commit file list             [Ctrl] [Shift] [L]         |
+------------------------------------------------------------------------------+
```

### SCR-06 — Reset confirmation

Unchanged behaviour (AC-21): Reset opens the existing anchored context menu (Soft / Mixed / Hard…, Hard in danger tone) and the action runs through `CommitActions.run` with its existing confirmation for Hard. The only novelty is the **anchor**: the inline icon in the collapsed summary line, or a «Reset» entry with Soft / Mixed / Hard children inside More when Reset did not fit (one submenu level, supported by `yoru-context-menu`).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default · menu | Reset clicked in the collapsed summary line (inline icon), or More → Reset when overflowed (AC-21; F3 «click an action») | yoru-context-menu via ContextMenuService, anchored to the yoru-button that opened it; items Soft / Mixed / Hard… (Hard `tone: danger`) | W-06a |
| confirm · hard | Hard chosen (F3 «the action is Reset»): the existing danger confirmation, unchanged | yoru-dialog tone danger (existing), yoru-button ghost Cancel + danger Confirm | existing dialog, no new wireframe |
| cancel | Esc, Cancel or click-away (F3 «the developer cancels»): nothing runs, the summary line is back exactly as before | — | W-01b |
| success | Confirmed (F3 «the developer confirms»): reset runs, History refreshes, the header stays collapsed | Existing refresh path | W-01b after refresh |
| error | Reset fails: the existing `OpsRunner` failure toast «Reset failed: …» (SAD §8 Error handling); nothing new drawn | yoru-toast-host | existing |
| empty / loading / validation | N/A: a menu and a confirmation carry no list, no async content of their own and no form | — | — |

```text
W-06a · SCR-06 default · menu — anchored to the inline Reset icon, and the More variant
| (jm) chore(release): …  Jhoan · 7cd47b4   [⑂][tag][cherry][undo][reset][ ⋮ ]  [ v ] |
                                                               └──────────────┐
                                                  | Soft — move main, keep index and working tree |
                                                  | Mixed — move main, keep working tree           |
                                                  | Hard — discard everything…           (danger)  |
                                                  +------------------------------------------------+

  overflowed into More:
| (jm) chore(release): …  Jhoan · 7cd47b4                        [⑂][tag][ ⋮ ]  [ v ] |
                                                                        └────────┐
                                                                  | Cherry-pick        |
                                                                  | Revert             |
                                                                  | Reset            > |─┐
                                                                  +--------------------+ | Soft — …
                                                                                         | Mixed — …
                                                                                         | Hard — … (danger)
```

## Rendering variants

Not states — the same state tables apply; these say what changes in the drawing (AC-18, AC-19, AC-20; F2 placement branches; SAD §10 QG-3).

| Variant | What changes | Trace |
|---|---|---|
| Inspector at the bottom | The inspector column becomes a row under the centre; W-01a…e keep their block order top-to-bottom; the commit file list keeps at least the share of the column it has on the right, **except where the header-cap guard costs the list its ratio — a remainder under twice `--panel-head-h` with the header expanded, or under four times it collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**; the 50 % / 75 % shares are not measured here | AC-18 | <!-- amended 2026-09-08 (owner, review round 9 R9-S1-F5 / R9-S2-F6b); carve-out added 2026-09-08 (owner, review round 13 R13-S1-F1): this variant row was not among the six sites round 12 carved the guarantee out of, so the screen manifest still promised the un-carved share. Wording byte-identical to AC-18’s. Band restated 2026-09-09 (owner, review round 15 R15-S1-F1): the two fixed pixel pairs were derived from the spec fixtures, so the exception was narrower than the guard over 12 of the 21 reachable density × font pairs; it is now the guard’s own closed form, exact at 201 474 measured points -->
| Blame / file history stacked | Stacked panels keep their fixed share under the commit file list; collapsing the header grows only the commit file list, and collapsing the list leaves the released height empty; the 75 % target is not measured here | AC-19 | <!-- amended 2026-09-08 (owner, review round 9 R9-S1-F5 / R9-S1-F8) -->
| Compact density | Summary line and files header at `--panel-head-h` and file rows at `--file-row-h` as `computeMetrics` derives them for the active font (26 and 24 at the default 13 px), panel padding `--panel-pad`; type scale unchanged | AC-20 |
| Light theme | Tokens only (`--app-*`); every text meets the app contrast rule; no new blur-dependent surface (the workspace is in-flow, opaque) | AC-20, `DESIGN.md` §Accessibility |

## New components

None — all screens compose the existing inventory (`yoru-avatar`, `yoru-badge`, `yoru-button`, `yoru-context-menu` + `ContextMenuService`, `yoru-dialog`, `yoru-empty-state`, `yoru-kbd`, `yoru-segmented`, `yoru-skeleton`, `yoru-toast-host` + `ToastService`, `yoruTooltip`, `KeyboardShortcutsService`) plus existing feature markup (`inspector-header`, `files-header`, `file-row`, `sha-chip`, `diff-source-chip`, `diff-viewer`, `app-diff-view`, `app-changes-list`). The new `features/diff-workspace/` folder is a feature component, not a shared primitive: its strip is composed from the primitives above.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| — | — | — |

## State provenance — AC → screen · state

| AC | Screen · state |
|---|---|
| AC-01 | SCR-01 · default, body-expanded |
| AC-02 | SCR-01 · header-collapsed (+ persisted state note) |
| AC-03 | SCR-01 · squeezed |
| AC-04 | SCR-01 · default, file-list-overflow, empty · no files, filter · no match |
| AC-05 | SCR-01 · file-list-collapsed (+ persisted state note) |
| AC-06 | SCR-01 · workspace-open · SCR-02 · default · SCR-03 · default (row control) · SCR-05 (open shortcut) |
| AC-07 | SCR-02 · error · not text, error · file list emptied · SCR-04 · error · not text |
| AC-08 | SCR-02 non-visual rules (restore snapshot) |
| AC-09 | SCR-02 · loading · navigate (single workspace) |
| AC-10 | SCR-02 / SCR-04 non-visual rules (Esc layering) · SCR-01 · filter · no match (rank-4 note) |
| AC-11 | SCR-02 · edge · first / last · SCR-04 · edge · first / last |
| AC-12 | SCR-05 · default (shortcut table) |
| AC-13 | SCR-04 · default, refreshing · SCR-03 · notice · own side emptied, default (row control) |
| AC-14 | SCR-02 · default (no staging control) |
| AC-15 | SCR-04 non-visual rules · SCR-03 · validation / success N/A row |
| AC-16 | SCR-04 · refreshing · SCR-03 · notice · external side emptied |
| AC-17 | SCR-02 / SCR-04 non-visual rules (close on selection change) |
| AC-18 | Rendering variants · inspector at the bottom |
| AC-19 | Rendering variants · stacked panels · SCR-02 · with stacked panel |
| AC-20 | Rendering variants · compact density, light theme |
| AC-21 | SCR-01 · header-collapsed · SCR-06 · all states |
| AC-22 | SCR-01 · default (toggle on) · click-opens-off (toggle off) | <!-- added 2026-09-08 (owner, review round 9 R9-S1-F5) -->
