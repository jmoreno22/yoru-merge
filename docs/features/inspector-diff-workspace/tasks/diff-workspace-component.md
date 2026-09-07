---
id: T7
title: "Build the diff workspace component"
layer: "ui"
deps: ["T5", "T6"]
acs: ["AC-06", "AC-07", "AC-10", "AC-11", "AC-12", "AC-14", "AC-20"]
files_hint: ["src/app/features/diff-workspace/"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T7 — Build the diff workspace component

## Why

The centre-view state needs its thin host: a strip and a portal outlet, the rank-1 Esc layer and the file-navigation shortcuts — [sad §5 tree `features/diff-workspace/`](../sad.md), [ADR-0003](../adr/0003-re-host-the-single-diff-viewer-instance-with-a-cdk-dom-portal.md), [screens SCR-02, SCR-04, SCR-05](../screens.md).

## What

New `src/app/features/diff-workspace/diff-workspace.ts` + `.html` (standalone, OnPush), composing only existing primitives (screens §New components: none):

- **Strip** at `--panel-head-h`: `existing: diff-source-chip` («COMMIT» with short sha + subject, or «STAGED» / «UNSTAGED» with `data-side`), file path (mono, dirname faint / basename strong, truncate, rendered as text), spacer, `yoru-button` ghost sm icon-only × 3 with `yoruTooltip` + `yoru-kbd`: Previous file (`lucideChevronLeft`, disabled when `!canPrev`), Next file (`lucideChevronRight`, disabled when `!canNext`), Close (`lucideX`). Test ids `diff-workspace`, `diff-workspace-source`, `diff-workspace-path`, `diff-workspace-prev`, `diff-workspace-next`, `diff-workspace-close`, `diff-workspace-outlet`.
- **Outlet**: `CdkPortalOutlet` filling the rest; the `DomPortal` itself is created and attached by T8.
- While open: register the **rank-1 Esc layer** (T5 helper) and `diff-workspace.close` (`escape`, help row only — dismissal is the layer), `diff-workspace.next` (`shift+n`, `when: canNext`), `diff-workspace.prev` (`shift+p`, `when: canPrev`) through `KeyboardShortcutsService`; unregister on destroy.
- **States** per screens: SCR-02 default · edge first / last · loading·navigate (content swap, no skeleton) · error·not text / commit removed (rendered by the hosted viewer's existing empty branch; strip stays, both edges disabled on an empty file list); SCR-04 default · edge · refreshing (hosted viewer's `busy`). No staging control in the strip — staging lives in the hosted viewer and is gated by `diffSource` (AC-14 structural).

## Definition of Done

- [ ] `pnpm build` green with `strictTemplates`; `pnpm lint` green.
- [ ] Keyboard settings page lists the six rows of SCR-05 (with T9 / T11 toggles), «Next hunk n» / «Previous hunk p» unchanged (AC-12).
- [ ] Manual (after T8): Esc with a dialog / palette / filter text / line selection / stacked blame open leaves the workspace open; with none open closes it (AC-10). `shift+n` on the last file does nothing, control disabled (AC-11).
- [ ] Manual: a binary file shows the viewer's «Binary file…» explanation under the strip, never an empty centre (AC-07).

## Notes

Nothing in this folder knows about trees, sides or the DOM of the lists — file order comes from the owning list through the service (sad §5). Heights only from `--panel-head-h` / `--panel-pad`; in-flow, no z-index (AC-20, DESIGN.md §Z-layers).
