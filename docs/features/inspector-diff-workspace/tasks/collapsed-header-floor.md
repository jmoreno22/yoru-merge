---
id: T16
title: "Add the collapsed-header 75 % floor to the layout policy and drop the dead token"
layer: "domain"
deps: []
acs: ["AC-02"]
files_hint: [
  "src/app/core/services/inspector-layout.ts",
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T16 — Add the collapsed-header 75 % floor to the layout policy and drop the dead token

## Why

`computeInspectorLayout` knows one floor (`DIFF_SHARE_FLOOR = 0.5`); with the header collapsed and four or more drawn rows the diff sits under three quarters, and the only two 75 % assertions pass `fileCount: 2`, the one region where the 0.5 floor happens to yield 81 % — [review 2026-09-03 F-2, F-15](../_review/review-2026-09-03.md), [spec AC-02](../spec.md), [T1 DoD](./inspector-layout-policy.md).

## What

- A second floor of 0.75 applied when `headerCollapsed`: the list yields to its 2-row floor before the 0.5 branch is considered; the floors of AC-03 stay untouched.
- Remove `panelPad` from `InspectorLayoutTokens` (never read) and the `getComputedStyle` read that feeds it in `commit-inspector.ts`.
- Spec: table the collapsed share over `fileCount` 2 / 6 / 30 at 540 and 700 px in both density sets; assert ≥ 75 % wherever the 2-row floor allows it and name the configuration where it cannot.

## Definition of Done

- [ ] `inspector-layout.spec.ts` red first on the 6-file collapsed case, then green; no `@angular/core` import.
- [ ] `panelPad` gone from the token interface, both fixtures and the component read.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green.

## Notes

The fixed part of the header is not the policy's to shrink; if a configuration cannot reach 75 % at the 2-row floor, the test documents it rather than loosening the assertion.
