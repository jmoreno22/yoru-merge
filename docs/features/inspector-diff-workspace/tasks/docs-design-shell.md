---
id: T14
title: "Document the inspector layout, the diff workspace and the Esc layer order"
layer: "docs"
deps: ["T8", "T12", "T13"]
acs: ["AC-10", "AC-12"]
files_hint: ["DESIGN.md", "docs/screenshots/"]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T14 — Document the inspector layout, the diff workspace and the Esc layer order

## Why

`DESIGN.md` §App shell is the canonical description of the workbench vocabulary the spec traces to; the shipped behaviour (content-sized inspector blocks, the diff workspace centre state, the six Esc ranks) must be readable there for the next feature — [spec §1 traceability](../spec.md), [sad §2 conventions, §8 Keyboard](../sad.md).

## What

- `DESIGN.md` §App shell: the inspector column as header (collapsible) / file list (bounded, collapsible) / diff slot (`flex-1`, floor 50 %) / stacked panels; the diff workspace as a centre-view state (not a route, window, tab or overlay) that restores selection, scroll and focus.
- `DESIGN.md` §Density: the two new CSS variables the layout policy sets (`--inspector-list-rows`, `--inspector-clamp-lines`) and the rule that `--file-row-h` stays pinned.
- `DESIGN.md` keyboard / accessibility notes: the Esc layer order (dialog › palette › text field with content › line selection › stacked panel › diff workspace) and the six new shortcut rows of SCR-05.
- Refresh the History and Changes screenshots in `docs/screenshots/` that show the old two-to-three inspector split.

## Definition of Done

- [ ] `DESIGN.md` describes the three items above; no stale mention of `flex-[2] / flex-[3]` for the inspector remains.
- [ ] Screenshots that showed the old inspector are replaced; `README` links still resolve.
- [ ] Biome / markdown lint (if configured) green.

## Notes

Docs only — no code. The spec-level measurements (height shares, Esc matrix, layout shift, 150 ms) are recorded by `review`, not here.

**Files beyond `files_hint`:** `README.md` — its shortcut table is the single list the app's command palette traces to, so the six new combos documented in `DESIGN.md` §Keyboard had to be mirrored there too, or the table would go stale on day one.
