---
id: T54
title: "Round-13 code fixes: the false suite result at :385, the single-density figure, and the fourth stacked basis"
layer: "domain"
deps: ["T53"]
acs: ["AC-03", "AC-18", "AC-19"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T54 — Round-13 code fixes

## Why

Three things from `_review/review-2026-09-08-round13.md`, all in the spec tier. No production code
changes.

**R13-S2-F1 — a comment states a suite result its own cited record refutes.**
`inspector-layout.spec.ts:385` reads «so removing `COLLAPSED_LIST_SHARE_FLOOR` outright left **all
838 tests green** (review round 12, R12-S2-F2)». The cited record says the opposite:
`_review/review-2026-09-08-round12.md:98` records **3 failed / 835** — «the two 75 %-floor unit rows
… and the share sweep at 200 px — **the twin is not among them**». T51's own Outcome table
(`round12-code-fixes.md:133`) records **4 failed / 835**. Stage 2 measures 4 / 835 and the lead
measures 4 / 835. The mutation has never left the suite green in any round; what it left green was
**the twin**, which is exactly what R12-S2-F2 found and this row exists to fix. `test-plan.md:43`,
written by T52 in the same wave, gets it right.

This is the fourth consecutive round on the comments of this one file (R10-S2-F5, R11-S1-F1,
R12-S1-F1) and the same shape every time: a comment stating a number or a cause the policy or the
record does not support. It blocks rather than reading as a typo because a maintainer at `:385` learns
that the collapsed floor is uncovered by the whole suite — the false belief that would justify
deleting the two 75 % unit rows sitting a few hundred lines above it, at `:196` and `:211`.

**R13-S1-F2 ≡ R13-S2-F2 — the fourth basis value the owner decision named is pinned by nothing.**
`main-content.ts:275` is `fileHistoryFlex = computed(() => this.blameFile() ? '0 0 20%' : '0 0 28.6%')`.
Mutating the blame-absent value → `'0 0 58.6%'` leaves **839 passed / 63 green** (measured by stage 1
at 29 %, by stage 2 at 58.6 %, by the lead at 29 % — all green); the control, blame-alone
`'0 0 37.5%'` → `'0 0 38%'`, reddens one row. Round 12's owner decision 2 named all four values
(«`'0 0 30%'` / `'0 0 20%'` stacked, `'0 0 37.5%'` / `'0 0 28.6%'` alone») and T51 restates that
bullet verbatim in its own What without disclosing the gap — R12-S1-F4's class, in the wave sent to
close R12-S1-F4. The AC-19 row opens blame alone, then adds file history; it never opens file history
alone, so `'0 0 28.6%'` is the one declared value with no cover. File history opened by itself can
take 58.6 % of the inspector column — AC-19's subject in the words `main-content.ts:266-268` uses.

Scope, recorded honestly: the 110 px remainder every carve-out marker rests on comes from the
**stacked** pair, both of which are pinned, so no derived figure is at risk. It is a live AC-19 hole
on a configuration a user reaches by opening one panel, not a threat to the band.

**R13-S2-F3 ≡ R13-S1-O1 — one figure in the rewritten note is still single-density.** `:509-510`:
«The 2-row floor does SET `protectedList` below **126 px** collapsed (94 > 0.75h)». Measured:
comfortable `h ≤ 125`, compact `h ≤ 119`. Every other figure in the note carries both densities, and
T51's DoD bullet claims «no figure in the note is un-sourced or single-density»
(`round12-code-fixes.md:96-97`) while its Outcome repeats the single-density figure. The
parenthetical sources it to comfortable's constant, so it is traceable rather than wrong — the defect
is the DoD claiming a property the note does not have.

## What

1. **`inspector-layout.spec.ts:385`** — «left all 838 tests green» → «left **the twin** green»,
   keeping the R12-S2-F2 citation. State the measured counts the mutation has actually produced
   (3 failed / 835 in round 12 with the twin absent, 4 failed / 835 now with the new row among them)
   so the corrected clause is sourced.
2. **`inspector-layout.spec.ts:509-510`** — «below 126 px collapsed» → «below **126 px comfortable /
   120 px compact** collapsed», keeping `(94 > 0.75h)`.
3. **`main-content.spec.ts`, the AC-19 row (`:406-470`)** — add a file-history-alone phase and assert
   `'0 0 28.6%'`. Either close `blameFile` before setting `fileHistoryFile`, or open file history
   first and add blame after; keep the existing blame-alone (`'0 0 37.5%'`) and stacked-pair
   (`'0 0 30%'` / `'0 0 20%'`) assertions and their order intact, and keep the min/max-height
   assertions applying to whatever wrappers are on screen in each phase.
4. Nothing else in either file. **No production file is touched by this task** — `files_hint` names
   none.

## Definition of Done

- [x] `grep -n "838 tests green" src/app/core/services/inspector-layout.spec.ts` returns **only the
      quoted retired clause inside its round-13 marker** (`:389`); the clause names the twin and quotes
      both measured counts.
      <!-- re-worded 2026-09-09 (T58, review round 14 R14-S2-F1). The bullet read «returns nothing»
      and was ticked, while the grep returns `:389` — correctly, because the retired clause is quoted
      inside the marker that retires it, which is the house convention T53's own last DoD bullet
      states. The original wording is preserved here; what was wrong was the bullet and the Outcome
      that did not name it, not the code. -->
- [x] `grep -rn "126 px" src/app/core/services/inspector-layout.spec.ts` shows both densities.
- [x] **Mutation, recorded with its exact row and message:** `main-content.ts:275`'s blame-absent
      value `'0 0 28.6%'` → any other value reddens the AC-19 row. Run it, quote the failure, and
      confirm the suite is green again after restoring — with an md5 of the production file before
      and after.
- [x] The three surviving pins still redden: `'0 0 37.5%'` (blame alone), the stacked pair, and the
      min-height / max-height guards on **both** wrappers. Re-run MUT-B (class-based grow) and
      MY-M2b / MY-M2c (the second panel's min-height, the max-height half) — all three held in round
      13 and must still hold.
- [x] Whole gate: `pnpm test` green on **three consecutive serial runs** with identical counts
      (expect 840 if the AC-19 row gains an `it`, 839 if the phase is added inside the existing one —
      state which and why), `pnpm lint` clean over 266 files, `tsc --noEmit -p tsconfig.spec.json`
      exit 0, `pnpm build` clean with no budget warning.
- [x] `git diff HEAD -- src | grep -c '^-.*expect('` is **0** — no assertion removed, relaxed or
      emptied. No `it.skip` / `.only` / `.todo` / `.concurrent`.
- [ ] `git diff --name-only HEAD -- src` names **only** the two spec files; no production file, no
      `src-tauri`. **Unmet as written — named in the Outcome:** `HEAD` is `805a32d` and the whole
      T40–T52 wave is still uncommitted, so the diff names six. The check it meant was run against the
      tree round 13 reviewed and passes: exactly two files differ.
- [x] Every figure this task writes or corrects is re-derived by running the policy, not copied from a
      record — and any figure that survives single-density is named in the Outcome with its reason.

## Notes

`deps: [T53]`: the criteria wording comes first, since the comments cite the band this wave restates.

Both files are this task's alone; T53 and T55 touch no `src/` file, so the wave has no shared-file
edge at all.

The lead's round-13 battery is the floor to beat, not the target: MY-M1, MUT-G, MY-M2, MY-M2b,
MY-M2c, MY-M5, MY-M3, MUT-E, MUT-A, MUT-B, MY-N1, MY-N2, MY-N6 all redden a row today. Only MY-N3
(the fourth basis) does not, and closing it is this task's third item.

## Outcome (2026-09-08)

Landed. Two spec files, no production file.

**The pin reached RED before it reached green, which a characterisation row normally cannot.** Rather
than writing the assertion against the value already shipping (a false-pass by construction, the way
T36's rows had to be handled), the production value was mutated **first** — `'0 0 28.6%'` →
`'0 0 58.6%'` — then the assertion written, then run: **1 failed / 838**,
`expected [ '0 0 58.6%' ] to deeply equal [ '0 0 28.6%' ]` at `main-content.spec.ts:481`. A genuine
red, failing on the value and not on compilation. The mutation was then reverted and the file verified
byte-identical by md5 (`720244ba837d5fa7229ea935bb6d4704`, before and after), and the suite returned to
**839 / 839**.

**The count stays 839.** The new phase went **inside** the existing AC-19 `it` rather than adding one,
because it is the same criterion at a third panel configuration and the row already walks blame-alone
→ both-stacked; the DoD asked which and why, and this is the answer. `expect(` in
`main-content.spec.ts` goes 60 → 62.

**The three pins that already worked still redden**, each at its own row and line, measured in the lead
worktree with both production files restored byte-identical afterwards:

| mutation | result |
|---|---|
| blame-alone `'0 0 37.5%'` → `'0 0 38%'` | 1 failed / 838 — `:420`, `expected '0 0 38%' to be '0 0 37.5%'` |
| stacked `'0 0 30%'` → `'0 0 31%'` | 1 failed / 838 — `:463`, `expected [ '0 0 31%', '0 0 20%' ] to deeply equal [ '0 0 30%', '0 0 20%' ]` |
| `[style.minHeight]="'400px'"` on the **blame** wrapper | 1 failed / 838 — `:447`, `expected '400px' to be ''` |
| `[style.maxHeight]="'120px'"` on the **file-history** wrapper | 1 failed / 838 — `:448`, `expected '120px' to be ''` |

So all four of owner decision 2's basis values now have cover, the min-height guard is proved on the
first wrapper and the max-height guard on the second, and adding the blame-closed phase at the end of
the row did not weaken anything that runs before it.

**The two comment corrections.** `:385` now reads «left THE TWIN green» and carries both measured
counts (3 / 835 in round 12 with the twin absent; 4 / 835 once the 400 / 200 row exists), citing
R12-S2-F2 for the finding and R13-S2-F1 for the correction. The collapsed row-floor boundary now reads
«below 126 px comfortable and below 120 px compact», with both constants shown — re-derived, not
copied: `94 > 0.75h` gives `h ≤ 125` and `90 > 0.75h` gives `h ≤ 119`.

**Gate.** `pnpm test` **839 / 839, 63 files, three consecutive serial runs identical** · `pnpm lint`
clean, 266 files · `tsc --noEmit -p tsconfig.spec.json` exit 0 · `pnpm build` clean, no budget warning ·
`git diff 805a32d -- src | grep -c '^-.*expect('` = **0** · no `it.skip` / `.only` / `.todo` /
`.concurrent`.

**DoD bullets that could not be satisfied as written — two, the second added 2026-09-09 by T58
(review round 14, R14-S2-F1).**

**Bullet 1**, «`grep -n "838 tests green" …` returns nothing», was ticked and does not return
nothing: it returns `:389`, the line that **quotes the retired clause in order to retire it**. That is
the house convention — T53's own last DoD bullet says any grep bullet unsatisfiable for exactly this
reason must be named in the Outcome — and this Outcome named only the bullet below, so the DoD read as
fully met. Round 14 blocked on it as R14-S2-F1: an auditor running the bullet's own command gets a hit
and cannot tell from the task file whether the correction landed. The substance was never in doubt —
`:385-389` is correct and round 14 re-measured it at 4 / 835 — and the bullet is now re-worded above.
The transferable rule: when a correction quotes the wording it retires, write the bullet as «returns
only the quoted clause inside its marker», never as «returns nothing».

**Bullet 9:** «`git diff
--name-only HEAD -- src` names **only** the two spec files». It names six, because `HEAD` is `805a32d`
and the whole T40–T52 wave is still uncommitted — the bullet was written as if the diff were scoped to
this task. The check it meant was run instead, against the tree round 13 reviewed (the reviewer
worktree at `805a32d` + the T40–T52 patch): **exactly two files differ**,
`inspector-layout.spec.ts` and `main-content.spec.ts`. No production file, no `src-tauri`. Worth
fixing in the next wave's DoD wording rather than leaving the bullet to read as unmet.
