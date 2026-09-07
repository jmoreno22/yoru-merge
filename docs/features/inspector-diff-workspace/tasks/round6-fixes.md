---
id: T32
title: "Round-6 fixes: drop the unfailable focus line from the Q2 row and correct the two documents that report V4 closed"
layer: "app"
deps: ["T31"]
acs: ["AC-08"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/round5-fixes.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T32 — Round-6 fixes

## Why

The sixth review of 2026-09-07 found V1, V2, V3 and V5 of round 5 genuinely closed — each with the mutation that turns its new pin red, executed rather than reasoned — but V4 open: T31 replaced one assertion that could not fail with another — [review round 6, F1 / S1](../_review/review-2026-09-07.md).

The expiry lives in the `index < 0` branch of the inspector's restore effect (`commit-inspector.ts:337-348`): it calls `focusRestored(key)` and returns, never focusing anything, and `focusVirtualRow` is unreachable while `index < 0`. So in the state that row drives, focus sits on `document.body` whether or not the key expires. The stage-1 reviewer proved it: with the expiry removed the row fails at `:738`, and a temporary probe kept alongside that mutation confirmed `host.contains(document.activeElement)` is still `false` with the key unexpired. Two documents report the item as fixed.

## What

No production change; one assertion removed and two documents corrected:

- **Drop the line (V4, AC-08)** — `commit-inspector.spec.ts:739-742`: remove `expect(host.contains(document.activeElement)).toBe(false)` and the three-line comment that calls it «the failable half». Leave a short note saying why the focus half is unobservable while the emptied list draws no rows, so the next reader does not re-add it: the proof that an expired key does not steal the focus is the closing block at `:750-755`, which observes a drawn row. `expect(workspace.pendingFocusKey()).toBeNull()` at `:738` stays untouched — it and `:750-755` are the mutation-verified halves.
- **`test-plan.md:111`** — the expected column claims «the Q2 row asserts the active element rather than an empty list» and the behaviour column claims «the new rows carry no assertion that cannot fail». Both describe the line this task removes; restate the row as what actually holds (the cap's literal and the single injection), and move the Q2 row's proof to `pendingFocusKey()` plus the returning-path block.
- **`tasks/round5-fixes.md:33`** — the V4 bullet offered «assert that `document.activeElement` is not a file row, or drop the line». Record which option landed and why the first one is not available here: no path in this panel focuses anything while `index < 0`, so any assertion on where the focus went passes in both branches.

## Definition of Done

- [ ] The Q2 row (`commit-inspector.spec.ts`, AC-08) carries no assertion that passes in both branches of the expiry; removing `focusRestored` from `commit-inspector.ts:345` still turns the row red at `pendingFocusKey()`, and the returning-path block still asserts nothing took the focus — verify both by running the mutation, not by reading.
- [ ] `test-plan.md:111` and `tasks/round5-fixes.md:33` describe what landed; neither claims a closed assertion that is gone.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean; no `src-tauri` change.
- [ ] Any file outside `files_hint` recorded in a «Files beyond `files_hint`» note here.

## Notes

The stage-2 reviewer's supporting claim that the host has «no focusable fallback» is imprecise — `commit-inspector.html` has seven native `<button>`s — but it does not change the finding: nothing on the restore path moves focus into the panel, so the assertion cannot fail for the mutation it was advertised against. Keeping the line with a corrected comment was the alternative the owner declined; the removal is the option T31's own task file already allowed.

Round-6 S2 (`WORKING_SIDES` still compiles if the source union gains a side) and S3 (the new `WorkingSide` alias duplicates the one exported from `features/working-changes/file-row.ts:39`) are owner-declined, not work — see the review record.

**DoD outcome (review round 7, T33).** Bullet 1 held in one half only. Dropping `focusRestored` from the `index < 0` arm does redden the row at `pendingFocusKey()` — verified again in T33 (1 failed / 27 passed, `expected 'b.ts' to be null`). The other half — «the returning-path block still asserts nothing took the focus» — was disproved: with that arm removed and the first assertion probed, the block reported `{pending: null, focusedTheRow: false, active: "BODY", hasRow: true}` and stayed green, because the normal arm consumes the key and `focusVirtualRow`'s deferred `.focus()` never lands on the viewport the emptied list re-created. So `focusedTheRow` was the same class of assertion as the line this task removed, and [T33](./round7-fixes.md) removed it too. This DoD is left as written — it is the record of what was asked.
