---
slug: inspector-diff-workspace
date: "2026-09-04"
round: 3
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: aff23e8
previous_review: review-2026-09-04.md (CHANGES REQUESTED, G1–G12, C1–C9, D1–D16)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus, effort high) — stage 1 closure + claimed ACs + chain backstop; stage 2 quality of the changed surface. Reports written to files first (the idle message truncates at ~2.5 k chars). Lead verification on the two behavioural claims with a throwaway component spec, removed after the run.
---

# Re-review round 3 — inspector-diff-workspace — 2026-09-04

## Scope

Third review of the branch, after the follow-ups of the 2026-09-04 re-review. Whole feature diff `7cd47b4..aff23e8`: 32 commits, 118 files, +10 734 / −329. Changed surface since the re-review (`9fd06ec..aff23e8`): T28 `67c9b2e` (`fix`: refresh race, shared origin, expiring focus key, residual AC-07 reset, bounded header, view-scoped toggles, zero-height restore, repo docs) and T27 `aff23e8` (`test`: the component rows the plan declared, plus a remount guard in `commit-list.ts`), 27 files, +1 333 / −169, nothing under `src-tauri/`. `SDD-AC` trailers claim AC-01..AC-04, AC-06..AC-08, AC-10..AC-13, AC-16; the review re-traced the whole set.

Gate at review time, run by the lead on `aff23e8`: `pnpm test` 819 tests / 63 files green (two tiers under `ng test --no-watch`, no missing-icon stderr) · `pnpm lint` (biome, 266 files) clean · `pnpm build` clean (906.24 kB main, under the 1.2 MB budget). Rust gate unchanged since the first review (no `src-tauri` change).

## Resolution of the 2026-09-04 findings

| Finding | Resolved | Evidence at HEAD | Note |
|---|---|---|---|
| G1 AC-10 five-layer Esc row | yes | `working-changes.spec.ts:585` | dialog, palette, opted-in filter, line selection, workspace — one layer per Esc |
| G2 AC-03 squeezed column | yes | `commit-inspector.spec.ts:399` | both variables asserted on the host |
| G3 AC-01 header metadata + six actions | yes | `commit-inspector.spec.ts:273` | |
| G4 AC-02 toggle shortcuts pressed | yes | `commit-inspector.spec.ts:355` | |
| G5 AC-08 commit-list restore | yes | `commit-list.ts:206-216`; `commit-list.spec.ts:182` | writing the row exposed the remount zeroing `listScrollTop`; guard recorded in T27's task file |
| G6 AC-04 / AC-06 rows past six | yes | `commit-inspector.spec.ts:440` | |
| G7 AC-11 filter guard | yes | `commit-inspector.spec.ts:606` | |
| G8 AC-12 hunk keys in the workspace | yes | `diff-workspace.spec.ts:225` | |
| G9 AC-16 watcher event | yes | `src/testing/tauri-events.ts`; `working-changes.spec.ts:501` | Tauri's own event bus via `mockIPC(shouldMockEvents)`; the real `listen`, the 400 ms debounce and the echo window are exercised |
| G10 / G11 / G12 artifact drift | fixed 2026-09-04 | — | |
| C3 unreachable `ng_on_destroy` stubs | yes | no occurrence under `src/` | |
| C5 fetch count on double-click | yes | `commit-inspector.spec.ts:553` | |
| D6 icon set in every TestBed | yes | `src/testing/icons.ts`; six component specs | gate runs without the warning |
| D8 hardcoded hunk combos | yes | `settings-dialog.spec.ts:99` | renders `DiffViewer`, reads its registrations — strictly stronger |
| D11 origin faked via `stagingBusy` | yes | `working-changes.spec.ts:477` | driven through the Stage control |
| D13 local `CommitDetails` fixture | yes | `repo-fixtures.ts:78` `overrides` | |
| D14 `TEST_CONFIG` / `DISPLAYED` | yes | `repo-fixtures.ts:53` | |
| D1 refresh race | yes | `repo-ops.ts:219-222`; `working-changes.spec.ts:346` | same `isSelectedFile` predicate as `loadDiff`, on both branches |
| D2 shared origin | yes | `repo-ops.ts:296-299`; `working-changes.spec.ts:370` | fails on the old write-before-await; the `own` half of the row is unasserted (R14) |
| D3 expiring focus key | partial | `changes-list.ts:119-125`; `commit-list.ts:275-278`; `working-changes.spec.ts:400` | changes side pinned; commit-list side unpinned and its ownership test is negative (R1, R2) |
| D4 residual AC-07 reset | yes | `diff-workspace.service.ts:250`; `commit-inspector.spec.ts:718` | empty → repopulate → one fetch |
| D5 bounded header | partial | `commit-inspector.css:6,9`; `inspector-layout.ts:96`; `commit-inspector.ts:576,584`; `main-content.spec.ts:263` | the cap exists and is policy-derived; its value is asserted nowhere and does not feed `diffHeight` (R3, R4, R8, R9) |
| D12 zero-height restore | yes | `virtual-row-focus.ts:32`; `virtual-row-focus.spec.ts:78` | |
| C2 view-scoped toggles | yes | `diff-workspace.service.ts:154,165,280`; `working-changes.spec.ts:421` | |
| C6 / C7 DESIGN.md rows | yes | `DESIGN.md:347-360,894` | |
| C8 AGENTS.md stand-ins | partial | `AGENTS.md:72` | names the four that existed when T28 landed; T27 added two one commit later (R5) |
| C9 `DiffSourceSide` export | yes | `shared/ui/index.ts:31` | no importer left |
| D15 `focusVirtualRow` in the UI-kit README | yes | `shared/ui/README.md:274` | |
| D16 core → shared/ui exception | yes | `ARCHITECTURE.md:110-114` | names `KeyboardShortcutsService`, the single such import |

**Claimed ACs.** Every AC the two commits claim is genuinely touched by code or a new assertion (table in the stage-1 report). AC-05, AC-09, AC-14, AC-17 and AC-21 rows were edited by T27 for the shared fixture and the icon provider only — mechanical, correctly unclaimed. No `.skip` / `.todo` / `xit` under `src/`; no weakened assertion in the diff; the new rows were spot-checked for revert-sensitivity (AC-13 origin, AC-07 fetch delta, AC-08 offset, D12 remeasure) and none is a tautology.

## Chain trace

**User stories.** US-01..US-08 each keep ≥ 1 AC and a `sad.md` §6 flow (unchanged).

**Acceptance criteria.** Every AC-01..AC-21 reaches code and at least one automated assertion, except AC-20 (manual by owner decision). `test-plan.md` task column carries T27 on the nine rows it wrote and T28 on its five re-review rows; no row was amended to manual. One pre-existing gap the two earlier reviews missed: the AC-09 row «clicking another file row or using previous / next while open navigates in place» is declared `component · automated` (T12) and has no `it` — only the pure-TS replace row (`diff-workspace-state.spec.ts:84`) covers AC-09 (R7).

**Open items from T28's implementer, ruled.** (a) `overflow-x` computing to `auto` on the header is benign: `.meta-row` and both refs rows wrap, subject and body carry `overflow-wrap: anywhere`, a ref badge is capped at `max-w-[16rem]` with a truncating label (`yoru-badge.ts:52`). (b) `headerMaxH` not feeding `diffHeight` is real and bounded (R3). (c) The commit-list half of D3 is reachable from the existing harness — the restore runs from `afterNextRender` inside the viewport effect that `commit-list.spec.ts:182` already drives — so the analogy with the changes-list pin is not enough (R2).

## Findings — stage 1

- **R1 The commit list expires focus keys it does not own** — `commit-list.ts:277`; AC-08. `!key.includes(':')` also matches a commit-file key (a bare path owned by `commit-inspector.ts:325-334`). The restore is not lost today only because the inspector's plain `effect` runs before the list's `afterNextRender` in the same tick — the lead confirmed with a throwaway spec (`MainContent` rendered, open from an inspector file row, close → focus on that row, exactly one `focusRestored` call). Nothing pins or documents that ordering; `changes-list.ts:123` tests ownership positively. → **Fix now → T29** (a positive ownership test — a prefixed commit-row key or a sha-shape match — plus the two-list pinning row).
- **R2 D3's commit-list half is unpinned though the harness reaches it** — `commit-list.ts:275-278`; AC-08; `test-plan.md:101` declares it. → **Fix now → T29** (drop the target sha from `repo.commits` before Close; the key expires, nothing is focused).
- **R3 `headerMaxH` never feeds the `diffHeight` the policy returns** — `inspector-layout.ts:75-90` vs `:96`; AC-03, AC-04 / AC-06. `diffHeight` still subtracts the unbounded header, so in the many-refs case it reports below the floor and its only consumer (`commit-inspector.ts:571`, the W-01d row bonus) grants fewer rows than the freed slot has; `Math.max(layout.listRows, …)` keeps it from going below the policy rows. → **Fix now → T29** (clamp the header term to `headerMaxH` before computing `diffHeight`).
- **R4 The AC-03 bounded-header row asserts a CSS property, not the floor** — `main-content.spec.ts:263`, helper `:127-145`; AC-03; `test-plan.md:102` expects «`flex-1` slot ≥ floor». The row passes on `overflow-y: auto` alone; `headerMaxH` has no assertion anywhere, the 6 × 30 table in `inspector-layout.spec.ts` included (T28 did not touch that spec). → **Fix now → T29**.
- **R5 `AGENTS.md` §TESTING names four of six `src/testing/` stand-ins** — `AGENTS.md:72`; T27 added `icons.ts` and `tauri-events.ts` after T28 rewrote the line. → **Fix now → T29** (point at the directory, or list the six).
- **R6 T28 widened its boundary with no note** — `tasks/edge-fixes-and-repo-docs.md` vs `git show --stat 67c9b2e`: `src/app/core/services/inspector-layout.ts`, `commit-inspector.spec.ts`, `working-changes.spec.ts`, `main-content.spec.ts` and the new `virtual-row-focus.spec.ts` are outside the hint; T27 recorded its two. → **Fixed by this review** («Files beyond `files_hint`» note appended).
- **R7 `test-plan.md:66` AC-09 component row has no `it`** — pre-existing (T12), slipped past both earlier backstops. → **Fix now → T29** (owner: write the row rather than relabel it).

## Findings — stage 2

Behavioural edges:

- **R8 `headerMaxH` can reach 0 and hide the whole expanded header** — `inspector-layout.ts:96`; AC-03. `0.5 × remainder − fileListHeight()` is ≤ 0 once `remainder ≤ 2 × (panelHeadH + 2 × fileRowH)` — below the app's minimum column height with the inspector at the right (≈ 52 px cap at 560 px with both panels stacked), reachable with the inspector at the bottom. → **Fix now → T29** (floor the cap at `panelHeadH`).
- **R9 The layout dedup key carries a fractional value** — `commit-inspector.ts:577`; `headerMaxH` inherits `getBoundingClientRect` fractions from the stacked panels, so `applied` changes on almost every pass and the early return stops deduping (three `setProperty` writes plus `checkViewportSize()` each time). → **Fix now → T29** (round before keying and writing).
- **R10 `focusVirtualRow` still waits unbounded when the range never emits** — `virtual-row-focus.ts:41-44`; AC-08. → **Not an issue.** The CDK completes `renderedRangeStream` when the viewport is destroyed, so nothing leaks; the failure mode is «no focus», which the manual close-from-Changes check covers, and T28's DoD offered remeasure *or* a bounded wait — the remeasure landed and is pinned.
- **R15 (PLAUSIBLE) WebKitGTK omits a scroll container's bottom padding from `scrollHeight`** — `commit-inspector.ts:539-541`; AC-03; would understate `headerFixedH` by one `--panel-pad` on the Linux build only. → **Deferred → spec §8** (owner Jhoan Moreno, due: ship — manual check of the expanded header with 30 refs at 960 × 640 on Linux; if confirmed, measure an inner content wrapper).
- **R16 (PLAUSIBLE) `overflow-y: auto` makes `overflow-x` compute to `auto`** — `commit-inspector.css:6-9`. → **Not an issue** (open item (a) above: nothing in the header is un-wrappable; the focus ring fits inside `--panel-pad`).
- **R17 The changes list expires the key on a pass where `rows()` is transiently empty** — `changes-list.ts:117-123`. → **Not an issue.** `rows` is an input computed from `repo.changes`, which is only ever written with a loaded payload (no interim `[]` anywhere under `src/app`); an empty side after an external change is exactly the case the expiry is for.

Tests and hygiene:

- **R11 `virtual-row-focus.spec.ts:66-71` spends 300 ms of real time on a wait the helper does not have** — the remeasure path focuses in the first `afterNextRender`. → **Fix now → T29** (one tick).
- **R12 The AC-16 row sleeps 500 ms twice against a 400 ms debounce it hardcodes** — `working-changes.spec.ts:236-238,517,527`; `WATCHER_DEBOUNCE_MS` is a private constant of `current-repo.service.ts:74`. → **Fix now → T29** (export the constant and derive the wait, or fake timers).
- **R13 `emitRepoChanged` is called as a floating promise** — `working-changes.spec.ts:516,525-526`. → **Fix now → T29** (`await` each emit).
- **R14 The interleave row never asserts the `own` publish** — `working-changes.spec.ts:370-397`; AC-13; it proves the watcher answer published `external`, then resolves the staging answer and asserts nothing. → **Fix now → T29** (`changesOrigin()` is `own`, no second toast).
- **R18 The commit-list restore row pins the signal, not the replayed scroll** — `commit-list.spec.ts:224,239`. → **Not an issue.** jsdom lays nothing out and `scrollTo` is stubbed, so the CDK offset cannot be measured; the guard is what the row exists to pin (test-plan.md says so), and the visual replay is on the manual checklist.
- **R19 The remount guard keeps mount history in a closure instead of testing `rows().length === 0`** — `commit-list.ts:206-215`. → **Not an issue.** Equivalent behaviour, pinned by `commit-list.spec.ts:239`; re-litigating settled style.
- **R20 Every task file's front-matter still says `status: "todo"`** — all 28 files vs `tasks/tracker.md`. → **Not an issue.** Pre-existing for every task since T1; `tracker.md` is the status source `implement` updates. A sweep can happen at ship.

Checked and clean (stage 2): `refreshActiveDiff` re-check on both branches with the sibling predicate; `loadChanges` origin read before the `await` and written beside `changes`; `isInspectorMounted()` branches on the same `railView()` the template does; the AC-07 residual reset has no double publish; `provideTestIcons()` in all six rendering TestBeds; the `tauri-events.ts` bridge drives the real `listen` subscription; `DESIGN.md`, `ARCHITECTURE.md` and `shared/ui/README.md` hunks match HEAD and touch only the declared prose.

## Owner decisions (2026-09-04, round 3)

1. **R1–R5, R8, R9 (stage 1 + header edges):** fix now, one task — T29 «Round-3 fixes: owned focus keys, header cap feedback, the AC-03 and AC-09 rows, test hygiene».
2. **R7 (AC-09 row):** write the component row in T29 rather than relabel it — consistent with the 2026-09-03 decision to honour the plan.
3. **R11–R14 (test hygiene):** fix now in T29.
4. **R15:** deferred to spec §8 with owner and due (ship, Linux check). **R10, R16–R20:** not an issue, reasons above.
5. **R6:** fixed by this review.

## Artifacts changed by this review

- `tasks/edge-fixes-and-repo-docs.md` (T28): «Files beyond `files_hint`» note appended.
- `tasks.json`, `tasks/tracker.md`, `tasks/_epic.md`: T29 added (`todo`); T26 stays `blocked`.
- `tasks/round3-fixes.md` (T29) written.
- `test-plan.md`: AC-09 row stamped T29; round-3 rows appended for T29.
- `spec.md` §8: R15 recorded as an open question (owner Jhoan Moreno, due ship).

## Gate result

**CHANGES REQUESTED.** Every 2026-09-04 finding is resolved except the three partials above, and no AC is violated on any traced path. What remains is one ownership test that holds by incidental ordering (R1), three declared rows without an assertion (R2, R4, R7), the cap's feedback into the policy (R3, R8, R9), a stale doc line (R5) and four test-hygiene nits. Re-review the changed surface after `/sdd:implement inspector-diff-workspace` runs T29; T26's screenshots and the manual checklist stay owner-only prerequisites for `ship`.
