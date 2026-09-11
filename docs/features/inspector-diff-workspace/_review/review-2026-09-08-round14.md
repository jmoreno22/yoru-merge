---
slug: inspector-diff-workspace
date: "2026-09-08"
round: 14
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T40–T55 working tree
previous_review: review-2026-09-08-round13.md (CHANGES REQUESTED at 805a32d + the T40–T52 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality, edges, test adequacy of the changed surface). Each ran in its own git worktree with a symlinked node_modules, over a detached 805a32d with the whole working patch applied; the lead measured the gate in the main tree and ran its own six-mutation battery in a third worktree.
---

# Re-review round 14 — inspector-diff-workspace — 2026-09-08

## Scope

Fourteenth review, and the first over the **round-13 fix wave**: **T53** (criteria amendment),
**T54** (code fixes) and **T55** (records), all three **uncommitted** at review time, per the standing
rule that spec / SAD / task docs land in the same commit as the code they describe.

Whole feature diff `7cd47b4..HEAD` (130 files, +12481 / −346) plus the working tree (27 files,
+1497 / −185, **six under `src/`**: +438 / −22) and 21 untracked files under
`docs/features/inspector-diff-workspace/`. **Changed surface since round 13:**

| task | what |
|---|---|
| **T53** | the canonical carve-out sentence carried to `sad.md:380` (the F2 prose) and `screens.md:343`, byte-identical to the six sites that had it; the pointer `except where the header-cap guard binds (AC-18)` at `sad.md:368`, `ux-flows.md:170` and `:219`; dated round-13 markers; T53–T55 registered in `tasks.json` / `_epic.md` / `tracker.md` |
| **T54** | `inspector-layout.spec.ts:385` corrected from «all 838 tests green» to «left **the twin** green» with both measured counts; `:509-510` given both densities; a **file-history-alone phase** added inside the existing AC-19 row in `main-content.spec.ts`, pinning `'0 0 28.6%'` |
| **T55** | `round12-records.md`'s `acs` observation rewritten with its predicate and the real set (12 / 16); a round-13 marker + Outcome addendum on `round12-code-fixes.md`'s four-values bullet; `test-plan.md:93` naming the fourth value and T54 |

**No production code changed in this wave** — verified three ways: `git diff 805a32d -- src` grew
from round 13's +418 / −22 to +438 / −22 with the delta entirely in the two spec files; the three
production files in the working tree carry the md5s round 13 recorded
(`inspector-layout.ts` `43606b87…`, `main-content.ts` `720244ba…`, `main-content.html` `d1fbdf2e…`),
the last of which is the exact hash T54's Outcome quotes; and both reviewers reached the same
conclusion independently in their own worktrees.

Out of scope, unchanged since round 8: four working-tree modifications unrelated to this feature
(`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked
`.mcp.json`; `docs/plans/` is gitignored. `git diff --name-only 7cd47b4..HEAD` on all four is empty.
`src-tauri` untouched in the diff, in the working tree and in `git status`, so the Rust gate is
unchanged.

## Gate

Measured by the lead in the main tree and reproduced independently by both reviewers in their own
worktrees; all three agree on every value.

`pnpm test` **839 tests / 63 files green** — the lead ran **four** consecutive serial runs, each
reviewer three, all identical · `pnpm lint` (biome, 266 files) clean, before and after every mutation
battery · `tsc --noEmit -p tsconfig.spec.json` exit 0 · `pnpm build` clean, **908.38 kB** initial
total in all three trees, no budget warning · `git status --porcelain -- src-tauri` and
`git diff --name-only 7cd47b4..HEAD -- src-tauri` both empty. The one stderr line
(`[cdkFocusInitial]` not focusable) is the known jsdom noise. `fileParallelism: false` (T43) intact at
`vitest.config.ts:54`.

`expect(` per touched spec file: `inspector-layout.spec.ts` **59** (unchanged since round 13),
`main-content.spec.ts` 60 → **62** (T54's two), `commit-inspector.spec.ts` 113,
`diff-workspace.spec.ts` 33. `git diff 805a32d -- src | grep -c '^-.*expect('` = **0**, and **0** over
the whole feature diff as well: no assertion removed, relaxed or emptied anywhere. No `it.skip` /
`.only` / `.todo` / `.concurrent`. No `as any`, `as unknown as`, non-null `!`, `@ts-ignore` /
`@ts-expect-error` introduced.

**Reviewer disclosure.** Stage 2 reports that its first mutation run crashed the harness on a
`UnicodeEncodeError` while printing a failure line, leaving `main-content.ts` mutated, and that it
restored with `git checkout --`, which reset the file to `805a32d` and discarded the working-patch
version. It recovered by copying the file from the main tree, verified all five baseline md5s with
`md5sum -c`, and only then hardened its harness (pristine on-disk copies, ASCII-safe logging,
`try/finally` restore). The lead confirms the main tree was never written to: the five files it names
carry those same md5s in the main tree now, and `git status --porcelain` there lists exactly the
pre-existing 27 modifications plus 22 untracked files. Round 13's scratchpad collision did not recur —
both reviewers worked in private subdirectories from the start.

## What round 13 asked for, and got

**All three owner decisions landed, and every mechanical claim the wave makes reproduces.** Nothing
in this section is taken from a record; each row was measured by at least two of the three agents.

| round-13 finding / decision | status | evidence |
|---|---|---|
| **Decision 1 ≡ R13-S1-F1** the carve-out at the five remaining sites | **landed, and the byte-identity holds to the hash** | the 313-character sentence extracted by regex from every artefact and compared as strings: **one distinct value**, md5 `71e191bb259e30cb8285798a199677f3`, at `spec.md:198`, `spec.md:231`, `sad.md:380`, `sad.md:733`, `screens.md:343`, `ux-flows.md:179`, `test-plan.md:91`, `test-plan.md:167` — the eight claimed artefact sites — plus two deliberate quotations in `round12-criteria-amendment.md:103` and `round13-criteria-amendment.md:71`. The pointer is likewise one distinct value at exactly `sad.md:368`, `ux-flows.md:170`, `ux-flows.md:219`. Measured by both reviewers and the lead. **Corrected 2026-09-09 during T56:** this row first said the pointer is «59 characters», carried over from stage 1's report (`LEN 59`, line 65), whose regex measured a wider capture than the value it printed. The pointer is **47 characters**, md5 `c02eb85ec94f6385201a4f2de8f23d5e` — re-measured off disk. The byte-identity finding is unaffected; the figure was wrong. **What the sweep behind it missed is R14-S1-F1** |
| **Decision 2 ≡ R13-S1-F2 ≡ R13-S2-F2** the fourth stacked basis | **landed, and it bites** | `main-content.ts:275`'s blame-absent `'0 0 28.6%'` mutated → **1 failed / 838** at `main-content.spec.ts:481`, `expected [ '0 0 58.6%' ] to deeply equal [ '0 0 28.6%' ]`, the exact row and message T54 records — reproduced by stage 1, by stage 2 and by the lead, each restoring `main-content.ts` to `720244ba…`. The lead also inverted the ternary's condition and stage 2 swapped its branches: both redden. All four of decision 2's values now have cover |
| **Decision 3 ≡ R13-S1-F3** the `acs` ↔ Task-column record | **landed, set for set** | re-run mechanically from `tasks.json` + the 88-row `## AC coverage` table by stage 1, stage 2 and the lead: **P1 = 12** (T2, T6, T7, T8, T12, T13, T21, T25, T29, T34, T35, T44) with the same ACs per task, **P2 = 16** (P1 + T22, T23, T24, T38), T25/AC-18 and T8/AC-19 named explicitly, and **T53, T54 and T55 clean under both predicates**. `test-plan.md:93` names `'0 0 28.6%'` and T54 |
| **R13-S2-F1** the false «838 tests green» | **closed, and the replacement is what the suite does** | `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 → **4 failed / 835**: the two 75 % unit rows (`:196`, `:211`, `expected 350 to be 175`), the new 400 / 200 row (`:410`, `expected 0.5 to be close to 0.75`) and the sweep (`:529`). The 220 / 110 twin (`:377`) is **not** among them — precisely what the corrected clause now says. Measured by stage 1, stage 2 and round 13's own count |
| **R13-S2-F3 ≡ R13-S1-O1** the single-density figure | **closed** | `inspector-layout.spec.ts:513-515` now reads «below 126 px comfortable and below 120 px compact», and both re-derive from the policy: `94 > 0.75h → h ≤ 125` and `90 > 0.75h → h ≤ 119` |
| **the corrected figures generally** | **re-derive** | stage 1 transpiled `inspector-layout.ts` and swept `h ∈ [40, 2000]` over both densities and both collapse states: the miss bands are contiguous `40..67`, `40..135`, `40..59`, `40..119`, **224 misses, 224 fixed by removing the head-cap guard, 0 by removing the row floor**, and all four bounds invariant with the row floor at 0, 1, 2, 3 or 6 rows. 220 / 110 collapsed gives cap 34 / share 0.690909 comfortable and cap 30 / share 0.727273 compact. The lead re-derived the closed form `panelHeadH / (1 − ratio) − 1` = 67 / 135 / 59 / 119 by hand |
| **registration** | **clean** | `tasks.json` parses, **55 tasks**, 0 duplicate ids, 0 dangling deps, DFS finds no cycle, `files_hint` agrees with every task file for T1…T55 (**0 mismatches**), no id without a file and no file without an entry — checked independently three times. `git diff --numstat 805a32d -- tasks.json` = **321 / 0**, exactly as T53 records: textual insertion, no reflow of the 52 pre-existing entries. `_epic.md:114-119` / `:194-196` and `tracker.md:60-62` mirror `T53 → T54`, `T53 → T55`, `T54 → T55`; `tracker.md:64` reads «Total: 55 tasks» and links the round-13 record |

**T54's recorded mutations all reproduce**, and the guards are stronger than the task claims: stage 2
ran **25** mutations and the lead six, and between them the min-height guard, the max-height guard and
a class-based floor each redden on **both** wrappers (B1–B6), the second panel's `flex-[2]` shape
reddens (B7), and `MIN_BOTTOM_PX`, `LIST_ROWS_FLOOR` (both copies), `LIST_SHARE_FLOOR`,
`COLLAPSED_LIST_SHARE_FLOOR`, the head-cap guard, `Math.floor` → `Math.ceil` and the `protectedList`
`fileCount === 0` arm all redden. **Exactly one mutation in thirty-one leaves 839 green: C6** — and it
is not an uncovered guard but a vacuous one → R14-S2-F3.

## Findings — stage 1 (spec / AC compliance)

| id | Finding | Resolution |
|---|---|---|
| **R14-S1-F1** | **The carve-out has now reached every carrier that phrases the guarantee with the word *share*, and neither of the two that phrase it with the word *less*.** `sad.md:21` — §1 *Top-3 quality goals*, QG-1, the goal the whole SAD is organised around: «the commit file list receives ≥ 50 % … and ≥ 75 % collapsed (inspector right, no stacked panels), **and never less at the bottom or with stacked panels**», marker `<!-- amended 2026-09-07 (owner) -->`, no carve-out and no pointer. `tasks/_epic.md:206` — the epic's invariants list: «the commit file list never receives less than 50 % … (AC-03), **and never less at the bottom or with stacked panels than it keeps on the right (AC-18, AC-19)**». Neither is quoted inside a dated marker; both are live assertions and both cite the ACs the exception belongs to. **Failure scenario:** History view, placement `bottom`, splitter at `MIN_BOTTOM_PX = 220` (`main-content.ts:46`), blame **and** file history stacked (a fixed 30 % + 20 % of 220 = 110 px, `main-content.ts:270-276`), header collapsed → `protectedList = max(94, 82.5) = 94`, `headerAllowance = 16`, `headerMaxH = floor(max(16, 34)) = 34`, share `(110 − 34) / 110 =` **0.690909**; compact **0.727273**; against **0.750** on the right in the same window. A release engineer reading `sad.md:21`, or an implementer reading the invariant they are told not to break, would log a correct policy as a defect. **Why it blocks:** `sad.md` now answers the same question two ways inside one file — §1 QG-1 without the exception, §10 QG-1, the *full scenario for that same goal* by its own heading (`sad.md:731`), with it. That is verbatim the defect R13-S1-F1 named for `ux-flows.md`. Both files are in **T53's own `files_hint`** and T53 edited `_epic.md` in this same wave. T53's Outcome reports «**The residual sweep is empty**» and «**Every carrier of the claim now states its exception**»; the sweep behind those statements enumerated four phrasings, **all built on the noun *share***. Third consecutive round of this class (R12-S1-F2 → R13-S1-F1 → R14-S1-F1), and the third consecutive time the miss is inside the wave sent to close it | **Fix now** → T56 |

## Findings — stage 2 (quality, edge cases, test adequacy)

| id | Finding | Resolution |
|---|---|---|
| **R14-S2-F2** | **A comment names an operation the policy no longer performs — and the patch under review is the patch that removed it.** `main-content.spec.ts:388`: «`round(560 − max(50 % floor 280, 2-row floor 34 + 2 × 30))`». At `805a32d` the policy really was `Math.round(Math.max(headerAllowance, panelHeadH))`; the **uncommitted wave** (T44, the round-10 fix for R10-S2-F2) changed it to `Math.floor` at `inspector-layout.ts:84`, and the T44 hunk did not sweep the companion comment, which was written true in `cd7f546`. **Failure scenario:** a maintainer reads that the cap rounds, restores `Math.round`, and at any odd column height the list loses its pixel and drops just under its 50 % floor — the 434 heights between 40 and 1000 px that `inspector-layout.ts:80-83` quantifies. The sweep at `421` reddens, so the regression is loud rather than silent; the comment is still false, and it is the precise belief the round-10 fix removed, in a file whose sibling spends fifteen comment lines and two extra sweep heights on «FLOOR, not round». The asserted **value** is right — `560 − max(280, 94) = 280`, an integer where floor and round agree — so only the operation name is wrong. Confirmed independently by the lead against `git show 805a32d:` and `git log -S` | **Fix now** → T57 |
| **R14-S2-F3** | **The `fileCount === 0` arm of `listRows` is provably vacuous, so the rule is written twice with nothing distinguishing the operative copy from the dead one.** `inspector-layout.ts:100-106`: dropping `\|\| fileCount === 0` from the `listRows` condition (mutation **C6**) leaves **839 green** — not an uncovered guard, but a no-op: with `fileCount === 0` the else-branch already returns `Math.min(0, Math.max(2, …)) = 0`. Stage 2 re-derived it exhaustively over **720 360** configurations (both densities × `availableHeight` 0…2000 × `fileCount ∈ {0,1,2,6,30}` × `bodyLines ∈ {0,1,12}` × both collapse flags × `stackedPanelsHeight ∈ {0,110,200}`): **0 differing outputs**; the lead confirmed it analytically. **Failure scenario:** its sibling at `:73`, inside `protectedList`, is the arm that carries AC-04 / AC-05 — mutation **C5** reddens three rows across two tiers (`inspector-layout.spec.ts:150` `expected 320 to be 606`, the sweep at 200 px, `commit-inspector.spec.ts:583` `expected 400 to be 766`) — and the comment explaining the displayed-row-count rule (`:68-71`) sits above **that** one. A maintainer told to «remove the redundant `fileCount === 0`» has an even chance of removing `:73`, which at a 640 px column with an empty file list changes the header cap from 606 to 320 and leaves half the inspector blank: exactly the regression AC-05's no-share clause exists to prevent. Secondarily, any test written against `:101` can never fail. This is a T44 line inside the wave under review, so it belongs to this branch | **Fix now** → T57 |
| **R14-S2-F1** | **A ticked DoD bullet whose own grep does not return nothing, with the Outcome naming the *other* unsatisfiable bullet.** `round13-code-fixes.md:80-81`, DoD bullet 1, `[x]`: «`grep -n "838 tests green" src/app/core/services/inspector-layout.spec.ts` returns nothing». It returns `389: // said «all 838 tests green», which no round has ever measured — review`, which is **correct behaviour** — the retired clause is quoted inside the marker that retires it, the house convention T52 and T53 both got right and that T53's last DoD bullet states explicitly («any DoD bullet written as a grep that cannot be satisfied because the retired wording survives inside its own marker is **named in the Outcome**, with the reason»). The defect is the reporting: T54's Outcome (`:158-164`) names exactly one bullet it could not satisfy, the `git diff --name-only HEAD -- src` one, so the DoD reads as fully met. **Failure scenario:** an owner or a later reviewer auditing T54 runs the bullet's own command, gets a hit on `:389`, and cannot tell from the task file whether the correction landed, was reverted or was never applied — the exact ambiguity R12-S1-F4 was raised to remove. Fifth consecutive round of this class, and T53 — the sibling task in the same wave — carries the bullet that guards against it | **Fix now (record only)** → T58 |

## Checked and clean

**The wave's substance is sound and neither reviewer could break it.** T53's byte-identity claim
reproduces to the hash, its three pointer sites are exact, and its dated markers are present at the
three sites that can hold one. T54's pin reddens at the exact row and message it records, from three
independent agents; the three pre-existing pins still redden; and five further guards nobody asked for
— the max-height half, both wrappers for each of min-height and max-height, a class-based floor on
both, and the second panel's `flex-[2]` shape — hold as well. The two comment corrections re-derive
figure by figure, including the 4 / 835 count that four rounds got wrong. T55's counts reproduce set
for set under both predicates.

**The chain, traced end to end** by stage 1, mechanically over `spec.md`, `sad.md`, `ux-flows.md`,
`screens.md` and `test-plan.md`: all eight user stories US-01…US-08 have ≥ 1 AC and appear in the
`sad.md:641-648` US → flow table; all 22 ACs have a §6 AC → flow row, a `ux-flows.md` AC-map row and a
`screens.md` trace; `target_surfaces: [desktop-app]`, one surface; the 88-row coverage table gives
every AC ≥ 1 row and every AC but AC-20 an automated component or e2e-through-UI row (AC-20 manual by
declaration, `test-plan.md:26`, no visual-regression pipeline); every AC but AC-20 is named in at
least two `it()` / `describe()` titles. Nothing dropped out anywhere. The two `added-by-fix` ACs were
re-mutation-tested rather than taken on the record: AC-04's `protectedList` arm → **3 failed / 836**
across two tiers; AC-22's `commitFileClickOpensWorkspace` default flipped → **3 failed / 836**.

**Test adequacy.** Thirty-one mutations across the three agents; **thirty redden**, the thirty-first
is C6 and it is vacuous rather than uncovered. The suite catches every constant in the policy, both
row floors separately, both share floors, the head-cap guard, the flooring, `MIN_BOTTOM_PX`, all four
stacked bases, both height guards on both wrappers, and the class-based escape hatches on both. The
new AC-19 phase reaches a genuine third configuration — stage 2's **D1** (forcing the blame block to
render after the phase closes blame) reddens seven rows, so the phase cannot silently no-op — and it
did not weaken anything that runs before it (A2, A3, A4 all still redden at their original lines).

**Conventions, boundaries, security.** biome clean over 266 files before and after every battery; the
new phase matches the file's idiom exactly (signal `set()` → `await bench.settle()` → assert on the
live DOM, no `fixture.detectChanges()`, Angular 22 zoneless/signals respected), adds no new symbol,
and introduces no `any`, non-null `!` or type assertion. No new `invoke(`, `innerHTML`, `eval`,
storage access, IPC command, DOM sink, widened Tauri surface or secret. No new dead code beyond the
pre-existing line R14-S2-F3 names. `src-tauri` untouched in the diff, the working tree and
`git status`.

## Observations — recorded, not findings

- **O1** `_epic.md:7` states the goal as «list floor of 50 % / 75 %» with no placement scope; at the
  same reachable 220 / 110 collapsed configuration the share is 0.6909. Weaker than R14-S1-F1 — a
  one-line epic summary rather than a criterion or an invariant, and spec §6 rows 1–2 scope the two
  figures explicitly to «inspector right, no stacked panels» — so it rides along with T56 rather than
  taking its own decision.
- **O2** T53's DoD bullet 3 («each of the **five** sites has a dated round-13 marker») is literally
  met at three: `sad.md:380`, `ux-flows.md:219`, `screens.md:343`. The two mermaid labels carry no
  marker of their own because markdown comments cannot live inside a mermaid block; each is named
  explicitly inside the adjacent prose marker. Substantively met, structurally impossible to meet
  literally — and T53's «DoD bullets that could not be satisfied as written: none» glosses that
  rather than naming it. Same family as R14-S2-F1, an order of magnitude weaker; folded into T58's
  scope as one clause.
- **O3** T53's Outcome exempts «`_review/` and the round-10 / round-13 task files that quote them
  deliberately»; two round-**11** task files also carry the phrasing
  (`round11-criteria-amendment.md:50`, `round11-records.md:48`). Both are past-tense narration of the
  state that wave was fixing, so neither is a live carrier — the enumeration is simply incomplete in
  a bullet whose subject is exhaustiveness.
- **O4** Round-13 **O2** and **O3** stand, unaddressed and not routed to a task: `:390` still calls
  200 px «the smallest **round** figure where the collapsed floor DOES bind» (the smallest is **126**,
  re-derived twice this round), and the `h = 130` worked example at `:516-519` illustrates the
  head-cap guard rather than the 2-row-floor sentence it follows (at `h = 130` collapsed the *share*
  floor sets `protectedList`: `0.75 × 130 = 97.5 > 94`). T54 was asked only for the density half.
- **O5** `inspector-layout.spec.ts:513-515`'s «below **126 px** comfortable» is exact over integer
  heights only — the real bound is `h < 125.33̄`, so the sentence is false on `h ∈ (125.33, 126)`,
  while compact's «below 120» is exact over the reals. The parenthetical `(94 > 0.75h)` makes it
  self-correcting and the file's convention is integer heights; the odd one out in a note whose other
  seven bounds are exact over the reals.
- **O6** The new AC-19 phase re-asserts neither the min/max-height guards nor `growingChildren()` on
  the single surviving wrapper. No cover is lost — both wrappers are checked in the stacked phase and
  the class list is static in the template — but the phase is a third *value* configuration, not a
  third full configuration.
- **O7** Round-12 O4 / round-13 O9 stand: `stackedPanelWrappers()` (`main-content.spec.ts:223-227`) is
  not scoped to the inspector column and `closest('[style*="flex"], div')` would retarget through an
  inserted wrapper. The new phase inherits it; B7 shows the failure mode is loud
  (`expected '' to match /^0 0 /`), not silent.
- **O8** Round-13 O5 stands: `main-content.spec.ts:546` is derived from `:545` and adds readability,
  not detection power (A5 reddens on `:545`).
- **O9 — the gate has one measurable margin, and it is not `fileParallelism`.** Stage 2's mutation B1
  reported **7 failed / 832** on its first run: the six extras were five `Test timed out in 5000ms` in
  `diff-workspace.spec.ts` (`:154`, `:198`, `:279`, `:299`, `:324`) plus one «Cannot configure the
  test module when the test module has already been instantiated» in
  `diff-workspace.service.spec.ts:23`, produced while its own analysis scripts shared the CPU. The
  clean re-run of the identical mutation on the other wrapper gave exactly 1 failure, and all ten
  clean gate runs this round are 839 / 839. This is round-13 **O11** measured: serialising files
  removes inter-file parallelism, but the 5 s default `testTimeout` is still the only margin the
  render-window rows have, and CPU contention alone is enough to spend it. Not caused by this wave;
  it is the standing case for T43's deferred successor, and it matters to whoever runs this gate on a
  loaded CI box.
- **O10** AC-22's default-flip mutation reddens three rows, all three in `preferences-schema.spec.ts`
  (unit tier): its component rows set the preference explicitly, so they are insensitive to the
  default by construction. Not a chain gap — AC-22 has four coverage rows, seven `it()` / `describe()`
  mentions, F9, a screen state and its own task — but the mutation's reach is narrower than «AC-22 is
  mutation-covered» suggests.
- **O11** Round-13 O12 / O17 stand: task-file `status` is `done` for T47–T55 and `todo` in the other
  46, and `tasks.json` carries no `status` key at all. Still one decision, not one per wave.
- **O12** Round-13 O15 stands: the twelve `acs` ↔ Task-column mismatches are pre-existing bookkeeping,
  not missing coverage. `round12-records.md` now carries the predicate that makes them reproducible;
  they remain the candidate scope for a single later decision.
- **O13** `pnpm build` reports **908.38 kB** in all three trees, identical to round 13. AC-20 remains
  the one AC with no automated UI row, by declaration. Both unchanged and correct.

## Owner decisions (2026-09-08, round 14)

1. **R14-S1-F1:** **the canonical sentence in the SAD, the pointer in the epic.** `sad.md:21` takes
   T50's 313-character sentence byte-identical — it is prose, and its own §10 full scenario already
   carries it; `_epic.md:206` takes `except where the header-cap guard binds (AC-18)` — it is an
   invariant bullet, an index. This is round-13 decision 1's criterion applied unchanged: prose takes
   the sentence, a label or index takes the pointer.
2. **R14-S2-F2:** **fix now** — `round(` → `floor(` at `main-content.spec.ts:388`. One word, and the
   contradiction was introduced by the very patch under review.
3. **R14-S2-F3:** **delete the `|| fileCount === 0` arm at `inspector-layout.ts:101`.** It removes the
   ambiguity instead of documenting it: the rule stays written once, in the place that executes it.
   This makes the wave a production-touching one, so the gate must confirm it — and the sibling arm at
   `:73` must be re-mutated to prove the operative copy is still covered. Caveat to record: with
   `fileRowH = 0` the deletion would turn a `NaN` into `0`; no density token set reaches that value.
4. **R14-S2-F1:** **correct the record now** — one sentence in T54's Outcome naming the bullet and the
   reason, and the bullet re-worded as «returns only the quoted retired clause inside its round-13
   marker». The practice T53's own last DoD bullet demands.
5. **Scope:** fix everything in this wave, split into three tasks on the round-9 / 10 / 11 / 12 / 13
   pattern (criteria first, then code, records last) so the dependency stays acyclic and the two docs
   tasks share no file.

## Artifacts changed by this review

Three follow-up tasks, written to disk and **not committed** (spec / SAD / task docs land in the same
commit as the code they describe):

| task | layer | deps | covers |
|---|---|---|---|
| **T56** — Round-14 criteria amendment: the two carriers that say *less* | docs | — | R14-S1-F1; O1; registers T56–T58 |
| **T57** — Round-14 code fixes: the stale `round(` and the vacuous `fileCount === 0` arm | domain | T56 | R14-S2-F2; R14-S2-F3 |
| **T58** — Round-14 records: T54's unnamed DoD bullet and T57's coverage attribution | docs | T56, T57 | R14-S2-F1; O2 |

## Gate result

**CHANGES REQUESTED.**

This is the soundest wave the branch has produced. Every mechanical claim T53, T54 and T55 make
reproduces under independent measurement — the byte-identity to the hash, the pin at its exact row and
message, the 4 / 835 count four rounds got wrong, the 12 / 16 sets task for task, the registration at
55 tasks with zero mismatches and a 321 / 0 textual insertion. Thirty of thirty-one mutations redden.
The whole §4 / §5 chain traces end to end with AC-20 the single declared manual exception, and both
`added-by-fix` ACs still redden across two tiers. The gate is 839 / 839 on ten clean runs across three
trees, with lint, `tsc` and build clean, no assertion weakened and no production file moved by the
wave.

What blocks is one stage-1 finding and three cheap quality ones, and the shape of the stage-1 finding
is by now the branch's signature. **The carve-out has reached every carrier of the guarantee that
says *share* and neither of the two that say *less*** — `sad.md:21`, the SAD's own headline quality
goal, whose §10 twin carries the exception so the SAD answers one question two ways; and
`_epic.md:206`, the invariant an implementer is told not to break. Both promise, at a configuration a
user reaches by dragging one splitter, a share the policy measurably does not give (0.690909 /
0.727273 against 0.750). Both files are in T53's own `files_hint`. T53's Outcome reports the residual
sweep as empty on the strength of four phrasings that share a single noun — which is the same lesson
T53 itself wrote down («sweep every phrasing of the claim, not a finding's list»), applied one level
too shallow.

Alongside it: a comment that tells a maintainer the cap **rounds**, in the tree that just changed it
to `Math.floor` and whose sibling spends fifteen lines on why rounding is wrong; a policy line that
states its rule twice, once operatively and once vacuously, next to a sibling whose removal breaks
three rows across two tiers; and a fifth consecutive round of a DoD reported as met with one bullet
unnamed.

Every fix is small and local — two sentences and two markers, one word, one deleted condition, one
Outcome clause. Nothing found this round touches an acceptance criterion's behaviour or the shipped
policy's output, and after T57 the gate must be re-measured because for the first time in four waves
a production file changes.
