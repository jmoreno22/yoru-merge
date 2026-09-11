---
slug: inspector-diff-workspace
date: "2026-09-08"
round: 13
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T40–T52 working tree
previous_review: review-2026-09-08-round12.md (CHANGES REQUESTED at 805a32d + the T40–T49 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality, edges, test adequacy of the changed surface). Each ran in its own git worktree with a junctioned node_modules, over a detached 805a32d with the whole working patch applied; the lead measured the gate in the main tree and re-derived the sharpest arithmetic in a third worktree.
---

# Re-review round 13 — inspector-diff-workspace — 2026-09-08

## Scope

Thirteenth review, and the first over the **round-12 fix wave**: **T50** (criteria amendment),
**T51** (code fixes) and **T52** (records), all three **uncommitted** at review time, per the standing
rule that spec / SAD / task docs land in the same commit as the code they describe.

Whole feature diff `7cd47b4..HEAD` (130 files, +12481 / −346) plus the working tree (27 files,
+1424 / −185, **six under `src/`**: +418 / −22) and 17 untracked files under
`docs/features/inspector-diff-workspace/`. **Changed surface since round 12:**

| task | what |
|---|---|
| **T50** | the carve-out's cause corrected to the head-cap guard alone and its band split per collapse state, byte-identical at four sites; `ux-flows.md:179` gains it as a fifth; `screens.md:16` re-pointed to F1–F9; `screens.md:50`'s stale KPI claim moved inside its marker |
| **T51** | the restore-threshold note rewritten around one cause with re-derived figures; the 220 / 110 twin's comment corrected (allowance 16, not 27.5); the new 400 / 200 row where the collapsed 75 % floor binds; the AC-19 basis **values** and the min/max-height guards; the `MIN_BOTTOM_PX` pin |
| **T52** | `test-plan.md:90` added as AC-18's automated row and `:91` given the carve-out; the AC-18 / AC-19 coverage rows re-attributed; T49's `acs` gains AC-01; T48's record corrected (the 27.5 allowance, the third grep bullet named as unmet) |

**No production code changed in this wave** — verified three ways: `git diff 805a32d -- src` names
only `inspector-layout.spec.ts` and `main-content.spec.ts` as changed since round 12; the two
production files in the working tree carry only what round 12 attributed to earlier waves
(`inspector-layout.ts` = T44's `Math.floor` + the `fileCount === 0` arm + T40's comment;
`main-content.ts` = a docblock hunk); and `grep -rn "round 12\|R12-\|T5[012]"` over the production
files returns nothing.

Out of scope, unchanged since round 8: four working-tree modifications unrelated to this feature
(`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked
`.mcp.json`; `docs/plans/` is gitignored. `git diff --name-only 7cd47b4..HEAD` on all four is empty.
Confirmed absent from the feature diff by both reviewers and the lead. `src-tauri` untouched in both
the diff and the working tree, so the Rust gate is unchanged.

## Gate

Measured by the lead in the main tree and reproduced independently by both reviewers in their own
worktrees; all three agree on every value.

`pnpm test` **839 tests / 63 files green, three consecutive serial runs** (838 → 839 = T51's one new
`it`) · `pnpm lint` (biome, 266 files) clean, before and after every mutation battery ·
`tsc --noEmit -p tsconfig.spec.json` exit 0 · `pnpm build` clean, **908.38 kB** initial total in all
three trees, no budget warning · `git status --porcelain -- src-tauri` and
`git diff --name-only 7cd47b4..HEAD -- src-tauri` both empty. The one stderr line
(`[cdkFocusInitial]` not focusable) is the known jsdom noise. `fileParallelism: false` (T43)
untouched at `vitest.config.ts:54`; the three serial runs agree exactly.

`expect(` per touched spec file, `HEAD` → patch: `inspector-layout.spec.ts` 47 → **59**,
`main-content.spec.ts` 45 → **60**, `commit-inspector.spec.ts` 106 → 113,
`diff-workspace.spec.ts` 29 → 33. `git diff 805a32d -- src | grep -c '^-.*expect('` = **0**: no
assertion removed, relaxed or emptied anywhere in the patch. No `it.skip` / `.only` / `.todo` /
`.concurrent`. No `as any`, `as unknown as`, non-null `!`, `@ts-ignore` / `@ts-expect-error`
introduced.

**Reviewer disclosure, recorded so it is not read as the wave's.** Stage 2 reported at its baseline
capture that its worktree listed three untracked root files it had not created
(`_r13-stage1-report.md`, `.gate-test.log`, `.gate-rest.log`) and that something overwrote its
`baseline.md5` in the shared session scratchpad. Investigated by the lead: stage 1 states under
disclosure that it made **no write of any kind** in stage 2's worktree at any time, and that its three
files were created in **its own** tree between 16:27:42 and 16:29:45 — after stage 2's capture, so on
a shared clock none of them existed anywhere at that moment; neither reviewer nor the lead can account
for the observation, and no one asserts anything about it. What is established: at 16:39 the lead
measured stage 2's worktree with **no** untracked root files and the only `src` delta being stage 2's
own live mutation, and the three trees' fingerprints showed each agent mutating only its own tree
(`main-content.ts` differing in stage 2's alone, `main-content.html` in stage 1's alone, the policy and
both spec files byte-identical across all three). The scratchpad collision **is** real and stage 1
owns it (`baseline.md5` / `baseline.status` written at the shared root at 16:31:33); both reviewers
moved to private subdirectories and re-baselined. Every measurement in both reports was taken on a
tree verified clean before and after — stage 2 re-baselined 334 `src/` md5s privately and verified
the tree after each of its **sixteen** mutations — and every suite run used `pnpm test`, not a bare
`npx vitest run`, which cannot compile the `templateUrl` components and produces a pile of false
FAILs (the lead hit that trap once, in its own tree, and discarded the run). Stage 2 records its own
16:24 observation as **unexplained** rather than resolved, which is the right way to leave it: no
measurement depends on the answer.

## What round 12 asked for, and got

**All three owner decisions landed, and two of them landed better than the wave claims.** Five of the
seven round-12 findings are fully closed and provably so.

| round-12 finding / decision | status | evidence |
|---|---|---|
| **Decision 1 ≡ R12-L-F1 ≡ R12-S1-F1** the carve-out's cause and band | **landed exactly, and tight** | swept over `h ∈ [40, 2000]`, both densities, both collapse states, by the lead and by both reviewers: the share misses its floor in exactly **224** configurations; **224 of 224** are fixed by removing `Math.max(headerAllowance, panelHeadH)` and **0** by removing the two-row floor; the four bands are `h ≤ 67` / `h ≤ 135` comfortable and `h ≤ 59` / `h ≤ 119` compact, each contiguous from 40, and unmoved with the row floor at 0, 1, 2, 3 or 6 rows. So «under 68 / 60 expanded, under 136 / 120 collapsed» is exact **and** tight — at `r = 68` the share is exactly 0.500000 and at `r = 136` exactly 0.750000. Stage 2 cross-checked a parametrised model against the real `computeInspectorLayout` over 62 752 configurations: **0 mismatches** |
| **R12-S1-F1** the note's four wrong statements | **closed** | «TWO causes» gone; the 27.5 allowance replaced by the measured 16; the deleted predicate's bounds now `h ≤ 187` / `179` expanded and `h ≤ 375` / `359` collapsed (all four, both densities); the closing instruction now points at the head-cap guard and gives both collapse states' thresholds. **Every one of the fourteen figures in the rewritten note re-derives exactly** from the policy — verified independently by stage 2 and the lead |
| **Decision 2 ≡ R12-S2-F1** the 110 px anchor | **landed, three values of four** | the four mutations that left 838 green in round 12 now each redden one row: bases doubled → `expected '0 0 75%' to be '0 0 37.5%'` at `:420` when **both** pairs are doubled, or `expected [ '0 0 60%', '0 0 40%' ] to deeply equal [ '0 0 30%', '0 0 20%' ]` at `:463` when only the stacked pair is (the row asserts in template order, so which assertion fires is a function of the mutation's scope, not of the row's power — measured both ways, by stage 2 and by the lead); bases widened to 45 / 35 % → `expected [ '0 0 45%', '0 0 35%' ] to deeply equal [ '0 0 30%', '0 0 20%' ]`; inline `min-height: 400px` → `expected '400px' to be ''`; `MIN_BOTTOM_PX` 220 → 400 → `expected '400px' to be '580px'`. Beyond what the wave claims: the min-height guard holds on the **second** stacked panel too, the **max-height** half has power, and a class-based floor reddens — measured three times independently, at `min-h-40` (stage 1), `min-h-[400px]` (the lead) and by stage 2 — so the `min-h-0` / `max-h-none` exemption is not a hole. **The fourth basis is unpinned** → R13-S1-F2 ≡ R13-S2-F2 |
| **Decision 3 ≡ R12-S2-F2** the collapsed twin | **landed and it bites** | the new row at `inspector-layout.spec.ts:382-413`: 400 / 200 collapsed → cap 50 / share 0.750000, expanded → cap 100 / share 0.500000, identical in both densities, the 2-row floor binding in neither. `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 → **4 failed / 835** and the new row **is** among them (`expected 0.5 to be close to 0.75`), against round 12's 3 / 835 with the twin absent. Its two halves assert separately, so it cannot pass on a coincidence. The twin is kept as the carve-out pin with its comment corrected, and O8 is closed |
| **R12-S1-F2** AC-18's chain | **closed in the coverage table, open in four artefacts** | `test-plan.md:90` is a new automated unit row for AC-18 naming T40 / T47 / T51; `:89` gained the `MIN_BOTTOM_PX` pin; `:91` carries the carve-out, so the file no longer gives a tester two expected results. `tasks.json` T47's `AC-18` now resolves to a row that names T47. **But four further artefacts still state the un-carved claim** → R13-S1-F1 |
| **R12-S1-F4 ≡ R12-S2-F4** T48's overstated claims | **closed** | `round11-criteria-amendment.md` carries three dated round-12 corrections and `round11-records.md` one, each leaving the retired claim quoted; the third grep bullet is now named as **unmet**, with its reason. T52's Outcome names **both** DoD bullets it could not satisfy — the practice rounds 10–12 kept asking for |
| **O9, O10, O11, O12** | **closed** | `screens.md:16` cites F1–F9; `screens.md:50`'s KPI claim sits inside its marker; T49's `acs` gained AC-01; `tracker.md`'s guard citations are re-pointed to `inspector-layout.ts:84` and `:75` / `:105` and are correct |

**T51's five recorded mutations all reproduce** at the exact row and message quoted, plus eight the
reviewers and the lead invented (MUT-G, MY-M2b, MY-M2c, MY-N1, MY-N2, MY-N6, R13-M3, and the control
`'0 0 37.5%'` → `'0 0 38%'`). Only **MY-N3** — the fourth basis — leaves the suite green.

## Findings — stage 1 (spec / AC compliance)

| id | Finding | Resolution |
|---|---|---|
| **R13-S1-F1** | **The carve-out reached six artefacts byte-identically and left four stating the claim the measurement falsifies — and one of the four sits in the same file as one that carries it, so `ux-flows.md` now answers the same question two ways.** `sad.md:368` (§6 F2, the «inspector placed at the bottom» branch: «the list keeping at least the share it has on the right») · `ux-flows.md:170` (the US-07 flowchart, node C, same sentence) · `ux-flows.md:219` (ux-flows' own AC → flow map, the AC-18 row: «the list keeps at least its right-hand share») · `screens.md:343` (Rendering variants → «Inspector at the bottom»). All four are false at the app's reachable minimum: at `MIN_BOTTOM_PX` 220 with both stacked panels (a fixed 110 px) and the header collapsed the share is **0.690909** comfortable / **0.727273** compact against 0.750 on the right. The carve-out sentence is byte-identical at the six sites it did reach — extracted by regex and compared as strings: `spec.md:198`, `spec.md:231`, `sad.md:733`, `ux-flows.md:179`, `test-plan.md:91`, `test-plan.md:167`, all 313 characters, **one distinct value** — which is exactly what makes the four omissions legible as omissions. This is **R12-S1-F2's class** (a carve-out that reached the named sites and not the rest) recurring in the wave sent to close it, and `ux-flows.md` and `screens.md` are both in T50's own `files_hint` | **Fix now** → T53 |
| **R13-S1-F2** ≡ **R13-S2-F2** | **Owner decision 2 named four stacked-basis values; three are pinned and the fourth is pinned by nothing, and the record that claims all four does not name the gap.** `main-content.ts:275` — `fileHistoryFlex = computed(() => this.blameFile() ? '0 0 20%' : '0 0 28.6%')`. Mutating the blame-absent value leaves **839 passed / 63 green** (stage 1 at `'0 0 29%'`, stage 2 at `'0 0 58.6%'`, the lead at `'0 0 29%'`), while the control — blame-alone `'0 0 37.5%'` → `'0 0 38%'` — reddens one row. The AC-19 row (`main-content.spec.ts:406-470`) opens **blame** alone, pinning `'0 0 37.5%'` at `:420`, then adds file history and pins the stacked pair at `:463`; it never opens file history alone. File history opened by itself can therefore take 58.6 % of the inspector column with the whole suite green — AC-19's subject in the words `main-content.ts:266-268` uses. T51 restates the four values verbatim (`round12-code-fixes.md:76-78`) and its Outcome discloses no unmet half: **R12-S1-F4's class, in the wave sent to close R12-S1-F4**. Scope, recorded honestly: the 110 px remainder every carve-out marker rests on comes from the **stacked** pair, both of which are pinned, so no derived figure is at risk | **Fix now** → T54 (the pin) + T55 (the record) |
| **R13-S1-F3** | **T52's closing observation reports two `acs` ↔ Task-column mismatches; the same check, run independently by stage 1 and by the lead over the same 88 coverage rows and the same predicate, finds twelve — and two of the ten it does not name are this feature's own AC-18 and AC-19.** `round12-records.md:155-160` names only `tasks.json` T34 (AC-18, AC-19) and T44 (AC-03, AC-04). The real set under «the task does appear somewhere in the Task column» (which excludes the docs-task convention of `test-plan.md:29`) is **T2, T6, T7, T8, T12, T13, T21, T25, T29, T34, T35, T44** — twelve, sixteen if widened to every non-docs task — including **T25/AC-18** and **T8/AC-19**. The other half of T52's claim reproduces exactly: T47 and T51 are clean. What fails is the exhaustiveness, in the bullet whose whole point was mechanical exhaustiveness | **Fix now (record only)** → T55; the twelve stay a recorded observation for a later decision |

## Findings — stage 2 (quality, edge cases, test adequacy)

| id | Finding | Resolution |
|---|---|---|
| **R13-S2-F1** | **A spec-file comment states a suite result its own cited record refutes — and the false statement is precisely the one that would justify deleting the rows it sits beside.** `inspector-layout.spec.ts:385`: «so removing `COLLAPSED_LIST_SHARE_FLOOR` outright left **all 838 tests green** (review round 12, R12-S2-F2)». The cited record says the opposite — `review-2026-09-08-round12.md:98` records **3 failed / 835**, «the twin is not among them» — and T51's own Outcome table two files away (`round12-code-fixes.md:133`) records **4 failed / 835**. Stage 2 measures 4 / 835; the lead measures 4 / 835. The mutation has never left the suite green in any round; what it left green was **the twin**, which is what R12-S2-F2 found and what this row exists to fix. `test-plan.md:43`, written by T52 in the same wave, states it correctly. This is the **fourth consecutive round** on the comments of this one file (R10-S2-F5, R11-S1-F1, R12-S1-F1), the same shape every time; a maintainer reading `:385` learns that the collapsed floor is uncovered by the whole suite — the belief that would justify deleting the two 75 % unit rows at `:196` and `:211`. The fix is one clause | **Fix now** → T54 |
| **R13-S2-F3** ≡ **R13-S1-O1** | **One figure in the rewritten note is still single-density, against T51's own DoD.** `inspector-layout.spec.ts:509-510`: «The 2-row floor does SET `protectedList` below **126 px** collapsed (94 > 0.75h)» — measured, comfortable is `h ≤ 125` and compact `h ≤ 119`, i.e. below 120. Every other figure in the note carries both densities, and T51's DoD claims «no figure in the note is un-sourced or single-density» (`round12-code-fixes.md:96-97`) while its Outcome repeats the single-density figure. The parenthetical `(94 > 0.75h)` sources it to comfortable's constant, so it is traceable rather than wrong; the defect is a DoD claiming a property the note does not have — the third item of R12-S1-F1 surviving in one sentence. One word | **Fix now, riding along** → T54 |

## Checked and clean

**Owner decision 1 is the best-measured thing on this branch and it landed exactly** — the band is
right, tight, per collapse state, byte-identical at six sites, and the cause attribution reproduces to
the configuration (224 / 224 by the head-cap guard, 0 by the row floor, all four bounds invariant
under a 0 / 1 / 3 / 6-row floor, and the closed form `panelHeadH / (1 − ratio) − 1` evaluating to
67 / 135 / 59 / 119). The policy is a function of the **remainder** alone, so a sweep with
`stackedPanelsHeight: 0` covers every stacked configuration.

**Every figure in the rewritten note re-derives.** The bounds table, the 224 / 0 attribution, the
closed form and its invariance, the worked example (`h = 130` collapsed comfortable: cap 34 →
0.738462; without the guard cap 32 → 0.753846), the deleted predicate's four bounds
(187 / 179 / 375 / 359), the restore thresholds (68 / 60 / 136 / 120, both densities), the T29 residue
classes (`Math.round ≠ Math.floor` only at 421 expanded and 422 collapsed, in both densities, every
other listed height `≡ 0 (mod 4)`), the twin's arithmetic (allowance 16, cap 34, share 0.690909) and
the new row's (150 → 50 → 0.75 collapsed, 100 → 100 → 0.50 expanded). After four rounds the note is
arithmetically sound; what remains wrong in it is one *claim about the suite* (R13-S2-F1) and one
single-density figure (R13-S2-F3).

**The chain, traced end to end.** All eight user stories US-01…US-08 have ≥ 1 AC and ≥ 1 §6 flow
(`sad.md:640-649`); every AC-01…AC-22 has a row in the AC → flow table (`:651-674`) with AC-20 the
single declared non-runtime N/A; `sad.md` `target_surfaces: [desktop-app]`, one surface. The 88-row
coverage table gives every AC ≥ 1 row and every AC but AC-20 an automated UI row (AC-20 manual by
declaration — no visual-regression pipeline). **AC-18's chain, broken for four rounds, now runs
criterion → §6 → flow → task → code → unit + component + e2e.** The two `added-by-fix` ACs were traced
at least as strictly as the rest and both were mutation-tested: reverting AC-04's `fileCount === 0`
arm → **3 failed / 836** across two tiers (the bare-head unit row, the sweep, and the component row
`expected 400 to be 766`); flipping `commitFileClickOpensWorkspace` to `false` → **3 failed / 836**,
including the default-open row and the bad-stored-value fallback, and AC-22 also has F9, a screen
state, four coverage rows and its own task.

**Test adequacy beyond what the wave claims.** MY-N6 (the row-count floor dropped alone, `protectedList`
intact) → 1 failed / 838 at the 220 / 110 row's `listRows` assertion, and it is the **only** row in all
839 that catches it. MUT-E → 2 failed / 837, both `expected 16 to be 34`, exactly as the twin's
comment predicts. MUT-A (`Math.floor` → `Math.round`) → 1 failed / 838 at 421. MUT-B (class-based grow,
inline basis dropped) still reddens, now at the value assertion, so the extended row did not lose
R11-S2-F2's cover. The sweep still has no escape hatch — the `nothingToDraw` arm asserts
`headerMaxH === availableHeight − panelHeadH` rather than excusing the configuration, and both arms
assert.

**Mechanical records.** `tasks.json` parses, **52 tasks**, 0 duplicate ids, 0 dangling deps, DFS finds
no cycle; `files_hint` agrees between `tasks.json` and **every** task file for T1…T52 (**0
mismatches**), no id without a file, no file without an entry — verified independently by stage 1 and
the lead. `T50 → T51 → T52` and `T50 → T52` are mirrored in `_epic.md` and `tracker.md`.
`git diff --numstat HEAD -- tasks.json` = 280 / 0, exactly as T50 records.

**Conventions, security, boundaries.** biome clean over 266 files before and after every battery; the
new code is plain Vitest in the repo's own idiom, reusing `renderWorkbench` / `inspectorBlock` /
`installResizeObserver` from `src/testing/` and the file's own helpers, with no new symbol beyond the
two T47 added; the `for (const tokens of [COMFORTABLE_TOKENS, COMPACT_TOKENS])` loop matches the
density-pair pattern already in the file. No new `invoke(`, `innerHTML`, `outerHTML`, `eval`,
`document.write`, storage access, `bypassSecurityTrust*`, IPC command, Tauri surface or secret. The one
`core → shared` crossing is this feature's settled D16 exception (`ARCHITECTURE.md:110-114`), not
re-litigated; no barrel import, no `features → features` edge, the policy stays a pure-TS `core/`
module importing nothing. `GROWTH_UTILITIES` and `stackedPanelWrappers()` each have exactly one
consumer; `growingChildren()` sits beside them with a distinct documented job, untouched; nothing in
`src/testing/` duplicates either. No dead code introduced. Determinism holds: `fileParallelism: false`,
three identical serial runs, and neither new component row depends on a render window (both drive the
ResizeObserver stand-in and `await bench.settle()`).

## Observations — recorded, not findings

- **O1** The 220 / 110 collapsed twin (`inspector-layout.spec.ts:351-380`) remains fully redundant in
  detection terms: at that remainder both collapse states compute the same `protectedList`, allowance,
  cap and share, so no mutation reddens it that does not already redden its expanded sibling. Its
  comment now says so plainly and owner decision 3 kept it deliberately as the carve-out pin, so this
  is not a finding — but its only non-duplicated content is the pair of *share* assertions
  (≈ 0.6909, < 0.75), a negative pin on a criterion the owner carved out. Worth knowing before anyone
  treats it as cover.
- **O2** `inspector-layout.spec.ts:386-388` calls 200 px «the smallest **round** figure where the
  collapsed floor DOES bind». The smallest remainder where it binds is **126**; 200 is the smallest
  multiple of 100. «Round figure» is doing undefined work in a note whose subject is exactness.
- **O3** `:509-514` places the `h = 130` worked example immediately after the sentence about the 2-row
  floor setting `protectedList`, but at `h = 130` collapsed it is the **share** floor that sets it
  (0.75 × 130 = 97.5 > 94). The example is correct and it illustrates the guard, which is the point —
  it just does not illustrate the sentence it follows.
- **O4** MY-N2 (`LIST_ROWS_FLOOR` 2 → 1) reddens the 220 / 110 expanded row at its **`headerMaxH`**
  assertion (`expected 46 to be 34`), not at `listRows`, because that constant also feeds
  `protectedList`. The comment's «one assertion per guard; each mutation reddens this row alone» is
  true of the row, but the assertion ↔ guard mapping is not 1:1 — MY-N6 is what isolates the second
  assertion.
- **O5** `main-content.spec.ts:531`'s `expect(800 − parseFloat(centre.style.height)).toBe(220)`
  restates the line above it from the same value: readability, not detection power. Round-12 O5's
  class, harmless because `:530` carries the literal.
- **O6** `round12-code-fixes.md:180` says the new bottom row's comment «cites the band per collapse
  state»; the comment (`inspector-layout.spec.ts:388-389`) says «it is above the carve-out band»
  without the four numbers, which are in the same file at `:522`. Similarly `:66` asked the twin's
  comment to «quote T50's carve-out wording» and it states what the row pins instead — the substantive
  half — quoting no part of the sentence. Neither is named in T51's DoD or Outcome.
- **O7** T51's Outcome records five mutations; three more that hold (MUT-G, MY-M2b, MY-M2c) and one
  that does not (MY-N3) are absent. Recording the second panel and the max-height half would have cost
  nothing, and probing the fourth basis value would have exposed R13-S2-F2 to the wave itself.
- **O8** Round-12 **O1** (the flooring residue: a bottom remainder `r ≡ 0 (mod 4)` gives exactly 0.75
  while the right column's collapsed share can exceed it by up to `0.75/R`) is now *exercised* by the
  new 400 / 200 row — which lands on `r ≡ 0 (mod 4)` and asserts exactly 0.7500, so it can never see
  the residue. Nothing is wrong; worth knowing.
- **O9** Round-12 **O2** (the classList half of the AC-19 assertion has no power while the inline basis
  is present), **O3** (`GROWTH_UTILITIES` flags `grow-0` and misses `flex-grow` and variant-prefixed
  forms) and **O4** (`stackedPanelWrappers()` is not scoped to the inspector column, and
  `closest('[style*="flex"], div')` would retarget through an inserted wrapper) all stand, none
  worsened. The wave's new assertions sit inside the same helper, so they inherit O4's brittleness —
  which fails loud, not silently.
- **O10** `ux-flows.md:219` and `screens.md:377` are index cells rather than criteria; `:219` is folded
  into R13-S1-F1 because it restates the guarantee in full, `:377` is a bare pointer and is fine.
- **O11** Round-12 O15 stands: the AC-06 chevron row (`diff-workspace.spec.ts:154`) is still
  render-window dependent, green 3/3 serially, the 5 s default `testTimeout` its only margin. For
  T43's deferred successor.
- **O12** Round-12 O17 stands: task-file `status` is `done` for T47–T52 and `todo` in the other 46, and
  `tasks.json` carries no `status` key. Still worth deciding once rather than per wave.
- **O13** AC-20 remains the one AC with no automated UI row, by declaration (`test-plan.md:26`, no
  visual-regression pipeline). Unchanged, correct.
- **O14** `pnpm build` reports **908.38 kB** in all three trees against round 12's 908.22 kB, with no
  bundled change in the wave (spec code is not bundled). Round-12 O16's noise band; T51 chased it
  deliberately and concluded it is stable per tree and varies with build-cache state. All three of this
  round's measurements agree with T51's.
- **O15** The twelve `acs` ↔ Task-column mismatches of R13-S1-F3 are pre-existing bookkeeping, not
  missing coverage — every AC involved has coverage rows; what is missing is the attribution of *that
  task* on *that AC*. Recorded here as the candidate scope for a single later decision.

## Owner decisions (2026-09-08, round 13)

1. **R13-S1-F1 (the four artefacts):** **the canonical sentence in prose, an explicit pointer in the
   diagram node and the index cell.** `sad.md:368` and `screens.md:343` take T50's 313-character
   sentence byte-identical; `ux-flows.md:170` (mermaid node C) and `ux-flows.md:219` (AC → flow map)
   take `except where the header-cap guard binds (AC-18)`. The verifiable criterion is that no artefact
   states the guarantee without its exception; a 313-character sentence inside a node label would be
   unreadable and is not what the decision asks for.
2. **R13-S1-F2 ≡ R13-S2-F2 (the fourth basis):** **pin it in the AC-19 row that already exists.** Add a
   file-history-alone phase and assert `'0 0 28.6%'`, keeping the blame-alone and stacked-pair
   assertions and their order intact. It closes a live AC-19 hole on a configuration a user reaches by
   opening one panel, and it leaves all four of decision 2's values with cover.
3. **R13-S1-F3 (the `acs` sweep):** **correct the record, leave the twelve as a recorded observation.**
   T52 states the exact predicate and the real set (12 under «the task appears in the Task column», 16
   widened to every non-docs task), naming T25/AC-18 and T8/AC-19 explicitly. The twelve are
   pre-existing bookkeeping and belong in one decision, not inside a corrections wave.
4. **Scope:** fix everything in this wave, split into three tasks on the round-9 / 10 / 11 / 12 pattern
   (criteria first, then code, records last) so the dependency stays acyclic and the two docs tasks
   share no file.

## Artifacts changed by this review

Three follow-up tasks, written to disk and **not committed** (spec / SAD / task docs land in the same
commit as the code they describe):

| task | layer | deps | covers |
|---|---|---|---|
| **T53** — Round-13 criteria amendment: the four artefacts the carve-out still has not reached | docs | — | R13-S1-F1; registers T53–T55 |
| **T54** — Round-13 code fixes: the false suite result at `:385`, the single-density figure, and the fourth stacked basis | domain | T53 | R13-S2-F1; R13-S2-F3 ≡ R13-S1-O1; R13-S1-F2 ≡ R13-S2-F2 (the pin) |
| **T55** — Round-13 records: T52's `acs` sweep, T51's undisclosed gap, and the test-plan rows for the fourth basis | docs | T53, T54 | R13-S1-F3; R13-S1-F2 ≡ R13-S2-F2 (the record half); O6, O7 |

## Gate result

**CHANGES REQUESTED.**

This is the strongest wave on the branch and the closest it has come to shipping. All three of round
12's owner decisions landed; the carve-out's band is exact **and** tight, per collapse state,
byte-identical at six sites, with a cause attribution that reproduces to the configuration (224 of 224
by the head-cap guard, 0 by the row floor, invariant under a 0 / 1 / 3 / 6-row floor) and a
62 752-configuration cross-check of the model against the shipped policy with zero mismatches. Every
one of the fourteen figures in the four-times-rewritten note now re-derives exactly. The new 400 / 200
row is the row R12-S2-F2 asked for and it genuinely separates the collapse states in both densities,
with its halves asserted independently. Four mutations that left 838 green in round 12 now redden one
row each, and three more that nobody asked for — the second panel's min-height, the max-height half, a
class-based floor — hold as well. AC-18's chain, broken for four rounds, runs end to end. The gate is
839 / 839 on three serial runs with lint, `tsc` and build clean, no assertion weakened, and no
production code moved.

What blocks is the wave's own bookkeeping, three times, and each instance is the class the wave was
sent to close. **The carve-out reached six artefacts and left four** — a §6 branch, a US-07 diagram
node, an AC-map row and the screen manifest's Rendering-variants row — each still promising, at the
app's reachable minimum, a share the policy measurably does not give (0.6909 / 0.7273 against 0.750);
two of those files are in T50's own `files_hint`, and `ux-flows.md` now answers the same question two
ways within one file. **A comment at `inspector-layout.spec.ts:385` tells a maintainer the whole suite
stayed green under a mutation that has reddened three or four rows every time it has been run** —
including in T51's own Outcome table two files away — and that is precisely the false belief that would
justify deleting the two 75 % rows it sits beside. **And the owner decision that named four basis
values got three pinned:** file history opened alone can take 58.6 % of the inspector column with all
839 tests green, which is AC-19's subject, while the record that names all four discloses no gap.

Every fix is small and local — one clause, one word, two lines inside a row that already exists, and
four sentences carried to artefacts that already have five siblings quoting them.
