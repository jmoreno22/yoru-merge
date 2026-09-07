---
slug: inspector-diff-workspace
date: "2026-09-07"
round: 8
verdict: PASS
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 228ab35
previous_review: review-2026-09-07-round7.md (CHANGES REQUESTED, R7-F1 + S1–S5, R7-F3)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus, effort high) — stage 1 (R7-F1 closure + claimed AC + full §4/§5 chain trace) and stage 2 (quality of the changed surface). Reports written to scratchpad files first, then relayed (the idle message truncates). Both ran mutations in the shared working tree; the collision that produced is recorded below. The lead re-measured the one claim the two reviewers reported differently, on a tree verified clean before and after.
---

# Re-review round 8 — inspector-diff-workspace — 2026-09-07

## Scope

Eighth review of the branch, after T33 (the round-7 follow-up). Whole feature diff `7cd47b4..228ab35`: 43 commits. Changed surface since round 7 (`0384570..228ab35`): two commits — `813f4fc` (the round-7 record + T33's rows in `tasks.json` / `_epic.md`) and `228ab35` (the fix) — 8 files, +219 / −14. One test file (`src/app/features/commit-inspector/commit-inspector.spec.ts`, +13 / −12); everything else is a document. No production file, nothing under `src-tauri/`. `SDD-AC` trailer claims **AC-08**.

Gate at HEAD, run by the lead on `228ab35` on a tree verified clean **before any reviewer was spawned**: `pnpm test` **831 tests / 63 files green** (unchanged from rounds 6 and 7 — T33 removed an object field, not a test) · `pnpm lint` (biome, 266 files) clean · `tsc --noEmit -p tsconfig.spec.json` clean (no output) · `pnpm build` clean (906.71 kB initial total, no budget warning). Both reviewers re-measured the same numbers independently after the tree collision below was resolved. Rust gate unchanged (the whole feature diff contains no `src-tauri` path). The one stderr line (`[cdkFocusInitial]` not focusable, from the AC-10 row in `working-changes.spec.ts`) is the known jsdom noise.

Out of scope, noted so `ship` is not surprised: the working tree carries four modifications unrelated to this feature (`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked `.mcp.json`. Confirmed absent from `git diff --name-only 7cd47b4..228ab35`; no reviewer touched them.

## Process — shared-tree collision, and which numbers were discarded

Both reviewers ran mutation experiments in the same working tree concurrently, and each picked up the other's in-flight edits. Recorded because it decides which measurements in this record are trustworthy, not because it says anything about the feature.

- Stage 2's first full-suite run (12:25) executed against stage 1's live `// MUTATION-A` / `// MUTATION-B` edits plus a probe at `commit-inspector.spec.ts:739`. **Discarded.**
- Stage 1's full-suite run (12:29:11) executed against stage 2's live `// MUT-A removed` / `// MUT-B removed` edits and reported a spurious 1 failed / 830 passed at `:739`; its `ng build` at 12:30 ran on the same tree. **Both discarded and re-measured after the tree went clean.**
- The collision ran both ways, and both attributions are confirmed by their authors rather than inferred: stage 1's mutations were live 12:25:00–12:25:45 (what stage 2's run picked up), and stage 2 claimed the 12:29 `MUT-A` / `MUT-B` pair, started before the lead's hold reached it.
- Neither agent reverted the other's edits — correct behaviour, and each said so rather than guessing the tree back into shape. Both restored their own with `git checkout --` and proved it; both also re-measured the gate independently on a clean tree and agree with the lead's numbers on every value. The lead serialized them, handed both the pre-spawn gate numbers as authoritative, and verified the tree byte-clean (`git status --porcelain` = the four unrelated files + untracked `.mcp.json`; `git diff -- src/ docs/` empty; HEAD `228ab35`) before and after every measurement quoted here.

**Standing note for the next round:** one agent owns the tree for mutations at a time, or each runs in its own worktree. A gate number produced in this tree without a PRE/POST clean check is not evidence.

## Resolution of the round-7 findings

| Finding | Resolved | Evidence at HEAD |
|---|---|---|
| R7-F1 the returning-path block carries a member no mutation of the expiry can redden, and T32's DoD reports it verified | **yes** | `focusedTheRow` is gone from `commit-inspector.spec.ts:751-755`. Counted, not eyeballed: `expect(` 89 → 89 and `it(` 28 → 28 between `0384570` and HEAD; the sorted assertion-text delta over the whole file is exactly four lines — `expect({` and `expect(row).not.toBeNull()` out, the same row check inlined and `expect(workspace.pendingFocusKey()).toBeNull()` in. No matcher relaxed, no test removed, emptied or disabled. Independently reproduced by the lead. The Q2 row (`:711-756`) now references focus only in comments, in the `focusKey: 'b.ts'` input and in `data-focus-key` selectors — `document.activeElement` does not appear in it |
| S1 the comment's last clause over-reports what the block proves | **yes** | `:740-744` now reads «Where the focus sits is not observable at this tier, in either phase … so an assertion on the focus would pass whether or not the key expired (T33)» — exactly what round 7 measured. Every other clause of the row's comments was verified true against `commit-inspector.ts:322-353`, `virtual-row-focus.ts:26-45` and `diff-workspace-state.ts:80-84` |
| S2 the surviving `pending: null` member is weaker than it reads | **partly — see N1** | The row now names a reddening mutation for each surviving assertion. Two of the three claims hold exactly as written; the third is imprecise in one living document |

**T33's claimed verification, re-run rather than read.** Three independent measurements, each on a tree verified clean before and after:

| Mutation | Stage 1 | Stage 2 | Lead |
|---|---|---|---|
| (a) `commit-inspector.ts:345` only | 1 failed / 27 passed, Q2 red at `spec.ts:739:41`, `expected 'b.ts' to be null` | same (M1) | — |
| (b) `:345` + `:351`, **with `:739` replaced by a probe** | probe `{"pending":"b.ts"}`, 2 failed / 26 passed, Q2 red at `:755:41`, sibling at `:656:41` | equivalent via probes (M4): `P1 {"pending":"b.ts"}`, `P2 {"pending":null,"active":"BODY","isRow":false}` | — |
| (c) `:351` only | Q2 stays **green** (1 failed / 27, only the sibling) | same (M3) | — |
| (d) `:345` + `:351`, **unprobed** | not run | Q2 red at **`:739`**, sibling at `:656` (M2) | **2 failed / 26 passed; `spec.ts:739:41` and `spec.ts:656:41`** |

Mutation (c) is stage 1's own addition and closes a claim T33 asserted without running: each arm alone does clear the key, so the returning-path assertion really does require both to go. Mutation (d) is the one the two reviewers reported differently, and the lead settled it — the reports are compatible, not contradictory: stage 1 reached `:755` **because** its probe neutralised `:739`. Unprobed, `:739` throws first and `:755` is never evaluated.

## Chain trace

**User stories.** US-01..US-08 each keep ≥ 1 AC and a `sad.md` §6 flow (`sad.md:601-608`); no AC is orphaned from a story.

**Acceptance criteria.** AC-01..AC-21 each carry a §6 row (`sad.md:610-634`) and reach code plus at least one automated assertion, with the two tier exceptions round 7 recorded and no new joiner: AC-20 is the single manual-only AC (`test-plan.md:87`, matching the `non-runtime` classification at `sad.md:633`), and AC-19 keeps its automated unit row (`test-plan.md:85`, `inspector-layout.spec.ts:166-182`) beside its manual UI row (`test-plan.md:86`, T11). Every other AC with a manual row also has an automated one. `target_surfaces: [desktop-app]` (`sad.md:7`) — a single surface; no `contracts/` and no `data-model.md`, deliberate and recorded at `sad.md:639`.

**Screens.** `ux-flows.md:33-38` publishes SCR-01..SCR-06 with one flow per UI-touching story; `screens.md` carries the matching sections. No screen a flow references is missing from the manifest.

**Bookkeeping.** `tasks.json` T33 equals `tasks/round7-fixes.md` on title, deps, acs, layer and all six `files_hint` entries. `tracker.md:40` T33 `done`, T26 still `blocked`; `_epic.md:120` agrees; 33 tasks in `tasks.json`, 33 rows in `tracker.md`. No `.skip` / `.only` / `.todo` / `xit` / `fdescribe` / `fit` anywhere under `src/`; no test disabled or emptied.

**Documents `228ab35` had to change.** `test-plan.md:111` and the outcome note appended at `tasks/round6-fixes.md:46` both describe what landed and claim no assertion that is gone; the note correctly declines to rewrite T32's DoD and says why. T33's own Verification section records both runs with real output and discloses the probe (`round7-fixes.md:75-79`). The one imprecision is N1.

## Findings — stage 1

**`REVIEW_CLEAN`** — no stage-1 finding. R7-F1, S1 and S2 are closed by measurement; AC-08 is genuine on a traced production path (`diff-workspace.service.ts:254-266`, `diff-workspace-state.ts:80-84`, `commit-inspector.ts:326-353`, `commit-list.ts:269-286`, `changes-list.ts:111-130`) with revert-sensitive assertions behind it (`commit-inspector.spec.ts:739` single-point red, `:657` / `:679` / `:708` the positive direction, `diff-workspace-state.spec.ts:327-346` the per-arm owner predicate); AC-03 is untouched by this diff and intact (`main-content.spec.ts:336-338`, the `126` literal green in the 831-test run); and nothing dropped out of the spec → §6 → ux-flows/screens → tasks → code+test chain.

## Findings — stage 2

- **N1 three documents and the commit message compress «reddens the returning-path assertion» past what the committed row can produce** — `test-plan.md:111`; also `tasks.json:495` (T33 `dod`), `tasks/round7-fixes.md:87` and the `228ab35` message body; AC-08. They state that dropping `focusRestored` from *both* arms reddens the assertion after the path returns. Measured unprobed by stage 2 and by the lead: the two-point mutation reddens `commit-inspector.spec.ts:739`, the **first** key assertion; `expect` throws there and `:755` is never evaluated. `:755` becomes the failing line only in a doctored run where `:739` is replaced by a probe — which `round7-fixes.md:75-79` **does** disclose, and which the conclusion at `:87` and the derived documents drop. **Consequence:** `:755` is *dominated* by `:739` — no production mutation can make it the failing assertion. It is not the round-7 defect repeating: `focusedTheRow` was false in every possible world, whereas `:755` is failable in principle (it *is* false under the two-point mutation) and merely unreachable behind an earlier assertion of the same fact, which is the ordinary behaviour of sequential assertions. The row's own comment at `:753-754` («This reddens only if *neither* arm … — either one alone clears it») states a necessary condition and claims no sufficiency, and both its halves are verified (mutations (a) and (c)); the over-claim lives in the prose around it. What a reader of `test-plan.md:111` would wrongly infer is that the two key assertions carry independent coverage: if `:739` were ever removed, the row's coverage would silently drop from single-point to two-point detection and nothing would say so. → **Recorded** (owner), no document edit. The minimal fix, if it is ever taken up: one clause in `test-plan.md:111` saying the second key assertion is dominated by the first and observable only with the first neutralised, as `round7-fixes.md` records.
- **N2 stale line citation in the T33 DoD** — `tasks.json:495`: «The comment at :739-741 says the block proves the key expired» — in the landed file `:739` is an assertion and that comment sits at `:740-744`; the citation was written against the pre-edit file. Same class as the owner-recorded round-7 S5. → **Recorded** (owner), no edit.

Checked and clean (stage 2): all four AC-08 rows carry detecting assertions — `:656` reddens under mutations (b)/(c)/(d), `:657` / `:679` / `:708` are the positive direction, `:752` detects a panel left on stale details (the same selector is asserted `toBeNull()` at `:730` before the act), `:739` reddens single-point; a whole-file sweep of 20 candidate sites found no other assertion that cannot fail, the sole unfailable one being `:572` (round-7 S3, owner-recorded and untouched by T33); every clause of the rewritten comments verified true against the production code, and the comment density (14 lines for ~25 code lines) judged deliberate — each block records a non-obvious *why* the team paid two rounds to learn; no new import, no `as any`, no non-null `!`, no cast, no re-implemented `src/testing/` helper, and `expect(host.querySelector(…)).not.toBeNull()` rather than the file's `fileRow()` helper is the right call because `fileRow()` throws when the row is absent; no secret, no widened Tauri surface, no new DOM sink; round-6 S2 / S3 / S4 and round-7 S3 / S4 / S5 all re-checked, none touched or worsened by T33.

## Observations — recorded, not findings

- **O1** `tasks/round7-fixes.md` Verification (b) names the sibling failure as `:657`; it measures at `:656`. The sentence names the row (`:639-658`), so it is arguably not wrong.
- **O2** `tracker.md:42` states «~27½ person-days» against 27 by the line's own key (21 × `M` + 12 × `S`). The ½ gap is unchanged from round 7 (S5) and T33's own increment is right.
- **O3** the Q2 row's setup assertions at `:729` / `:730` carry no named mutation. Both are genuinely failable, pre-existing and outside T33's enumerated scope.
- **O4** the round-7 record names the positive-direction pins as `:657`, `:680`, `:708`; the second is at `:679`. Noted so this record does not inherit it.
- **O5** the shared-tree concurrency hazard — see **Process** above.

## Owner decisions (2026-09-07, round 8)

1. **N1:** recorded, not fixed. The alternative — a one-clause edit to `test-plan.md:111` as T34 — was weighed and declined: no AC is at risk, `:739` pins AC-08's mechanism by single-point mutation, the caveat is already written down at `round7-fixes.md:75-79`, and an eighth round that ends in a doc-only task would buy a ninth review of one clause. The domination is recorded here in full so a future reader of `test-plan.md:111` has the correction one link away.
2. **N2, O1, O2, O4 (line-citation drift and the person-day ½):** recorded in the same bucket as round-7 S5, no edit. `tasks.json` DoD text and past review records are the record of what was asked and what was measured at the time; the team settled in round 7 (S4, and the `round6-fixes.md:46` note) that they are not rewritten after the fact.
3. **R7-F3 / AC-19 and AC-20:** unchanged — the two recognized tier exceptions, both openly booked in `test-plan.md`.

## Artifacts changed by this review

None. No task was created; no document was edited. This record is the only artifact.

## Gate result

**PASS** — the first clean gate of the eight rounds. T33 closed R7-F1, S1 and S2 with no collateral loosening: the branch-independent field is gone, the assertion set is otherwise identical, no matcher was relaxed, every assertion left in the Q2 row is failable in principle, and every clause of the rewritten comments is true of the production code — all of it measured by two independent reviewers and, for the one claim they reported differently, by the lead. AC-08 and AC-03 are genuine on traced paths, the whole §4 user-story and §5 AC chain is intact across the single `desktop-app` surface with only the two owner-accepted tier exceptions, bookkeeping agrees across `tasks.json` / `tracker.md` / `_epic.md`, and the gate is green (831 tests, biome clean, `tsc --noEmit` clean, build 906.71 kB). The two stage-2 items are documentation wording, both recorded above with the measurement that corrects them.

**Owner-only prerequisites that remain for `ship`, unchanged from round 7:** T26's screenshots (still `blocked`), the R15 Linux check, and the manual checklist — AC-20 and AC-19's UI row.
