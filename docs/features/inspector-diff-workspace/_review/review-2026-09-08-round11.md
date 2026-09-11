---
slug: inspector-diff-workspace
date: "2026-09-08"
round: 11
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T40–T46 working tree
previous_review: review-2026-09-08-round10.md (CHANGES REQUESTED at 805a32d + the T40–T43 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality of the changed surface). Each ran in its own git worktree with a junctioned node_modules, over a detached 805a32d with the round-10 working patch applied; the lead measured the gate in the main tree and re-verified the sharpest findings in a third worktree.
---

# Re-review round 11 — inspector-diff-workspace — 2026-09-08

## Scope

Eleventh review, and the first over the **round-10 fix wave**: **T44** (code fixes), **T45**
(criteria and chain amendment) and **T46** (test-plan re-point), all three **uncommitted** at review
time, per the standing rule that spec / SAD / task docs land in the same commit as the code they
describe.

Whole feature diff `7cd47b4..HEAD` plus the working tree. **Changed surface since round 10** — the
round-10 part of the working patch: **16 files, +638 / −172**, plus three new task files and the
round-10 record:

| task | what |
|---|---|
| **T44** | `inspector-layout.ts` `Math.round` → `Math.floor`; `heights` gains `421`; the loop's `nothingToDraw` branch replaces the deleted `twoRowFloorBinds` hatch; the restore-threshold comment; `growingChildren()` widened to see inline flex; the new AC-19 fixed-basis row; `commit-inspector.spec.ts`'s AC-05 title (O9) |
| **T45** | AC-04's empty-list clause and widened *Given*; the carve-out in the two §6 NFR rows; §7's ≥ 60 % clause dropped; `sad.md` §10 QG-1, §3, C4 L2, §2; the canonical `CONTEXT.md`; `screens.md`, `ux-flows.md`; the T40 / T43 bookkeeping |
| **T46** | `test-plan.md`'s thesis, §NFR validation, the edge case, the sweep rows, AC-19's cover, O5 / O8 / O15 |

Out of scope, unchanged since round 8: four working-tree modifications unrelated to this feature
(`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked
`.mcp.json`. Confirmed absent from the feature diff by both reviewers.

## Gate

Measured by the lead in the main tree and reproduced independently by both reviewers in their own
worktrees; all three agree on every value.

`pnpm test` **835 tests / 63 files green, three consecutive serial runs** (834 → 835 is T44's new
AC-19 row) · `pnpm lint` (biome, 266 files) clean · `tsc --noEmit -p tsconfig.spec.json` clean ·
`pnpm build` clean, 908.12 kB initial total, no budget warning · `git status --porcelain -- src-tauri`
empty, so the Rust gate is unchanged. The one stderr line (`[cdkFocusInitial]` not focusable) is the
known jsdom noise. `fileParallelism: false` (T43) untouched; the three serial runs agree exactly, so
the runner is still deterministic.

`expect(` per touched spec file, `HEAD` → patch: `inspector-layout.spec.ts` 47 → 52,
`main-content.spec.ts` 45 → 49, `diff-workspace.spec.ts` 29 → 33, `commit-inspector.spec.ts`
106 → 106. Nothing relaxed, emptied or deleted.

## What round 10 asked for, and got

**All fifteen round-10 findings are addressed at the `file:line` each named** — thirteen fully
closed, two partially (R10-S2-F5, and the O6 / O7 pair). **All four owner decisions are implemented
exactly as decided**: `Math.floor` + height `421`; the ≥ 60 % KPI clause dropped; the empty-list rule
as a clause in AC-04 plus a carve-out in the two §6 NFR rows, with §5 still ending at AC-22 and no
new AC; and the three-task acyclic split (`T45 → T44 → T46`). Thirteen of the sixteen observations
are taken.

**Every mutation the wave claims reproduces.** Verified independently by both reviewers and, for the
sharpest, by the lead in a third worktree, each on a tree verified clean before and after:

| # | Mutation | Result |
|---|---|---|
| MUT-1 | `main-content.ts` `blameFlex` → `'1 1 …'` | 1 failed / 834 — the AC-19 row alone |
| MUT-2 | `main-content.ts` `fileHistoryFlex` → `'1 1 …'` | 1 failed / 834 — same row |
| MUT-3 | `inspector-layout.ts:84` `Math.floor` → `Math.round` | 1 failed / 834 — the sweep, at `availableHeight: 421` |
| MUT-4 | revert the `fileCount === 0` arm of `protectedList` | 2 failed / 833 — the 640 px row *and* the sweep at 200 px (before T44: the 640 px row alone) |
| MUT-5 | drop `Math.max(…, panelHeadH)` | 1 failed / 834 — T40's guard row, `expected 16 to be 34` |
| MUT-6 | drop `Math.max(LIST_ROWS_FLOOR, …)` | 1 failed / 834 — same row, `expected 1 to be 2` |
| MUT-8 | drop `Math.min(headerHeight, headerMaxH)` | 1 failed / 834 |
| MUT-9 / MUT-10 | the chevron gate forced to either constant | 1 failed / 834 each, opposite halves of the AC-06 row |
| MUT-15 / MUT-16 | the two share floors moved | 3 failed / 832 and 8 failed / 827 |
| MUT-17 | the History diff slot made to grow | 4 failed / 831 — and it shows the four pre-existing `growingChildren` callers are still meaningful |

**R10-S1-F8 is closed and provably so** — the fixed flex bases are the whole of AC-19 and the reason
the owner corrected AC-05 to «left empty», and MUT-1 / MUT-2 each redden the new row and only it.
**R10-S2-F1 is closed**: the sweep asserts all **168** configurations (7 heights × 6 file counts × 2
collapse states × 2 token sets) with no escape hatch left — 28 empty ones assert the bare head, 140
assert `share ≥ floor`, 0 failures, reproduced numerically by both reviewers and the lead. **Owner
decision 1 is right across the whole reachable space**: with `Math.floor` the protected share meets
its floor for every height 40…1000 px in both densities except the low band where the hard floors
deliberately win, and every pinned literal (606, 320, 303, 210, 175, 100, 56, 34) stays green.

**The chain still traces end to end.** Stage 1 walked US-01…US-08 and AC-01…AC-22 through
`sad.md` §6 → `ux-flows.md` → `screens.md` → `test-plan.md` → `tasks.json` → code → test, opening the
rows this wave touched rather than grepping the AC id: every US has ≥ 1 AC and ≥ 1 flow, every AC
reaches code and test, and all 22 have a UI-tier row (AC-20 manual by declaration, `sad.md:672`).
Nothing dropped out at any layer.

## Findings — stage 1 (spec / AC compliance)

| id | Finding | Resolution |
|---|---|---|
| **R11-S1-F1** ≡ **R11-S2-F5** | **The restore threshold R10-S2-F5 asked to be corrected is still wrong, by ten pixels, and its closing instruction drops the collapsed case.** `inspector-layout.spec.ts:426-435` states the deleted `twoRowFloorBinds` clause «needs the clause only below 68 px expanded and **126 px** collapsed (measured over 40…1000 px, both densities)» and closes «restore it … only for a height under ~68 px». Swept against the shipped policy by both reviewers and the lead: expanded `h ≤ 67` ✓, collapsed **`h ≤ 135`** (comfortable) and `h ≤ 119` (compact). `126` is neither density's bound, and the band `[126, 135]` fails for a *different* reason — there `0.75h > 94`, so the two-row floor no longer binds and the miss comes from `Math.max(headerAllowance, panelHeadH)` lifting a 31.5–33.75 px allowance to 34. R10-S2-F5's whole subject was that a wrong number here is what makes the note dangerous | **Fix now** → T47 |
| **R11-S1-F2** ≡ **R11-S2-F3** | **AC-04's newly added clause names «a filter that matches none» as its reachable case, and the wiring that makes that case work is asserted by nothing.** The clause's own marker (`spec.md:113`) and `inspector-layout.ts:70-71` both rest on the policy being fed the **displayed** row count; `commit-inspector.ts:548` reads `this.fileRows().length`, built from `visibleFiles` → `filterFiles(…, filter())`. Mutation, run by both reviewers and the lead: `→ this.details()?.files.length ?? 0` leaves **63 files / 835 tests green**. A 30-file commit whose filter matches nothing would then keep the 50 % share reserved for a list drawing no row — R10-S1-F1's defect exactly, the one this criterion was written for. AC-04's automated cover is two unit rows fed `fileCount: 0` as a literal plus a component row that reads only the header count and the empty copy; no component row reads `--inspector-header-max-h` for an empty or filtered-empty list | **Fix now** → T47 |
| **R11-S1-F3** | **T45's DoD and Outcome claim `tasks.json` and the task files agree on `files_hint`; two of seven disagree, one of them T45's own record.** `round9-code-fixes.md:8` still names `diff-viewer/diff-view.spec.ts` where `tasks.json` was corrected to `diff-workspace/diff-workspace.spec.ts` (O7 fixed on the machine side, left stale on the human side); `round10-criteria-and-chain.md:6-13` omits `screens.md` and `ux-flows.md` while `tasks.json` lists both — and T45's own Outcome reports amending five lines across those two files. `files_hint` is the machine contract `implement` reads to build lanes, and both waves were kept serial precisely because two lanes cannot share a file. O6 reintroduced by the task asked to close it | **Fix now** → T49 |
| **R11-S1-F4** | **§7's third KPI still measures the pre-reversal proportion and cannot be met under either reading.** `spec.md:255` — «header + commit file list for a one-file, subject-only commit at 1280 × 800 — baseline about 275 px (fixed two-fifths); target ≤ 220 px expanded, ≤ 70 px collapsed». Allocated: the History diff slot is `h-0` (`main-content.html:120-124`) and the commit inspector block is the column's only `flex-1` child, so the two blocks consume the whole column. Drawn: 34 + 34 + 30 = **98 px** collapsed with the one row a one-file commit draws, against a 70 px target — arithmetic already in the repo at `screens.md:50`, which flagged the ambiguity «not decided here» on 2026-09-03 and was never decided. R10-S2-F4's defect class, one bullet below the bullet this wave amended; T45's DoD scoped §7 to a single `grep -n "60 %"` | **Owner decision: drop the bullet** → T48 |
| **R11-S2-F4** (stage 2, AC-level) | **§6 NFR row 3 / AC-18 / `sad.md` §10 QG-1 / `test-plan.md:156` promise a cross-placement share the shipped policy misses, in the configuration this wave made canonical.** Measured independently by stage 2 and the lead: at the bottom's 220 px minimum (`main-content.ts` `MIN_BOTTOM_PX`) with blame and file history stacked at a fixed 30 % + 20 % = 110 px, and the header **collapsed**, the share is **0.6909** (comfortable) / **0.7273** (compact) against **0.7500** with the inspector on the right. The cause is legitimate policy — the panel-head guard MUT-5 pins, beating the 0.75 floor — but the criterion carries no carve-out and nothing can see the miss: the 168-configuration sweep passes `stackedPanelsHeight: 0` throughout, T40's 220 / 110 row asserts the expanded case only, and `test-plan.md:156`'s checklist bullet never combines the bottom minimum with both panels and a collapsed header. AC-18's own amendment marker asserts «the policy applies the same ratios to whatever remainder it is given», which is what this falsifies | **Owner decision: carve-out in the criterion + pin the collapsed twin** → T48 (text) + T47 (assertion) |

## Findings — stage 2 (quality, edge cases, test adequacy)

| id | Finding | Resolution |
|---|---|---|
| **R11-S2-F1** | **`421` closes only the expanded half of R10-S2-F2; the collapsed residue class is still unwatched.** `inspector-layout.spec.ts:354-359` treats two conditions as one: expanded, `headerAllowance = 0.5h`, so round-half-up bites iff `h` is **odd** — `421` covers it; collapsed, `headerAllowance = 0.25h`, so it bites iff `h ≡ 2, 3 (mod 4)`, and the table is `0, 0, 0, 1, 0, 0, 0 (mod 4)` — **no height in the failing class**, exactly as before the wave. Mutation: round on the collapsed path only (`(headerCollapsed ? Math.round : Math.floor)(…)`) leaves **835 green**, while the swept behaviour breaks the collapsed floor at 528 heights (comfortable) / 520 (compact). Measured remedy: one height `≡ 2, 3 (mod 4)` — with `422` added the same mutation reddens at `availableHeight: 422`, and the shipped policy stays green with it | **Fix now** → T47 |
| **R11-S2-F2** | **The widened `growingChildren()` is a whitelist of two mechanisms, and the one it cannot see is the pre-feature idiom.** `main-content.spec.ts:204-213` counts a child as growing by the `flex-1` class **or** an inline `flex` whose grow term is not `0`. The parse is correct for every value the templates set, and MUT-1 / MUT-2 prove the inline path works. Mutation: give blame the idiom `sad.md:36` records for the pre-feature stack — `class="… flex-[3] …"`, `[style.flex]` dropped — and the suite is **835 green**. A stacked panel that grows is the exact violation of AC-19 and the reason AC-05 can say «left empty». The same hole covers `grow`, `flex-auto`, any `flex-[n]` and a grow arriving from a stylesheet rather than the template | **Fix now** → T47 |
| **R11-S2-F6** | **The caller's clamp guard is a live guard with no test, and it makes the unit tier's collapsed-clamp assertions unobservable.** `commit-inspector.ts:585-587` — «Never zero: the header collapses a frame before this pass agrees, and a zero clamp would blank the body for that frame» — `Math.max(layout.clampLines, 1)`. Mutation: drop the `Math.max` → **835 green**. Second consequence: the policy returns `clampLines: 0` for a collapsed header and two unit rows assert it (`inspector-layout.spec.ts:194`, `:210`), but the only consumer overrides it to `1` before writing `--inspector-clamp-lines`, so no collapsed value the policy returns ever reaches the DOM. The one row that reads the variable (`commit-inspector.spec.ts:435`) is expanded, where the policy already returns 1. `test-plan.md:14`'s new thesis names «floors at one clamp line» | **Fix now** → T47 |

## Checked and clean

No `as any`, no `as unknown as`, no non-null `!` introduced in the patch · no new `invoke(`,
`innerHTML`, `eval`, `document.write`, storage access or bypassed sanitizer · no new IPC command,
DOM sink, secret or widened Tauri surface · no duplicated `src/testing/` helper · no dead code
introduced by the wave · no assertion relaxed, emptied or deleted without a stronger replacement
(counts above) · the four pre-existing `growingChildren(...) === [inspectorBlock(...)]` rows are
strictly stronger for T44's widening and still meaningful (MUT-17 reddens four of them) · Angular
idiom consistent with the repo (signals, `computed`, OnPush, zoneless, the new control flow) · the
production files md5-compared before and after the whole mutation battery and byte-identical, with
`git status --porcelain -- src` carrying nothing but the wave · rounds 6–10's recorded observations
re-checked on the touched files, none worsened.

## Observations — recorded, not findings

- **O1** the working patch carries two changes **no task in this wave declares**: the AC-06 chevron
  row in `diff-workspace.spec.ts` and `vitest.config.ts`'s docblock. Both belong to the round-9 wave
  (T40's test half and T43), whose code halves are in `805a32d` while their test and comment halves
  are still uncommitted. Nothing is wrong with the content; it means the next commit's `SDD-Task`
  trailers are **T40–T46**, not T44–T46 alone. Lead's business, not a defect.
- **O2** `inspector-layout.ts:101`'s `fileCount === 0` term is redundant — the enclosing
  `Math.min(fileCount, …)` already yields 0 — and removing it leaves the suite green. It reads as
  intentional symmetry with `protectedList` and predates the wave; mentioned, not deleted, per the
  repo rule.
- **O3** repo-root `CONTEXT.md:12` still defines the inspector as holding «the diff viewer». Round 10
  routed it (O12) to T45 with «decide it here»; the file was not touched and T45's Outcome does not
  mention it. Still true of Changes, and the per-feature entry wins, so defensible — but routed and
  silently dropped rather than decided.
- **O4** `main-content.spec.ts:211`'s `grow !== undefined` is dead under the repo's current
  `tsconfig` (`strict` without `noUncheckedIndexedAccess`); harmless.
- **O5** the same parse reads `flex: none` as growing. Over-strict rather than blind, and no template
  sets it — the opposite direction from R11-S2-F2.
- **O6** T44's title says «restore the loop to **144** assertions» in four places
  (`round10-code-fixes.md:3`, `tasks.json` T44 `title`, `tracker.md:51`, `_epic.md:167`) while the
  loop it delivered has **168**. Right everywhere it is operative (T44's DoD, its Outcome,
  `test-plan.md:35`, `:96`); the four titles carry the round-10 record's pre-decision figure.
- **O7** `test-plan.md:96` is an **AC-02** row naming T44 in its Task column while `tasks.json` T44
  `acs` has no `AC-02`; round 10's O15 class, in a row this wave re-pointed. T44 also touched
  `commit-inspector.spec.ts` (the O9 title) without naming it in either `files_hint`.
- **O8** `sad.md:643`'s US-03 row was not extended with **F9**, the flow T41 added for AC-22; the
  AC-22 row at `:674` names it, so the chain holds. `sad.md:677`'s vocabulary note still says «F1–F8»
  where F9 uses the same vocabulary, and §6 places F9 between F2 and F4.
- **O9** the sweep's `nothingToDraw` branch ignores `headerCollapsed` — the invariant is identical for
  both — so 14 of the 28 empty configurations are duplicates. Worth knowing when 168 is quoted as
  breadth. The *other* loop (`:362-397`) also iterates `fileListCollapsed`, so it is 336
  configurations; no artefact states its count.
- **O10** `inspector-layout.ts:82` compresses R10-S2-F2's collapsed figure to «half of them
  collapsed»; measured 528 / 961 comfortable and 520 / 961 compact, so «half» is fairer than the
  round-10 record's own «312» (the subset above 378 px). No action.
- **O11** round 10's O2 stands: the AC-06 chevron row is in the render-window-dependent family, green
  3/3 serially, with the 5 s default `testTimeout` the only margin. For T43's deferred successor.
- **O12** AC-19's second half («the released height goes to the commit file list») is still automated
  only indirectly; `test-plan.md:91` leaves the «grew by the released height» measurement to the
  manual checklist, as round 10 declared. No regression.

## Owner decisions (2026-09-08, round 11)

1. **R11-S2-F4 (the cross-placement share):** **carve-out in the criterion**, the same shape as
   round-10 decision 3 — the cross-placement guarantee does not apply where the header-cap or two-row
   floor binds (a remainder under 136 px comfortable / 120 px compact). Amend AC-18, `spec.md` §6
   row 3, `sad.md` §10 QG-1 and `test-plan.md:156` together, and pin the collapsed twin at the
   220 / 110 row. The policy is right; the criterion overreaches.
2. **R11-S1-F4 (§7's third KPI):** **drop the bullet.** The first KPI bullet already measures the
   protected share, which is what §6 and AC-03 now define; this one measures the pre-reversal
   two-fifths proportion. Dropping it also closes `screens.md:50`'s open question.
3. **Scope:** fix everything in this wave, split into three tasks on the round-9 / round-10 pattern
   (code ← criteria, records last) so the dependency stays acyclic.

## Artifacts changed by this review

Three follow-up tasks, written to disk and **not committed** (spec / SAD / task docs land in the same
commit as the code they describe):

| task | layer | deps | covers |
|---|---|---|---|
| **T47** — Round-11 code fixes: the collapsed residue height, the class-based grow, the displayed-row-count wiring, the caller's clamp guard, the collapsed twin | domain | T48 | R11-S1-F1, F2; R11-S2-F1, F2, F4 (assertion), F6 |
| **T48** — Round-11 criteria amendment: the cross-placement carve-out and the KPI bullet | docs | — | R11-S2-F4 (text); R11-S1-F4; O3, O8 |
| **T49** — Round-11 records: the test-plan re-point and the `files_hint` drift | docs | T47, T48 | R11-S1-F3; O6, O7, O9 |

## Gate result

**CHANGES REQUESTED.**

The round-10 wave did what it was asked to do, and it is the best-evidenced wave on this branch. All
fifteen findings are addressed at the sites they named, all four owner decisions landed exactly as
decided, thirteen of sixteen observations are taken, every mutation the wave claims reproduces —
including the two that close R10-S1-F8 — the sweep now asserts all 168 configurations with no escape
hatch, `Math.floor` is correct across the whole reachable space, the gate is 835 / 835 green on three
serial runs with lint, `tsc` and build clean, and AC-01…AC-22 trace end to end with a UI-tier row for
each.

Two things block the gate. **First, the defect class this branch has spent five rounds removing is
present four more times, each proved by a mutation that leaves all 835 tests green**: the collapsed
half of the rounding class the wave was asked to watch; the class-based grow the widened helper
cannot see, which is the very idiom the pre-feature stack used; the displayed-row-count signal
AC-04's new clause explicitly rests on; and the caller's clamp guard, whose removal also reveals that
no collapsed `clampLines` the policy returns ever reaches the DOM. **Second, two criteria still
promise what the shipped policy cannot deliver**: the cross-placement share, missed at 0.691 against
0.750 in exactly the configuration this wave canonicalised — with its own amendment marker asserting
the opposite, and no test or checklist step able to see it — and §7's third KPI, unreachable under
both available readings, with the ambiguity recorded and undecided since 2026-09-03. Round 10's
R10-S2-F5 also returns: the corrected threshold is still ten pixels short, in the direction that
sends a maintainer to change the policy instead of the table.
