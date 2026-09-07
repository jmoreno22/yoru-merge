---
id: T9
title: "Make the commit header collapsible with a clamped body"
layer: "ui"
deps: ["T4"]
acs: ["AC-01", "AC-02", "AC-12", "AC-20"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.ts",
  "src/app/features/commit-inspector/commit-inspector.html",
  "src/app/features/commit-inspector/commit-inspector.css"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T9 — Make the commit header collapsible with a clamped body

## Why

The header opens expanded with the body clamped to four lines, collapses into one summary line, and paints directly in its remembered state — [spec AC-01, AC-02](../spec.md), [sad §6 F1 / F2](../sad.md), [screens SCR-01 default · body-expanded · header-collapsed](../screens.md).

## What

In `features/commit-inspector/`:

- **Expanded** (W-01a): body wrapped in a block whose `-webkit-line-clamp` is driven by a CSS variable `--inspector-clamp-lines` (default 4; T11 sets it from the policy); «show more» as `yoru-button` ghost sm text (`data-testid="inspector-show-more"`) shown only when the body overflows the clamp; pressing it removes the clamp in place (body-expanded). Collapse control `yoru-button` ghost sm icon-only `lucideChevronUp` + `yoruTooltip` (`inspector-collapse-header`).
- **Collapsed** (W-01b top line): one row at `--panel-head-h` with `yoru-avatar` (16), subject (truncate), author (muted), `existing: sha-chip`, expand control `lucideChevronDown` (`inspector-expand-header`). Action icons are T10 — leave a slot.
- State from `PreferencesService.commitHeaderCollapsed`, read synchronously at render, written on toggle. Register `inspector.toggle-header` (`mod+shift+h`, «Collapse or expand commit header», `when: commit selected`).
- Density: every fixed height from `--panel-head-h` / `--panel-pad`; light theme via `--app-*` tokens only (AC-20).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Manual: long-body commit → 4 lines + «show more»; short body → no reserved height, no control (AC-01). Toggle → summary line; toggle again → previous state (AC-02).
- [ ] Manual: set collapsed, restart the app, select a commit → header paints collapsed with 0 px shift between first frame and settled (NFR); the same expanded.
- [ ] Keyboard settings page lists «Collapse or expand commit header · Ctrl+Shift+H» (AC-12).

## Notes

First of the `commit-inspector` lane (T9 → T10 → T11 → T12). Do not touch the file-list block here.
