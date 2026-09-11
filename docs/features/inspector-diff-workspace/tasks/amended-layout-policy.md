---
id: T34
title: "Rewrite the layout policy around the commit file list as the protected block"
layer: "domain"
deps: []
acs: ["AC-03", "AC-04", "AC-18", "AC-19"]
files_hint: ["src/app/core/services/inspector-layout.ts", "src/app/core/services/inspector-layout.spec.ts"]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T34 — Rewrite the layout policy around the commit file list as the protected block

## Why

The owner reversed the composition of the History inspector on 2026-09-07: it hosts no diff viewer at all — [spec AC-06, AC-22](../spec.md) and the reversal in [spec §8](../spec.md). [ADR-0004's amendment](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md) keeps the decision (a pure-TS policy fed by a `ResizeObserver`) and changes only *what the policy protects*. The module still implements the old subject, and `commit-inspector.ts:597` compensates by adding `Math.floor(layout.diffHeight / fileRowH)` to the row count — the policy lies and the caller patches it.

## What

- The protected block becomes the commit file list: the 50 % / 75 % floors keep their numbers and their measurement ([spec §6](../spec.md)), but they are floors on the list's share.
- Invert the yield order (AC-03): the body clamp shrinks first to `CLAMP_LINES_FLOOR`, then `headerMaxH` binds and the expanded header scrolls inside its cap; the list is the last block to give anything up and never drops under `LIST_ROWS_FLOOR`.
- Drop `MAX_LIST_ROWS` (AC-04): the list is the growing child and shows as many rows as the column fits; the 2-row floor stays, and the exact-count and 0-file cases are unchanged.
- `diffHeight` stops being an output the History view consumes. The stacked-panel rule (AC-19) and the bottom placement (AC-18) run the same policy over the remainder as today.
- Rewrite every row of `inspector-layout.spec.ts` that asserts `diffHeight` or the 6-row cap against the list's share. The numbers do not change, the subject does.

## Definition of Done

- [ ] `inspector-layout.spec.ts` passes the table of spec configurations with the list as the subject: 30 files at 960 × 640 with a long body yield clamp → header cap and never fewer than 2 rows; exact rows for 1–6 files; 0 rows for 0 files; no upper cap for 7+ files; list share ≥ 50 % expanded and ≥ 75 % collapsed; stacked shares fixed off the top; both density token sets.
- [ ] `MAX_LIST_ROWS`, `DIFF_SHARE_FLOOR`'s diff framing and the `diffHeight` output are gone; no consumer of `diffHeight` is left in `src/app` (grep clean).
- [ ] No `@angular/core` import — the module stays in the pure-TS tier ([sad §2](../sad.md)).
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean.

## Notes

`commit-inspector.ts` compiles against the removed field, so it cannot stay green alone: T34 and T35 are a **compile-coupled lane** through `inspector-layout.ts` and may close with one shared gate and commit.

## Outcome (2026-09-07)

Landed in `a1694d7` with T35 (compile-coupled lane — see that task file).
`inspector-layout.spec.ts` went from 19 rows asserting the diff's share to 19
asserting the list's; RED was GOOD (13 failed / 6 passed, every failure an
assertion, none a compile error), first failing line
`expect(result.listRows).toBe(6)` — received 2, the old policy starving the
list to protect the diff.

`MAX_LIST_ROWS`, `DIFF_SHARE_FLOOR` and the `diffHeight` output are gone;
`grep diffHeight src` is clean. The expected table was derived from the
amended ACs before the module was touched, and checked for floor violations
across 144 configurations (0 found).
