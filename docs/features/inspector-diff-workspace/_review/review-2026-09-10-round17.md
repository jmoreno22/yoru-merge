---
slug: inspector-diff-workspace
date: "2026-09-10"
round: 17
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T63–T66 working tree
previous_review: review-2026-09-10.md (CHANGES REQUESTED at 805a32d + the T59–T62 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + full §4/§5 chain trace) and stage 2 (quality, edges, test adequacy of the changed surface). Each ran in its own git worktree (`C:\wt\r17s1`, `C:\wt\r17s2`) with a junctioned `node_modules` over a detached `805a32d` with the whole working patch applied and the 37 untracked files copied in. Both were dispatched with the round-15 **O11** discipline — persist the report outside the repo before analysing, log every mutation before applying it — and both delivered complete; stage 1's message truncated in transit and was recovered from the persisted file. The lead measured the gate in the main tree and ran its own arithmetic, chain and sweep batteries.
---

# Re-review round 17 — inspector-diff-workspace — 2026-09-10

## Scope

Seventeenth review, and the first over the **round-16 fix wave**: **T63** (criteria amendment),
**T64** (test coverage), **T65** (the figure gate) and **T66** (records), all four **uncommitted** at
review time, per the standing rule that spec / SAD / task docs land in the same commit as the code
they describe.

Whole feature diff `7cd47b4..805a32d` (**64 files under `src/`, +7248 / −327**) plus the working tree
(**33 files, +2096 / −241** against `805a32d`) and 37 untracked files — 70 `git status` entries.

**Changed surface since round 16:**

| task | what |
|---|---|
| **T63** | the carve-out clause reworded to the predicate its band measures, byte-identical at ten artefact sites; the per-density figures at `test-plan.md:90`/`:91`/`:173`; the counts restated as the loop's arithmetic; the three shipped densities carried to thirteen further sites; `sad.md:38`'s non-existent `FILE_ROW_HEIGHT` replaced by what the CDK `itemSize` really reads; T63–T66 registered |
| **T64** | the clamp term's flooring given a witness; the retired fixture band replaced by closed forms; the 220 / 110 twin rewritten across all three densities with map-size guards and an explicit `throw` on a missing key; the «rounds the cap» test title corrected to «floors» |
| **T65** | **new** `scripts/check-figures.mjs`, `package.json` `check:figures`, a «Figure drift check» step in `.github/workflows/ci.yml`, and `test-plan.md`'s CI-placement section |
| **T66** | every live epic address cited by anchor; the nested HTML comment un-nested; the carrier enumeration corrected to four with its scope named |

## Gate

Measured in the main tree by the lead and independently in each reviewer's worktree — three
agreeing measurements:

- `pnpm test` → **842 passed (842), 63 files**. Stage 2 ran the suite **49 times** through its
  battery; the baseline reported 842 / 63 every time.
- `pnpm lint` (biome) → **clean over 266 files**.
- `pnpm check:figures` → exit **0** (`23 markers, 45 values checked, 1 unmarked` — `DESIGN.md:73`,
  a `fontSize: 0.875rem` type-scale token, a heuristic false positive).
- `tsc --noEmit -p tsconfig.spec.json` → exit 0 (stage 2).
- `git status --porcelain -- src-tauri` empty; the Rust half is untouched by the whole feature diff.

**No production file changed in this wave.** The five md5s round 16 recorded are unchanged, verified
by all three agents on entry and on exit:

```
inspector-layout.ts       f10fa099c0981638022f412395001db6
appearance-metrics.ts     f50d48f3108168abaf083311f6815eba
commit-inspector.ts       44f017a4c415d7a1c001f7e0362d6a9c
main-content.ts           720244ba837d5fa7229ea935bb6d4704
main-content.html         d1fbdf2ef79301507843b0053f8b6586
```

## Reviewer disclosure

**Stage 1 edited no file at all** — every measurement came from throwaway ESM scripts under
`.tmp-review/` importing the shipped modules, deleted immediately. Its mutation log is empty by
construction, and `git status` was 70 entries at start and at end.

**Stage 2 ran 48 mutations plus 31 gate invocations**, each logged before application, applied with
Python (`newline=''`), restored immediately and md5-verified against a pre-battery copy. All four
mutated files are byte-identical to their pristine state. **One incident disclosed**: an early
derivation run imported the live modules while `MAX_CLAMP_LINES 4→5` was still applied and produced
wrong numbers; it was caught immediately (a clamp above the max is impossible) and every figure in
the report was re-derived from pristine copies with the battery idle. No file was corrupted and
nothing needed recovery.

**Stage 1's message truncated in transit**; its 303-line report was read in full from the persisted
file. No verdict in this record rests on a message whose text was not read. No `git add` / `commit` /
`checkout --` / `reset` / `clean` / `stash` ran in any worktree.

## What round 16 asked for, and got

| round-16 item | status |
|---|---|
| **R16-S1-F1** the dead fixture's shares in the cells a tester executes | **closed.** `test-plan.md:90`, `:91` and `:173` now give per-density figures; «the cap is one panel head» and «expanded and collapsed alike» are gone. Every surviving share re-derived from `computeMetrics` by all three agents: comfortable 34 / 0.690909, compact 27 / **0.754545 (meets 0.750)**, relaxed 43 / 0.609091. `:173` names `0.727273` explicitly as a `uiFontSize` 16 artefact so a tester who measures it knows why. **A fourth carrier the finding did not enumerate, `:43`, was found and fixed by T63 itself and disclosed** |
| **R16-S1-F2** the retired fixture band inside `src/` | **closed for the figures, reopened for one form → R17-F1.** `inspector-layout.spec.ts:640-694` carries no per-density pixel figure; the restore instruction now names the share-yield bound as a form and says «Do not write those bounds out as numbers». Retired figures 59, 119, 224, 120, 90, 179, 359 all grep to 0 outside the dated marker. **But the guard's closed form in the same block is wrong** |
| **R16-S1-F3** the four counts falsified by the wave's own change | **closed, and closed in the way that survives the next change.** `test-plan.md:35`, `:99` and `:145-152` state `DENSITIES.length × heights.length × fileCounts.length × 2`; verified against the real loop (`DENSITIES` 3 at `:30`, `heights` 8 at `:574`, `fileCounts` 6 at `:575`) ⇒ **288 / 576 / 48** |
| **R16-S1-F4** the ticked DoD bullet whose commands contradicted it | **closed.** No live artefact cites `_epic.md` by line number; the two survivors are past-tense quotations that are the finding's substance. **Their count is misreported → R17-F12** |
| **R16-S1-F5** the `relaxed` decision at three sites of sixteen | **closed at fifteen of seventeen → R17-F2, R17-F4.** `spec.md:229`, `:236`, `sad.md:40`, `:690`, `:734`, `:742`, `:744`, `test-plan.md:35`, `:38`, `:43`, `:47`, `:90`, `:95`, `:99`, `:116`, `:171`, `:186` all corrected. **`test-plan.md:179` and `adr/0003:43` were not** |
| **R16-S1-F6** the nested HTML comment | **closed.** Token-scanned with a state machine over 98–106 markdown files by the lead and stage 1, fenced blocks and code spans blanked first: **0 nested, 0 unclosed**. `test-plan.md:113` is one well-formed marker |
| **R16-S1-F7** the carrier enumeration | **closed with its scope.** The marker names four carriers, lists four, excludes `inspector-layout.ts` as «not a carrier — that site was always right», and states the grep, the paths and the date swept. The predicted fifth carrier — the «rounds the cap» test title — now reads «floors» (`grep -rn "rounds the cap" src` → 0) |
| **R16-L-F1** `FILE_ROW_HEIGHT` | **closed.** `grep -rn "FILE_ROW_HEIGHT" src` is empty; `sad.md:38` names `[itemSize]="rowHeight()"` in all five templates and keeps the real half of the constraint. **T63 also found and corrected a further carrier of the same belief in `DESIGN.md` §Density, and disclosed taking `ARCHITECTURE.md` beyond its routing** |
| **R16-L-F2** the 220 / 110 twin | **closed on all three points.** «the one REACHABLE configuration» deleted; «numerically identical» replaced by the per-density table (comfortable 34/34 and relaxed 43/43 identical, **compact 36 / 27 not**); the row loops all three densities from a `Map` with `expect(EXPECTED.size).toBe(DENSITIES.length)` and a property assertion. Stage 2's S1/S2/S3'/S4 mutations each redden and the explicit `throw` fires — both guards are real and independent |

**T63's headline sweep reproduces exactly.** Re-measured independently by the lead and by both
reviewers over the same grid (21 reachable density × font pairs × `r = 1…1200` step 0.25 × 2 collapse
states = **201 474 points**): the clause's band vs the share yielding → **0 mismatches**; vs the guard
binding → **5312**, every one expanded; the guard's own closed form `2·panelHeadH + 2·fileRowH`
expanded / `4·panelHeadH` collapsed vs the guard binding → **0**. First round in several where the
wave's headline figure holds up under three independent re-derivations.

## Findings

Twelve distinct findings after de-duplication. **R17-F1 was reached independently by all three
agents**; **R17-F3** by stage 1 and the lead; **R17-F4** and **R17-F12** by the lead alone;
the rest by stage 2.

### The false closed form

| id | finding | resolution |
|---|---|---|
| **R17-F1** | **The guard-binding closed form T64 wrote to end the stale-figure class is itself false, is certified as exact, and is contradicted by its own derivation two lines below.** `inspector-layout.spec.ts:663` states the guard's band as `expanded  r < 2 * (panelHeadH + 2 * fileRowH)`. The guard binds iff `remainder − protectedList < panelHeadH`, and in the row-floor regime `protectedList = panelHeadH + 2·fileRowH`, so the boundary is **`2·panelHeadH + 2·fileRowH`** — which is what `spec.md:198` and T63's own Outcome table give, and what `:666-667`'s prose derives. Measured over the identical 201 474-point grid the comment cites: the written form mismatches at **5312**, the correct one at **0**. Three adjacent claims fall with it: `:668` «Also **0 mismatches**» is 5312; `:669` «disagree at **5312**» is **10 624** with the form as written; `:670` «**0.6091 to 0.6909**» is really ≈ **0.50 … 0.74**. At comfortable / 13 px the written form claims the guard binds to `r = 188`; it stops at **127.75** — witness at `r = 130`, where the cap is 36 > `panelHeadH` 34 and the guard does not bind. T64's Outcome repeats the wrong form and the false certification verbatim. **Failure scenario:** the next reviewer compares `spec.md:198` with the policy's own spec file, finds them differing by `2 × fileRowH` = 60 px at comfortable, and nothing says which is shipped truth. A maintainer trusting the code comment treats `r = 128…188` expanded as inside the carve-out — it is not; the guard does not bind there and the ratio is the only thing holding the list's half, so a share regression in that window gets dismissed as «inside the band». **Why it blocks:** **ninth consecutive round of the class**, inside the artefact T64 wrote *in this wave* to end it, whose stated remedy was «closed forms cannot go stale». **`:686-687`'s bounds `h < 2 * (panelHeadH + 2 * fileRowH)` / `h < 4 * (panelHeadH + 2 * fileRowH)` are CORRECT** — a different predicate — and must not be "fixed" alongside it | **Fix now** → T68 |

### The two-densities sweep, one artefact short again

| id | finding | resolution |
|---|---|---|
| **R17-F2** | **The last live measurement instruction still pinned to two densities — at the address R16-S1-F5 explicitly enumerated.** `test-plan.md:179`: «**Layout regressions in existing modes** → scenario: **8 configurations (2 themes × 2 densities × 2 placements)** on Windows and Linux; assert 0 regressions.» It contradicts `spec.md:236` («both themes × **the three densities** × both placements»), `sad.md:742`, `sad.md:744` and `test-plan.md:186` — the last of which T63 **did** fix. Under the owner's three-densities decision the count is **12**. **Failure scenario:** the release engineer works the NFR list top to bottom; bullet 1 says six runs across three densities, this one says eight configurations across two. They never render the inspector at **relaxed** in either theme or placement and sign the checklist. Relaxed carries the widest guard band (`4 × 43 = 172`) and the worst reachable share, **0.609091** at the 220 / 110 bottom minimum. **Why it blocks:** AC-20's *entire* verification is manual (`test-plan.md:26`, `sad.md` §11 «No automated UI test tier»); T63 fixed the line then at `:179` and the neighbouring bullet carrying the same defect moved into the vacated address | **Fix now** → T67 |
| **R17-F4** | **A live Accepted-ADR consequence still scopes its verification to two densities, inside the grep scope T63 declared and outside the Outcome it reported.** `adr/0003:43`, a *Negative* Consequences bullet with no amendment section anywhere in the file: «after the move the viewer must re-measure (its `ResizeObserver` fires on the new size) and the behaviour **must be checked in both inspector placements and both densities**». `status: Accepted`, `updated_at: 2026-09-02`, not superseded. T63's DoD bullet named `adr/` explicitly in the grep scope and required reporting the command's real output; its Outcome named **two** exceptions and neither is this. **Failure scenario:** whoever verifies ADR-0003's portal re-measure consequence checks 2 of 3 densities and never exercises relaxed, where `panelHeadH` is 43 and the re-measured box is largest. **Why it blocks:** same class and same wave as F2, in a file the wave's own DoD put in scope — and **both clean-context reviewers missed it**; it came out of the lead battery. Fixing F2 without it repeats «the sweep stopped one artefact short» for the tenth round | **Fix now** → T67 |
| **R17-F3** | **A back-reference to a run count this wave changed, in the collapsed-share measurement.** `test-plan.md:172`: «**Commit file list protected share, header collapsed** → scenario: **the same 4 runs** with the header collapsed». The bullet it refers back to is `:171`, which this wave rewrote from «4 runs (… × both densities)» to «**6 runs** (960 × 640 and 1280 × 800 × **the three shipped densities**)» — both lines are `+` in `git diff 805a32d`. «The same 4 runs» names a count no bullet in the file states. **Failure scenario:** the engineer executes six runs, reads «the same 4 runs» and has to guess which four; any reading that yields four drops a density from the **collapsed** measurement — where the guard band is widest and the 0.750 promise is actually missed. **Why it blocks:** AC-02's only measurement in the built app is under-run, and the instruction is internally consistent with itself so the tester cannot notice | **Fix now** → T67 |

### The figure gate (T65) — an instrument that overstates what it guards

| id | finding | resolution |
|---|---|---|
| **R17-F5** | **The gate never reads the prose it certifies.** The only comparison is the marker's `expect=` against the recomputed value; nothing ties a marker to the figure in the sentence beside it (`scripts/check-figures.mjs:127-215` — verified by reading the source). Every historical instance reconstructed **in the prose, marker untouched**, exits 0: «30 / 30 compact» (R15-S1-F2 verbatim), «compact meets it at 0.727273» (R15-S1-F1's dead figure), «As the suite stands: 192, 384 and 32» (R16-S1-F3 verbatim), and a marked row's own «`headerMaxH` = 99 comfortable» against a marker still saying 34. **Failure scenario:** `test-plan.md:185` tells the reader «when a row quotes a derived figure, its marker is what checks it». It is not; the marker checks the marker. A wave writes a wrong figure into a row that already carries a correct marker, CI passes, and the branch's whole defect class walks straight through the instrument built to stop it. **Why it blocks:** it is the gate's central claim, and T65's table «it fails on each of the six historical instances» holds only because the drift was injected into the markers | **Fix now (claims) + defer (marker↔prose binding)** → T70 + spec §8 |
| **R17-F6** | **Losing a marker is a silent pass.** The marker regex is `/<!-- figure:\s*(\S+)\s+([^>]*?)-->/g`, so `<!--figure:` (no space), `<!-- Figure:` (capitalised), a marker reflowed across two lines, or one deleted outright each drop a check while the gate exits **0** and prints `OK` — markers go 23 → 22 and nothing asserts the count. The coverage counter cannot catch it either: the figure sits inside the unmatched comment, so `insideSameLine` suppresses it. **Failure scenario:** an editor reflows a long table row, a marker breaks, and the row's figures silently stop being checked for the rest of the branch's life | **Fix now** → T70 |
| **R17-F7** | **`sweep-counts` certifies its own model of the loop.** `check-figures.mjs:202` computes `{ share: nd*nh*nf*2, cap: nd*nh*nf*4, zerofile: nd*nh*2 }` — only the three array lengths are read from the spec file; the `×2`, the `×4` and the `nf`-independence of the zero-file subset are the verifier's own hardcoded shape. Removing the collapse dimension from the share loop (real 288 → 144) and adding a fifth nested dimension to the cap loop (576 → 1152) both leave the gate at exit **0**. **Failure scenario:** someone widens or narrows a loop the way T61 widened `DENSITIES`; the counts in `test-plan.md:35`, `:99` and `:152` go stale and the gate confirms them — R16-S1-F3 reproduced with the gate installed. **Why it blocks:** T65's DoD «a verifier that reimplements the thing it verifies certifies itself» is unmet for the one kind whose historical instances are counts; its grep passes only because it does not look for this arithmetic | **Fix now** → T70 |
| **R17-F8** | **The coverage number does not measure coverage, and two Outcomes state a precise figure that is false.** `45` counts *values*, `1` counts *lines*, and **one marker exempts its whole line** (`check-figures.mjs:230`: `!line.includes('<!-- figure:')`) — 34 of the 35 heuristic-visible figures in live prose sit on lines reported as `0 unmarked`. The heuristic (`:104`) sees only a `0.ddd`–`0.dddddd` decimal or a 20–49 px pair, so it cannot see `68 / 60`, `136 / 120`, `192 / 384 / 32`, `288`, `cap 50`, `cap 100`, `43 + 2 × 37 = 117` — the figures of R15-S1-F1, R16-S1-F3 and R10-S1-F10, the very instances T65's table claims to close. T65's «marker coverage of derived figures is **45 of 45**» and T63's «**19 of 19**» are both false; `45` is itself inflated — 23 markers carry **10 distinct claims** / 22 distinct values. **Failure scenario:** the owner, the next reviewer or `ship` reads `1 unmarked` as «one figure is unchecked» and stops sweeping; on `test-plan.md:43` alone eight derived figures are unchecked and reported as zero. **Why it blocks:** «a precise figure that is false» is the class this wave exists to close, and the false figure is the wave's own coverage claim | **Fix now** → T70 (semantics) + T71 (the two Outcomes) |
| **R17-F9** | **Two marker arguments are silently ignored, and both are the next ones an author would write.** A `share` marker's `fileCount=` is discarded (`shareFor`, `:78-88`, hardcodes `fileCount: 30`) and a `cap` marker's `font=` is discarded (`capFor`, `:68-77`, hardcodes 13); both exit 0. **Failure scenario:** `protectedList` branches on `fileCount === 0` (AC-04 / AC-05), so a marker written for the empty-list case is silently verified against the 30-file case and can certify a figure the app never produces; and the branch's worst reachable share, **0.647059 at relaxed / 17 px**, cannot be marked at all. **Why it blocks:** the script's own header calls named arguments «deliberate … a positional triple is the same ambiguity that produced the figures this script exists to catch», then discards two named arguments without a word — the same failure mode one layer down | **Fix now** → T70 |

**Also routed to T70 (lead):** `ARTEFACTS` (`check-figures.mjs:39-48`) is an **enumerated list of eight
files**. That is the structure the owner abolished after R15-S1-F3 («redefine the sweep's scope as
every tracked file the branch touches rather than an enumerated list»), reinstated in the wave's own
anti-recurrence instrument. `adr/0003` — where R17-F4 lives — is outside it. No marker is currently
orphaned outside the scope, so this is latent rather than exploited, and it is disclosed nowhere.

### Test adequacy — two coverage holes

Stage 2's battery: **48 mutations, full-suite denominator, 40 redden, 8 green.** Of the eight greens,
one is an equivalent mutant (`C7`, the write dedup — no observable effect, correctly untested), five
are low-severity boundary gaps recorded as observations, and two are real:

| id | finding | resolution |
|---|---|---|
| **R17-F10** | **The collapsed header's own height is unobserved.** `inspector-layout.ts:103`, `headerHeight = headerCollapsed ? panelHeadH : …` → `? 0 :` leaves **842 / 842 green**. The two disagree in `listRows` at **400** configurations of stage 2's fixture space and at **30 of the 576** in the suite's own T29 table (lead re-measurement), including **compact at the 220 / 110 carve-out remainder** — real 2 rows, mutated 3 — and `compact h = 200, files ≥ 7` (6 vs 7). **Failure scenario:** a change that stops charging the collapsed header its own head, or charges it the expanded `headerFixedH`, silently hands the list a row it has no room for, at every density, with the suite green. **Why it blocks:** `listRows` under a collapsed header is AC-02's only observable, and it is the term the round-16 wave rewrote the surrounding rows around — the twin at `:401` asserts caps and shares under collapse and never a row count. Every other term of the policy has an assertion; this is the one that does not | **Fix now** → T69 |
| **R17-F11** | **The consumer half of AC-19 is unwitnessed.** Neutering the stacked-panels sum in `applyLayout` (`commit-inspector.ts:570-573`) leaves **842 / 842 green**: no component row renders a stacked panel inside the inspector column, and both of that file's own policy calls pass `stackedPanelsHeight: 0` (`commit-inspector.spec.ts:468`, `:573`). **Failure scenario:** the inspector stops subtracting the stacked panels, sizes against the full column, and the list overflows its box at every window size — suite green. **Why it blocks:** the «fixed 110 px» remainder that AC-18's carve-out band, T51's collapsed twin and the fourth manual run are all derived from comes from exactly this loop. `main-content.spec.ts`'s AC-19 rows pin the flex *bases*; battery `L22` pins the *policy* side; nothing joins them. Constructible — the suite already stubs rects | **Fix now** → T69 |

### Records

| id | finding | resolution |
|---|---|---|
| **R17-F12** | **A count in a record that is not what its command returns — the class T66 was written to close, in T66.** Its Outcome reads «`grep -rn "_epic\.md:[0-9]"` over `tasks/` down to **one historical quotation**». It returns **two**: `round15-records.md:36` and `round16-records.md:234` — the second being T66's own line, quoting the first. Both are past-tense quotations that must stay; only the reported count is wrong. **Failure scenario:** the round-18 reviewer runs the bullet's own command, gets 2 where the record promises 1, and cannot tell whether a third citation was missed or the count was miscounted. **Why it blocks:** low blast radius, but the branch's standing rule is that a bullet whose subject is a count states what the command returns — written by T62, restated by T66, broken by T66 | **Fix now (record only)** → T71 |

## AC chain trace

Traced end-to-end by stage 1, mechanically: `spec.md` §4/§5 → `sad.md` §6 coverage → `ux-flows.md`
AC→flow map → `screens.md` SCR inventory → `test-plan.md` coverage rows → `tasks.json` `acs` → the
named spec files under `src/`. `sad.md` `target_surfaces: [desktop-app]` — one surface, so the UI-tier
requirement is ≥ 1 `component` or `e2e-through-UI` row.

**8 / 8 user stories** carry ≥ 1 AC and ≥ 1 §6 flow. **22 / 22 acceptance criteria** have a §6 flow
row, a `ux-flows.md` map entry, ≥ 1 test-plan row with a UI-tier level, and ≥ 1 task claiming them.
**0 ACs are claimed by no task; 0 AC ids appear in `tasks.json` that are not in spec §5. Nothing drops
out of the chain at any hop.**

The `added-by-fix` criteria were traced at least as strictly as the rest: **AC-22** (the owner's
2026-09-07 reversal) lands in code, four component tests and a schema test; the round-9/10/11
additions to AC-04, AC-05 and AC-06 each have their own named row and test.

The one substantive gap is **AC-20's absence of automated cover** — declared, dated and owner-accepted
(`test-plan.md:26`, `sad.md` §11). That is precisely what makes **R17-F2** block: `test-plan.md:179`
is one of only two instructions that would ever render the inspector at relaxed.

## Checked and clean

Measured, not read.

- **The reworded clause is one distinct byte value at exactly ten sites, no eleventh.** 319 characters
  with the bold delimiters, md5 `2b9b31ab551ed2f7e942a0a24e457cf5` — **exactly T63's claimed figure**,
  re-derived byte-for-byte by stage 1; the lead's inner-span capture (315 chars, md5
  `9dab88a1a2a9df5e9a8c1486f52094b3`) agrees on the conclusion. Sites: `spec.md:101`, `:198`, `:231`,
  `sad.md:21`, `:380`, `:733`, `screens.md:343`, `test-plan.md:91`, `:173`, `ux-flows.md:179`. The
  short pointer is likewise one distinct value, 66 characters, at six sites. `grep -rn "header-cap
  guard binds"` over live artefacts → **0**.
- **Every live figure re-derives from the shipped modules, in all three densities.** The lead
  re-derived all **24** `figure:` markers with an independent implementation of `computeMetrics` and
  the policy — **0 mismatches** — without invoking the project script. Stage 1 and stage 2 did the
  same by importing the modules. Tokens 26/24 · 34/30 · 43/37; 220/110 collapsed caps 27 / 34 / 43;
  220/110 expanded caps 36 / 34 / 43; 420 cap 210 in all three; 400/200 collapsed cap 50 / share
  0.750000; relaxed 400/200 expanded cap 83 / share 0.585000. Every cell is reachable.
- **Every share-shaped decimal in live prose sits on a line carrying a marker** — 23 of 23 (lead
  sweep with dated markers blanked). The coverage *number* is wrong (R17-F8); the coverage itself, for
  the figures the heuristic can see, is complete.
- **The gate fires loudly in the module direction — its real strength.** Five module drifts, each
  logged, applied, restored and md5-verified: `PAD.fileRow` 15→20 → exit 1, 14 figures named;
  `TEXT_LINE_RATIO` → 39; `COLLAPSED_LIST_SHARE_FLOOR` → 3; head-cap guard dropped → 10;
  `LIST_ROWS_FLOOR` 2→3 → 5. Every message carries `file:line`, the claim and the computed value. It
  imports the shipped modules rather than reimplementing them (T65's grep confirmed).
- **T64's rewritten comments are correct everywhere except `:663`** — the twin's per-density table,
  the compact-420 derivation, the «binds both hard floors» arithmetic, the 400/200 row, the
  `4·(ph+2fr)/3` collapsed row-floor bound, the `h = 130` worked example, the share-yield form at
  `:652-653`, and the deleted-predicate bounds at `:686-687`.
- **O6 and O15 are genuinely closed, measured not argued.** Mutations S1, S2, S3' and S4 each redden;
  with the `EXPECTED.size` assertion also removed the explicit `throw` fires (`Error: no expectation
  for panelHeadH 26`), so both guards are real and independent. M1 / M2 / M3 each redden rows *inside*
  `inspector-layout.spec.ts`, so the literal-anchored coupling to `computeMetrics` survived T64's
  rewrite.
- **Registration bookkeeping, mechanically over all 66** (lead and stage 1 independently):
  `tasks.json` parses; 66 tasks; ids exactly `T1`…`T66`; **0 duplicate ids, 0 dangling deps, 0 cycles**;
  every id has exactly one task file and every task file's `id` is in `tasks.json`; **`files_hint`
  agrees on all 66** (0 mismatches); `deps` agrees on all 66. `_epic.md:218-221` and `tracker.md:70-73`
  mirror `tasks.json` on layer and deps for T63–T66; `tracker.md:75` reads «Total: 66 tasks» and links
  the round-16 record.
- **Comment hygiene**: 0 nested, 0 unclosed HTML comments over 98–106 markdown files, fenced blocks
  and inline code blanked first.
- **Portability**: CRLF-converted artefacts and modules still exit 0; `.gitattributes` pins
  `* text=auto eol=lf`; the CI step is a plain `run:` in the `build` job on `[ubuntu-latest,
  windows-latest]`, after Lint and before Unit tests, with no `continue-on-error`, so a non-zero exit
  does fail the job.
- **Esc layer registry** untouched by this wave: listener removed on `DestroyRef.onDestroy`, `bind()`
  unregisters through `effect`'s `onCleanup`, resolution is pure. No leak, no boundary violation.
- **Boundaries**: `inspector-layout.ts` imports nothing, `appearance-metrics.ts` imports one type,
  `check-figures.mjs` executes no app side effect. No new coupling between inspector / diff-workspace /
  main-content.
- **Security**: nothing in this wave reads user input, touches the network, or shells out.
- `grep -rn "it\.skip\|\.only(\|it\.todo\|\.concurrent" src/` → **0** (properly escaped).

## Observations — recorded, not blocking

- **O1** `tasks.json` T44 claims `AC-02` and T49 claims `AC-01` where the task files' frontmatter does
  not (round-15 O10, round-16 O13). Both ACs have ample other cover; nothing drops out of the chain.
  Still exactly those two of 66.
- **O2** `tasks/compact-file-list-layout.md:43` still reads «Row height stays 30 px in both densities
  (pinned to `FILE_ROW_HEIGHT`)» — both halves false today. It is a task record from the original wave;
  whether task records count as «live artefacts» for T63's DoD is now settled by the owner's scope
  decision below.
- **O3** `test-plan.md:152`'s «As the suite stands: 288, 576 and 48» is an unchecked literal one line
  above the `sweep-counts` marker that checks the same three values. Drift would fail the marker, but
  the prose is not itself pinned — R17-F5 in miniature.
- **O4** Boundary gaps from the battery, all cheap to close and all in `commit-inspector.ts`:
  `measureBody`'s one-pixel anti-flicker slack (`:481`, mutations C2/C3), `bodyLines`' rounding
  (`:563`, C5), `headerFixedH`'s body subtraction (`:568`, C6 — jsdom gives the body a zero rect in
  every row, so the subtraction is a no-op throughout), and the header-action count clamp (`:520`, C8).
- **O5** Mutation **C7** (the `applyLayout` write dedup) is green and **is not a hole** — the dedup has
  no observable effect on the written variables. Recorded so a future round does not read it as one.
- **O6** A well-formed marker inside a fenced code block is counted as a real check and inflates the
  coverage number; a wrong one inside a fence fails CI. The script header's «prose must not quote the
  marker delimiters inline» convention is enforced by nothing — while T66's own comment scanner,
  written in the same wave, *does* blank fenced blocks and code spans first.
- **O7** `check-figures.mjs` accepts unknown density keys inside `expect=` silently and takes the last
  of a duplicated key; `checked += 1` runs before the `want[d] === undefined` test in the `cap` and
  `token` branches.
- **O8** `commit-inspector.ts:583`'s comment still compresses two different cases («`lineH` is 0 (or
  NaN, when jsdom resolves `line-height: normal`)») — round-16 O2, unrouted in this wave.
- **O9** `main-content.spec.ts`'s `stackedPanelWrappers()` resolves the wrapper with
  `.closest('[style*="flex"], div')`, which falls back to the nearest `div` ancestor. Correct today; it
  would silently start asserting on the wrong element if the template gained an intermediate `div`.
- **O10** `adr/0004:22` quotes spec §6's NFR as «**Diff viewer** share … both densities» inside
  *Decision drivers*. Both halves are pre-reversal, but the ADR carries `**Date:** 2026-09-02` and an
  explicit `## Amendment — 2026-09-07` section, so the drivers are dated by the file's own structure.
  Judged **correctly historical** by stage 1 and the lead — recorded because a future sweep will hit it
  again and should not "fix" it.
- **O11** Commit hygiene, round-16 O14 and growing: `.github/workflows/release.yml`, `install.sh`,
  `.gitignore` and `.mcp.json` sit in the same working tree, claimed by no task, `tasks.json` entry or
  `files_hint`. `scripts/check-figures.mjs`, `package.json` and `.github/workflows/ci.yml` *are*
  claimed, by T65.
- **O12** The CI step is **unexercised** — nothing is pushed from this branch. What was exercised is
  the exact command CI runs: 31 local invocations against 24 malformed-marker attacks, 6 prose
  reconstructions, 2 sweep-shape drifts and 5 module drifts.

## Owner decisions taken at this gate

| # | question | decision |
|---|---|---|
| **D1** | how far the figure-gate fix goes in this wave | **Harden the cheap structure and correct every overstated claim.** In scope: assert the marker count (F6), stop discarding named arguments (F9), measure the loop's shape or retire the `sweep-counts` kind (F7), fix the coverage number's semantics (F8), widen `ARTEFACTS` per D4. Correct `test-plan.md:185`, the docblock, and T65's and T63's Outcomes. **The marker↔prose binding (F5's structural half) is deferred to its own spec, recorded in spec §8 with owner + due** — it is a prose parser and does not belong inside a review wave |
| **D2** | the two coverage holes | **Fix both now.** F10 as a unit row; F11 at component tier with a stacked panel rendered in the inspector column |
| **D3** | anti-recurrence, after nine rounds of the same class | **No live artefact may write a figure derived from `computeMetrics` or the policy.** Closed forms in `panelHeadH` / `fileRowH` only, plus **one** reference table generated from the code. The class ends by construction rather than by surveillance |
| **D4** | how the next sweep's scope is defined | **Every tracked file the branch touches, with written exclusions.** ADRs and task records are in scope by default; anything excluded is named with its reason. Plus a mechanical check that fails when a sweep's declared scope is narrower than the scope it executed |

## Routing

| task | layer | deps | what |
|---|---|---|---|
| **T67** — round-17 criteria amendment | docs | — | **F2** `test-plan.md:179` → 12 configurations across the three densities · **F4** `adr/0003:43` → three densities · **F3** `test-plan.md:172`'s «the same 4 runs» → 6 · **D3** the no-derived-figures-in-prose rule written into the criteria, with the single generated reference table · **D4** the sweep-scope definition with its written exclusions and the mechanical scope check. Registers T67–T71. Cite `_epic.md` by anchor only, parentheses included |
| **T68** — round-17 code fixes | domain | T67 | **F1** `inspector-layout.spec.ts:663` → `2 * panelHeadH + 2 * fileRowH`, and re-measure `:668`, `:669`, `:670` from the corrected form. **Do not touch `:686-687`** — a different predicate, verified correct by stage 2 and the lead |
| **T69** — round-17 test coverage | domain | T68 | **F10** a witness for the collapsed header's own height (the mutation `? panelHeadH :` → `? 0 :` must redden) · **F11** a component row that renders a stacked panel in the inspector column so the `applyLayout` sum is observed (neutering it must redden) · optionally the O4 boundary pins |
| **T70** — round-17 gate hardening | infra | T67 | **F6**, **F7**, **F9**, **F8** (semantics) and the `ARTEFACTS` widening per D4; correct `test-plan.md:185` and the docblock to what the gate actually checks; record F5's structural half in spec §8 with owner + due |
| **T71** — round-17 records | docs | T69, T70 | **F12** the grep count · T64's Outcome (the wrong closed form and its false «0 mismatches») · T65's «45 of 45» and T63's «19 of 19» · the observation list above. **No registration** — T67 owns it |

## Verdict

**CHANGES REQUESTED.**

Twelve findings: one false closed form inside `src/`, three live measurement instructions the
three-densities sweep did not reach, five defects in the wave's own figure gate, two coverage holes,
and one record count.

The direction is right and this wave delivered more real closure than any since round 9: T63's
201 474-point sweep reproduces exactly under three independent re-derivations, the ten-site clause is
byte-identical to the character T63 claimed, every live figure re-derives correctly in all three
densities, the AC chain is complete end-to-end for the first time under a full mechanical trace, and
40 of 48 mutations redden. The gate is real — it catches every module-side drift that could be
constructed against it.

What blocks is that the wave's two anti-recurrence instruments both certify more than they check. The
closed form T64 wrote to make figures un-staleable is itself false, next to a correct derivation of
the right one. The gate T65 built to catch false figures reads its own markers rather than the prose
those markers annotate, so the four historical instances walk through it untouched. That is why **D3**
and **D4** matter more than any single fix in the routing table: after nine rounds, the class does not
end by finding the next instance.

**Nothing production-side is wrong.** The shipped policy is correct at all 201 474 points measured,
`inspector-layout.ts` and `appearance-metrics.ts` are byte-identical to what round 16 reviewed, and no
finding in this round describes behaviour a user would see.
