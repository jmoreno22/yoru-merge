---
id: T10
title: "Put the six commit actions inline in the collapsed header with overflow into More"
layer: "ui"
deps: ["T9"]
acs: ["AC-21"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.html"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T10 — Put the six commit actions inline in the collapsed header with overflow into More

## Why

Collapsing must never hide an action: the six buttons sit inline as icons, overflow into More by measured width, and Reset keeps its confirmation — [spec AC-21](../spec.md), [sad §6 F3](../sad.md), [screens SCR-01 header-collapsed, SCR-06](../screens.md).

## What

In the collapsed summary line slot left by T9: six `yoru-button` ghost sm icon-only with `yoruTooltip` + `aria-label` — Branch `lucideGitBranchPlus`, Tag `lucideTag`, Cherry-pick `lucideCherry`, Revert `lucideUndo2`, Reset `lucideRotateCcw`, More `lucideEllipsisVertical` — each calling the same `CommitActions` handler as the expanded header. A `ResizeObserver` on the actions container computes how many icons fit; those that do not move into the More menu (`ContextMenuService`), where Reset is an entry with the Soft / Mixed / Hard… children (one submenu level, Hard `tone: danger`), running through the existing Reset path and its confirmation (W-06a).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: wide inspector → six icons inline, one click each; narrow inspector (drag the splitter) → trailing actions move into More, none disappears (AC-21).
- [ ] Manual: Reset inline and Reset via More both open the Soft / Mixed / Hard menu; Hard opens the existing danger confirmation; cancel leaves the summary line unchanged (SCR-06).
- [ ] No new shortcut registered for any commit action ([spec §6.1](../spec.md)).

## Notes

Second in the `commit-inspector` lane. Reuse `commit-menu.ts` entries where the expanded header already builds the More menu — do not duplicate the item list.

**Files beyond `files_hint`:** `src/app/features/commit-list/commit-menu.ts` — adds `promoteMenuItems`, the helper that lifts the actions the collapsed header's `ResizeObserver` could not fit inline to the top of the More menu. `src/app/features/commit-list/commit-actions.service.ts` — `CommitActions`'s menu-open method is the one place that builds and opens the More menu for both the collapsed and expanded headers, so it needed a new `promote` parameter to call `promoteMenuItems`.
