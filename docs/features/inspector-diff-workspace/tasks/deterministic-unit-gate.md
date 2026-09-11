---
id: T43
title: "Make the unit gate deterministic: run spec files serially"
layer: "infra"
deps: []
acs: []
files_hint: [
  "vitest.config.ts",
  "docs/features/inspector-diff-workspace/_review/review-2026-09-08.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T43 — Deterministic unit gate

## Why

Found while running T40's RED step, not by a reviewer: **the suite is not deterministic**, and it has not been for some time. Under vitest's default file-level parallelism, between one and four component specs fail at random. Measured on `228ab35` — the tree [review round 8](../_review/review-2026-09-07-round8.md) passed as «831 tests green» — with `src` byte-clean:

```
parallel run 1 → 1 failed / 830 passed
parallel run 2 → 831 passed
parallel run 3 → 4 failed / 827 passed
```

and on the same tree with `fileParallelism: false`:

```
serial run 1 → 831 passed
serial run 2 → 831 passed
serial run 3 → 831 passed
```

The affected specs are the five that wait on an asynchronous render — `commit-list.spec.ts` AC-08 (the T27 focus-restore row), `main-content.spec.ts` AC-06, `diff-workspace.spec.ts` AC-06, `working-changes.spec.ts` AC-13 and `commit-inspector.spec.ts` AC-01. All of them depend on `afterNextRender`, the CDK `DomPortal` or the virtual viewport landing inside a window that a competing fork can take away. No pure-TypeScript (`node` environment) spec ever failed across nine runs.

**What this costs the record.** Every «831 green» in rounds 6–9 was measured under parallelism, so those were lucky runs rather than proof. The named single-point mutations those rounds turned on are unaffected — each reddened a specific row that matched the mutation, and the flaky set is a different, identifiable family — but the two round-9 findings whose *evidence* is «the mutation leaves 831/831 green» (R9-S2-F1, R9-S2-F2) had to be re-measured serially. They were, and both hold. Round 8's «two reviewers agree on every value» also holds, for the same reason: they agreed on the named failures.

## What

- **`vitest.config.ts`** — add `fileParallelism: false` to the `test` block, with a comment carrying the measurement above so the next reader does not «optimise» it back. This is the whole change.
- **`_review/review-2026-09-08.md`** — add the finding, its measurement and what it means for the earlier gate numbers. Rounds 6–8's records are **not** rewritten: they are the record of what was measured at the time, the rule the team settled in round 7 (S4).
- **`tasks/tracker.md`** — one line in the round-9 note so the next wave knows the gate is serial and why.

## Definition of Done

- [ ] Three consecutive `pnpm test` runs at HEAD report 63 files / all green, with the same test count each time.
- [ ] The comment in `vitest.config.ts` states the measurement, not just the setting.
- [ ] The round-9 review record carries the finding and its consequence for the rounds 6–9 gate numbers.
- [ ] `pnpm lint` green; no `src/` change.

## Notes

Deliberately **not** the root fix. The five specs are timing-dependent, and making them render-deterministic is the real repair — the owner weighed it and chose the one-line safety net now, because four earlier rounds were already spent inside that component tier and an unreliable gate blocks every task in this wave. If the serialization is ever to be reverted, those five specs have to become deterministic first.

The commit must carry `SDD-Task: T43`; it satisfies no acceptance criterion, so it carries no `SDD-AC` trailer.
