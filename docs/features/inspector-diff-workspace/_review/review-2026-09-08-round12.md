---
slug: inspector-diff-workspace
date: "2026-09-08"
round: 12
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T40–T49 working tree
previous_review: review-2026-09-08-round11.md (CHANGES REQUESTED at 805a32d + the T40–T46 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality, edges, test adequacy of the changed surface). Each ran in its own git worktree with a junctioned node_modules, over a detached 805a32d with the whole working patch applied; the lead measured the gate in the main tree and re-derived the sharpest arithmetic in a third worktree.
---

# Re-review round 12 — inspector-diff-workspace — 2026-09-08

## Scope

Twelfth review, and the first over the **round-11 fix wave**: **T47** (code fixes), **T48** (criteria
amendment) and **T49** (records), all three **uncommitted** at review time, per the standing rule
that spec / SAD / task docs land in the same commit as the code they describe.

Whole feature diff `7cd47b4..HEAD` (130 files, +12481 / −346) plus the working tree
(21 files, +938 / −185, six under `src/`). **Changed surface since round 11:**

| task | what |
|---|---|
| **T47** | `heights` gains `422` (the collapsed residue class); the new `stackedPanelWrappers()` helper + `GROWTH_UTILITIES` and the AC-19 mechanism assertion; the AC-04 filter-matching-nothing component row; the AC-03 collapsed-clamp component row; the collapsed twin of the 220 / 110 row; the corrected restore-threshold note |
| **T48** | the cross-placement carve-out in AC-18, `spec.md` §6 row 3 and `sad.md` §10 QG-1; §7's third KPI bullet dropped; `screens.md:50`'s open question closed; `sad.md` F9 bookkeeping; repo-root `CONTEXT.md` decided in; T47–T49 registered |
| **T49** | `test-plan.md`'s third §NFR bullet + its fourth manual run; the sweep rows' counts and residue classes; the two new rows and AC-19's extension; the `files_hint` drift and the two records that claimed it closed |

Out of scope, unchanged since round 8: four working-tree modifications unrelated to this feature
(`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked
`.mcp.json`. Confirmed absent from the feature diff by both reviewers and the lead.

## Gate

Measured by the lead in the main tree and reproduced independently by both reviewers in their own
worktrees; all three agree on every value.

`pnpm test` **838 tests / 63 files green, three consecutive serial runs** (835 → 838 = T47's three
new rows) · `pnpm lint` (biome, 266 files) clean · `tsc --noEmit -p tsconfig.spec.json` exit 0 ·
`pnpm build` clean, 908.22 kB initial total, no budget warning · `git status --porcelain -- src-tauri`
empty and `git diff --name-only 7cd47b4..HEAD -- src-tauri` empty, so the Rust gate is unchanged. The
one stderr line (`[cdkFocusInitial]` not focusable) is the known jsdom noise. `fileParallelism: false`
(T43) untouched; the three serial runs agree exactly.

`expect(` per touched spec file, `HEAD` → patch: `inspector-layout.spec.ts` 47 → 55,
`main-content.spec.ts` 45 → 52, `commit-inspector.spec.ts` 106 → 113, `diff-workspace.spec.ts` 29 → 33
(unchanged since round 11). `git diff HEAD -- src | grep -c '^-.*expect('` = **0**; the only removed
assertion-bearing line in the whole patch is an `it(...)` title rename (round-10 O9). No `it.skip` /
`.only` / `.todo` / `.concurrent`.

**Reviewer disclosure, recorded so it is not read as the wave's:** one of stage 2's intermediate
`pnpm lint` runs failed on a formatter diff in `inspector-layout.ts` — its own mutation script had
rewritten the file with CRLF endings (the same Windows/python trap this branch has hit before). It
converted back to LF and re-ran; lint is clean, and both of its tree fingerprints
(`git diff HEAD -- src` and `git status --porcelain`) match the pre-battery baseline byte for byte
before and after every mutation. The wave's lint is clean; the failure was the reviewer's.

## What round 11 asked for, and got

**Five of the eight round-11 findings are fully closed and provably so; three are partial.** All three
owner decisions are implemented as decided — one of them incompletely propagated.

| round-11 finding | status | evidence |
|---|---|---|
| **R11-S1-F1 ≡ R11-S2-F5** restore threshold | **partial** | the bounds are now exact in all four cells (67 / 59 expanded, 135 / 119 collapsed, `inspector-layout.spec.ts:462-463`) and the «only … under ~68 px» sentence is gone — but the causal attribution is false → **R12-S1-F1** |
| **R11-S1-F2 ≡ R11-S2-F3** displayed row count | **closed** | new component row `commit-inspector.spec.ts:543-585`; **MUT-C** → 1 failed / 837, `expected '25' to be '0'`. The row pins the cap against the policy's output *and* against `COLUMN_H − panelHeadHeight()`, so a junk helper input cannot make it pass |
| **R11-S1-F3** `files_hint` drift | **closed** | parsed both records for all 49 tasks: **0 mismatches**, 0 dangling deps, 0 ids without a task file, 0 task files without an entry. Verified independently by both reviewers and the lead |
| **R11-S1-F4** §7's third KPI | **closed** | bullet gone (`spec.md:255`); §7 has three bullets; the arithmetic preserved in the dated marker; `screens.md:50`'s open question resolved |
| **R11-S2-F1** collapsed residue | **closed** | `heights = [200, 300, 420, 421, 422, 560, 700, 900]`; **MUT-A** → 1 failed / 837 at `availableHeight: 422`; **MUT-M** (the same mutation with `422` removed) → 838 green, so `422` is exactly what closes it. **MUT-A2** → 1 failed / 837 at `availableHeight: 421`, so each height watches its own formula |
| **R11-S2-F2** class-based grow | **closed** | `stackedPanelWrappers()` + the AC-19 mechanism assertion; **MUT-B** → 1 failed / 837, `expected '' to match /^0 0 /`, reproduced by both reviewers *and* the lead; **MUT-F** (the same on `app-file-history-panel`) → 1 failed / 837, so the second panel is covered too, which T47 did not claim |
| **R11-S2-F4** cross-placement share | **partial** | the carve-out is at all four named sites and **MUT-E** reddens the guard row and its twin (2 failed / 836) — but two further artefacts still state the un-carved claim → **R12-S1-F2**, the twin does not pin the share it is named for → **R12-S2-F2**, and the band over-reaches → **R12-L-F1** |
| **R11-S2-F6** caller's clamp guard | **closed** | new component row `commit-inspector.spec.ts:445-480`; **MUT-D** → 1 failed / 837, `expected '0' to be '1'`. It is now the only observable cover for the collapsed clamp, as the task says |
| **Owner decision 1** carve-out + collapsed twin | **implemented, incompletely propagated** | → R12-S1-F2, R12-S2-F2, R12-L-F1 |
| **Owner decision 2** drop §7's third KPI | **as decided** | `spec.md:255` |
| **Owner decision 3** three tasks, acyclic, records last | **as decided** | 49 tasks, DFS finds no cycle, no dangling dep; `T48 → T47 → T49` mirrored in `_epic.md:102-107` and `tracker.md` |

**Every mutation T47 records reproduces**, at the exact row and message its Outcome quotes, verified
independently by both reviewers on trees md5-checked clean before and after each run — MUT-A, MUT-B,
MUT-C, MUT-D and MUT-E, including MUT-E's two-row failure. Thirteen of round 11's observations are
taken (O3, O6, O7 first half, O8, O9, and everything rounds 10 and 11 routed into the wave).

## Findings — stage 1 (spec / AC compliance)

| id | Finding | Resolution |
|---|---|---|
| **R12-S1-F1** ≡ **R12-S2-F3** (+ R12-S2-F2's comment half) | **The restore-threshold note — the same note rounds 10 and 11 both sent back — now carries the right numbers and the wrong cause, and its closing instruction points a maintainer at the guard that is not responsible.** `inspector-layout.spec.ts:465-478` claims «they have **TWO causes, not one**», that «up to 125 px collapsed the 2-row floor does set `protectedList`», and tells the next reader to restore a `twoRowFloorBinds`-shaped predicate «only for the cause that applies». Swept independently three times (both reviewers and the lead) over 40…2000 px, both densities, both collapse states: of the **224** missing configurations, **224** are fixed by removing `Math.max(headerAllowance, panelHeadH)` and **0** by removing the two-row floor — the bound is the closed form `panelHeadH / (1 − ratio) − 1` (34/0.5−1 = 67, 34/0.25−1 = 135, 30/0.5−1 = 59, 30/0.25−1 = 119) and does not move when the list's row floor is set to 0, 1, 3 or 6 rows. Two further figures in the same note are wrong: `:470-471` says the deleted predicate «held for every h < 190 expanded and h < 376 collapsed» where it held for `h ≤ 187` / `h ≤ 179` expanded and `h ≤ 375` / `h ≤ 359` collapsed — `190` is neither density's bound and the causal paragraph gives the comfortable numbers only. And the collapsed twin's own comment (`:355`) says «the collapsed 75 % floor (82.5) leaves an allowance of 27.5» where `protectedList = max(94, 82.5) = 94` leaves **16** (comfortable) / **20** (compact): `27.5` is `110 − 82.5`, the allowance the share floor *would* have left had it bound — a number the policy never computes, contradicted by the suite's own MUT-E output (`expected 16 to be 34`, not 27) and by the sweep note 130 lines below in the same file. `grep -rn "27.5"` finds the sentence at exactly two live sites: `inspector-layout.spec.ts:355` and `round11-criteria-amendment.md:40` (T48's Why). The wrong enumeration was then copied into AC-18 (`spec.md:198`), §6 row 3 (`spec.md:231`) and `test-plan.md:166` — so **four** wrong statements now sit in this one note and its echoes: the «TWO causes» attribution, the 27.5 allowance, the 190 / 376 predicate history, and a closing instruction pointing at a two-row-floor-shaped predicate for a band caused entirely by the head-cap guard | **Fix now** → T50 (criteria) + T51 (the spec-file comments) + T52 (T48's record) |
| **R12-S1-F2** ≡ **R12-S2-F5** | **The carve-out reached the four sites the owner decision named and left two more artefacts stating the claim the measurement falsifies — one of them the AC-18 → test row — so one file now gives a tester two contradictory expected results for the same run.** `test-plan.md:90` is AC-18's `e2e-through-UI · manual` row: «the list's protected share at the bottom is ≥ the share it has with the inspector on the right, same window size and density», its only marker round 9's. Executed at the bottom's 220 px minimum with both panels stacked and the header collapsed it measures 0.691 / 0.727 against 0.750 and is recorded as a **FAIL** against a criterion the owner deliberately carved out — while `test-plan.md:166`, three sections below in the same file, now prescribes exactly that run *with* the carve-out. `ux-flows.md:179` carries the US-07 flow prose with no carve-out and no round-11 marker. On the coverage side, neither AC-18 row (`:89` component, `:90` e2e) names **T47** or the collapsed twin — the twin is filed under **AC-03** (`:43`) — and `tasks.json` T47 claims `AC-18` that no AC-18 row attributes to it (round-11 O7's pattern, in the wave whose job included closing it) | **Fix now** → T50 (the two artefacts) + T52 (the coverage rows) |
| **R12-L-F1** (lead) | **The carve-out's band is correct for the collapsed share and over-broad for the expanded one, so the criterion now waives a guarantee the policy delivers — including at the very configuration the wave canonicalised.** AC-18, `spec.md:231`, `sad.md:733` and `test-plan.md:166` all waive the cross-placement share for «a remainder under 136 px comfortable / 120 px compact» without distinguishing the collapse state. Measured over 40…1000 px: the expanded share is met from **68 px** comfortable / **60 px** compact upward, so `r ∈ [68, 135]` is waived and met. That band contains the whole reachable bottom remainder (`r ≥ 110`, since both stacked panels take 30 % + 20 % of a column with a 220 px minimum): at 220 / 110 **expanded** the share is 0.6909 against a 0.50 floor — comfortably met, and waived by the criterion as written. Neither reviewer raised it; stage 1 explicitly cleared the band, which is right for the collapsed half only | **Owner decision: fix the cause and split the band per collapse state** → T50 |

## Findings — stage 2 (quality, edge cases, test adequacy)

| id | Finding | Resolution |
|---|---|---|
| **R12-S2-F1** ≡ **R12-S1-F3** | **The new AC-19 assertion pins the *shape* of the stacked panels' basis and nothing pins its *size*, so a panel can still swallow the height AC-19 reserves for the commit file list, with all 838 tests green — and the wave's own numbers are derived from the three constants nothing watches.** `main-content.spec.ts:433-440` asserts `style.flex` matching `/^0 0 /` plus an empty growth-utility list; `grep -rn "MIN_BOTTOM\|'0 0 30%'\|0 0 20%\|0 0 37.5\|0 0 28" src/` returns only the three production lines (`main-content.ts:46`, `:271`, `:275`) plus one prose reference. Four mutations, each **838 passed / 63 — green**: the two bases doubled (**MY-M1**), the bases widened to 45 % / 35 % (**MUT-G**), a `[style.minHeight]="'400px'"` on the blame wrapper with the basis kept (**MY-M2**), and `MIN_BOTTOM_PX` 220 → 400 (**MY-M5**). Under MY-M1 the two panels take 90 % of the column instead of 50 %; under MY-M2 blame takes 400 px whatever it declares — which is AC-19's actual subject, stated in those words at `main-content.ts:266`. The load is new: T47's comment at `inspector-layout.spec.ts:328-330` cites all three constants as the reason 220 / 110 is «the tightest configuration the app can actually reach», and T48's carve-out band and T49's fourth manual run are both derived from that 110 | **Owner decision: pin the values and the min/max-height** → T51 |
| **R12-S2-F2** | **The collapsed twin does not pin the collapsed share it is named for.** `inspector-layout.spec.ts:352-377`. At `availableHeight: 220, stackedPanelsHeight: 110` expanded and collapsed are numerically identical — `protectedList = max(94, 82.5) = 94` either way, allowance 16, cap 34, share 0.6909 — so the twin exercises no code path its expanded sibling one row above does not, and reddens to no mutation its sibling does not already catch. **MY-M3** (`COLLAPSED_LIST_SHARE_FLOOR` removed outright, so the collapsed floor becomes 0.5) → **3 failed / 835**: the two 75 %-floor unit rows (`expected 350 to be 175`) and the share sweep at 200 px — **the twin is not among them**. Yet `test-plan.md:43` says the twin «pins the one configuration where AC-18's cross-placement share yields», `:166` calls it the automated counterpart of the fourth manual run, and T47's Notes call it behaviour «that must be pinned so it cannot drift silently». The collapsed share at the bottom placement can drift silently; what cannot is the panel-head guard, already pinned by T40's row | **Owner decision: add a bottom row where the 75 % floor binds** → T51 |
| **R12-S1-F4** ≡ **R12-S2-F4** | **T48 reports the carve-out as landing in three criteria sites «in those words»; one of the three does, and a third grep-shaped DoD bullet fails unacknowledged.** `round11-criteria-amendment.md:96-99` (DoD) and `:113-121` (Outcome). Verbatim at `spec.md:198` (AC-18) and, via T49, `test-plan.md:166`. Condensed at `spec.md:231` (drops «the list's» and the scrollbar reason) and at `sad.md:733` (drops **both** named mechanisms, leaving only «where a hard floor binds»). The substance survives at all four sites, so this is a claim defect, not a criterion defect — but QG-1 drops exactly the half R12-S1-F1 shows the wave got wrong, and this is R11-S1-F3's class (a task asserting an agreement between records the records do not have) in the wave sent to close R11-S1-F3. Same task: the DoD bullet «`grep -n "two-fifths" spec.md` returns nothing in §7» is **unmet** — `spec.md:255` quotes «baseline about 275 px (fixed two-fifths)» inside the dropped-KPI marker. T48's Outcome has a paragraph naming *two* grep-shaped bullets it could not satisfy, and its reasoning is sound (the house convention quotes the retired wording inside the marker that retires it); this third bullet of the same kind is simply not named, so the DoD reads as satisfied | **Fix now** → T52 |

## Checked and clean

All five of T47's mutations reproduce at the exact row and message recorded, plus five of the
reviewers' own (MUT-A2, MUT-F, MUT-M, MY-M3, MY-M4) and one the lead re-ran independently (MUT-B:
1 failed / 837, `expected '' to match /^0 0 /`, tree md5-identical before and after) · T48's four
measured figures re-derived from scratch and correct — the collapsed miss boundary is `≤ 135`
comfortable / `≤ 119` compact, and the share at the 110 px remainder is 0.690909 / 0.727273 against
0.750 · T49's mechanical claims true: `files_hint` agrees between `tasks.json` and **every** task
file for T1…T49 (0 mismatches), the share sweep is 192 (8 × 6 × 2 × 2, `fileListCollapsed` fixed
false), the whole-pixel-cap row 384, and 32 empty configurations of which half are duplicates · the
sweep has no escape hatch — the `nothingToDraw` branch asserts an alternative invariant
(`headerMaxH === availableHeight − panelHeadH`) rather than excusing the configuration, and both arms
of `:484-486` assert · `422` is provably the height that closes the collapsed residue class, and the
bounds table is exact in all four cells · no assertion relaxed, emptied, deleted or swapped for a
weaker form (counts above, content read) · the four pre-existing `growingChildren(...)` rows untouched
and unweakened; `growingChildren()` itself untouched, sitting beside `stackedPanelWrappers()` with
distinct documented jobs and the jsdom tier limit recorded · no `as any`, `as unknown as`, non-null
`!`, `@ts-ignore`/`@ts-expect-error` introduced · no new `invoke(`, `innerHTML`, `eval`,
`document.write`, storage access, bypassed sanitizer, IPC command, DOM sink, secret or widened Tauri
surface · no duplicated `src/testing/` helper; the wave's three new symbols are single-file concerns ·
no dead code introduced · determinism holds (`fileParallelism: false`, three identical serial runs;
neither new component row depends on a render window) · T47's attribution of the production changes is
correct — `inspector-layout.ts` is T44's `Math.floor` + `fileCount === 0` arm and T40's comment,
`main-content.ts` a docblock hunk only, and `grep -rn "round 11\|R11-"` over the production files
returns nothing · `tasks.json` DAG acyclic, 49 tasks, consistent with `_epic.md` and `tracker.md` ·
rounds 6–11's recorded observations re-checked on the touched files, **none worsened**.

**AC chain traced end to end.** All eight user stories US-01…US-08 have ≥ 1 AC and ≥ 1 §6 flow
(`sad.md:640-647`, US-03 now naming F9); the AC → flow table carries a row for every AC-01…AC-22 with
AC-20 declared non-runtime N/A; the 87-row coverage table gives every AC ≥ 1 row and ≥ 1 UI-tier row,
21 of 22 with an automated UI row (AC-20 manual by declaration, no visual-regression pipeline). The
two `added-by-fix` ACs were traced at least as strictly as the rest: AC-04's empty / filtered-empty
clause reaches a declared screen state, a criterion marker, the policy comment, a unit row, the 32
empty sweep configurations and a component row MUT-C reddens; AC-22 reaches F9, a task, test-plan rows
and the round-9 preference rows. **Where the chain drops out: AC-18** — see R12-S1-F2.

## Observations — recorded, not findings

- **O1** Even outside the carve-out band the cross-placement guarantee has a flooring residue: the
  right column's collapsed share is `(R − floor(0.25R)) / R`, exceeding 0.75 by up to `0.75/R` when
  `R ≢ 0 (mod 4)`, while a bottom remainder `r ≡ 0 (mod 4)` gives exactly 0.75 — so the bottom share
  can sit ≈ 0.11 percentage points below the right one. Below the precision §6 row 3 implies, and a
  by-product of the `Math.floor` round 10 chose in the list's favour.
- **O2** The classList half of the new AC-19 assertion (`main-content.spec.ts:437-439`) has no
  detection power: an inline `flex` outranks a non-`!important` class rule, so any real class-based
  grow must first lose the inline basis, which `:436` catches. Belt-and-braces, not a hole — the row's
  whole detection power is the line above it.
- **O3** `GROWTH_UTILITIES` (`main-content.spec.ts:230`) flags `grow-0`, which sets `flex-grow: 0`
  (measured: 1 failed / 837, `expected [ 'grow-0' ] to deeply equal []`), and misses `flex-grow` and
  any variant-prefixed form (`md:grow`, `lg:flex-1`) because it is `^`-anchored. Over-strict in one
  direction, blind in another; neither matters while the inline basis is present (O2).
- **O4** `stackedPanelWrappers()` (`:223-227`) is not scoped to the inspector column, unlike
  `growingChildren()`, and `closest('[style*="flex"], div')` resolves to the nearest `div` ancestor —
  a wrapper inserted between the panel and the styled one retargets the assertion. It would fail loud
  (`style.flex` would be `''`), so brittleness rather than a hole.
- **O5** The middle assertion of the new AC-04 row (`commit-inspector.spec.ts:577-580`) compares the
  written cap against a fresh call to the function under test, so it moves with the production code;
  the literal pin at `:583` is what carries the value. Sound because the literal is there.
- **O6** `commit-inspector.spec.ts:578`'s needle `'matches'` is a substring of the filter term the same
  row types, and of the empty-state copy at `commit-inspector.html:299`. A `data-testid` or the full
  sentence would be tighter.
- **O7** The new AC-03 collapsed-clamp row recomputes the policy with `lineH: 0, headerFixedH: 0` to
  assert a constant `0`; the right assertion, but the tokens imply more coupling than exists.
- **O8** The collapsed twin spells its share as `listShare(110, 0, cap)` (`:373`) where its own inputs
  are `220 / 110` and every sibling row spells it `listShare(availableHeight, stacked, cap)`.
  Arithmetically identical; the two numbers no longer match the call.
- **O9** `screens.md:16` still cites `sad.md` §6 as «F1–F8» after F9 exists — in a file T48's own
  `files_hint` names, and the same class as the observation (round-11 O8) T48 closed at `sad.md:678`.
- **O10** `screens.md:50`'s prose still asserts «which meets the spec §7 KPI «≤ 70 px collapsed»» — a
  live reference to the KPI the same wave deleted. The dated marker right after it says the bullet is
  gone, so the house convention covers it, but the stale claim is in prose rather than inside a marker.
- **O11** `tasks.json` T49 `acs` omits **AC-01** while T49 edited the AC-01 sweep row
  (`test-plan.md:35`). Round-11 O7's class in the task that closed O7; bookkeeping only.
- **O12** `tracker.md:60` still cites `inspector-layout.ts:77` and `:98` for the two guards; after T44
  they sit at `:84` and `:75` / `:105`. Historical prose, and the guards are named as well as numbered.
- **O13** AC-01's and AC-02's share sentences (`spec.md:97`, `:101`) remain unqualified; their scoping
  to «inspector right, no stacked panels» lives in AC-18's parenthetical, AC-19's last clause and §6's
  row headers. R9-S2-F6b's resolution, predating this wave — worth knowing when reading AC-02 beside
  the 0.691 measurement.
- **O14** Round 11's O2 (redundant `fileCount === 0` at `inspector-layout.ts:101`), O4
  (`grow !== undefined` dead under the repo's `tsconfig`), O5 (`flex: none` read as growing) and O9
  (the `nothingToDraw` branch ignoring `headerCollapsed`) all stand, none worsened. O9 is now recorded
  at `test-plan.md:145-150` with figures the lead and both reviewers verified.
- **O15** Round-11 O11 / round-10 O2 stands: the AC-06 chevron row (`diff-workspace.spec.ts:154`) is
  still render-window dependent, green 3/3 serially, the 5 s default `testTimeout` its only margin.
  For T43's deferred successor.
- **O16** `pnpm build` reports 908.22 kB against round 11's 908.12 kB with no bundled change in the
  wave (spec code is not bundled). Cross-worktree measurement noise; recorded so the next round does
  not read it as a production change.
- **O17** Task-file `status` is maintained for T47–T49 (`done`) and left at `todo` in the other 46,
  including tasks committed weeks ago; `tasks.json` carries no `status` key at all. The field is not a
  live record on this branch — worth deciding once rather than per wave.

## Owner decisions (2026-09-08, round 12)

1. **R12-L-F1 + R12-S1-F1 (the carve-out sentence):** **fix the cause and split the band per collapse
   state.** Drop «or the list's two-row floor» — it causes none of the 224 misses — and state the band
   as: *a remainder under 68 px comfortable / 60 px compact with the header expanded, or under
   136 / 120 collapsed*. The criterion then promises exactly what the policy delivers, in both
   collapse states.
2. **R12-S2-F1 (the 110 px anchor):** **pin the values and the min/max-height.** Extend the AC-19 row
   from the basis shape to its value (`'0 0 30%'` / `'0 0 20%'` stacked, `'0 0 37.5%'` / `'0 0 28.6%'`
   alone) and assert no wrapper carries a min-height or max-height, inline or by utility; pin
   `MIN_BOTTOM_PX` where the bottom splitter clamp is already tested. Closes MY-M1, MY-M2 and MY-M5.
3. **R12-S2-F2 (the collapsed twin):** **add a bottom row where the 75 % floor binds.** Keep the 110
   twin as the carve-out pin with its comment corrected to name the two-row floor, and add a
   bottom-placement row at a remainder where the collapsed floor actually binds and differs from
   expanded — measured for this record: `availableHeight: 400, stackedPanelsHeight: 200` gives cap 50 /
   share 0.7500 collapsed against cap 100 / share 0.5000 expanded, in both densities, and MY-M3 moves
   the collapsed cap 50 → 100, so the row reddens.
4. **Scope:** fix everything in this wave, split into three tasks on the round-9 / 10 / 11 pattern
   (criteria first, then code, records last) so the dependency stays acyclic.

## Artifacts changed by this review

Three follow-up tasks, written to disk and **not committed** (spec / SAD / task docs land in the same
commit as the code they describe):

| task | layer | deps | covers |
|---|---|---|---|
| **T50** — Round-12 criteria amendment: the carve-out's cause and its per-collapse-state band, and the two artefacts the carve-out never reached | docs | — | R12-L-F1; R12-S1-F1 (criteria half); R12-S1-F2 (the two artefacts); O9, O10 |
| **T51** — Round-12 code fixes: the note's causal text, the collapsed share's own cover, and the constants the 110 px anchor rests on | domain | T50 | R12-S1-F1 (comment half); R12-S2-F1; R12-S2-F2; O8 |
| **T52** — Round-12 records: AC-18's coverage rows, the `acs` drift, and T48's third grep bullet | docs | T50, T51 | R12-S1-F2 (coverage half); R12-S2-F5; R12-S1-F4 ≡ R12-S2-F4; O11, O12 |

## Gate result

**CHANGES REQUESTED.**

The round-11 wave is the best-evidenced wave on this branch and most of it holds. Every one of T47's
five mutations reproduces at the exact row and message it records; `422` is provably the height that
closes the collapsed residue class and each of the two heights watches its own formula; the
class-based grow is caught on **both** stacked panels, which T47 did not claim; the displayed-row-count
wiring and the caller's clamp guard each redden a component row of their own, reaching behaviour the
unit tier cannot; the corrected bounds table is exact in all four cells; T49's mechanical claims are
true across all 49 tasks; T48's four measured figures are right to six decimals; the DAG is acyclic;
and the gate is 838 / 838 green on three serial runs with lint, `tsc` and build clean. Five of eight
round-11 findings and all three owner decisions landed.

Three things block the gate, and all three are this branch's signature class rather than new defects
in the policy. **First, the note rounds 10 and 11 both sent back now has the right numbers and the
wrong cause**: the miss bound is `panelHeadH / (1 − ratio) − 1` and does not move when the list's row
floor is set to 0, 1, 3 or 6 rows, so the two-row floor causes **0** of the 224 missing
configurations — yet the note claims «TWO causes», instructs a maintainer to restore a
two-row-floor-shaped predicate, misstates the deleted predicate's own bounds, and the same wrong
enumeration was copied into AC-18, §6 row 3 and the test plan, while the collapsed twin's comment
narrates an allowance the policy never computes. **Second, the criterion the owner amended now both
under-promises and is contradicted inside one file**: the band waives the expanded guarantee across
`r ∈ [68, 135]` where the policy meets it — including 220 / 110, the configuration the wave
canonicalised — and `test-plan.md:90` still records the un-carved claim as a tester's expected result
three sections from the bullet that carves it out, with AC-18's coverage rows never reaching the
automated row that pins it. **Third, what the wave was sent to pin is pinned and its outcome is not**:
the collapsed twin reddens to nothing its expanded sibling does not already catch and stays green when
the 75 % floor is removed outright, and four mutations of the three constants the whole 110 px anchor
rests on leave all 838 tests green while a stacked panel takes the height AC-19 reserves for the
commit file list.
