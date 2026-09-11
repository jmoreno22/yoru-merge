---
id: T36
title: "Cover the open-behaviour control and its durable preference"
layer: "ui"
deps: ["T35"]
acs: ["AC-22"]
files_hint: ["src/app/features/commit-inspector/commit-inspector.spec.ts", "src/app/features/commit-inspector/commit-inspector.ts", "src/app/features/commit-inspector/commit-inspector.html", "src/app/core/services/preferences-schema.spec.ts"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T36 — Cover the open-behaviour control and its durable preference

## Why

[AC-22](../spec.md) reverses the 2026-09-02 «gesture only» resolution in [spec §8](../spec.md): the file list header carries a control that switches what a single click does, and the choice is remembered across restarts like the two collapse states (T4). `2049df4` landed the production side — `commitFileClickOpensWorkspace` in the preferences schema, defaulting to `true`, and the `mode-button` in `commit-inspector.html` — with no test behind it; the schema spec gained one line (the default) and nothing else.

## What

- Component rows over both modes: with the preference on, a single click on a file row opens the diff workspace; with it off, the same click only makes the row active and the workspace stays closed.
- A row asserting the control shows which of the two is active (its `aria-pressed` / label names the live mode, not the mode a click would switch to).
- A row asserting the control changes nothing else: double-click, the open-large control and `mod+d` open the workspace in **both** modes.
- `preferences-schema.spec.ts`: round-trip `commitFileClickOpensWorkspace`, assert the default `true`, and assert `sanitizePreferences` rejects a non-boolean and falls back to the default.

## Definition of Done

- [ ] The four groups above pass, each row naming AC-22.
- [ ] Toggling the control writes the preference through the same durable path as `commitHeaderCollapsed` (asserted, not assumed), and a re-created component reads the persisted value.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean.

## Notes

Serialized with T35 through `commit-inspector.spec.ts`. If a row exposes a gap in the shipped control (a missing `aria-pressed`, a mode that swallows the double-click), fix it here and record the production file in this task file — the rest of the wave is test-only.

## Outcome (2026-09-07)

Landed in `4f2357d`. **No RED was reachable:** AC-22's production code — the
preference, the control, and the branch in the click handler — all shipped in
`2049df4` without tests, so the eight rows characterise existing behaviour
rather than drive it. Each was verified against the mutation it advertises:

| Mutation | Rows reddened |
| --- | --- |
| `if (this.clickOpensWorkspace())` → `if (false)` | the preference-on click row |
| `[attr.aria-pressed]` dropped from the control | the live-mode row + the durable-write row |
| `toggleClickOpens()` emptied | the live-mode row + the durable-write row |
| the row's `(dblclick)` binding removed | the both-modes row (plus two pre-existing AC-06 rows) |

All four were run and the tree restored from a copy each time. No production
file needed a change — no gap was found.
