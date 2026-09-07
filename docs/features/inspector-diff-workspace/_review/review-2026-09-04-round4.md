---
slug: inspector-diff-workspace
date: "2026-09-04"
round: 4
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: a662a2a
previous_review: review-2026-09-04-round3.md (CHANGES REQUESTED, R1–R20)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus, effort high) — stage 1 closure of R1–R14 + claimed ACs + chain backstop; stage 2 quality of the changed surface. Reports written to scratchpad files first, then relayed (the idle message truncates at ~2.5 k chars). Lead verified the two behavioural findings in the code before the rulings.
---

# Re-review round 4 — inspector-diff-workspace — 2026-09-04

## Scope

Fourth review of the branch, after T29 (the round-3 follow-ups). Whole feature diff `7cd47b4..a662a2a`: 34 commits, 120 files, +11 286 / −330. Changed surface since round 3 (`aff23e8..a662a2a`): `a1fe268` (docs: round-3 record + T29) and `a662a2a` (T29, `fix`: `commit:<sha>` row keys with an owned expiry, `headerMaxH` floored at one panel head, rounded and fed into `diffHeight`, `WATCHER_DEBOUNCE_MS` exported, the AC-08 / AC-03 / AC-09 / AC-13 rows and the test hygiene), 21 files, +588 / −37, nothing under `src-tauri/`. `SDD-AC` trailers claim AC-03, AC-04, AC-06, AC-08, AC-09, AC-13, AC-16.

Gate at review time, run by the lead on `a662a2a`: `pnpm test` 829 tests / 63 files green (two tiers under `ng test --no-watch`) · `pnpm lint` (biome, 266 files) clean · `pnpm build` clean (906.40 kB main, under the 1.2 MB budget). Rust gate unchanged since the first review (no `src-tauri` change). One stderr line, `Element matching '[cdkFocusInitial]' is not focusable`, comes from the AC-10 row T27 wrote at `aff23e8` — jsdom noise, not a finding.

## Resolution of the round-3 findings

| Finding | Resolved | Evidence at HEAD | Note |
|---|---|---|---|
| R1 commit list expires keys it does not own | yes | `commit-list.ts:277-279` (`startsWith('commit:')`), `commit-list.html:61`; `commit-list.spec.ts:242` (foreign key stays pending), `:316` (both lists mounted, one `focusRestored`) | removing the incidental expiry opened Q2 |
| R2 commit-list half of D3 unpinned | yes | `commit-list.spec.ts:270-315` — sha dropped from `repo.commits`, `pendingFocusKey()` null, nothing focused | |
| R3 `headerMaxH` never fed `diffHeight` | yes | `inspector-layout.ts:105` (`Math.min(headerHeight(), headerMaxH)`); `inspector-layout.spec.ts:399-415` | |
| R4 AC-03 row asserts CSS, not the floor | partial | `main-content.spec.ts:297-303` — whole pixels and `≥ panelHeadH`, the value itself unasserted | Q1 |
| R5 `AGENTS.md` names four of six stand-ins | yes | `AGENTS.md:72` lists the six; `src/testing/` holds exactly those plus two specs | |
| R7 AC-09 component row missing | yes | `diff-workspace.spec.ts:299-339`; `test-plan.md:66` carries T29 | |
| R8 cap can reach 0 | yes | `inspector-layout.ts:98-100`; `inspector-layout.spec.ts:383` (150 px → cap 34), table at `:346` | |
| R9 dedup key carries a fraction | yes | `inspector-layout.ts:98` rounds; `commit-inspector.ts:577,583` key and write the same integer; `inspector-layout.spec.ts:417`, `main-content.spec.ts:308` (561 px — an unrounded cap would be `186.5px`) | |
| R11 300 ms real wait in the helper spec | yes | `virtual-row-focus.spec.ts:64-69` — one tick | |
| R12 hardcoded 500 ms vs a private 400 ms | yes | `current-repo.service.ts:74` exported; `working-changes.spec.ts:238-241` derives the wait | the +50 ms margin is Q7 |
| R13 floating `emitRepoChanged` | yes | `working-changes.spec.ts:528,536-537` | |
| R14 interleave row never asserts the `own` publish | yes | `working-changes.spec.ts:405-410` — `changesOrigin()` is `own`, toast list unchanged | |
| R15 WebKitGTK `scrollHeight` (deferred) | open | spec §8, due ship | owner manual check on Linux |

**Lead rulings during GREEN, checked.** `inspector-layout.spec.ts:38` 196 → 210: recomputed by hand by both reviewers — remainder 420, floor 210, list yields to 2 rows (94 px), clamp yields to 1 line (header 130 px), `headerMaxH = round(max(420 − 210 − 94, 34)) = 116`, `diffHeight = 420 − min(130, 116) − 94 = 210`; `listRows` and `clampLines` unchanged, so 196 pinned the pre-R3 semantics and nothing was weakened. The compact sibling at `:53` stays 216 because the 114 px header sits under its 120 px cap. The file-row click before `mod+d` in the R2 row is setup, not a weakening: the opener is registered only for an active file row (`diff-workspace.service.ts:121`), and the row gained a positive pin of the rendered key (`commit-list.spec.ts:288`).

**Claimed ACs.** AC-03 genuine (`inspector-layout.ts:98-105`; `inspector-layout.spec.ts:346,383,399`, `main-content.spec.ts:308`) with the host half incomplete (Q1). AC-04 / AC-06 genuine by code: `diffHeight` feeds the W-01d bonus (`commit-inspector.ts:571`) and now grants more rows, never fewer; the pre-existing row `commit-inspector.spec.ts:440` stays green as the task asked. AC-08 genuine (`commit-list.ts:277-286`, `commit-list.html:61`; `commit-list.spec.ts:242,270,316`; `diff-workspace-state.spec.ts:290`). AC-09 genuine (`diff-workspace.spec.ts:299`: strip follows the foreign row click and previous / next, `open` called once). AC-13 genuine (`working-changes.spec.ts:405-410`). AC-16 hygiene only, correctly small. The four RED classifications the test-author recorded hold: the ordering pin at `commit-list.spec.ts:316` catches a dropped or doubled inspector restore; the AC-09 row catches a click that re-opens or a strip that stops following (its `toHaveLength(1)` half is decorative — the state holds one source); the `own` origin row catches a revert of the D2 fix; the 560 px row is the `panelHeadH` floor on the host and the 561 px row carries the rounding.

## Chain trace

**User stories.** US-01..US-08 each keep ≥ 1 AC and a `sad.md` §6 flow (unchanged).

**Acceptance criteria.** Every AC-01..AC-21 reaches code and at least one automated assertion, except AC-20 (manual by owner decision). `test-plan.md` rows `:66` and `:104-106` each map to an `it` (`commit-list.spec.ts:242,270,316`; `inspector-layout.spec.ts:346,383,399,417` with `main-content.spec.ts:287,308`; `working-changes.spec.ts:405`). Row `:105`'s third clause («equals the policy value at 560 px with 30 refs») is unmet (Q1); row `:95` still names the commit-row shape «sha» (Q3). `tracker.md` T29 `done`, T26 `blocked`; `tasks.json` T29 matches its task file; the «Files beyond `files_hint`» note covers `DESIGN.md`, the only non-bookkeeping file outside the hint; `AGENTS.md:72` and `DESIGN.md:345` match HEAD. No `.skip` / `.only` / `.todo` / `xit` under `src/`; no assertion deleted or loosened in `a662a2a`.

**Focus-key ripple.** Every consumer of the key was checked: `commit-list.ts:276-286` (prefix, own only), `changes-list.ts:112-129` (positive `side:` match), `commit-inspector.ts:325-334` (positive path match, never expires — Q2), `diff-workspace.service.ts:285-294` (reads `dataset.focusKey` off the DOM, shape-agnostic), `diff-workspace-state.ts:58,136` (`focusKeyFor` returns the bare path for a commit source, which names the *file* row; `close` keeps the snapshot key verbatim). Nothing compares a commit-row key with a bare sha; no key is persisted. `rowId`, `data-testid`, `aria-activedescendant`, selection, `scrollReveal` and `focusVirtualRow` key off the bare sha or the path and are untouched.

## Findings — stage 1

- **Q1 The AC-03 host row asserts the cap's shape, not the policy's value** — `main-content.spec.ts:297-303`; AC-03; `test-plan.md:105` and T29's DoD require the host's `--inspector-header-max-h` to equal the policy value at 560 px / 30 refs; HEAD asserts `/^\d+px$/` and `≥ panelHeadH`, so a writer emitting an unbounded integral cap still passes. jsdom feeds the policy deterministic inputs (column 560, stacked panels 0, `bodyLines` 0, `headerFixedH` 0, tokens from `AppearanceService`), so equality with `computeInspectorLayout` is one assertion. → **Fix now → T30**.
- **Q2 A bare-path key whose commit file row is gone is expired by nobody** — `commit-inspector.ts:325-334`; AC-08. Before T29 the commit list expired every key without a colon (`commit-list.ts:277` at `aff23e8`), which incidentally covered a bare path whose row had vanished. T29 scoped that expiry to `commit:` keys, and the inspector's restore effect returns on `index < 0` without `focusRestored`; the key stays pending until the next `open()` and takes the focus when the same path appears in a later commit — D3's regression class (`test-plan.md:101`, «a reappearing path is not focused»), pinned on the changes side only (`working-changes.spec.ts:400`). Confirmed by the lead in the code. → **Fix now → T30** (expire an owned key whose row is absent, as `changes-list.ts:119-125` does, with a component row mirroring the changes-side pin).
- **Q3 `test-plan.md:95` names the commit-row key shape «sha»** — the T20 row's expected column lists «bare path, `side:path`, sha» while rows render `commit:<sha>` (`commit-list.html:61`) and its own test was updated (`diff-workspace-state.spec.ts:290-296`). → **Fixed by this review**.

## Findings — stage 2

- **Q4 The T20 shape row cannot fail on the commit-row prefix** — `diff-workspace-state.spec.ts:303,310`; AC-08; `commitRowKey` is a local literal asserted against the same literal, and `ROW_FOCUS_PREFIX` is private to `commit-list.ts:55`, so reverting the prefix leaves the row green; the rendered shape is pinned only by the component row at `commit-list.spec.ts:288`. → **Fix now → T30** (the row-key shapes live next to `focusKeyFor` in `diff-workspace-state.ts`; the commit list, the inspector's ownership test (Q2) and the T20 row import them).
- **Q5 `headerMaxH` has no value assertion in the pure rows** — `inspector-layout.spec.ts:367,413`; AC-03; the 144-case table asserts integrality and the `panelHeadH` floor, the R3 row only `< 400`; the formula survives only through `diffHeight === 210` at `:37`. → **Fix now → T30** (pin 116 in the comfortable squeeze row and 120 in the compact sibling).
- **Q6 The `clampLines` rung no longer lowers the reported `diffHeight`** — `inspector-layout.ts:91-93,105`; AC-03; with the header expanded `headerMaxH` is independent of `clampLines`, so the third yield can only lift the reported height above the floor (the header fitting under the cap without scrolling); the doc comment at `:44-52` still reads as if it moved the floor. → **Fix now → T30** (one sentence in that comment).
- **Q7 `afterDebounce` sleeps 50 ms longer than the debounce it waits for** — `working-changes.spec.ts:240`; AC-16; `WATCHER_DEBOUNCE_MS + 50` is 450 ms of real time twice, against T29's DoD «no real-time sleep longer than the debounce it waits for». → **Fix now → T30** (fake timers, or the exact debounce plus a macrotask flush — two timers of equal delay fire in scheduling order).

Checked and clean (stage 2): the three yield `if`s are sequential and monotone, so the policy cannot diverge; `headerMaxH ≤ 0.5 × remainder` on its first arm and exceeds the remainder only below one panel head, where `diffHeight` was already negative and `Math.max(layout.listRows, …)` absorbs it; the rounding is consistent between the policy, the dedup key and the CSS consumer; the `commit:` key is disjoint from both other shapes, so the effect / `afterNextRender` ordering R1 relied on no longer matters; the two new AC-08 rows and the AC-09 row are revert-sensitive; `WATCHER_DEBOUNCE_MS` is a plain file export in a directory with no barrel, imported only by its spec; no `as any`, no duplicated `src/testing/` helper, `provideTestIcons()` in each rendering TestBed; the `DESIGN.md` cell matches the code.

## Owner decisions (2026-09-04, round 4)

1. **Q1, Q2 (stage 1):** fix now, one task — T30 «Round-4 fixes: the inspector expires its own key, the cap pinned on host and table, shared row-key shapes, exact debounce wait».
2. **Q4, Q5, Q6, Q7 (stage 2):** fix now in T30 as well (the lead had recommended dismissing Q6 and Q7; the owner chose to take them).
3. **Q3:** fixed by this review.

## Artifacts changed by this review

- `test-plan.md`: row `:95` says `commit:<sha>`; round-4 rows appended for T30.
- `tasks.json`, `tasks/tracker.md`, `tasks/_epic.md`: T30 added (`todo`); T26 stays `blocked`.
- `tasks/round4-fixes.md` (T30) written.

## Gate result

**CHANGES REQUESTED.** Every round-3 finding T29 owned is closed with a revert-sensitive test except R4, still partial, and no AC is violated on a traced path. What remains is one declared assertion that was never written (Q1), one net T29 removed without replacing on the inspector side (Q2), a decorative shape pin (Q4), a formula asserted only through a derived value (Q5), a stale comment (Q6) and a 50 ms margin (Q7). Re-review the changed surface after `/sdd:implement inspector-diff-workspace` runs T30; T26's screenshots, the R15 Linux check and the manual checklist stay owner-only prerequisites for `ship`.
