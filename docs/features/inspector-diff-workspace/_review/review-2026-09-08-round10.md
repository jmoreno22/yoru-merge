---
slug: inspector-diff-workspace
date: "2026-09-08"
round: 10
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T40–T43 working tree
previous_review: review-2026-09-08.md (CHANGES REQUESTED at 805a32d)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality of the changed surface). Each ran in its own git worktree with a junctioned node_modules, over a detached 805a32d with the round-10 working patch applied; the lead measured the gate in the main tree and re-verified the four sharpest findings in a third worktree.
---

# Re-review round 10 — inspector-diff-workspace — 2026-09-08

## Scope

Tenth review, and the first over the **round-9 fix wave**: T40 (code fixes), T41 (chain amendment),
T42 (test-plan re-point) and T43 (the deterministic gate), all of them **uncommitted** at review
time, per the standing rule that spec / SAD / task docs land in the same commit as the code they
describe.

Whole feature diff `7cd47b4..HEAD` plus the working tree: 130 files, +12 481 / −346.
**Changed surface since round 9** — the working patch on `805a32d`: **19 files, +816 / −143**, plus
four new task files (321 lines) and the round-9 record:

| task | what |
|---|---|
| **T43** | `vitest.config.ts` — `fileParallelism: false`, carrying the measurement |
| **T40** | the `fileCount === 0` arm of `protectedList`; two new `inspector-layout.spec.ts` rows and the deleted `twoRowFloorBinds` hatch; the chevron row in `diff-workspace.spec.ts`; the AC-19 / AC-05 comment in `main-content.ts` |
| **T41** | `sad.md` (+124 lines changed), `ux-flows.md` (61), `screens.md` (63), `spec.md` §6 / §7 / AC-05 (16) |
| **T42** | `test-plan.md` (37), T39's Outcome and status |

Out of scope, unchanged since round 8: four working-tree modifications unrelated to this feature
(`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked
`.mcp.json`. Confirmed absent from the feature diff.

## Gate

Measured by the lead in the main tree and reproduced independently by both reviewers in their own
worktrees; all three agree on every value.

`pnpm test` **834 tests / 63 files green** · `pnpm lint` (biome, 266 files) clean ·
`tsc --noEmit -p tsconfig.spec.json` clean · `pnpm build` clean, 908.10 kB initial total, no budget
warning. No `src-tauri/` path in the feature diff, so the Rust gate is unchanged. The one stderr
line (`[cdkFocusInitial]` not focusable) is the known jsdom noise.

**T43 works, and stage 2 established why.** Serial ×3: 834, 834, 834. Parallel ×3 (config flipped,
then restored byte-for-byte): 834 green, **3 failed**, **3 failed** — the same trio each time
(`commit-list.spec.ts` AC-08, `diff-workspace.spec.ts` AC-06, `main-content.spec.ts` AC-06), always
`Test timed out in 5000ms`, never an assertion. And the flag really is the whole net: the Angular
builder merges the user config into one vitest project, vitest turns `fileParallelism: false` into
`maxWorkers = 1` for that project, and `resolveMaxWorkers` reads the project value first. No `pool`,
`poolOptions`, `maxWorkers`, `sequence.concurrent` or `describe.concurrent` anywhere.

## What round 9 asked for, and got

**Every finding routed to T40 is closed and provably so.** All five mutations T40's Outcome quotes
reproduce, each reddening the one row it names — measured independently by both reviewers, and MUT-A
and MUT-B again by the lead in a third worktree, each on a tree verified clean before and after:

| # | Mutation | Result |
|---|---|---|
| MUT-A | `inspector-layout.ts:80` drop `Math.max(…, panelHeadH)` | 1 failed / 833 — `binds both hard floors…`, `expected 16 to be 34` |
| MUT-B | `inspector-layout.ts:101` drop `Math.max(LIST_ROWS_FLOOR, …)` | 1 failed / 833 — same row, `expected 1 to be 2` |
| MUT-C | revert the `fileCount === 0` arm | 1 failed / 833 — `claims no share…`, `expected 320 to be 606` |
| MUT-D | `diff-view.ts:239` → `computed(() => false)` | 1 failed / 833 — chevron row, `expected <button …> to be null` |
| MUT-E | `diff-view.ts:239` → `computed(() => true)` | 1 failed / 833 — chevron row, `expected null not to be null` |

The rows are load-bearing, not decorative: in `binds both hard floors…` the two assertions are
genuinely independent (under MUT-A the cap drops to 16, which *raises* `listHeight` to 60 and leaves
`listRows` at 2 — only the first assertion catches it), and the chevron row drives the real open
path through `MainContent` rather than a bare `DiffView` fixture. R9-S2-F1, F2, F3, F4 and
R9-S1-F10's test half are closed; O3 and O4 are taken; T40's DoD grep holds — the only non-spec hit
for `diff slot|diff share|diffHeight|MAX_LIST_ROWS` in `src/` is the dated note at
`inspector-layout.ts:51`.

**The chain now traces end to end, for the first time on this branch.** Mechanically verified by
stage 1: every AC-01…AC-22 has a `sad.md` §6 coverage row, a `ux-flows.md` AC → flow row, a
`screens.md` AC → screen row, ≥ 1 `test-plan.md` row and ≥ 1 task in `tasks.json`; every US-01…US-08
has a §6 flow. AC-22, which existed nowhere in the SAD at round 9, traces `spec.md:218-223` →
`sad.md` F9 `:382-411` + critical-flow-1's `alt` → `ux-flows.md:92`, `:223` → `screens.md:33-34`,
`:381` → T36/T39/T41 → `preferences-schema.ts:94` + `commit-inspector.ts:193`, `:531` →
`commit-inspector.spec.ts:949-1018` → `test-plan.md:58-61`. R9-S1-F2, F3, F4, F5, F8, F10 and O5 are
closed at the sites they named. AC-05's correction is consistent across all five artefacts and the
code.

**Trailers.** The wave is uncommitted, so R9-S1-F9's requirement is checked against the task files:
all four state it, T43 correctly noting it carries no `SDD-AC` because it satisfies no criterion.

## Findings — stage 1 (spec / AC compliance)

| id | Finding | Resolution |
|---|---|---|
| **R10-S1-F1** | **The wave's sharpest new rule is in the code and four artefacts, and in no criterion — and the two NFR rows the release checklist measures forbid it.** `inspector-layout.ts:72-75` gives `fileCount === 0` a bare head; the rule is written into `sad.md:317`, `ux-flows.md:72`/`:82`, `screens.md:44`/`:141`, `test-plan.md:116` and into no §5 criterion. `spec.md:229` NFR row 1 («≥ 50 % at every window size from 960 × 640 upward», measured `(inspector height − headerMaxH) / inspector height`) gives **5.3 %** at 640 px with 0 displayed rows; row 2 the same. AC-01 has no file-count condition in its *Given*; AC-04 states the rendering, not the share, and its *Given* does not cover the reachable case — a filter matching nothing | **Owner decision: a clause in AC-04 + a carve-out in the Measurement column of the two NFR rows** → T45 |
| **R10-S1-F2** | **`sad.md` §10 QG-1 still verifies by the two methods T41 removed from the spec.** `:734` — «element-height measurement in the built app» (R9-S2-F6a, restated out of `spec.md:229-230` precisely because it cannot be right for the list) and «side-by-side measurement against the 1.0.5 build» (R9-S1-F7 / R9-S2-F6c, whose own amendment marker says amended AC-18 replaced that baseline). `:733` also still reads «its **height** is ≥ the share». T41's DoD was checked against the SAD's §6 flow, not its §10 | **Fix now** → T45 |
| **R10-S1-F3** | **`test-plan.md` §NFR validation is untouched and re-introduces both removed measurements.** `:153` «Diff viewer share, header expanded → assert **element-height share** ≥ 50 %», `:154` the 75 % twin, `:155` «Diff height at the bottom or with stacked panels → 3 runs **side by side with the 1.0.5 build** … assert height ≥ the 1.0.5 value» — verbatim the text R9-S1-F7 named and T41 deleted from `spec.md:231`. T42 re-pointed the AC coverage table and stopped at the table; this is the section the release checklist is run from | **Fix now** → T46 |
| **R10-S1-F4** | **`test-plan.md:14`, the plan's own thesis, still states the reversed design**: «The inspector must hand **the diff viewer** its height (**header and file list yield first**…)». Both halves are what the reversal inverted (`spec.md:107` AC-03, `inspector-layout.ts:38-52`). First sentence a reader meets | **Fix now** → T46 |
| **R10-S1-F5** | **`test-plan.md:133` sizes a diff that is not in the column**: «… the policy holds rows = 2 and clamp = 1, never negative, **and the diff takes the remainder** (SAD §11 risk row)». The configuration is real and is now exactly the row T40 landed, but the expectation names an output the policy no longer has; `sad.md:753` is about the stacked-panel remainder | **Fix now** → T46 |
| **R10-S1-F6** | **R9-S1-F1's «two preferences where there are three» survives at two sites T41's What did not enumerate**: `sad.md:73` (§3, the `preferences.json` row — the row that enumerates what the datastore gains from this feature) and `sad.md:181` (C4 L2, «now including the two collapsed states»). T41 fixed the three sites it listed, and its DoD was scoped to the same three | **Fix now** → T45 |
| **R10-S1-F7** | **The canonical feature glossary still describes the pre-reversal column.** `CONTEXT.md:11` — commit file list «shown in the inspector **between the commit header and the diff viewer** … **bounded in height**»; `:13` the diff viewer as «the diff pane inside the inspector». `sad.md:766` declares this file canonical over the SAD's repeats and five artefacts send readers here first, while `sad.md:772`'s copy was amended in T41 to «no upper bound» — so the canonical entry is the stale one. `updated_at: "2026-09-02"`; the file is in no task's `files_hint` | **Fix now** → T45 |
| **R10-S1-F8** | **The fixed flex bases AC-19 requires — and that the owner's AC-05 correction rests on — are asserted by nothing.** `main-content.ts:270-276`. Measured by stage 1 and reproduced by the lead: `blameFlex → '1 1 30%' / '1 1 37.5%'` leaves **63 files / 834 tests green**. `growingChildren()` (`main-content.spec.ts:199-206`) filters on the `flex-1` **class** while the panels set `[style.flex]`, so the four `growingChildren(...) === [inspectorBlock(...)]` assertions cannot reach them, and none of those rows opens a stacked panel. AC-19's only automated cover (`test-plan.md:89`) subtracts a stacked height the caller supplies. Same class as R9-S2-F1 / F2, in a configuration the app ships | **Fix now** → T44 |
| **R10-S1-F9** | **T40's dependency on T43 is recorded in two places and missing from three.** `tasks.json` has `["T41","T43"]` and `_epic.md:93`/`:102` draw it; `round9-code-fixes.md:5`, `tracker.md:47` and `_epic.md:151` — the three a human reads — say only T41. The dependency is real: T40's Outcome says every measurement was taken after T43 | **Fix now** → T45 |
| **R10-S1-F10** | **Two re-pointed rows describe a sweep stronger than the one that runs.** `test-plan.md:35` (AC-01) and `:95` (AC-02) promise «never under 0.5 / ≥ 75 %, **swept over 144 configurations**»; after T40's exemption the loop asserts 120. Neither row names the exemption, and neither names **T40** in its Task column although T40 is what changed the loop. Merged with R10-S2-F3 | **Fix now** → T46, after T44 |

## Findings — stage 2 (quality, edge cases, test adequacy)

| id | Finding | Resolution |
|---|---|---|
| **R10-S2-F1** | **The 144-configuration loop lost 24 of its 144 assertions, and the 24 it lost are exactly the ones that exercise the arm this round added.** `inspector-layout.spec.ts:413` / `:427`. Re-run outside vitest against the shipped policy, and reproduced by the lead at 12 of 72 per token set: `{ total: 144, share_below_floor: 24, nothingToDraw_true: 24, oldHatch_actually_needed: 0 }`. Before the new arm all 144 satisfied `share >= floor` and the deleted hatch excused nothing; after it, 24 fail and are switched off wholesale. The broadest row in the suite now says nothing about the new behaviour — its only cover is the single 640 px row at `:124-152`, comfortable tokens only. Zero-cost repair that also restores 144/144: `ok: nothingToDraw ? result.headerMaxH === availableHeight - tokens.panelHeadH : share >= floor` | **Fix now** → T44 |
| **R10-S2-F2** | **Every height in the loop's table is divisible by 4 — the one residue class where the cap's rounding cannot break the floor.** `Math.round` at `inspector-layout.ts:80` rounds a `.5` cap **up**, taking the half pixel from the list: `h=189 → share 0.497354`, `h=421 → 0.498812`, `h=701 → 0.499287`. Swept 40…1000 px with 30 files: **434 heights miss 0.5 expanded** (all odd, from 189) and **312 miss 0.75 collapsed** (from 378 — `round(0.25h)` rounds up for `h ≡ 2, 3 (mod 4)`, half of all heights). `heights = [200, 300, 420, 560, 700, 900]` are all `≡ 0 (mod 4)`. Cost is one pixel, but §6 now defines the NFR as literally this quotient and `test-plan.md:35` says the sweep proves it | **Owner decision: `Math.round` → `Math.floor`, plus a non-multiple-of-4 height in the table** → T44 |
| **R10-S2-F3** | **`test-plan.md:35` and `:118` describe a sweep with no exemption, in the same wave that added one.** Both were re-pointed by T42. Per F1 the loop asserts 120 of 144, and the 24 it skips are exactly the ones where the share *is* under the floor; per F2 the 120 it does assert sit in the one residue class where the rounding cannot bite. Merged with R10-S1-F10 | **Fix now** → T46, after T44 |
| **R10-S2-F4** | **`spec.md:253`'s re-pointed KPI states a target the measurement it now names cannot reach.** «≥ 60 % with the header expanded for a subject-only commit with two or fewer files» — but the protected share is `max(panelHeadH + 2·fileRowH, 0.5·remainder) / remainder`, **exactly 0.50 for every remainder ≥ 188 px**, independent of file count and body length (measured: 640 px / 1 file / 1 body line → 50.00 %; 800 px / 30 files / 12 lines → 50.00 %). It made sense against the pre-reversal «diff viewer share»; a *protected* share is a flat floor | **Owner decision: drop the clause** → T45 |
| **R10-S2-F5** | **The restore threshold the new comment leaves behind is wrong.** `inspector-layout.spec.ts:414-421`: «Put it back … if a height under ~190 px (comfortable) ever joins the table». Measured, the deleted clause is *needed* only for **h ≤ 67 expanded** and **h ≤ 125 collapsed**; 190 px is where its predicate flips, and for a collapsed header that predicate holds for every height below **376 px** — so 200 and 300, already in the table, are inside its range. A maintainer following the comment would restore a clause that silently excuses F2's rounding failures | **Fix now** → T44 |

## Checked and clean

No `as any`, no `as unknown as`, no non-null `!` in the `src/**` delta · no duplicated `src/testing/`
helper · no dead code · no new IPC command, DOM sink, secret or widened Tauri surface · no assertion
relaxed, emptied or deleted without a stronger replacement (`expect(` 47→52 and 29→33; the only
removed assertion-bearing lines in the whole `src` delta are `twoRowFloorBinds` and its `||` clause)
· the `fileCount === 0` consumers are safe — `--inspector-list-rows: 0` sizes only `.file-list`,
which is not rendered in either empty branch, and the raised cap cannot squeeze the empty-state copy
out (`.files-header` is `flex-shrink: 0`, the `<p>`'s `min-height: auto` resolves to its content) ·
`inWorkspace` gates exactly one element (`diff-view.html:47`), so AC-06's «every other control comes
with it unchanged» is accurate · rounds 6–9's recorded observations re-checked on the touched files,
none worsened.

## Observations — recorded, not findings

- **O1** T43's stated cost («about twelve seconds a run») is right against a *green* parallel run
  (22.31 s vs 30.64–36.35 s), but the mean across three runs favoured the serial gate (56 s vs 61 s)
  because a failing parallel run pays three 5-second timeouts. The trade is better than the comment
  claims.
- **O2** the chevron row T40 added is itself in the render-window-dependent family — one of the
  three specs that timed out in both failing parallel runs. Green serially 3/3, but on a slower
  machine the 5 s default `testTimeout` is the only margin. For T43's successor (the root repair the
  owner deferred), not for now.
- **O3** `screens.md:33`'s `default` state still reads «fewer changed files than the column fits take
  exactly that many rows; the commit file list keeps ≥ 50 % of the inspector» in one sentence — only
  compatible under the *protected*-share reading R9-S2-F6a introduced into `spec.md` §6 in this same
  wave.
- **O4** `screens.md:16` and `test-plan.md:12` still cite «`spec.md` §5 AC-01…21»; AC-22 joined §5 on
  2026-09-07.
- **O5** `test-plan.md` frontmatter still carries `updated_at: "2026-09-03"` after T42 rewrote fifteen
  rows; the other four artefacts moved to 2026-09-08.
- **O6** the four new task files add `tracker.md` / `_epic.md` / `tasks.json` to their `files_hint`;
  `tasks.json` lists neither for any of them (T34–T39 agreed exactly — round 9 O11).
- **O7** `tasks.json` T40 `files_hint` still names `diff-viewer/diff-view.spec.ts`; the chevron row
  landed in `diff-workspace/diff-workspace.spec.ts`. Recorded honestly at `round9-code-fixes.md:96`,
  but the machine contract was not followed up.
- **O8** `test-plan.md:106` claims the AC-03 component row shows «the growing child **and keeps ≥ 50 %
  of the column**»; `main-content.spec.ts:317-338` asserts the growing child and the written cap, not
  a share. Same class as round 9's O2.
- **O9** `commit-inspector.spec.ts:516`'s title still says «keeps … the file **in the viewer**» where
  amended AC-05 says «the file the diff workspace shows». Title only; the assertion is correct.
- **O10** `screens.md:52`'s test-id list was not extended with `inspector-click-opens`, which
  `screens.md:33` names.
- **O11** `sad.md:36` (§2 Constraints) still lists «diff viewer `flex-[3]`» with no date marker. It
  reads as the pre-feature baseline, which is what §2 is for, but it is the one §2 line a reader
  could take as a live constraint.
- **O12** the repo-root `CONTEXT.md:12` defines the inspector as holding «the diff viewer» — still
  true of Changes, so weaker than R10-S1-F7, but the other half of the same two-level contract.
- **O13** AC-06's chevron clause reached `spec.md`, `sad.md` and `screens.md` but not `ux-flows.md:207`.
  Flow altitude, so arguably correct to omit.
- **O14** `tracker.md:52`'s provenance sentence lists «T40–T42 of review round 9»; T43 is absent.
- **O15** T42 rewrote `test-plan.md:120`'s AC-22 sentence but carries no `AC-22` in its `acs` array.
- **O16** `main-content.ts:263-268` (round 9's O4) is now accurate: the quoted percentages match
  `blameFlex` / `fileHistoryFlex`, and both AC-19's and AC-05's rules follow from those fixed bases.
  Closed.

## Owner decisions (2026-09-08, round 10)

1. **R10-S2-F2 (the rounding):** `inspector-layout.ts:80` `Math.round` → `Math.floor`, plus a
   non-multiple-of-4 height (`421`) in the loop's table. Flooring can only give the list more and
   keeps every pinned literal green.
2. **R10-S2-F4 (the flat KPI):** drop the ≥ 60 % clause. It is structurally unreachable under the
   measurement the same bullet defines.
3. **R10-S1-F1 (the empty-list rule):** state it once as a clause in **AC-04** — widening its *Given*
   to the filter-with-no-match case — and add the carve-out to the Measurement column of the two §6
   NFR rows. No new AC.
4. **Scope:** fix everything in this wave. Split into three tasks rather than two, to keep the
   dependency acyclic exactly as round 9 did (code ← criteria, test-plan last).

## Artifacts changed by this review

Three follow-up tasks, written to disk and **not committed** (spec / SAD / task docs land in the same
commit as the code they describe):

| task | layer | deps | covers |
|---|---|---|---|
| **T44** — Round-10 code fixes: floor the header cap, restore the loop to 144 assertions, pin the fixed flex bases | domain | T45 | R10-S1-F8; R10-S2-F1, F2, F5 |
| **T45** — Round-10 criteria and chain amendment: the empty-list rule, the flat KPI, and the layer T41 did not open | docs | — | R10-S1-F1, F2, F6, F7, F9; R10-S2-F4; O4, O6, O7, O10, O11, O12, O13, O14 |
| **T46** — Round-10 test-plan re-point: the thesis, the NFR validation section and the overstated sweep rows | docs | T44, T45 | R10-S1-F3, F4, F5, F10; R10-S2-F3; O5, O8, O15 |

## Gate result

**CHANGES REQUESTED.**

The round-9 wave did what it was asked to do, and it is the best-evidenced wave on this branch:
all five mutations reproduce exactly, each reddening the one row it names; the gate is 834/834 green
on a runner that is now deterministic and demonstrably so; and AC-01…AC-22 trace spec → SAD flow →
ux flow → screen → task → code → test for the first time since the feature started, with AC-22
existing end to end where it existed nowhere.

Three things block the gate. **First, the same defect class the branch has been removing since
round 6 is present once more, in a place no round has looked**: the fixed flex bases that are the
whole of AC-19, and on which the owner's AC-05 correction explicitly rests, can be turned into
growing panels with the entire suite green. **Second, the two broadest quality claims in the suite
are narrower than they read** — the 144-configuration loop asserts 120, and the 24 it stopped
asserting are precisely the behaviour T40 introduced; and the 120 it does assert all sit in the one
residue class where `Math.round` cannot break the floor, which it otherwise does for 434 of 961
expanded heights and half of all collapsed ones. **Third, the chain amendment stopped one layer
short of where several round-9 findings lived**: the two measurements it removed from `spec.md` §6
are still what `sad.md` §10 QG-1 and `test-plan.md` §NFR validation tell the release checklist to
run, the preference count is still «two» in §3 and in the C4 container, the canonical glossary still
describes the pre-reversal column, and the wave's own new rule — a list with nothing to draw claims
no share — is in four artefacts and the code while the two NFR rows the checklist measures forbid it.

T44, T45 and T46 close all fifteen findings. **Owner-only prerequisites for `ship` remain unchanged:**
T26's screenshots (still `blocked`), the R15 Linux check, and the manual checklist — AC-20 and
AC-19's UI row.
