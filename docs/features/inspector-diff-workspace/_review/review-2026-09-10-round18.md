---
slug: inspector-diff-workspace
date: "2026-09-10"
round: 18
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 805a32d + the uncommitted T67–T71 working tree
previous_review: review-2026-09-10-round17.md (CHANGES REQUESTED at 805a32d + the T63–T66 tree)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus) — stage 1 (claimed AC + the full §4/§5 chain, the closure of the docs-shaped round-17 findings, and owner decisions D3/D4) and stage 2 (quality, edges, test adequacy of the changed surface, and the hardened gate attacked adversarially). Each ran in its own git worktree (`C:\wt\r18s1`, `C:\wt\r18s2`) with a junctioned `node_modules` over a detached `805a32d` with the whole working patch applied and the 44 untracked files copied in — 79 `git status --porcelain -uall` entries at entry and at exit in both. Both were dispatched with the round-15 **O11** discipline (persist the report outside the repo before analysing, log every mutation before applying it) and both delivered complete. The lead ran its own battery in the main tree plus a third worktree (`C:\wt\r18lead`) and a reconstructed shallow CI checkout.
---

# Re-review round 18 — inspector-diff-workspace — 2026-09-10

## Scope

Eighteenth review, and the first over the **round-17 fix wave**: **T67** (criteria amendment),
**T68** (code fixes), **T69** (test coverage), **T70** (gate hardening) and **T71** (records), all
five **uncommitted** at review time, per the standing rule that spec / SAD / task docs land in the
same commit as the code they describe.

Whole feature diff `7cd47b4..805a32d` plus the working tree (**35 tracked files, +2419 / −244**
against `805a32d`) and 44 untracked files — 79 `git status` entries.

**Changed surface since round 17:**

| task | what |
|---|---|
| **T67** | `test-plan.md`'s layout-regression scenario restated as the product across the three shipped densities; the collapsed-share bullet re-pointed at «every run of the bullet above»; `adr/0003`'s re-measure consequence widened to three densities; **D3** and **D4** written into the test plan's conventions block and `spec.md` §8; T67–T71 registered; the epic's mermaid graph repaired for T63–T66; `tracker.md`'s person-day total restated as its arithmetic |
| **T68** | the false closed form replaced by `2 * panelHeadH + 2 * fileRowH`, and every adjacent number re-measured from the corrected form |
| **T69** | a witness for the collapsed header's own height; a component row that renders real stacked panels inside the inspector column |
| **T70** | `check-figures.mjs` rewritten (branch-derived scope, marker-count pin, loop-shape reading, honoured named arguments, line-level coverage bound); **new** generated `reference-figures.md`; the CI-placement row and the docblock corrected; R17-F5's structural half deferred in `spec.md` §8 with owner + due |
| **T71** | the `_epic.md` grep count restated as what the command returns on the tree it leaves; T64's wrong form and false certification corrected; T65's «45 of 45» and T63's «19 of 19» replaced by T70's measured quantity with its definition |

## Gate

Measured independently in the main tree by the lead and in each reviewer's worktree — three agreeing
measurements:

- `pnpm test` → **844 passed (844), 63 files**. Stage 2 ran the full suite **51 times** through its
  battery; the baseline reported 844 / 63 every time.
- `pnpm lint` (biome) → **clean over 266 files**. *The scope is `src` only — `scripts/` is outside it
  → R18-O2.*
- `pnpm check:figures` → exit **0** locally (`23 markers in 3 file(s), 10 distinct claims, 45 values
  recomputed`; `scope: 108 markdown file(s) derived from the branch`; `coverage: 36 figure(s) … 15
  unbound`). **Exit 1 under the workflow's own checkout → R18-F1.**
- `pnpm figures:write` → the regenerated table is **byte-identical** to the checked-in copy
  (md5 `4fce755666e7058a0603b21d9764842b` both sides).
- `tsc --noEmit -p tsconfig.spec.json` → exit 0.
- `git status --porcelain -- src-tauri` empty; `git diff --stat 7cd47b4..HEAD -- src-tauri` empty. The
  Rust half is untouched by the whole feature diff, so T71's `388 passed / 0 failed / 1 ignored`
  is **not re-verified in this record** — stated rather than passed over.

**No production file changed in this wave.** The five md5s round 17 recorded are unchanged, verified
by all three agents on entry and on exit:

```
inspector-layout.ts       f10fa099c0981638022f412395001db6
appearance-metrics.ts     f50d48f3108168abaf083311f6815eba
commit-inspector.ts       44f017a4c415d7a1c001f7e0362d6a9c
main-content.ts           720244ba837d5fa7229ea935bb6d4704
main-content.html         d1fbdf2ef79301507843b0053f8b6586
```

`scripts/check-figures.mjs` moved from T65's `8cf3336e78b9d59ce15a405f6287af9f` to
`bcde4f743357bb3ab169c603186a1b75`, which is the value T70 records.

## Reviewer disclosure

**Stage 1 applied six mutations**, each logged before application and restored immediately, with the
production md5s re-verified after the last restore. Its `git status` was 79 entries at start and at
end.

**Stage 2 applied 99 mutations** across five gate-attack harnesses and one full-suite battery, each
logged before application, applied with Python (`newline=''`), restored immediately and md5-verified
against a pre-battery pristine copy. Every mutated file is byte-identical to its pristine state. **Two
mutations are disclosed as invalid rather than counted as results:** `G35` (renaming a policy constant
broke the module, so its exit 1 measured a broken import — replaced by `G35b`, `= 1 / 2;`) and `G44`
(an unclosed `<div>` broke the Angular build — replaced by `G44b`, a well-formed wrapper). No
derivation ran while a mutation was live; no other incident.

**The lead** applied two mutations in `C:\wt\r18lead` (both restored, md5-verified), built a shallow
single-branch clone to reconstruct the CI checkout, and ran its own arithmetic, chain, registration
and comment-hygiene batteries from throwaway scripts outside the repo.

No `git add` / `commit` / `checkout --` / `reset` / `clean` / `stash` / `restore` ran in any worktree.
No verdict in this record rests on a report whose text was not read in full.

## What round 17 asked for, and got

| round-17 item | status |
|---|---|
| **R17-F1** the false closed form, certified as exact | **closed, and closed with the RIGHT form.** All three agents re-derived the guard's boundary from `inspector-layout.ts` independently: it binds iff `remainder − protectedList < panelHeadH`, and in the row-floor regime that is `r < 2·panelHeadH + 2·fileRowH` — a **sum**, not `2 * (panelHeadH + 2 * fileRowH)`. Measured over the same 201 474-point grid (21 reachable density × font pairs × `r = 1…1200` step 0.25 × 2 collapse states): the corrected form **0 mismatches**, the doubled form **5312**, the expanded halves disagree at **5312**, the collapsed halves coincide. Every adjacent number in the rewritten block re-derives — the share-yield form (0), the closed-form share bound (min `0.500000`, max `0.741127`, **0** violations of `(ph+2fr)/(2ph+2fr)`), the one-cause claim (378 of 378 fixed by dropping the guard, **0** by dropping the row floor), and the `h = 130` worked example (cap 34 → 0.7385; without the guard cap 32 → 0.7538). The «0.6091 to 0.6909» pair is gone, replaced by a form. **`:765-766`'s deleted-predicate bounds are present, unchanged and still correct** — T68 did not "fix" them by mistake |
| **R17-F2** the last two-density measurement instruction | **closed.** Content at `test-plan.md:207`, now «2 themes × the three shipped densities × 2 placements», stated as the product per R16-S1-F3 rather than as a literal count |
| **R17-F3** «the same 4 runs» | **closed.** `test-plan.md:200` now reads «every run of the bullet above». `grep -nE "the same [0-9]+ runs\|same [0-9]+ configurations"` → **0**. The back-reference no longer restates a count, so a future change to the run set cannot strand it again |
| **R17-F4** the Accepted-ADR consequence at two densities | **closed.** `adr/0003:43` names the three shipped densities, with a dated marker recording that the **decision** is unchanged and unamended and that only the verification scope moved |
| **R17-F5** the gate never reads the prose it certifies | **claims half closed; structural half correctly still open and honestly stated.** `test-plan.md:213` now reads «What a marker checks is the marker — the script never reads the prose beside it»; `grep -rn "marker is what checks it"` over live artefacts → **0**. The docblock carries five explicit limits. The deferral is in `spec.md:264` with owner **and** due. Stage 1's **M3** confirms the behaviour: editing `test-plan.md:90`'s prose from `0.754545` to `0.654545` with its three markers untouched still exits **0**. **One leftover → R18-F6**, and the deferral's stated mitigation does not exist → **R18-F2** |
| **R17-F6** losing a marker is a silent pass | **closed at 15 of 15 attacks.** `<!--figure:`, `<!-- Figure:`, a reflowed marker, trailing junk and an outright deletion each exit 1; the deletion is caught by the marker-count pin in the generated table, which names the file and the expected count |
| **R17-F7** `sweep-counts` certified its own model of the loop | **closed in structure.** The verifier locates each loop by its `it()` title, walks the block and resolves each `for…of` iterable from an inline literal or a `const` array in the same file; the `× 2` / `× 4` / zero-file shape is gone. Counting loops and unresolvable iterables produce a named error rather than a guess. It **fails safe but not cleanly** → R18-O1 |
| **R17-F8** the coverage number did not measure coverage | **closed.** The quantity is now defined in the output and reproduces under an independent reimplementation: `unbound(line) = max(0, heuristic-visible figures − strict markers on that line)` — **36 visible, 15 unbound** over nine named sites, the nine summing to exactly 15. The whole-line exemption is measurably gone; the heuristic's blind spots are printed on every run. Both false record figures corrected → see R17-F8's record half below. **But two Outcomes in this same wave still quote the retired number → R18-F7** |
| **R17-F9** silently ignored named arguments | **closed.** Per-kind key sets are enforced; an unknown key, a duplicated key, an unparseable value and an unknown density inside `expect=` each exit 1; `checked` no longer increments before the validity test (round-17 **O7**). The run reports which defaults were relied on: `12 share marker(s) checked at 30 files, 2 cap marker(s) at 13 px` |
| **R17-F10** the collapsed header's own height unobserved | **closed, by mutation.** `headerHeight = headerCollapsed ? panelHeadH :` → `? 0 :` now reddens (**1 failed / 843**), and so do the two adjacent corruptions of the same term (`? headerFixedH :`, `? panelHeadH * 2 :`) — each reddening exactly one row, its own. Round 17 measured this mutation as 842 / 842 green. The witness's six-cell per-density table and all three «separates» verdicts re-derive |
| **R17-F11** the consumer half of AC-19 unwitnessed | **closed, by mutation.** Neutering the stacked-panels sum in `applyLayout` now reddens (**1 failed / 843**). The row is **not** vacuous: it appends real `app-blame-viewer` / `app-file-history-panel` elements into the inspector column at the branch's canonical 220 / 110 split, derives both expectations from the policy, and carries an explicit premise assertion that the two configurations differ. Its figures re-derive (`2 / 34` with panels, `6 / 110` whole column) |
| **R17-F12** a count that is not what its command returns | **closed, and closed the harder way.** `grep -rn "_epic\.md:[0-9]"` over `tasks/` returns **3** on the tree the wave leaves — `round15-records.md:36`, `round16-records.md:251` and `round17-criteria-amendment.md:217` — which is exactly what T71's Outcome states, with the third disclosed as arriving from T67 mid-wave. All three are past-tense quotations that must stay. T71 also wrote the transferable rule: a record that adds a quotation of the pattern it is counting must count the tree it **leaves** |
| **D1** correct every overstated claim, defer the marker↔prose binding | **done for the claims; the deferral is properly recorded.** F6, F7, F8, F9 and the `ARTEFACTS` widening all landed; `test-plan.md:213`, the docblock and both round-16 Outcomes corrected |
| **D2** fix both coverage holes | **done, both proved by mutation** (see F10 / F11 above) |
| **D3** no live artefact writes a figure derived from the code | **written, not performed → R18-F2, R18-F3.** The rule and the generated table exist and the table is correct; the tree it governs still carries 36 derived figures in live prose, 15 of them unbound |
| **D4** the sweep's scope is the branch, with written exclusions | **the definition and the derivation are real; the mechanical check is not → R18-F4.** Scope is genuinely derived (185 branch files → 108 markdown; `adr/0003` inside it, and a planted marker there fails), and every exclusion carries a reason. The check that was to make a narrowing fail compares one function against itself |

**T68's headline sweep reproduces exactly**, re-derived three times over the identical 201 474-point
grid. **T69's two witnesses reproduce exactly**, each to the failing assertion T69 quoted. **T70's
generated table reproduces exactly** — all 30 values re-derived by the lead with an independent
implementation of the metrics and the policy, **0 mismatches**, and `pnpm figures:write` round-trips
byte-identically. Second consecutive round in which the wave's central arithmetic holds up under three
independent re-derivations, and the first in which the *code* half is entirely clean.

## Findings

Seven blocking findings after de-duplication. **R18-F2** and **R18-F5** were reached independently by
stage 1 and the lead; **R18-F1** by stage 2 and the lead; **R18-F3**, **R18-F6** by stage 1;
**R18-F4** by stage 2 and, in its exclusion direction, by the lead; **R18-F7** by stage 2.

### The instrument that cannot run

| id | finding | resolution |
|---|---|---|
| **R18-F1** | **`pnpm check:figures` cannot pass in CI: the branch's only anti-recurrence instrument fails closed on the first CI run it will ever have, for a reason that has nothing to do with figures.** T70 rewrote the scope to derive from `git merge-base HEAD main` (`scripts/check-figures.mjs:131`), and `.github/workflows/ci.yml:31-32` checks out with **no `with:` block**, so `fetch-depth: 1` and no local `main` ref. Measured in a reconstructed CI checkout by stage 2 **and independently by the lead** in a `--depth 1 --single-branch` clone: `fatal: Not a valid object name main` / «the scope could not be derived from the branch» / **exit 1**. `git merge-base` does **not** fall back to `refs/remotes/origin/main` — verified directly. The second path fails too: on a `push` to `main` / `develop` (the only push branches the workflow listens to) `merge-base HEAD main` is `HEAD`, so `git diff --name-only HEAD..HEAD` is empty, the tree is clean, `all.length` is 0, and `:164-167` exits **1** with «the derived scope is 0 file(s) — refusing to pass». **Failure scenario:** the owner opens the PR; the `Figure drift check` step is a plain `run:` with no `continue-on-error`, after Lint and **before** Unit tests, on both `ubuntu-latest` and `windows-latest`. It exits 1, the job goes red on both OSes, and Unit tests, the frontend build and the whole Rust half never run. The message points at git, so the first reading is «CI is broken», and the cheapest repair under time pressure is to delete the step — removing the instrument at the moment it first executes. **Why it blocks:** T65's version had an enumerated list and shelled out to nothing, so it would have run; **T70's widening introduced the dependency**. Round-17 **O12** recorded the step as merely *unexercised*; it is worse than unexercised. T70's docblock limit 5 says «the CI step is only as good as its placement» — the placement is right and the command is not runnable there | **Fix now** → T72 |

### The rule that was written and not performed

| id | finding | resolution |
|---|---|---|
| **R18-F2** | **Owner decision D3 is declared in force and the tree it governs violates it, and the mitigation `spec.md:264` offers for the deferred R17-F5 therefore does not exist.** The rule (`test-plan.md:145-152`, `spec.md:260`) is unconditional and names its files: «A number produced by `computeMetrics` or by the layout policy — a token, a cap, a share, a band bound, a configuration count — may not be written into prose in `spec.md`, `sad.md`, `ux-flows.md`, `screens.md`, this file, `DESIGN.md`, `ARCHITECTURE.md` or `adr/`». The wave's own instrument prints the violation: `coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer markers than figures`. The lead's independent scan (HTML comments, fenced blocks and code spans blanked first) finds 36 derived-figure occurrences in live prose at `test-plan.md:43`, `:90`, `:91`, `:201` and `DESIGN.md:371`; stage 1's wider vocabulary finds them on 13 lines across 3 of the 8 named files, including the figures the heuristic **cannot** see — `cap 50`, `cap 100`, `cap 83`, `43 + 2 × 37 = 117`, `4 × 26 = 104`, `68 px`. No artefact in the wave states a transition, a grandfather clause or a written exclusion. **Failure scenario:** `spec.md:264` grants the deferral of the marker↔prose binding on this stated ground — «Until it exists the mitigation is D3: a figure that is never written in prose cannot be unbound». Thirty-six figures **are** written in prose, so nothing mitigates the deferral, and stage 1's **M3** proves the consequence: `test-plan.md:90`'s `0.754545` → `0.654545` in the prose, markers untouched, exits **0**. The next wave moves a `PAD` value or `COLLAPSED_LIST_SHARE_FLOOR`, the gate forces every marker to update, and the prose figure beside each one goes stale with CI green. The release engineer executing `test-plan.md:201`'s fourth run compares the built app against a stale `cap 27 / share 0.754545` and either files a regression that is not one or waves through one that is. **Why it blocks:** this is the tenth round of «a precise figure that is false», and D3 was the owner's answer to it — «the class ends by construction rather than by surveillance». The rule was written; the construction was not performed | **Fix now** → T73 |
| **R18-F3** | **`DESIGN.md`'s density table states eight false derived figures, is unmarked, and is contradicted by its own section eleven lines below.** `DESIGN.md:309-320`, the `### Density` table, whose stated purpose is «Every fixed dimension in the shell». Re-derived from `computeMetrics` at the default 13 px by stage 1 and independently by the lead — the `Comfortable` column is correct in all nine rows; **8 of 9 `Compact` cells are false**: Titlebar 32 vs **29**, Toolbar 40 vs **35**, Icon rail 44 vs **35**, Refs panel rows 26 vs **24**, Commit rows 34 vs **26**, File rows 30 vs **24**, Panel header 30 vs **26**, Status bar 24 vs **22** (only Panel padding 10 is right). **`relaxed` has no column at all.** No dated marker in or around the table. Eleven lines below, `DESIGN.md:331` — corrected by T63 in the previous wave, and marked — says «`--row-h` and `--file-row-h` move with density like every other token — **26 / 24 compact**, 34 / 30 comfortable, 43 / 37 relaxed at the default 13 px». One `### Density` section, two contradictory answers for the compact row height. **Failure scenario:** «Commit rows 34 px | 34 px» and «File rows 30 px | 30 px» is the `FILE_ROW_HEIGHT` belief — *row height does not move with density* — that R16-L-F1 killed in `sad.md:38` and that T67 corrected in `tasks/compact-file-list-layout.md:43` under its own D4 exclusion rule. The table's own preamble makes it load-bearing: «These are not suggestions: `--row-h` must match the CDK virtual-scroll `itemSize` **and** the branch-graph row height, or the graph lanes drift away from their commits.» A developer who trusts it hard-codes 30 into a new virtual list's `itemSize` and the graph lanes drift off their commits at compact — the exact failure the preamble warns about, caused by the preamble's own table. **Why it blocks:** `DESIGN.md` is one of the eight files D3 names by hand, it is `M` in this working tree, and D4 puts every tracked file the branch touches in scope by default with no exclusion written for it. It is also the strongest single piece of evidence that D3-as-written is not being applied | **Fix now** → T73 |

### The check that cannot fail

| id | finding | resolution |
|---|---|---|
| **R18-F4** | **D4's mechanical scope check is vacuous against the failure it was commissioned for.** `scripts/check-figures.mjs:169-186`: `executed = scopeFrom(all)` where `all = branchFiles()`, then `const declared = scopeFrom(branchFiles()).swept` — the **same pure function over the same git output**, so the two loops at `:175` and `:182` compare a set with itself. The set the sweep actually iterates is `ARTEFACTS` (`:170`, consumed at `:443`), and nothing compares `ARTEFACTS` to either side. Measured: replacing `const ARTEFACTS = executed.swept;` with an enumerated three-file list that keeps all three marker carriers exits **0** with output byte-for-byte the baseline; adding one reasoned exclusion that drops `/adr/` exits **0** with all four ADRs, `adr/0003` included, out of the sweep (lead's **L2**, reproduced by stage 2). The direction T70 measured and reported as working — narrowing the *declaration* to round 16's eight-file list — exits 1, and is the harmless one. The lead's **L1** shows the marker-count pin catches a narrowing only when it drops a marker-carrying file; the R17-F4 shape is precisely a **marker-free** file leaving scope, which the pin cannot see. **Failure scenario:** the next wave hits R18-F1's CI breakage, or simply wants the run faster, and replaces the derivation with a list — exactly what T65 did and what R17-F4 punished. The gate prints `OK`, the D4 check reports nothing, and any marker written outside the list silently stops being verified. **Why it blocks:** D4's text is explicit — «a sweep that declares a narrower scope than the one it executed fails mechanically» — and the direction that matters has no check at all, while T70's Outcome reports this as measured and working and the docblock's limit 4 claims it catches «an enumerated file list reinstated, which is the round-17 failure». Reinstating it at `ARTEFACTS`, the site round 16 actually used, exits 0. The derivation itself is real; the check D4 asked for does not exist | **Fix now** → T72 |

### Registration and records

| id | finding | resolution |
|---|---|---|
| **R18-F5** | **`_epic.md`'s mermaid graph misses 7 of 71 ids, and T67 wrote — inside the graph — the completeness check that fails.** Single mermaid block, `_epic.md:16-153`. Node extraction by stage 1 and independently by the lead: **T27, T28, T29, T30, T31, T32, T33** appear neither as a node nor in any edge; the graph jumps from `T23 --> T26` straight to `T34`. T63–T66 **and** T67–T71 are both drawn and the T67–T71 edges match `tasks.json` `deps` exactly, so T67's repair of the round-16 gap is real. What is false is the claim attached to it: `_epic.md:161-162`, written by T67 — «**Both waves are now drawn**, and the check for the next one is «every id in `tasks.json` appears as a mermaid node», not «the rows agree»» — and the Outcome repeats it. That check returns **7 misses of 71** on the tree T67 leaves. It was written, not run. T67's diagnosis is also short by seven: it reports the graph as «stale from T62 onward» when it has been stale from T26 onward, across five earlier review rounds. **Failure scenario:** the round-19 reviewer, or the wave that registers T72, runs the check T67 prescribes, gets seven misses, and faces exactly the ambiguity R17-F12 describes — it cannot tell whether this wave failed to draw its own tasks or inherited an older gap — while the marker beside the graph asserts the check passes. Concretely, an implementer opening the Task map to find what `T29` depends on finds no node and concludes it is unregistered. **Why it blocks:** T67 discovered the graph had silently gone stale for a whole round *because three agents checked the rows and none checked the graph*, wrote the stronger check that would have caught it, and left the stronger check failing. That is the wave's own instrument certifying more than it checks — round 17's central diagnosis, one artefact over | **Fix now** → T74 |
| **R18-F6** | **T70 named a leftover for T71 by file and line, and T71 edited that very file without taking it.** T70's DoD exception 4 reads: «No sentence in the tree claims the marker checks the prose figure.» True of every live artefact … **One dated record still asserts it — `tasks/round16-figure-gate.md:164-165`, T65's own Outcome. That file is T71's surface, and T71's plan item 3 covers its «45 of 45» but not this sentence: named here so the wave does not stop one artefact short again.** The content is now at `:184-185` (T71's own insertion shifted it 20 lines) and reads, unchanged: «`test-plan.md`'s CI-placement section **now says** that when a row quotes a derived figure, its marker is what checks it.» T71's Outcome does not mention it and its three named DoD exceptions do not include it. **Failure scenario:** «now says» is a present-tense claim about `test-plan.md`, and `test-plan.md:213` now says the opposite — «What a marker checks is the marker». A reader who follows the pointer finds two artefacts contradicting each other on the single question R17-F5 turns on, with no marker saying which is current, and has to re-derive the gate's behaviour from the source to break the tie. **Why it blocks:** T67's own written D4 exclusion draws the line here — a record is not rewritten when it describes past work, **but is rewritten when it asserts a live invariant** — and «`test-plan.md` now says X» asserts a live invariant about a file that says ¬X. The previous task in the same wave named the file, the lines and the reason, and the wave stopped one artefact short anyway, without disclosing it. One dated marker closes it | **Fix now** → T74 |
| **R18-F7** | **Two Outcomes in this wave quote a gate output the tree they deliver cannot produce, and the figure they quote is the one R17-F8 blocked on.** `tasks/round17-code-fixes.md:263-264` and `tasks/round17-test-coverage.md:266-267`, both: «`pnpm check:figures` → exit **0** (`23 markers, 45 values checked, 1 unmarked` — `DESIGN.md:73`, the known heuristic false positive)». On the tree this wave delivers the gate prints no `unmarked` line at all; it prints `figures: 23 markers in 3 file(s), 10 distinct claims, 45 values recomputed` and `coverage: 36 figure(s) … 15 of them on a line carrying fewer markers than figures`. `1 unmarked` is exactly the figure **R17-F8** named as false, and **T70 removed it in the same wave**. Neither Outcome is dated to the pre-T70 gate or marked as measured in a different lane, and T71 corrected the two *round-16* records carrying the same class while leaving these two untouched. **Failure scenario:** the round-19 reviewer runs `pnpm check:figures` against T68's and T69's gate bullets, gets output with no `unmarked` count and a coverage pair of 36 / 15, and cannot tell whether the gate regressed, a check was lost, or the record is stale — R17-F12's failure scenario verbatim, one round later. **Why it blocks:** same class and same standing rule as R17-F12, which round 17 blocked on. Blast radius is low and the substantive claim (exit 0) is true, so this is the cheapest finding in the round — but the wave exists to close this class and reproduced it inside its own records | **Fix now** → T74 |

## AC chain trace

Traced end-to-end mechanically by stage 1 and, independently, by the lead: `spec.md` §4/§5 →
`sad.md` §6 coverage → `ux-flows.md` AC→flow map → `screens.md` SCR inventory → `test-plan.md`
coverage rows (with their level) → `tasks.json` `acs` → the named spec files under `src/`.
`sad.md` `target_surfaces: [desktop-app]` — one surface, so the UI-tier requirement is ≥ 1
`component` or `e2e-through-UI` row.

**8 / 8 user stories** carry ≥ 1 AC and ≥ 1 §6 flow. **22 / 22 acceptance criteria** appear at every
hop — §6 flow, `ux-flows.md` map entry, `screens.md` inventory, ≥ 1 test-plan row with a UI-tier
level, and ≥ 1 task claiming them. **0 ACs are claimed by no task; 0 AC ids appear in `tasks.json`
that are not in spec §5. Nothing drops out of the chain at any hop.** The diff's `SDD-AC` trailers
were not used as the AC set.

The `added-by-fix` criteria were traced at least as strictly as the rest: **AC-22** (the owner's
2026-09-07 reversal) lands in code, four component tests and a schema test; the round-9/10/11
additions to AC-04, AC-05 and AC-06 each have their own named row and test.

The one substantive gap remains **AC-20's absence of automated cover** — declared, dated and
owner-accepted (`test-plan.md:26`, `sad.md` §11). Every live instruction that schedules a measurement
now reaches `relaxed`; that is what R17-F2, R17-F3 and R17-F4 were about, and all three are closed.

## Checked and clean

Measured, not read.

- **The corrected closed form is the right one, re-derived from the policy three times.** `0`
  mismatches at 201 474 points; the doubled form `5312`; `spec.md:198` and
  `inspector-layout.spec.ts:732` state the same predicate; `spec.md:198`'s «reachable in 16 of the 21
  token sets» reproduces (2264 of the 5312 points have `r ≥ 110`).
- **The generated reference table is correct in every cell.** The lead re-derived all 30 values with
  an independent implementation of `computeMetrics` and the policy — tokens (26/24/26 · 34/30/34 ·
  43/37/43), all 18 cap / share rows at remainders 110 / 200 / 420 in both collapse states, and all
  six carve-out band tops (compact 51 / 103, comfortable 67 / 135, relaxed 85 / 171) — **0
  mismatches**. `pnpm figures:write` round-trips byte-identically; a hand-edited table fails with the
  first divergent line quoted; an emptied table fails naming all three inventory files.
- **The sweep counts are the product of the loops that exist.** Read out of the spec file: share
  `3 × 8 × 6 × 2 = 288`, cap `3 × 8 × 6 × 2 × 2 = 576`, zero-file subset `3 × 8 × 2 = 48` — verified
  against `DENSITIES` (3), `heights` (8 at `:643`) and `fileCounts` (6 at `:644`).
- **The gate's module direction is as strong as round 17 found it, and the marker direction is now
  strong too.** 15 of 15 malformed-marker attacks fail loudly; five module drifts each fail naming
  `file:line`, the claim and the computed value; CRLF-converted artefacts, modules and the generated
  table all still exit 0; a planted marker in `adr/0003` fails, proving the widened scope reaches it.
- **Both new witnesses are real detectors, proved by mutating their own subject**, and neither is
  vacuous — see R17-F10 / R17-F11 above.
- **43 of 49 mutations redden over the changed surface**, full-suite denominator. Every term of the
  layout policy (29 / 29), every metric (7 / 7) and every `main-content` binding (4 / 4) reddens. All
  six greens are the exact set round 17 recorded as **O4** (five boundary gaps) plus **O5** (one
  equivalent mutant): **no new coverage hole**. T69 declined the O4 gaps explicitly, which is what its
  Outcome says.
- **Round-17 O9 refuted as a silent-drift hazard, measured.** Inserting an intermediate
  `<div class="contents">` between the wrapper and `app-blame-viewer` makes
  `main-content.spec.ts:425` fail loudly (`expected '' to be '0 0 37.5%'`) rather than asserting on
  the wrong element quietly.
- **Registration bookkeeping, mechanically over all 71** (lead and stage 1 independently):
  `tasks.json` parses; **71 tasks**; ids exactly `T1`…`T71` with none missing or extra; **0 duplicate
  ids, 0 dangling deps, 0 cycles**; every id has exactly one task file and every task file's `id` is
  in `tasks.json`; `files_hint` and `deps` agree on all 71; `tracker.md` reads «Total: 71 tasks» and
  links the round-17 record; `_epic.md` and `tracker.md` agree with `tasks.json` on layer and deps for
  T67–T71. **The graph is the exception → R18-F5.**
- **Comment hygiene**: a token scanner over **113** markdown files with fenced blocks and inline code
  spans blanked first — **0 nested, 0 unclosed**.
- `grep -rn "it\.skip\|\.only(\|it\.todo\|\.concurrent" src/` → **0**;
  `grep -rn "FILE_ROW_HEIGHT" src` → **0**; `grep -rn "rounds the cap" src` → **0**.
- **Boundaries and leaks**: `inspector-layout.ts` imports nothing, `appearance-metrics.ts` imports one
  type, no new coupling between inspector / diff-workspace / main-content. The Esc layer registry is
  untouched by this wave — listener removed on `DestroyRef.onDestroy`, `bind()` unregisters through
  `effect`'s cleanup, resolution is pure.
- **Security**: nothing in this wave reads user input or touches the network. `check-figures.mjs` does
  shell out — `execFileSync('git', [...])` with a fixed argument array, no shell, no interpolated
  input — and executes no app side effect.
- **Zero live artefacts assert the doubled form as the guard's band.** `:738` quotes it only to
  explain that it is wrong; `:765-766` is a different predicate and is correct.

## Observations — recorded, not blocking

- **O1** The loop-shape parser regexes the raw block text without blanking comments or string
  literals (`check-figures.mjs:283-298`), while `blankCode` at `:412` does exactly that blanking for
  markdown in the same file. A commented-out `for (const bogus of [1, 2, 3])`, or one inside a string,
  makes the gate report **864** where the loop runs 288, exit 1. It **fails safe** — a false failure,
  never a false pass — but the repair path the message suggests is `pnpm figures:write`, which bakes
  the phantom dimension into the pinned table, the one place a concrete derived figure is allowed to
  live. One line of blanking closes it. Related and lower: reordering two dimensions with the product
  unchanged also fails, because the table pins the dimension *order*; that one is self-describing.
- **O2** `scripts/check-figures.mjs` (783 lines) is outside **both** gates: `pnpm lint` is
  `biome check src` and `biome.json` includes only `src/**`, so
  `pnpm exec biome check scripts/check-figures.mjs` reports «0 files … these paths were provided but
  ignored»; `tsconfig.spec.json` does not reach it either. Four Outcomes in this wave report `pnpm
  lint` clean over 266 files beside a change to that file. It carries one confirmed piece of dead
  code — `:99`, `pattern: /.*/`, never read, since only `applies` is consulted at `:148`.
- **O3** T71's «of the **eleven** surviving occurrences of the doubled form» is **15 lines / 16
  occurrences** on the tree it leaves. The nearest scope that yields 11 drops `_review/` and the three
  occurrences the Outcome itself adds — the count-the-tree-you-inherited error the same Outcome names
  as its transferable rule two paragraphs earlier, and got right for the `_epic.md` grep.
- **O4** T67's D4 sweep reports «**89 hits**» for `both densit|two densit|2 densit` over 184 files.
  Over the identical scope the command returns **82 matching lines / 96 occurrences**, and no
  construction returns 89. Structurally unreproducible — T67 counted mid-wave and every task after it
  added records containing the pattern. Everything the count is *for* verifies independently: the
  classification's live-artefact (2), live-ADR (1) and `tasks.json` (10) rows all reproduce, and the
  substantive conclusion holds under the lead's comment-blanked scan.
- **O5** T67's «every live instruction that schedules a measurement now reaches relaxed — seven of
  seven» is true of the seven it enumerates and of the two it does not: `test-plan.md:200` and `:201`
  also schedule measurements and both reach the three shipped densities. The enumeration is short by
  two; the conclusion is not affected.
- **O6** `reference-figures.md` — the wave's own new artefact, and D3's single home for concrete
  figures — appears in **no** `files_hint` in `tasks.json` and in no task file's frontmatter, while
  `tasks/round17-records.md:200-203` states that it **is** claimed. T70's `files_hint` is
  `["scripts/check-figures.mjs", "test-plan.md", "spec.md", "package.json"]`.
- **O7** Commit hygiene, round-16 O14 / round-17 O11 and growing: `.github/workflows/release.yml`,
  `.gitignore`, `install.sh` and `.mcp.json` sit in the working tree claimed by nothing — plus
  **`CHANGELOG.md`**, which O11 missed, and `reference-figures.md` per O6. Claimed and correct:
  `scripts/check-figures.mjs`, `package.json`, `.github/workflows/ci.yml`, every `src/` file and every
  live doc artefact.
- **O8** `tasks.json` T44 claims `AC-02` and T49 claims `AC-01` where the task files' frontmatter does
  not (round-15 O10, round-16 O13, round-17 O1). Both ACs have ample other cover; nothing drops out of
  the chain. Still exactly those two of 71.
- **O9** The five round-17 **O4** boundary gaps are all still green and all still in
  `commit-inspector.ts`: `measureBody`'s one-pixel anti-flicker slack (the fixtures differ by 128 or
  0, never 1), `bodyLines`' rounding (every fixture makes `scrollHeight` an exact multiple of `lineH`),
  `headerFixedH`'s body subtraction (no fixture stubs the body's rect, so the subtrahend is 0
  throughout), and the header-action clamp (jsdom reports `clientWidth` 0, so the ceiling is never
  approached). T69 declined them explicitly and closed none.
- **O10** `check-figures.mjs` silently drops a destructuring dimension
  (`for (const [, tokens] of DENSITIES.entries())` → 288 becomes 96 with `tokens 3` gone from the
  shape) and becomes loud only through the changed product, not through a parse error.
- **O11** `commit-inspector.ts:583`'s comment still compresses two different cases («`lineH` is 0 (or
  NaN, when jsdom resolves `line-height: normal`)») — round-16 O2, unrouted for a third wave.
- **O12** `adr/0004:22` quotes spec §6's NFR as «**Diff viewer** share … both densities» inside
  *Decision drivers*. Judged **correctly historical** again — the ADR carries `**Date:** 2026-09-02`
  and an explicit `## Amendment — 2026-09-07` section, so the drivers are dated by the file's own
  structure. Recorded a second time so a future sweep does not "fix" it.
- **O13** T68's Outcome labels the share region's minimum «at comfortable / ui=11 r=64»; the minimum
  is `0.500000` and is **attained at 21 tied points, one per token pair**, so the label is iteration
  order rather than a wrong figure.

## Owner decisions taken at this gate

| # | question | decision |
|---|---|---|
| **D1** | how R18-F1's CI breakage is closed | **`fetch-depth: 0` on the checkout AND a degradation chain in the script.** Both halves: the workflow fetches enough history for `merge-base`, and the script falls back `origin/main` → `HEAD~` → «sweep every markdown file under `docs/` and the repo root», **naming the fallback it used in its output** instead of exiting 1. This closes the `pull_request` path and the `push`-to-`main` path (empty scope) together, and leaves the gate runnable in any checkout |
| **D2** | what happens to D3, given 36 derived figures in live prose and `DESIGN.md`'s false table | **Migrate the tree to D3.** Perform the construction the decision asked for: replace the figures in live prose with the closed form or a pointer to `reference-figures.md`, and replace `DESIGN.md`'s density table with a pointer to the generated table rather than adding a `relaxed` column of new literals. The class ends by construction, which is what was decided — not by a narrower rule |
| **D3** | R18-F4, D4's vacuous check | **Compare the declared scope against `ARTEFACTS` at the point of use** — the set the sweep actually iterates — so that reinstating an enumerated list at the site round 16 used it fails. Rewrite the docblock's limit 4 to describe exactly what the check does and does not cover |
| **D4** | R18-F5, F6, F7 — the registration and record findings | **All three now.** Draw T27–T33 with their edges and **run** the completeness check T67 declared, correcting its «stale from T62 onward» diagnosis; date the `round16-figure-gate.md:184` sentence with a marker; correct the gate bullets in T68's and T69's Outcomes |

## Routing

| task | layer | deps | what |
|---|---|---|---|
| **T72** — round-18 gate and CI fixes | infra | — | **F1** per D1: `fetch-depth: 0` in `.github/workflows/ci.yml`, plus the `origin/main` → `HEAD~` → docs-and-root fallback chain in `check-figures.mjs`, with the fallback named in the output; prove it by running the exact CI command in a reconstructed shallow checkout **and** in a clean checkout where `merge-base HEAD main == HEAD`. **F4** per D3: assert the declared scope equals `ARTEFACTS` at the point of use, prove that an enumerated list at that site now fails, and rewrite docblock limit 4. Optionally **O1** (blank comments and strings before `loopShape`) and **O2** (bring `scripts/` into `biome`, drop the dead `pattern` field). **Registers T72–T74** |
| **T73** — round-18 D3 migration | docs | T72 | **F2** per D2: every derived figure in live prose in the eight files D3 names replaced by the closed form or a pointer to `reference-figures.md`; re-run `pnpm figures:write` so the marker inventory is re-pinned, and report `coverage:` on the tree the task leaves. **F3**: `DESIGN.md:309-320` replaced by a pointer to the generated table, with a dated marker recording the eight false compact cells and the missing `relaxed` column, and the contradiction with `:331` resolved. Any figure kept is named with its written exclusion and its reason, per D4 |
| **T74** — round-18 records and graph | docs | T73 | **F5**: T27–T33 drawn with their edges (`T24,T25→T27`, `T19–T23→T28`, `T27,T28→T29`, `T29→T30→T31→T32→T33`); the completeness check T67 declared actually run and its output pasted; the «stale from T62 onward» diagnosis corrected to T26. **F6**: `tasks/round16-figure-gate.md:184-185` dated with a marker naming `test-plan.md:213`. **F7**: T68's and T69's gate bullets restated as what the delivered gate prints. Plus **O3** (the eleven → 15/16), **O4** (the 89), **O5** (seven → nine), **O6** (`reference-figures.md` in T70's `files_hint`, and the record that claims it already is) and **O7**'s `CHANGELOG.md`. **No registration** — T72 owns it |

## Verdict

**CHANGES REQUESTED.**

Seven findings: one instrument that cannot run where it is wired, one owner decision written but not
performed, one live design table with eight false figures, one mechanical check that cannot fail, one
graph missing seven of seventy-one ids beside the check that would have caught it, one named leftover
not taken, and two record bullets quoting a retired number.

**The code half of this wave is clean, and that is new.** R17-F1 is fixed with the *right* form, not
merely a changed one — `2·panelHeadH + 2·fileRowH` re-derived from the policy by three agents
independently, **0** mismatches at 201 474 points against the doubled form's 5312, with every adjacent
number in the rewritten block re-deriving and the correct bounds at `:765-766` untouched. Both
coverage holes are closed by mutation, each witness reddening exactly one row — its own — and the
AC-19 witness renders real stacked panels at the branch's canonical remainder rather than passing
zero. 43 of 49 mutations redden and all six greens are the O4/O5 set round 17 already classified: no
new hole. The generated reference table is correct in all 30 cells and round-trips byte-identically.
Nothing production-side changed, and no finding in this round describes behaviour a user would see.

**What blocks is, for the third round running, the anti-recurrence instrument certifying more than it
checks — and this time one of them cannot execute at all.** T70 widened the gate's scope to derive
from the branch, which is exactly what D4 asked for and which genuinely reaches `adr/0003`; the
widening also made the gate depend on a git ref the project's own CI checkout does not create, so the
branch's only mechanical defence against its dominant defect class exits 1 on the first PR it will
ever see, before the tests run, on both operating systems. D4's check compares one function against
itself and cannot see the narrowing it was commissioned to catch. And D3 — the owner's answer to nine
rounds of «a precise figure that is false», the decision meant to end the class *by construction* —
was written into the criteria and never applied to the tree it governs: thirty-six derived figures
remain in live prose, fifteen of them bound to nothing, `DESIGN.md`'s density table is false in eight
of nine compact cells and contradicts its own section eleven lines below, and the deferral of R17-F5
was granted against a mitigation that does not exist.

That last point is the one that matters more than any single fix in the routing table. Round 17
concluded that «after nine rounds, the class does not end by finding the next instance». It does not
end by writing the rule either. **T73 is the wave where the construction actually happens**, and until
it does, every instance the rule forbids is still reachable.
