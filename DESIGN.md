---
version: "alpha"
name: YoruMerge
description: "Japanese cyberpunk design system for a fast Git GUI desktop client built with Angular, Tauri, and Tailwind CSS 4."
colors:
  primary: "#00E5FF"
  secondary: "#9B5CFF"
  tertiary: "#FF4FB8"
  neutral: "#F4F8FF"
  on-primary: "#050712"
  on-secondary: "#F4F8FF"
  on-tertiary: "#050712"
  background: "#050712"
  foreground: "#F4F8FF"
  muted: "#7EA6EF"
  border: "#252D4A"
  dark-background: "#050712"
  dark-surface: "#080B18"
  dark-surface-raised: "#12162A"
  dark-panel: "#1A2038"
  dark-border: "#252D4A"
  dark-text: "#F4F8FF"
  dark-text-muted: "#AFC8F7"
  dark-text-faint: "#7E93B8"
  light-background: "#F7FAFF"
  light-surface: "#FFFFFF"
  light-surface-raised: "#EEF4FF"
  light-panel: "#E3ECFB"
  light-border: "#B9C8E8"
  light-text: "#101426"
  light-text-muted: "#465A7F"
  light-text-faint: "#546889"
  neon-cyan: "#00E5FF"
  neon-blue: "#3B82FF"
  neon-violet: "#9B5CFF"
  neon-pink: "#FF4FB8"
  sakura: "#FF6FBE"
  success: "#35F2A2"
  warning: "#FFD166"
  danger: "#FF4D5E"
  git-added: "#35F2A2"
  git-modified: "#FFD166"
  git-deleted: "#FF4D5E"
  git-renamed: "#00E5FF"
  git-conflict: "#FF4FB8"
typography:
  display-xl:
    fontFamily: Zen Dots
    fontSize: 3rem
    fontWeight: "400"
    lineHeight: "1"
    letterSpacing: "-0.03em"
  heading-lg:
    fontFamily: IBM Plex Sans
    fontSize: 1.5rem
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: "-0.02em"
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: "1.6"
    letterSpacing: "0em"
  label-caps:
    fontFamily: IBM Plex Sans
    fontSize: 0.75rem
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: "0.12em"
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: "500"
    lineHeight: "1.5"
    letterSpacing: "-0.01em"
rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  xl: 28px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
  sidebar:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.lg}"
  panel:
    backgroundColor: "{colors.dark-surface-raised}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.lg}"
    padding: 24px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.primary}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  commit-row:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 16px
  diff-added:
    backgroundColor: "#0A2A22"
    textColor: "{colors.git-added}"
  diff-deleted:
    backgroundColor: "#321018"
    textColor: "{colors.git-deleted}"
---

## Overview

YoruMerge is a Git GUI with the atmosphere of Tokyo after midnight: precise, quiet, luminous, and slightly dangerous. The interface should feel like a premium desktop tool for developers, not a game HUD. Use restrained neon, dark glass panels, crisp type, and Git status colors that are immediately recognizable.

The default experience is dark mode. Light mode exists for long review sessions, daylight environments, and accessibility preferences, but it must keep the same nocturnal identity through cool surfaces, blue shadows, and cyberpunk accent colors.

Design keywords: midnight, rain, glass, moonlight, circuit lines, sakura neon, terminal precision, merge graph, calm focus.

## Colors

### Brand palette

- **Primary / Neon Cyan (`#00E5FF`)**: main action color for commit, pull, push, selected branch, active navigation, and current HEAD.
- **Secondary / Neon Violet (`#9B5CFF`)**: secondary action color for compare, stash, tags, and visual depth.
- **Tertiary / Sakura Pink (`#FF4FB8`)**: high-emphasis accent for conflicts, destructive attention, and rare brand moments.
- **Moon Neutral (`#F4F8FF`)**: primary foreground in dark mode and high-contrast text on dark surfaces.

### Dark theme

Use dark mode as the canonical YoruMerge theme.

| Role | Token | Hex | Tailwind utility |
| --- | --- | --- | --- |
| App background | `dark-background` | `#050712` | `bg-yoru-950` |
| Sidebar / base surface | `dark-surface` | `#080B18` | `bg-yoru-900` |
| Raised surface | `dark-surface-raised` | `#12162A` | `bg-yoru-800` |
| Active panel | `dark-panel` | `#1A2038` | `bg-yoru-700` |
| Border | `dark-border` | `#252D4A` | `border-yoru-600` |
| Text | `dark-text` | `#F4F8FF` | `text-moon-50` |
| Muted text | `dark-text-muted` | `#AFC8F7` | `text-moon-200` |
| Faint text | `dark-text-faint` | `#7E93B8` | `text-[var(--app-text-faint)]` |

Dark backgrounds should never be pure black. Use subtle gradients and alpha borders so panels have depth without becoming noisy.

### Light theme

Light mode is cool, lunar, and technical. Avoid warm beige, pure white-only layouts, or pastel SaaS styling.

| Role | Token | Hex | Tailwind utility |
| --- | --- | --- | --- |
| App background | `light-background` | `#F7FAFF` | `bg-yuki-50` |
| Base surface | `light-surface` | `#FFFFFF` | `bg-white` |
| Raised surface | `light-surface-raised` | `#EEF4FF` | `bg-yuki-100` |
| Active panel | `light-panel` | `#E3ECFB` | `bg-yuki-200` |
| Border | `light-border` | `#B9C8E8` | `border-yuki-300` |
| Text | `light-text` | `#101426` | `text-ink-950` |
| Muted text | `light-text-muted` | `#465A7F` | `text-ink-600` |
| Faint text | `light-text-faint` | `#546889` | `text-[var(--app-text-faint)]` |

In light mode, neon cyan should be used mostly as border, icon, underline, glow, or small filled controls. Large cyan blocks can be too loud on pale backgrounds.

### Three levels of text, never opacity

`--app-text` › `--app-text-muted` › `--app-text-faint`. The faint token exists so
hints, counts and disabled reasons have a real colour instead of an
`opacity-50` stacked on muted text: both faint values are calibrated to stay
above WCAG AA 4.5:1 on **every** surface of their own theme (light `#546889` ≥
4.75:1, dark `#7E93B8` ≥ 5.16:1), which stacked opacity cannot guarantee.

Never dim text with `opacity-*`. Pick the next token down.

### Git semantic colors

| Git state | Hex | Usage |
| --- | --- | --- |
| Added | `#35F2A2` | added files, insertions, successful operations |
| Modified | `#FFD166` | modified files, pending changes, warnings |
| Deleted | `#FF4D5E` | removed files, failed operations, destructive intent |
| Renamed | `#00E5FF` | renamed files, moved paths, sync state |
| Conflict | `#FF4FB8` | merge conflicts, unresolved hunks, blocked actions |

Keep semantic colors consistent across file lists, diff gutters, badges, graph nodes, and notifications.

**Fill versus text.** The hexes above are the *fill* tones: dots, borders, tints,
diff backgrounds. As type they fail on a light surface — the green and the amber
measure about 1.1:1 on white — and the red fails on the lighter dark palettes.
Text takes the ink of the same hue instead: `--app-added-text`,
`--app-modified-text`, `--app-deleted-text` and `--app-renamed-text`, exposed
as `text-git-added-ink`, `text-git-modified-ink`, `text-git-deleted-ink` and
`text-git-renamed-ink`. Each palette defines them
per mode in `color-palettes.ts`, next to `conflictText`, and
`color-palettes.spec.ts` holds them to 4.5:1 on all four surfaces. Use
`bg-git-*` / `border-git-*` for fills and the `-ink` utility for anything that
is read.

## Typography

Use distinctive type, but keep the app readable during long Git sessions.

- **Display:** `Zen Dots` for the YoruMerge wordmark, splash states, and rare hero headings only.
- **Body/UI:** `IBM Plex Sans` for panels, forms, menus, dialogs, settings, and readable UI text.
- **Code/Mono:** `JetBrains Mono` for commit hashes, branches, file paths, CLI output, diffs, and technical metadata.

### Font loading — self-hosted

The fonts ship with the app. A desktop client must render identically offline
and on first launch, and a request to `fonts.googleapis.com` would also have to
be opened up in the Tauri CSP. The woff2 files live in
`src/assets/fonts/` and are declared in `styles.css`:

```css
@font-face {
  font-family: "IBM Plex Sans";
  font-weight: 100 700;          /* variable font: one file, whole range */
  font-display: swap;            /* body text must never be blocked */
  src: url("./assets/fonts/ibm-plex-sans-latin.woff2") format("woff2");
}

@font-face {
  font-family: "JetBrains Mono";
  font-weight: 100 800;
  font-display: block;           /* a fallback swap would reflow diff columns */
  src: url("./assets/fonts/jetbrains-mono-latin.woff2") format("woff2");
}

@font-face {
  font-family: "Zen Dots";
  font-weight: 400;              /* static, single weight */
  font-display: block;
  src: url("./assets/fonts/zen-dots-latin.woff2") format("woff2");
}
```

Latin subset only (~91 kB total). The fallback stacks carry anything outside it
and cover the moment before the face is ready:

```css
--font-display: "Zen Dots", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
--font-body: "IBM Plex Sans", "Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif;
--font-mono: "JetBrains Mono", "Cascadia Code", Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
```

The fallbacks are deliberately per-platform: `Segoe UI` and `Cascadia Code` on
Windows, `Noto Sans` and `DejaVu Sans Mono` on Linux.

Rules:

- Do not use display typography for dense interface text.
- Commit hashes and branch names should use mono type.
- Labels can use uppercase with tracking, but never for paragraphs.
- Prefer `text-moon-50` / `text-ink-950` for primary text and muted tokens for secondary text.

## Iconography

Icons are [Lucide](https://lucide.dev) through `@ng-icons/lucide`, rendered as
`<ng-icon>`. **Never** emoji or unicode glyphs (`⎇`, `✕`, `▾`, `⚠`): they render
differently on Windows and Linux, cannot be coloured with a token, and cannot be
sized to the grid.

The curated set lives in `src/app/shared/icons/icons.ts` and is
provided once via `provideYoruIcons()`. `YoruIconName` is the union of allowed
names, so adding an icon to the app means adding it to that file first. The full
Git concept → icon table is in `shared/icons/README.md`.

| Context | Size |
| --- | --- |
| Inline in rows, menu items, badges | 14 px |
| Toolbar buttons, icon rail, panel headers | 16 px (the default) |
| Empty states | 18 px |

Stroke width is `1.75` everywhere — Lucide's default `2` is too heavy next to
13 px body text.

Core mappings: branch `lucideGitBranch` · merge `lucideGitMerge` · commit
`lucideGitCommitHorizontal` · cherry-pick `lucideCherry` · revert `lucideUndo2` ·
reset `lucideRotateCcw` · squash `lucideScissors` · stash `lucideArchive` · tag
`lucideTag` · remote `lucideGlobe` · fetch `lucideCloudDownload` · push
`lucideCloudUpload` · worktree `lucideLayers` · submodule `lucidePackage` ·
reflog `lucideHistory` · conflict `lucideTriangleAlert` · signed
`lucideShieldCheck`.

Icons are decorative by default (`aria-hidden="true"`) — the adjacent text
carries the meaning. An icon-only control needs an `aria-label`.

## Layout

YoruMerge is a desktop productivity app. Density is allowed, but hierarchy must stay calm.

### Spatial model

- **8px base grid** for all spacing.
- **16px** for panel padding and compact groups.
- **32px** for main content gutters.
- **48px** for empty-state breathing room.

### Density

Every fixed dimension in the shell. These are not suggestions: `--row-h` must
match the CDK virtual-scroll `itemSize` **and** the branch-graph row height, or
the graph lanes drift away from their commits.

They are **computed**, not chosen: `computeMetrics`
(`core/services/appearance-metrics.ts`) turns the type size and the density into
each token, and `AppearanceService` writes them as inline custom properties on
`<html>`. The table names the dimensions; their pixel values at each density and
type size are defined only by that function.

| Surface | Token | Padding budget it scales |
| --- | --- | --- |
| Titlebar (custom) | `--titlebar-h` | `PAD.titlebar` |
| Toolbar | `--toolbar-h` | `PAD.toolbar` |
| Icon rail | `--rail-w` | `PAD.rail` |
| Refs panel rows | `--ref-row-h` | `PAD.refRow` |
| Commit rows | `--row-h` | `PAD.row` |
| File rows | `--file-row-h` | `PAD.fileRow` |
| Panel header | `--panel-head-h` | `PAD.panelHead` |
| Panel padding | `--panel-pad` | `PAD.panel` (pure spacing, no text line) |
| Status bar | `--statusbar-h` | `PAD.statusbar` |
| Control — toolbar, dialogs, forms | `--control-h` | `PAD.control` |
| Control — inside a panel head | `--control-h-sm` | `PAD.controlSm` |
| Control — inside a row or a dense strip | `--control-h-xs` | `PAD.controlXs` |
| Rail item | `--rail-item` | `PAD.railItem` |

Each is `round(textRatio × typeSize + PAD.<surface> × densityScale)`, with
`DENSITY_PAD_SCALE` at `0.6 / 1 / 1.5` for compact / comfortable / relaxed —
density means «how much air around the text», never «how big is the text».
`--panel-pad` is the exception: pure spacing, so it is
`round(PAD.panel × densityScale)`, with no text term.

**Controls are sized by the same arithmetic as the bars that host them.** A
button, an input or an icon button is one line of text plus a padding budget,
and each budget is smaller than its host's: `control` under `toolbar`,
`controlSm` under `panelHead` and `fileRow`, `controlXs` under every row,
`railItem` under `rail`. The difference is the air around the control, and it
scales with density like everything else. A control therefore **never carries a
fixed height** — `h-8`, `h-7` or `size-10` on a button is a defect, because the
bar shrinks at compact and the button does not: at compact / 11 px a 32 px
button sat in a 32 px toolbar and a 40 px rail item in a 32 px rail.
`yoru-button` is `--control-h` at `md` and `--control-h-sm` at `sm`;
`yoru-segmented` is `--control-h-sm`; an icon button or a filter inside a row
or a strip is `--control-h-xs`. `appearance-metrics.spec.ts` asserts the fit
for every density and every type size the preference allows.

Type scale: body 13 px, mono 12 px, headings 15 px, labels 10.5 px uppercase
with `tracking-[0.12em]`. Those are the `text-y-*` steps at the default type
size; each is a ratio of `--ui-font-size`. Tailwind's own `text-xs` / `text-sm`
are fixed `rem` sizes that ignore the type-size preference — never use them.

**Compact density.** Density is applied as inline custom properties on
`<html>`: `AppearanceService` derives every metric from the type size and the
density in `core/services/appearance-metrics.ts` and writes the tokens itself.
There is no `:root[data-density="compact"]` rule, and `styles.css` says so at
the declaration — the `data-density` attribute is only a read-back marker.
Change density metrics in the arithmetic of that module, never with a CSS
override. **`--row-h` and `--file-row-h` move with density like every other
token, and what is deliberate is that they move *together with the CDK
virtual-scroll `itemSize`**: every virtual list binds
`[itemSize]="rowHeight()"` from the same `computeMetrics` output that writes
the token, so the two cannot disagree. Override either one in CSS and the rows
move while the viewport still scrolls by the old pitch, which misplaces every
row and drifts the graph lanes off their commits. Changing them means changing
the arithmetic, which moves both sides at once.

**Inspector layout variables.** Three more custom properties exist, and none
is a density token: `core/services/inspector-layout.ts` computes them from the
measured column and `CommitInspector` writes them on its own host element, once
per layout pass. Never author them in CSS, never persist them.

| Variable | Meaning | Bounds |
| --- | --- | --- |
| `--inspector-list-rows` | how tall the commit file list is, in rows (`rows × --file-row-h`) | no upper bound — as many rows as the column fits, capped only by the file count; floor of 2 while the list is expanded; 0 when the list is collapsed or the commit touched no file |
| `--inspector-clamp-lines` | `-webkit-line-clamp` on the commit message body | 1 to 4; a collapsed header hides the body rather than clamping it to zero |
| `--inspector-header-max-h` | how tall the expanded commit header may grow before it scrolls inside the cap | whatever the commit file list's floor leaves of the column, **floored** to whole pixels and never under one panel head (flooring, not rounding: rounding a half-pixel cap up takes that pixel from the list) |

The policy's rule is that the **commit file list** keeps at least half of the
column left by the stacked panels, and at least 75 % of it once the header is
collapsed — collapsing the header is the developer asking for more list, so the
stricter floor applies there. The list is the block the policy protects, and
the header is what yields, in this order: the body clamp shrinks first, down to
its floor of 1 line plus «Show more»; then the expanded header scrolls inside
its cap, which is whatever the list's floor leaves over, so a commit with many
refs cannot push the list under its share. The list never falls below 2 rows —
that floor wins over the ratio on a column too short for both. One exception:
the cap never goes under one `--panel-head-h`, because a header shorter than its
own head would disappear behind its own scrollbar, so on a remainder under twice
`--panel-head-h` expanded, or under four times it collapsed, the ratio yields to
the cap. That case is reachable at the bottom placement with both panels stacked
(spec AC-18, AC-03). Opening the diff workspace changes none of this: the
History inspector holds no diff to hand over. The policy writes these three
variables and nothing else: **`--file-row-h` stays tied** to the CDK `itemSize`
above and is never overridden.

### Z-layers

Four layers, declared in `styles.css`. Nothing may invent a z-index outside the
scale; use `z-[var(--z-…)]`.

| Token | Value | Meaning |
| --- | --- | --- |
| `--z-dropdown` | 1000 | anchored to the page, dismissed by clicking away: context menus, submenus, toolbar dropdowns |
| `--z-overlay` | 1100 | floats above a dropdown but takes no focus: tooltips, drag ghosts |
| `--z-modal` | 1200 | takes focus and blocks the app behind it: dialogs, merge resolver, command palette |
| `--z-toast` | 1300 | always visible, never blocks — above modals so a failure raised by a dialog action stays readable |

### App shell

The window has no native decorations. Top to bottom:

1. **Titlebar** — wordmark, repository tabs, window controls. The whole strip is
   `data-tauri-drag-region`; double-clicking it maximises.
2. **Toolbar** — clustered controls (Fetch / Pull / Push · Branch / Merge /
   Stash), a centred command bar that opens the palette, and the branch chip,
   notifications, settings and theme on the right.
3. **Icon rail** — Changes · History · Refs · Remotes · Tags · Stashes · Reflog,
   with Settings at the bottom. It drives the `railView` preference; Remotes,
   Tags and Stashes are not separate views — they open the refs panel on that
   section, because everything they would show already lives there.
4. **Workbench** — refs panel (collapsible, width persisted), the centre view,
   and the inspector column. One splitter, persisted as `workbenchSplit`.
   **What is where is data**: `workbenchLayout()`
   (`core/services/workbench-layout.ts`) turns the view, the placement
   preferences and what is open into the order of the outer row, the axis of
   the split, the blocks the centre mounts and the blocks the inspector stacks
   with their sizes. `main-content.html` only paints that description and owns
   the pixels (widths, split, drag). To move a panel, reorder it there; to add
   one, add its id, its rule and a `@case` — never a new `[class.x]` condition
   in the template.
5. **Repository-state banner** — above the workbench whenever git is parked in a
   merge, rebase, cherry-pick, revert or bisect. Sakura tone, and the only place
   Continue / Skip / Abort / Resolve live.
6. **Status bar** — watcher light, branch and upstream, ahead/behind, HEAD sha,
   detached-HEAD chip, change count, sequencer state, fetch progress, git
   version.

**The inspector column.** Four blocks, top to bottom, and only one of them
grows — which one depends on the view:

| Block | Height |
| --- | --- |
| Commit header | content-sized; collapses to a one-line summary (avatar, subject, author, sha chip) whose inline actions overflow into the More menu as the line runs out of room |
| Commit file list | `flex-1` — the only growing child in History, kept at half the column left by the stacked panels or more (75 % with the header collapsed), except on a column too short for the header cap (§Density); collapses to its own header |
| Diff slot | the portalled viewer's parking home: `flex-1` in Changes, where the working tree reads its diff inline; zero height in History, where the commit diff is read only in the diff workspace |
| Blame · file history | fixed shares of the column: 37.5 % / 28.6 % on their own, 30 % / 20 % when both are stacked |

The header is content-sized: no CSS caps it, because a cap would clip exactly
what the layout policy has to measure. The policy bounds it instead (§Density),
in TypeScript rather than by CSS ratios, so every pixel the header releases
lands in the commit file list.
Both collapsed states are durable preferences (`commitHeaderCollapsed`,
`commitFileListCollapsed`) read at first paint, so the column does not re-flow
after it appears. In the Changes view the header and the file list are absent —
the centre view already owns the file lists.

**The diff workspace.** One file's diff at full width in the **centre view** —
a state of that column, never a route, a window, a tab or an overlay, so it
takes no z-index. It is opened from the commit file list or from a staged or
unstaged row in Changes, carries a header strip with the source, the path,
previous / next and Close, and hosts **the** diff viewer, borrowed from the
inspector's diff slot (§Diff viewer).

**Opening a file.** A single click on a commit file row opens the diff
workspace when `commitFileClickOpensWorkspace` is on, which is the default;
with it off the click only makes the row active. The control that switches the
two sits in the file list header beside the tree and flat toggles and reports
the mode that is live. Either mode keeps the other three ways in: double-click,
the row's open-large control, and the shortcut. Closing restores what was
there — the same view, commit or side, the list's scroll offset, and focus on
the row the file came from. While it is open the Changes panel stays mounted
but hidden, because it owns the file order the workspace steps through; the
History and Reflog content is unmounted instead and rebuilt on close.

Use vertical separators sparingly. Prefer translucent borders and layered surfaces over heavy divider lines.

### Background treatment

Use one atmospheric background layer at app level. The top-right glow is the
accent (`--app-accent`), so it follows the accent preset; the bottom-left one
stays sakura.

```html
<main class="min-h-screen bg-yoru-950 text-moon-50 [background-image:radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--app-accent)_16%,transparent),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,79,184,0.10),transparent_30%)]">
  <!-- app shell -->
</main>
```

In light mode:

```html
<main class="min-h-screen bg-yuki-50 text-ink-950 [background-image:radial-gradient(circle_at_top_right,rgba(0,184,212,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(155,92,255,0.10),transparent_28%)]">
  <!-- app shell -->
</main>
```

## Elevation & Depth

Depth should feel like dark glass and monitor glow.

Recommended shadows:

```css
--shadow-panel: 0 24px 80px rgb(0 0 0 / 0.45);
--shadow-accent: 0 0 24px color-mix(in srgb, var(--app-accent) 28%, transparent);
--shadow-neon-pink: 0 0 24px rgb(255 79 184 / 0.25);
--shadow-light-panel: 0 18px 50px rgb(24 45 90 / 0.14);
```

`--shadow-panel` resolves through `--app-shadow-panel`, which is redefined per
theme, so `shadow-panel` is correct in both modes and a panel never has to know
which theme it is painted in.

**Every glow is the accent.** A glow is written as
`color-mix(in srgb, var(--app-accent) N%, transparent)`, never as a literal
cyan: with any other accent preset a hardcoded `rgb(0 229 255 / …)` leaves the
scrollbar, the drop target and the fetch pulse glowing in a colour the rest of
the interface no longer uses.

Usage:

- Main panels: `shadow-panel`.
- Avoid generic drop shadows that make the UI look like a web dashboard.

### Glow budget

At rest, exactly two things in a view may glow:

1. The **HEAD / current branch** marker.
2. The **one primary action in focus** — and only while hovered or focused.

Nothing else. No glowing rows, badges, borders, panels or icons. A glow is how
the app says "you are here" and "this is the button"; spend it anywhere else and
both meanings are gone. Conflict UI is the single exception: a blocking conflict
may carry a sakura glow while it is unresolved.

### Sakura is not red

They mean different things and must not be swapped:

- **Sakura pink** (`#FF4FB8` / `sakura-400`) — *conflict*. Something is blocked
  and waiting for the user to resolve it: merge conflicts, unresolved hunks, the
  rebase/merge state banner. Urgent, not dangerous.
- **Red** (`git-deleted`, `#FF4D5E`) — *destructive*. An action that discards
  work: delete branch, hard reset, discard changes, force push. Dangerous, not
  urgent.

`yoru-dialog` encodes the difference: `tone="conflict"` versus `tone="danger"`.

**Sakura as fill versus Sakura as text.** `--color-git-conflict` (`#FF4FB8`)
stays the fill, border and glow tone in both themes. Small text uses
`--app-conflict-text` instead, which is the same hue darkened to `#B0116A` in
the light theme: `#FF4FB8` is only 2.97:1 on white and 2.43:1 on its own `/10`
tint, well under AA. The dark theme keeps `#FF4FB8` there, where it already
measures 5.4–6.6:1. Conflict labels, banner titles, chips and the sequencer
state in the status bar all use the text token.

## Shapes

YoruMerge uses rounded rectangles with a precise technical feel.

| Token | Value | Usage |
| --- | --- | --- |
| `xs` | `6px` | icon buttons, tooltips, graph nodes, small handles |
| `sm` | `10px` | inputs, buttons, context menus |
| `md` | `14px` | cards, file rows |
| `lg` | `20px` | panels and **dialogs** (`yoru-dialog` uses `rounded-lg`) |
| `xl` | `28px` | empty states, large overlays |
| `full` | `999px` | ref pills, status badges, avatars |

Do not use fully rounded cards for core Git surfaces. Reserve pill shapes for branch names, status badges, and filters.

## Components

### UI kit

These primitives already exist in `src/app/shared/ui/`. Build screens
out of them rather than re-styling raw elements — that is what keeps radii,
density and focus behaviour identical across features. Full API and examples:
`shared/ui/README.md`.

| Component | Purpose |
| --- | --- |
| `yoru-dialog` | every modal: focus trap, Escape, sizes `sm/md/lg/full`, tones `default/danger/conflict` |
| `yoru-context-menu` + `ContextMenuService` | the one context menu, opened imperatively: header, checks, shortcuts, one submenu level, full keyboard (§Context menus) |
| `yoruIconButton` | the one square icon button, a directive on a native `<button>`: sizes `xs / sm / md`, tones `ghost / outline / danger`, pressed look from `aria-pressed` |
| `yoruInput` | the one text field, a directive on a native `<input>` or `<textarea>`: sizes `xs / sm / md` |
| `yoru-button` | `primary / secondary / ghost / danger`, sizes `sm` (`--control-h-sm`) and `md` (`--control-h`), icon and loading states |
| `yoru-badge` | ref pills for branch / remote / tag / HEAD |
| `yoru-avatar` | author initials with a deterministic gradient from the email |
| `yoru-empty-state` | zero-state copy with optional kanji watermark |
| `yoru-section-header` | 34 px panel header: caps label, count, actions slot |
| `yoru-diff-source` | diff strip head: source chip, optional detail, path with faint directory and strong file name |
| `yoru-field`, `yoru-switch`, `yoru-segmented` | settings and dialog form controls |
| `yoru-kbd` | key caps rendered from the registered combo string |
| `yoru-spinner`, `yoru-skeleton` | activity and loading placeholders |
| `yoru-toast-host` | renders `ToastService` bottom-right |
| `yoruTooltip` | delayed, positioned, `aria-describedby` hint |

Supporting services: `ClipboardService`, `KeyboardShortcutsService`.

### Buttons

Prefer `<yoru-button>`; the markup below is the contract it implements.

Primary actions should feel like terminal commands with a neon execution key:
an accent fill, dark type, and the glow only on hover or focus.

```html
<button class="h-[var(--control-h)] rounded-sm bg-accent px-3 text-y-base font-semibold text-yoru-950 hover:bg-moon-50 hover:shadow-accent">
  Commit
</button>
```

Secondary actions are framed and sit on the raised surface, so a button is
never the same colour as what is behind it:

```html
<button class="h-[var(--control-h)] rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] px-3 text-y-base text-[var(--app-text)] hover:border-accent/50 hover:bg-[var(--app-panel)]">
  Pull
</button>
```

A `ghost` button stays flat: it lives inside a row or a strip, where a resting
fill on every control would be noise. When a group of ghost buttons has to read
as controls — the toolbar clusters — the *group* takes the border and the raised
surface, not the buttons.

An icon-only control is `<button yoruIconButton>` and a text field is
`<input yoruInput>`. Both are directives on the native element, so `disabled`,
`data-testid`, the tooltip and the events stay on the element that owns them.
Never restyle a raw `<button>` or `<input>` by hand: the hand-written copies
were how the app ended up with six control heights and four field styles.

### Panels

```html
<section class="rounded-lg border border-yoru-600/70 bg-yoru-800/80 p-6 shadow-panel backdrop-blur-xl dark:bg-yoru-800/80">
  <!-- panel content -->
</section>
```

Light mode panel:

```html
<section class="rounded-lg border border-yuki-300/80 bg-white/85 p-6 shadow-light-panel backdrop-blur-xl">
  <!-- panel content -->
</section>
```

### Commit rows

Commit rows need high scanability.

- Hash: mono, muted, short hash visible.
- Subject: body font, strong foreground.
- Author/time: muted text.
- Branch/tag badges: pill shape, mono, low-saturation fill.
- Row states are the shared ones below — never restyled per list.

```html
<article class="rounded-md border border-yoru-600/60 bg-yoru-900/72 px-4 py-3 transition hover:border-neon-cyan/50 hover:bg-yoru-800/88">
  <p class="font-medium text-moon-50">Fix branch graph virtualization</p>
  <p class="font-mono text-xs text-moon-200">a91c2ef · main · 12m ago</p>
</article>
```

### Rows

Every list row in the workbench — commits, commit files, working-tree files,
refs, reflog entries, file history — carries `.yoru-row` (`styles.css`), so a
state looks the same wherever it appears:

| State | Look | How a row gets it |
| --- | --- | --- |
| Hover | a wash of the panel tone | `:hover` |
| Selected | an accent tint (14 %) | `aria-selected="true"` or `.is-selected` |
| Current | a 2 px accent edge on the left | `.is-current` — the one in effect: the commit the inspector shows, the file the diff shows, the checked-out branch |
| Focus | the global ring, drawn inside the row | `:focus-visible`; the row sets `--focus-offset: -2px`, because a list clips anything drawn outside the row |
| Menu open | the panel tone, held | `data-menu-open`, set by `ContextMenuService` |

Selected and current are different things and they combine: a clicked commit is
both. The edge is an inset shadow, so a row never reserves two pixels for a
state it is usually not in. Rows do not transition: a hover that fades trails
behind the pointer.

### Context menus

One component, opened through `ContextMenuService.open(items, anchor, options)`.

- **It says what it acts on.** A menu opened on a commit, a ref, a file, a tab
  or a remote passes a `header`: short sha and subject, ref name, file name and
  folder. Toolbar dropdowns need none — the button is the context.
- **Its origin stays lit.** The row or the button it came from keeps the panel
  tone while the menu is open (`data-menu-open`). A pointer menu finds its row
  by role (`option`, `treeitem`, `tab`); a row without one carries
  `data-menu-target`.
- **Focus comes back.** Closing returns the focus to whatever held it, so a
  keyboard user continues from the same row.
- **A dropdown belongs to its button.** Opened from an element it aligns to
  that element's left edge, to its right edge when it would overflow, and opens
  above it — never over it — when there is no room below.
- **Submenus forgive the diagonal.** An open submenu survives 200 ms of the
  pointer crossing sibling items on its way to it.
- **Items are rows.** They take `--file-row-h`, so a menu is as dense as the
  list it came from; long labels truncate at 28 rem.
- **The option in effect is checked** (`checked`): the current branch, the
  default pull mode. **A shortcut is shown by id** (`shortcutId`) and resolved
  against the registry when the menu opens, so a rebind never leaves a stale
  key; `shortcut` is only for a key the list itself handles (`F2`).
- A destructive item is red and so is its highlight. A disabled item always
  carries its reason.

### Diff viewer

Diffs must prioritize readability over atmosphere.

- Added line background dark: `#0A2A22`; text/accent: `git-added`.
- Deleted line background dark: `#321018`; text/accent: `git-deleted`.
- Current hunk border: cyan.
- Conflict hunk border: sakura pink.
- Code font: `JetBrains Mono`.

There is exactly one viewer element in the app. Its home is the inspector's
diff slot; the diff workspace borrows it through a CDK `DomPortal` and hands it
back on close, which is what keeps the loaded diff, the options bar and the
scroll position identical on both sides. Staging controls follow the diff's
source wherever the element is hosted — none for a commit diff, hunk and line
staging for a working-tree one.

### Branch graph

Branch graph colors should be stable per branch within a session. Use the neon palette for active graph paths and muted moon/ink tones for inactive paths.

The lane palette is exposed as CSS variables so the canvas renderer reads it
once per theme instead of hardcoding hex values:

```css
--graph-lane-1: #00E5FF;
--graph-lane-2: #9B5CFF;
--graph-lane-3: #FF4FB8;
--graph-lane-4: #35F2A2;
--graph-lane-5: #FFD166;
--graph-lane-6: #3B82FF;
```

The current branch path should have the strongest opacity and a subtle glow. Merged or inactive paths should reduce opacity before changing hue.

### Scrollbars

Scrollbars in YoruMerge are a UI surface like any other and must carry the Yoru Night identity: thin, theme-aware, and softly luminous — _neon, but never harsh_. Long Git review sessions mean a resting scrollbar must stay calm; only the hover state may glow.

Every scrollable container in the app uses the shared `.neon-scroll` utility class declared in `src/styles.css`. Feature components MUST NOT redeclare their own `::-webkit-scrollbar` rules — apply `.neon-scroll` on the scroll container instead. This keeps commit lists, working changes, diffs, blame and file history visually coherent.

**Spec**

| State | Track | Thumb fill | Glow |
| --- | --- | --- | --- |
| Resting | transparent | `color-mix(in srgb, var(--app-accent) 18%, var(--app-border))` with 2px transparent inset | none |
| Hover | transparent | `color-mix(in srgb, var(--app-accent) 55%, var(--app-border))` | soft `0 0 6px color-mix(in srgb, var(--app-accent) 30%, transparent)` |
| Active | transparent | `color-mix(in srgb, var(--app-accent) 70%, var(--app-border))` | matches hover |

- Gutter width: `10px` (horizontal + vertical), thumb visually narrows to ~6px via the transparent inset border + `background-clip: padding-box`.
- Thumb shape: pill (`border-radius: 999px`).
- Firefox / GTK parity via `scrollbar-width: thin` + `scrollbar-color` using the same cyan-tinted resting fill.
- Transitions: `160ms ease` for `background-color` + `box-shadow`. Respects the global `prefers-reduced-motion` rule in `styles.css`.

**Usage**

Apply the class to the scrollable element itself — not a parent wrapper:

```html
<cdk-virtual-scroll-viewport class="neon-scroll h-full">…</cdk-virtual-scroll-viewport>

<ul class="neon-scroll flex-1 min-h-0 overflow-y-auto">…</ul>

<div class="neon-scroll diff-content flex-1 overflow-auto">…</div>
```

**Rules**

- DO use `.neon-scroll` on every scrollable surface inside the Yoru Night shell.
- DO let the resting state carry the dark-border tone — the cyan should only whisper.
- DO NOT add a blanket `*::-webkit-scrollbar` global override; the utility is opt-in by class.
- DO NOT raise the cyan opacity above the spec — "neon pero no tan fuerte" is the design intent.
- DO NOT hardcode hex colors; always pull from `--app-accent` / `--app-border` so the utility adapts to the accent preset, to future palette tweaks and to both themes.

A virtual list whose rows truncate also takes `.fit-rows` on its viewport. The
CDK content wrapper is shrink-to-fit, so without it one long name widens the
whole list, the list scrolls sideways and no row ever reaches its ellipsis.
Leave it off only where a row must be free to grow (the blame viewer).

## Do's and Don'ts

### Do

- Default to dark mode and make light mode equally intentional.
- Use cyan for primary focus, selected state, and sync actions.
- Use sakura pink rarely so conflict states feel urgent.
- Keep Git semantic colors consistent everywhere.
- Use blur, alpha borders, and radial gradients for atmosphere.
- Use `JetBrains Mono` for hashes, file paths, diffs, and branch names.
- Prefer subtle animation: glow pulse on live fetch, row slide-in, command palette fade.

### Don't

- Do not turn every element neon.
- Do not use warm beige, generic purple-on-white SaaS styling, or flat black backgrounds.
- Do not use display fonts for tables, diffs, or long labels.
- Do not encode Git state by color alone; include icons, labels, or text where needed.
- Do not use heavy borders or skeuomorphic chrome.
- Do not let background effects compete with code diffs.
- Do not use emoji or unicode glyphs as icons — Lucide via `<ng-icon>`, always.
- Do not dim text with `opacity-*`; step down to the next text token.
- Do not spend the glow budget on anything but HEAD and the focused primary action.

## Tailwind CSS 4 Implementation

YoruMerge uses Tailwind CSS 4. Put these tokens in `src/styles.css` near the Tailwind import, then build component classes from the generated utilities.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-yoru-950: #050712;
  --color-yoru-900: #080B18;
  --color-yoru-800: #12162A;
  --color-yoru-700: #1A2038;
  --color-yoru-600: #252D4A;

  --color-yuki-50: #F7FAFF;
  --color-yuki-100: #EEF4FF;
  --color-yuki-200: #E3ECFB;
  --color-yuki-300: #B9C8E8;

  --color-ink-950: #101426;
  --color-ink-700: #24314F;
  --color-ink-600: #465A7F;

  --color-moon-50: #F4F8FF;
  --color-moon-100: #DDEAFF;
  --color-moon-200: #AFC8F7;
  --color-moon-300: #7EA6EF;

  --color-neon-cyan: #00E5FF;
  --color-neon-blue: #3B82FF;
  --color-neon-violet: #9B5CFF;
  --color-neon-pink: #FF4FB8;

  --color-sakura-300: #FF9BD2;
  --color-sakura-400: #FF6FBE;
  --color-sakura-500: #FF3FA4;

  --color-git-added: #35F2A2;
  --color-git-modified: #FFD166;
  --color-git-deleted: #FF4D5E;
  --color-git-renamed: #00E5FF;
  --color-git-conflict: #FF4FB8;

  --font-display: "Zen Dots", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", "Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;

  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Follows the theme through --app-shadow-panel. */
  --shadow-panel: var(--app-shadow-panel);
  --shadow-accent: 0 0 24px color-mix(in srgb, var(--app-accent) 28%, transparent);
  --shadow-neon-pink: 0 0 24px rgb(255 79 184 / 0.25);
  --shadow-light-panel: 0 18px 50px rgb(24 45 90 / 0.14);
}
```

### Theme variables

Use CSS variables for semantic roles so Angular components do not hard-code theme decisions.

```css
:root {
  color-scheme: light;
  --app-bg: #F7FAFF;
  --app-surface: #FFFFFF;
  --app-surface-raised: #EEF4FF;
  --app-panel: #E3ECFB;
  --app-border: #B9C8E8;
  --app-text: #101426;
  --app-text-muted: #465A7F;
  --app-text-faint: #546889;
  --app-conflict-text: #B0116A;
  --app-shadow-panel: 0 18px 50px rgb(24 45 90 / 0.14);
}

.dark {
  color-scheme: dark;
  --app-bg: #050712;
  --app-surface: #080B18;
  --app-surface-raised: #12162A;
  --app-panel: #1A2038;
  --app-border: #252D4A;
  --app-text: #F4F8FF;
  --app-text-muted: #AFC8F7;
  --app-text-faint: #7E93B8;
  --app-conflict-text: #FF4FB8;
  --app-shadow-panel: 0 24px 80px rgb(0 0 0 / 0.45);
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-body);
}
```

### Tailwind usage examples

```html
<div class="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-body">
  <aside class="border-r border-[var(--app-border)] bg-[var(--app-surface)]">
    <!-- repositories -->
  </aside>

  <section class="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-panel dark:shadow-panel">
    <!-- commit graph -->
  </section>
</div>
```

```html
<span class="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-1 font-mono text-xs text-neon-cyan">
  main
</span>
```

```html
<span class="text-git-added">+24</span>
<span class="text-git-deleted">-8</span>
<span class="text-[var(--app-conflict-text)]">conflict</span>
```

### Angular theme toggling

Apply `.dark` to the document root or app shell. Persist the selected mode in the Tauri store when theme settings are implemented.

```ts
document.documentElement.classList.toggle('dark', theme === 'dark');
```

Theme modes to support:

- `system`: follow OS preference.
- `dark`: force Yoru Night.
- `light`: force Moonlit Workbench.

The class is applied **before the first paint** by
`src/assets/theme-preboot.js`, a render-blocking script in `index.html`, so
launching the app never flashes the wrong background. It reads the same
`localStorage.theme` key as `ThemeService`; if you change one, change the other.
It is a file rather than an inline script because the Tauri CSP is
`script-src 'self'`.

## Accessibility

- All text/background combinations for primary surfaces must target WCAG AA contrast. Use `--app-text-faint` instead of stacking `opacity-*` on muted text.
- Do not rely on color alone for Git states; pair colors with icons, labels, diff markers, or badges.
- Focus rings are global: `styles.css` declares one `:focus-visible` rule (2 px accent, 2 px offset). Do not remove or override it per component. The ring follows the element's own radius; the 4 px default corner lives in `@layer base` so it applies only to an element that has none, and focus never reshapes a pill or a button. The one thing a component may change is where the ring sits, through `--focus-offset`: rows turn it inward (`-2px`) and text fields by one pixel, because both live in boxes that clip.
- Disable intense glow animations when `prefers-reduced-motion: reduce` is active.
- The in-app animations preference (`:root[data-animations="off"]`) also drops
  `backdrop-filter` on the dialog and command-palette scrims. Backdrop blur is
  re-rasterised on every repaint of the window beneath it, which on WebKitGTK
  costs a full-window blur per keystroke in the palette. Atmosphere is the only
  thing lost: those panels sit on an opaque `--app-surface-raised`, and no text
  is ever placed on the scrim itself, so contrast is unaffected. Any new surface
  that relies on blur for legibility must not — give it an opaque background.
- Diff backgrounds must remain readable for long sessions; never place decorative gradients behind code lines.

Recommended reduced motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Keyboard

**Escape closes exactly one layer.** The app has one `keydown` listener for
Escape (`core/services/escape-layers.service.ts`). A dismissable surface
registers a callback at a fixed rank while it is open, and the highest open
rank wins; nothing else may listen for Escape.

| Rank | Layer | What Escape does |
| --- | --- | --- |
| 6 | dialog | closes the dialog |
| 5 | command palette | closes the palette |
| 4 | text field that declares `data-escape-clears`, with content | clears the value and keeps focus — built in, nothing registers it; any other field falls through to the next layer |
| 3 | diff line selection | clears the selection |
| 2 | stacked blame or file history | closes that panel |
| 1 | diff workspace | closes it and restores the previous view |

Two surfaces stay outside the registry on purpose. The context menu keeps its
own two-level Escape and consumes the event on its own element, so the service
skips a press that was already handled. Tooltips hide passively and register
nothing.

**Shortcuts of the inspector and the diff workspace.** Both the command palette
and *Settings › Keyboard* render `KeyboardShortcutsService`, so a combo written
here is the combo the app shows. `mod` is `Ctrl`, `Cmd` on macOS builds; the
full user-facing list lives in [README.md](README.md).

| Id | Combo | Label |
| --- | --- | --- |
| `diff.next-hunk` | `n` | Next hunk |
| `diff.previous-hunk` | `p` | Previous hunk |
| `diff-workspace.open` | `mod+d` | Open in diff workspace |
| `diff-workspace.close` | `escape` | Close diff workspace |
| `diff-workspace.next` | `shift+n` | Next file |
| `diff-workspace.prev` | `shift+p` | Previous file |
| `inspector.toggle-header` | `mod+shift+h` | Collapse or expand commit header |
| `inspector.toggle-files` | `mod+shift+l` | Collapse or expand commit file list |

Hunk navigation keeps the bare `n` / `p`: modifier matching is exact, so the
workspace's `shift+n` / `shift+p` do not collide with it. Escape is never a
command shortcut — `diff-workspace.close` is registered so the help lists it
and never runs; the dismissal is the rank-1 layer above.

## Naming Guidance

Use theme names that reinforce the product identity:

- **Yoru Night:** default dark theme.
- **Moonlit Workbench:** light theme.
- **Sakura Conflict:** conflict state language.
- **Neon Current:** active branch / selected commit state.
- **Ghost Remote:** remote branch or stale reference state.

Use this file as the design source of truth. If Tailwind tokens, CSS variables, or component styling drift from this document, update `DESIGN.md` first and then propagate the change to implementation.
