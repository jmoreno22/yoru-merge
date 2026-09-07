---
id: T15
title: "Enable the component test tier in the existing unit runner"
layer: "infra"
deps: []
acs: []
files_hint: [
  "vitest.config.ts",
  "package.json",
  "tsconfig.spec.json",
  "angular.json",
  "src/testing/",
  "AGENTS.md",
  ".claude/sdd.local.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T15 — Enable the component test tier in the existing unit runner

## Why

The test plan makes the component tier `Yes` (owner decision 2026-09-03) and names one tooling task before the first UI task; it never reached `tasks.json`, so 18 of 21 ACs shipped without a UI-level assertion — [review 2026-09-03 F-9](../_review/review-2026-09-03.md), [test-plan §Levels, §CI placement](../test-plan.md).

## What

- Let `pnpm test` compile and run Angular component specs. `@angular/build` 22 (the `unit-test` builder) and `jsdom` are already dev dependencies; pick the path that keeps the pure-TS specs in the `node` environment and their runtime unchanged.
- A component spec opts into the DOM with the existing first-line docblock (`// @vitest-environment jsdom`) and may import `@angular/core`.
- `src/testing/`: a `ResizeObserver` stand-in (the simulated DOM has none) and a typed stub of the `invoke` wrapper, the single IPC seam the SAD names.
- Amend the testing policy lines: `AGENTS.md` §TESTING, the `vitest.config.ts` docblock, `.claude/sdd.local.md` (component specs may import the framework; pure-TS specs stay as they are).

## Definition of Done

- [ ] A smoke component spec (TestBed rendering an existing small component) passes under `pnpm test` next to the 727 pure-TS tests.
- [ ] `src/testing/` exports the `ResizeObserver` stand-in and the `invoke` stub.
- [ ] `AGENTS.md`, `vitest.config.ts`, `.claude/sdd.local.md` amended; `pnpm lint` and `pnpm build` green.

## Notes

Boot cost of the DOM environment is accepted (~20 s per run, test-plan §CI placement). No task other than T24 / T25 writes component specs.

**Files beyond `files_hint`:** `tsconfig.app.json` — `src/testing/**` has to leave the app compilation, one exclude line.
