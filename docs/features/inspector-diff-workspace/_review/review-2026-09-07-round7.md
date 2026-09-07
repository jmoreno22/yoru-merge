---
slug: inspector-diff-workspace
date: "2026-09-07"
round: 7
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 0384570
previous_review: review-2026-09-07.md (CHANGES REQUESTED, F1 + S1–S4)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus, effort high) — stage 1 (F1 closure + claimed AC + full §4/§5 chain trace) and stage 2 (quality of the changed surface). Reports written to scratchpad files first, then relayed (the idle message truncates). Both ran their mutations in the shared working tree and restored it; the lead re-measured every decisive claim independently on a tree verified identical to HEAD.
---

# Re-review round 7 — inspector-diff-workspace — 2026-09-07

## Scope

Seventh review of the branch, after T32 (the round-6 follow-up). Whole feature diff `7cd47b4..0384570`: 41 commits. Changed surface since round 6 (`ba8fea0..0384570`): the single commit `0384570`, 4 files, +8 / −6 — one test file (`src/app/features/commit-inspector/commit-inspector.spec.ts`) and three documents (`test-plan.md`, `tasks/round5-fixes.md`, `tasks/tracker.md`). No production file, nothing under `src-tauri/`. `SDD-AC` trailer claims **AC-08**.

Gate at review time, run by the lead on `0384570`: `pnpm test` **831 tests / 63 files green** (same count as round 6 — T32 removed one assertion, not a test) · `pnpm lint` (biome, 266 files) clean · `tsc --noEmit` clean (no output) · `pnpm build` clean (906.71 kB main, under the 1.2 MB budget). Rust gate unchanged (the whole feature diff contains no `src-tauri` path). The one stderr line (`[cdkFocusInitial]` not focusable, from the AC-10 row) is the known jsdom noise.

Out of scope, noted so `ship` is not surprised: the working tree carries four modifications unrelated to this feature (`.github/workflows/release.yml`, `.gitignore`, `CHANGELOG.md`, `install.sh`) plus an untracked `.mcp.json`. Confirmed absent from `git diff --name-only 7cd47b4..0384570`; no reviewer touched them.

## Resolution of the round-6 finding

| Finding | Resolved | Evidence at HEAD | Mutation that turns the pin red |
|---|---|---|---|
| F1 / S1 the Q2 row carries an assertion that cannot fail | **partly** | `commit-inspector.spec.ts:738-741` — the named line `expect(host.contains(document.activeElement)).toBe(false)` and its «failable half» comment are gone; the assertion-set diff over the file is exactly one removed `expect(` (90 → 89), `it(` unchanged at 28, no matcher relaxed | executed by all three of us: commenting out `commit-inspector.ts:345` (the `index < 0` arm's `focusRestored`) leaves 1 failed / 27 passed and the failure is this row, at `:738`, `expected 'b.ts' to be null`. But the block T32 promoted to the row's surviving proof carries a member that behaves exactly like the line it replaced — see **R7-F1** |

**The line T32 removed is genuinely gone and nothing else was weakened.** What did not close is the *claim*: T32's DoD (`tasks/round6-fixes.md:35`) asserts that «the returning-path block still asserts nothing took the focus — verify both by running the mutation». That half is false, and three independent measurements agree.

**Measured, not argued.** With `commit-inspector.ts:345` commented out and `:738` replaced by a probe so execution reaches the returning-path block, the lead measured on a tree verified identical to HEAD:

```
LEAD-P1 {"pending":"b.ts"}
LEAD-P2 {"pending":null,"focusedTheRow":false,"active":"BODY","hasRow":true}   28 passed
```

`hasRow: true` is the point: the row **is** drawn on the returning path, the key **was** still pending at close (`LEAD-P1`), and the focus still sits on `document.body`. The mechanism is visible in the same probe — `pending: null` at the block means the *normal* arm (`commit-inspector.ts:351`) consumed the key and called `focusVirtualRow`, whose `.focus()` is deferred through `afterNextRender` + `scrollToIndex` + `renderedRangeStream` (`virtual-row-focus.ts:26-45`) and never lands on a viewport the emptied list re-created. Both reviewers reached the same numbers, one of them with `settleScroll()` × 3 plus a `sizeVirtualViewport` on the repopulated viewport, ruling out a flush artifact.

**Where AC-08's negative half is really pinned — a correction to a claim stage 2 made and this record does not repeat.** Stage 2 justified the finding as a nit partly on the grounds that «an expired key does not steal the focus» is pinned failably at `commit-list.spec.ts:308-314`. The lead tested that: commenting out the commit list's own expiry (`commit-list.ts:278`) gives 1 failed / 3 passed, failing at `commit-list.spec.ts:308` with `expected 'commit:c0ffee1babe2cafe3dead4beef5f00…' to be null` — the two focus assertions at `:309` and `:310-313` stay green. So that row pins the key, not the focus, exactly like the inspector's.

The honest statement, which supersedes the wording of rounds 4–6: **at the component tier the DOM consequence «an expired key does not steal the focus» is not observable in these fixtures at all** (the row that could be stolen is absent by construction in every negative row, and where it comes back the deferred CDK focus does not land in jsdom). What *is* failably pinned is the mechanism — the key expires: `commit-inspector.spec.ts:738` and `commit-list.spec.ts:308`, both red by single-point mutation — and the positive direction — an honoured key does land focus on its row: `commit-inspector.spec.ts:657`, `:680`, `:708`. AC-08 rests on the composition of those two, plus the per-arm owner predicate at `diff-workspace-state.spec.ts:327-346`. Nothing in the feature claims more than that from here on.

**Claimed AC.** AC-08 genuine: code at `diff-workspace.service.ts:255-266`, `commit-inspector.ts:326-353` (the `focusKeyOwner` guard at `:341`), `commit-list.ts:269-286`, `working-changes/changes-list.ts:112-128`, `diff-workspace-state.ts:58-82`; revert-sensitive assertions as listed above. T32 weakened nothing beyond the line F1 named. AC-03 untouched by `0384570` and intact (`main-content.spec.ts:336-338`, round-6-verified).

## Chain trace

**User stories.** US-01..US-08 each keep ≥ 1 AC and a `sad.md` §6 flow (`sad.md:601-610`); no AC is orphaned from a story.

**Acceptance criteria.** AC-01..AC-21 all reach code and at least one automated assertion, with two tier exceptions now recorded rather than one — see **R7-F3**: AC-20 (non-runtime, `sad.md:633`, `test-plan.md:87`) and AC-19, whose policy is unit-pinned (`inspector-layout.spec.ts:166-182`) while its UI check is booked `e2e-through-UI` / `manual` at `test-plan.md:86`. `target_surfaces: [desktop-app]` (`sad.md:7`).

**Bookkeeping.** `tasks.json` T32 equals `tasks/round6-fixes.md` in title, deps, acs, dod and all three `files_hint` entries; `tracker.md:39` has T32 `done`, T26 `blocked`; `_epic.md:119` agrees. No `.skip` / `.only` / `.todo` / `xit` / `fdescribe` / `fit` under `src/`; no test disabled or emptied (`it(` count 28 at `ba8fea0` and 28 at HEAD).

**Documents `0384570` had to change.** `test-plan.md:111` is accurate as worded — it attributes the reddening to `pendingFocusKey()` and says «nothing asserts where the focus sits while no row is drawn»; it needs one more pass only because T33 changes what the block contains. `tasks/round5-fixes.md:51` records which of the V4 options landed and why the first was unavailable, in the file's own Notes idiom — accurate. `tasks/tracker.md:39` T32 row correct.

## Findings — stage 1

- **R7-F1 the returning-path block carries a member that cannot fail for the mutation it is advertised against, and T32's DoD reports it as mutation-verified** — `commit-inspector.spec.ts:753` (`focusedTheRow: false` inside the `toEqual` at `:751-754`); AC-08; `tasks/round6-fixes.md:35` (DoD bullet 1). Proven by three independent runs of the two-point probe above. No AC is violated — AC-08 keeps `:738` (single-mutation red), `:657-708` and the owner-predicate row — and no production behaviour is at risk. What is wrong is one factual claim in a DoD and one assertion field that no mutation of the expiry can redden. → **Fix now → T33.**

- **R7-F3 AC-20 is not the only AC whose surface check is manual** — `test-plan.md:85-86` against `inspector-layout.spec.ts:166-182`; AC-19 (US-07). AC-19 reaches code (`inspector-layout.ts:42`, `commit-inspector.ts:60`, `main-content.ts:266`) and one automated **unit** assertion, but no component-tier row renders blame or file history, and `test-plan.md:86` books that check as `e2e-through-UI` / `manual` (T11). Pre-existing, openly booked in the plan, untouched by T32; raised only because rounds 4–6 recorded AC-20 as the sole manual exception. → **Recorded** as a second recognized tier exception (owner), no document edit and no task.

No other stage-1 finding: the line round-6 F1 named is gone with no collateral loosening, AC-08 and AC-03 are genuine on traced paths, and the spec → §6 → screens → tasks → code+test chain is intact for every user story and every AC.

## Findings — stage 2

- **S1 the new comment's last clause over-reports what the block proves** — `commit-inspector.spec.ts:741`: «The block below proves it against a drawn row» is true of the key and false of the focus. Every other claim in the comment is verified true (`commit-inspector.ts:332-348` returns from the `index < 0` arm without focusing; `focusVirtualRow`'s only call site is `:352`, after the early `return`), and the comment earns its place — it records why there is deliberately no assertion at that point and stops the next reader re-adding the line T31 added and T32 removed. → folded into **T33** (one clause).
- **S2 the surviving `pending: null` member is weaker than it reads** — `commit-inspector.spec.ts:752`; AC-08. The lead traced it: in the clean tree the key is already `null` before the block (the `:345` arm expired it), under mutation A the `:351` arm consumes it, and removing `:351` alone leaves `:345` to expire it — so only the two-point mutation (neither arm consuming) reddens this member. It is not vacuous, but the row must not advertise it as proof of the expiry. → folded into **T33**: keep it, and require the DoD to name the mutation that actually reddens each surviving assertion.
- **S3 one genuinely unfailable pin survives in a sibling row** — `commit-inspector.spec.ts:572`, `expect(host).not.toBeNull()` inside the AC-06 `mod+d` row: `host` is `fixture.nativeElement` from `withActiveRow()` (`:512-519`), never null, and `fileRow()` already throws if the row is missing. Introduced by `4201438` (T24), outside T32's scope and `files_hint`. → **Recorded** (owner), not charged to T32 and not work.
- **S4 T32's bookkeeping is literally short of its own DoD bullet 4** — `0384570` edited `tasks/tracker.md`, which is not among T32's three `files_hint` entries, with no «Files beyond `files_hint`» note in `tasks/round6-fixes.md`; and that task file keeps `status: "todo"` with four unchecked DoD boxes while `tracker.md:39` says `done`. Both match every prior follow-up task file (`round3-fixes.md:25`, `round4-fixes.md:21`, `round5-fixes.md:17`, and `ba8fea0` / `7601d2b` editing `tracker.md` the same way): the tracker is the status of record and the task files are not rewritten after the fact. → **Recorded** (owner). **Convention, stated once so no further round re-raises it: an edit to `tasks/tracker.md`, `tasks/_epic.md` or `tasks.json` that only registers a task's own status or row needs no `files_hint` entry and no «Files beyond `files_hint`» note; the frontmatter `status` of a task file is not the status of record.** T33's `files_hint` lists them anyway.
- **S5 `tracker.md:41` person-days is ½ high** — the table's Estimate column at HEAD is 21 × `M` + 11 × `S` = 26½ by the line's own key, against the «~27» stated; T32's own ½ increment is right and the drift predates it (`ba8fea0` said ~26½ against 26, `7601d2b` ~26 against 25½). Same class: `tasks/round5-fixes.md:51` and `tasks/round6-fixes.md` cite the `index < 0` branch as `commit-inspector.ts:337-348` where it opens at `:332`. → **Recorded** (owner), uncorrected; the `~` softens the figure and a silent fix would hide a drift worth one deliberate pass later.

Checked and clean (stage 2): the removal touched nothing but the one `expect(`; the four rows of `describe('CommitInspector focus restore on close (AC-08)', …)` still cover the in-range restore (`:639-665`), the post-navigation restore (`:667-681`), the out-of-range scroll-in (`:683-709`) and the absent-row expiry (`:711-755`), with the commit-row and unexpired-key arms in `commit-list.spec.ts:182-341`; every other `toBeNull()` / `toBe(false)` / `not.toBeNull()` in the file (26 sites swept) is reddened by a stale-render or preference mutation; no new import, no `as any`, no non-null `!`, no cast anywhere in the file; the component-tier docblock and the `src/testing/` stand-ins are untouched and no helper is re-implemented; biome and `tsc --noEmit` clean on the changed file; no secret, no widened Tauri surface, no new DOM sink; round-6's owner-declined S2 (`WORKING_SIDES` addition-safety), S3 (the duplicated `WorkingSide` alias) and S4 (the `126` literal pinning the density tokens) are all still exactly as recorded and were not re-raised.

## Owner decisions (2026-09-07, round 7)

1. **R7-F1 + S1 + S2:** fix now, one minimal task — T33 «Round-7 fixes: drop the branch-independent focus field from the Q2 row, sharpen its comment and correct the claims that call the returning-path block mutation-verified». The alternative (keep the field as a forward guard and record it as an accepted limit, the way round-6 S2 and S3 were recorded) was declined: round 6 already refused that argument for the standalone line, and leaving a field no mutation of the expiry can redden would bait an eighth round.
2. **R7-F3 / AC-19:** recorded as a second recognized tier exception beside AC-20, with no document edit — `test-plan.md:86` already books its UI check as `e2e-through-UI` / `manual` (T11) and the policy it wires is unit-pinned, so the inaccuracy was in the earlier records' «AC-20 is the only manual exception» wording, which this record supersedes. Adding a component row that renders blame or file history was declined as new work on a feature already at seven rounds.
3. **S3, S4, S5:** recorded here with their reasons (pre-existing / settled convention / uncorrected drift), no task. The convention sentence in S4 is the standing answer for future rounds.

## Artifacts changed by this review

- `tasks/round7-fixes.md` (T33) written; `tasks.json`, `tasks/tracker.md`, `tasks/_epic.md`: T33 added (`todo`); T26 stays `blocked`.
- `test-plan.md` is **not** touched here: its `:111` row must change to match what T33 lands, so the correction belongs to the task.

## Gate result

**CHANGES REQUESTED** — stage 2 in substance, and narrower than round 6. The line round-6 F1 named is genuinely gone, no assertion was loosened, AC-08 and AC-03 are genuine on traced paths, the whole §4/§5 chain is intact and the gate is green including `tsc --noEmit`. What remains is R7-F1: one field of a `toEqual` that no mutation of the expiry can redden, and a DoD that reports it verified. The measurement behind it also settled something rounds 4–6 had wrong — the focus consequence of an expired key is not observable at this tier anywhere, in the inspector or in the commit list — which is now recorded so the row is never again advertised as proving it. Re-review the changed surface after `/sdd:implement inspector-diff-workspace` runs T33; T26's screenshots, the R15 Linux check and the manual checklist (AC-20, and AC-19's UI row) stay owner-only prerequisites for `ship`.
