# Iconography

Icons come from [`@ng-icons/lucide`](https://ng-icons.github.io/ng-icons/). Never
use emoji or unicode glyphs (`⎇`, `✕`, `▾`) in templates — they render
differently on Windows and Linux and cannot be styled.

## Setup

`provideYoruIcons()` is registered once in `app.config.ts`. It provides the whole
curated set plus the defaults (`size: '16px'`, `strokeWidth: '1.75'`), so any
component can render an icon with nothing but the component import:

```ts
import { NgIcon } from '@ng-icons/core';

@Component({ imports: [NgIcon], /* … */ })
```

```html
<ng-icon name="lucideGitBranch" size="14px" aria-hidden="true" />
```

Component-level `viewProviders: [provideIcons({ … })]` **merges** with the global
set (ng-icons resolves the parent map with `skipSelf`), so a component may add
icons locally, but everything shared belongs in `icons.ts`.

## Sizes and stroke

| Context | Size | Notes |
| --- | --- | --- |
| Inline in rows, menu items, badges, chips | `14px` | never larger — 34 px rows get noisy |
| Toolbar buttons, icon rail, panel headers | `16px` | the global default |
| Empty states | `18px` | paired with the kanji watermark |

Stroke width is `1.75` everywhere. Icons are decorative by default: add
`aria-hidden="true"` and let the adjacent text carry the meaning. When an icon is
the only content of a control, the control needs an `aria-label`.

Icons never encode state on their own either — colour + icon + text together
(DESIGN.md › Accessibility).

## Git concept → icon

| Concept | Icon |
| --- | --- |
| Branch (local) | `lucideGitBranch` |
| Create branch | `lucideGitBranchPlus` |
| Merge | `lucideGitMerge` |
| Rebase | `lucideGitPullRequestArrow` |
| Commit | `lucideGitCommitHorizontal` |
| Compare refs | `lucideGitCompareArrows` |
| Fork / worktree root | `lucideGitFork` |
| Cherry-pick | `lucideCherry` |
| Revert | `lucideUndo2` |
| Reset | `lucideRotateCcw` |
| Squash / fixup | `lucideScissors` |
| Stash | `lucideArchive` |
| Tag | `lucideTag` (one) · `lucideTags` (section) |
| Remote (host) | `lucideGlobe` |
| Fetch / pull | `lucideCloudDownload` |
| Push | `lucideCloudUpload` |
| Upstream set / unset | `lucideLink` / `lucideUnlink` |
| Refresh | `lucideRefreshCw` |
| Reflog / history | `lucideHistory` |
| Worktree | `lucideLayers` |
| Submodule | `lucidePackage` |
| Repository | `lucideDatabase` |
| Conflict | `lucideTriangleAlert` |
| Signed commit | `lucideShieldCheck` |
| Author | `lucideUser` |
| Detached HEAD / current ref | `lucideCircleDot` |
| Sequencer continue · skip · abort | `lucidePlay` · `lucideSkipForward` · `lucideBan` |

## File status → icon

| Status | Icon | Colour token |
| --- | --- | --- |
| Added | `lucideFilePlus` | `--color-git-added` |
| Modified | `lucideFileDiff` | `--color-git-modified` |
| Deleted | `lucideFileMinus` | `--color-git-deleted` |
| Renamed / copied | `lucideFile` | `--color-git-renamed` |
| Conflicted | `lucideFileX` | `--color-git-conflict` |
| Untracked | `lucideFile` | `--app-text-muted` |
| Ignored / assume-unchanged | `lucideEyeOff` | `--app-text-faint` |

## Substitutions

None. Every name in the plan exists in `@ng-icons/lucide` 35.1.0 and is exported
verbatim.

Ten icons were **added** beyond the plan's list because the feature
inventories need them: `lucideGlobe`, `lucideCloudUpload`, `lucideFolderTree`,
`lucideList` (tree/list toggles), `lucideEye`, `lucidePlay`,
`lucideSkipForward`, `lucideBan` (sequencer banner), `lucideGripVertical`
(reorder handles) and `lucideClock` ("fetched 4 m ago").

The map lists only icons the app actually registers. Nine that no longer had a
single call site were dropped from `icons.ts`, so a concept missing from the
table means no screen shows it yet — add the icon and the row together.
