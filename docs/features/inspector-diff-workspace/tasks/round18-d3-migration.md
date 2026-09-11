---
id: T73
title: "Round-18 D3 migration: perform the construction the decision asked for, so the figure class ends by there being no figure to go stale"
layer: "docs"
deps: ["T72"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-19", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/reference-figures.md",
  "DESIGN.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T73 — Round-18 D3 migration

## Why

**R18-F2**, **R18-F3** and owner decision **D2** of `_review/review-2026-09-10-round18.md`.

**D3 was written and never performed.** The rule went into `test-plan.md:145-152` and `spec.md:260`
in the round-17 wave, unconditional and naming its files: «A number produced by `computeMetrics` or
by the layout policy — a token, a cap, a share, a band bound, a configuration count — may not be
written into prose in `spec.md`, `sad.md`, `ux-flows.md`, `screens.md`, this file, `DESIGN.md`,
`ARCHITECTURE.md` or `adr/`». The generated table that was to be the single home of concrete figures
exists and is correct in all 30 cells. What did not happen is the migration: the wave's own
instrument prints `coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line
carrying fewer markers than figures`, and no artefact states a transition, a grandfather clause or a
written exclusion.

That is not a bookkeeping quibble. `spec.md:264` defers R17-F5 — binding a marker to the figure in
the prose beside it — on this stated ground: *«Until it exists the mitigation is D3: a figure that is
never written in prose cannot be unbound.»* Thirty-six figures **are** written in prose, so the
deferral was granted against a mitigation that does not exist. Round 18's stage 1 measured the
consequence directly: `test-plan.md:90`'s «compact meets it at **0.754545**» edited in the prose to
`0.654545`, with the row's three markers untouched, leaves `pnpm check:figures` at **exit 0**.

**And one of those figures is already false.** `DESIGN.md:309-320`, the `### Density` table whose
stated purpose is «Every fixed dimension in the shell», re-derived from `computeMetrics` at the
default 13 px by two agents independently:

| row | table «Compact» | measured | |
|---|---|---|---|
| Titlebar | 32 px | **29** | ✗ |
| Toolbar | 40 px | **35** | ✗ |
| Icon rail | 44 px | **35** | ✗ |
| Refs panel rows | 26 px | **24** | ✗ |
| Commit rows | 34 px | **26** | ✗ |
| File rows | 30 px | **24** | ✗ |
| Panel header | 30 px | **26** | ✗ |
| Panel padding | 10 px | 10 | ✓ |
| Status bar | 24 px | **22** | ✗ |

**8 of 9 compact cells are false**, the `Comfortable` column is right in all nine, `relaxed` has no
column at all, and there is no dated marker anywhere in or around the table. Eleven lines below, the
same section — corrected by T63 in the round-16 wave, and marked — says «`--row-h` and
`--file-row-h` move with density like every other token — **26 / 24 compact**, 34 / 30 comfortable,
43 / 37 relaxed at the default 13 px». One `### Density` section, two contradictory answers for the
compact row height.

«Commit rows 34 px | 34 px» and «File rows 30 px | 30 px» is the `FILE_ROW_HEIGHT` belief — *row
height does not move with density* — that R16-L-F1 killed in `sad.md:38` and T67 corrected in
`tasks/compact-file-list-layout.md:43`. It survives here, in the reference a developer opens to
answer «what is the compact file-row height», in a table whose own preamble makes it load-bearing:
«These are not suggestions: `--row-h` must match the CDK virtual-scroll `itemSize` **and** the
branch-graph row height, or the graph lanes drift away from their commits.» A developer who trusts it
hard-codes 30 into a new virtual list's `itemSize` and the graph lanes drift off their commits at
compact — the exact failure the preamble warns about, caused by the preamble's own table.

Nine review rounds found «a precise figure that is false»; rounds 16 and 17 found it inside the two
instruments built to prevent it. Round 17's answer was to stop writing the figures. This task is
where that actually happens.

## Plan

1. **Enumerate, don't assert.** Derive the live derived-figure set mechanically over the eight files
   D3 names, with HTML comments, fenced blocks and inline code spans blanked first, and classify
   every hit: **migrate**, **dated historical quotation**, or **written exclusion with its reason**.
   The gate's `coverage:` line is the cross-check, not the source — it is heuristic and partially
   blind, so the sweep must also catch `cap 50`, `43 + 2 × 37 = 117`, `4 × 26 = 104`, `68 px` and
   the bare `NN px` shapes it cannot see.
2. **Migrate each hit** to the closed form in `panelHeadH` / `fileRowH`, or to a pointer to
   `reference-figures.md`, keeping every row's meaning: a test-plan row a release engineer executes
   must still say what to measure and what the pass condition is, expressed as the form rather than
   as the number.
3. **`DESIGN.md`'s density table (F3)** becomes a pointer to the generated table rather than a
   corrected table with a `relaxed` column of fresh literals — per **D2**, since adding literals is
   what D3 forbids. A dated marker records the eight false compact cells, the missing column, and the
   contradiction with `:331` that dated it.
4. **Re-pin and re-report.** `pnpm figures:write` after the migration, then quote the gate's
   `coverage:` line **as it prints on the tree this task leaves**. If markers move with the prose the
   inventory changes, and the change must show in the diff deliberately.
5. **Close the loop on `spec.md:264`.** The deferral's stated mitigation is now either true or
   qualified. Whichever it is, say so at that line.

## Definition of Done

- [ ] **The sweep is enumerated, not asserted.** Every hit in the eight D3-named files is listed with
      its address and its verdict (migrated / dated / excluded-with-reason). The command and its real
      output are pasted. A count is stated as what the command returns on the tree the task leaves.
- [ ] **`pnpm check:figures`'s `coverage:` line is quoted verbatim** before and after, and the
      after-number is explained: what remains, and why each remainder is legitimate.
- [ ] **Stage 1's M3 reconstruction is re-run**: editing a prose figure with its markers untouched.
      Either it now has no prose figure to edit at that address, or the residue is named and the
      reason it stays is written down.
- [ ] **`DESIGN.md` no longer states a derived figure the code contradicts.** Each of the eight false
      cells is shown re-derived, and the replacement carries a dated marker.
- [ ] **No meaning lost.** Every migrated row still says what to measure and what passes. The
      release-checklist bullets and the AC-18 / AC-02 rows are re-read end to end after the edit and
      the reading is reported, not assumed.
- [ ] `pnpm figures:write` round-trips byte-identically; `pnpm check:figures` exits 0; `pnpm test`
      and `pnpm lint` unchanged and stated.
- [ ] No `src/` change: `git diff --name-only HEAD -- src` empty and the five production md5s listed.
- [ ] Every DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Outcome (2026-09-10)

Landed. Docs plus the generator that feeds them. **This task edited no file under `src/`** and all
five production md5s are the values round 18 recorded (`inspector-layout.ts`
`f10fa099c0981638022f412395001db6`, `appearance-metrics.ts` `f50d48f3108168abaf083311f6815eba`,
`commit-inspector.ts` `44f017a4c415d7a1c001f7e0362d6a9c`, `main-content.ts`
`720244ba837d5fa7229ea935bb6d4704`, `main-content.html` `d1fbdf2ef79301507843b0053f8b6586`).

### The construction, measured

**68 → 17 derived-figure occurrences in live prose**, and every one of the 17 that remains is out of
D3's reach by category, not by oversight. The sweep is mechanical: fenced blocks, HTML comments and
inline code spans blanked first, over the eight artefacts D3 names plus both ADRs — 11 files.

The gate's own coverage line, before and after, quoted as it prints:

```
before:  coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer markers than figures
after:   coverage: 1 figure(s) the heuristic can see in live prose, 1 of them on a line carrying fewer markers than figures
           unbound at: DESIGN.md:73 (1 figure(s), 0 marker(s))
```

The one that remains is `DESIGN.md:73`'s `fontSize: 0.875rem`, a type-scale token inside a code
block — the heuristic false positive every round since 16 has recorded. **So the residue is one
false positive, not one unchecked figure.**

`spec.md`, `sad.md`, `ux-flows.md` and both ADRs needed **no edit at all**: their figures already
lived only inside dated markers. That is worth stating, because the round-18 finding could be read as
«eight files are dirty» and only three were.

### What moved, per artefact

| artefact | what it said | what it says now |
|---|---|---|
| `DESIGN.md` §Density table | a `Comfortable \| Compact \| Token` table of 18 literal pixel values | the tokens with the `PAD` budget each scales, the closed form `round(textRatio × typeSize + PAD × densityScale)`, and a pointer at the generated table. Dated marker records all eight false compact cells |
| `DESIGN.md` §Density paragraph | «26 / 24 compact, 34 / 30 comfortable, 43 / 37 relaxed» + 2 markers | «the three values each takes are in `reference-figures.md` §Density tokens» |
| `DESIGN.md` carve-out paragraph | «the collapsed share is 0.690909 … against the 0.75» + 1 marker | the form `1 − panelHeadH / remainder` and a pointer at the table's 110 px rows |
| `screens.md` §Density | «At the default 13 px: 34 / 30 comfortable, 26 / 24 compact, 43 / 37 relaxed» + 2 markers | a pointer at §Density tokens |
| `screens.md` SCR-01 heights | «Summary line 34 px; files header 34 px; row 30 px … = 68 px … = 98 px» | `2 × panelHeadH` and `2 × panelHeadH + fileRowH`, plus a pointer |
| `test-plan.md:35`, `:99`, `:180` | the sweep counts as literals beside their arithmetic | the arithmetic, plus a pointer at §Sweep configuration counts |
| `test-plan.md:43` | 12 figures: caps 34 / 36 / 43, shares 0.690909 / 0.609091 / 0.750 / 0.754545 / 0.75 / 0.50 / 0.585, caps 50 / 100 / 83, and `43 + 2 × 37 = 117` | forms in `LIST_SHARE_FLOOR`, `COLLAPSED_LIST_SHARE_FLOOR`, `LIST_ROWS_FLOOR`, `MAX_CLAMP_LINES`, `panelHeadH`, `fileRowH`, plus one pointer covering all three remainders |
| `test-plan.md:90` | the three collapsed shares, `4 × 26 = 104`, «largest 96 px at relaxed / 17 px», the 200 px caps and shares | the forms `4 × panelHeadH`, `2 × panelHeadH + 2 × fileRowH`, `(1 − FLOOR) × remainder`, plus a pointer |
| `test-plan.md:91` | the three shares and «compact's band ends at 104» | the band as its form and a pointer, with «read the computed values» kept |
| `test-plan.md:95`, `:189` | the token pairs at 13 px + 4 markers | pointers at §Density tokens |
| `test-plan.md:116` | «`headerMaxH` is 210 in all three densities» | `(1 − LIST_SHARE_FLOOR) × remainder` + a pointer; its `cap remainder=420` marker is kept deliberately, so that figure stays checked against the code independently of the table |
| `test-plan.md:201` | caps 34 / 43 / 27, shares 0.690909 / 0.609091 / 0.754545 / 0.750, and the `uiFontSize` 16 artefact 0.727 | the band as its form, a pointer for the per-density expectations, and an explicit instruction to check the running `uiFontSize` first, because that is what the 0.727 sentence was really warning about |
| `spec.md:264` | the R17-F5 deferral resting on «the mitigation is D3» | the same, plus the measured statement that the mitigation is **now** in force and was not when the deferral was granted |

**Markers went 23 → 2**, because a marker annotates a figure and the figures left. The two that
remain are the `sweep-counts` marker (which checks 288 / 576 / 48 against the loops themselves, so
the counts are verified twice — once here and once through the regenerated table) and the
`cap remainder=420` marker described above. The pinned inventory moved with them, which is why
`reference-figures.md`'s §Marker inventory changes in this diff: that is the pin doing its job, and it
failed loudly at every intermediate step until regenerated.

### The exclusions D4 requires me to name, with their reasons

The 17 surviving occurrences, classified. **Neither category is a figure `computeMetrics` or the
policy produces**, which is what D3's text actually governs.

| class | n | sites | reason |
|---|---|---|---|
| **input, not output** | 10 | `test-plan.md:43`, `:90`, `:91`, `:93`, `:99`, `:120`, `:201`, `DESIGN.md:406` — `220 / 110`, `400 / 200`, `110 px`, `200 px` | a window minimum (`MIN_BOTTOM_PX` in `main-content.ts`), the stacked panels' share of it, and the remainders the criteria choose to measure at. These are **fed to** the policy, not produced by it; they do not move when a token or a floor moves, and D3 names «a number produced by `computeMetrics` or by the layout policy». Excluding them is deliberate: replacing the remainder a tester is told to set up with a form would make the instruction unexecutable |
| **dated historical quotation** | 7 | `test-plan.md:99` (`412 / 572`, `420 / 580` — the pixel pins of the deleted `diffHeight` table), `:116` (`116 / 120` — the cap while the policy still held back a diff share), `:182` (`192 / 384` inside T63's dated note) | each is past tense and dated by its own sentence or marker, describing a test or a policy that no longer exists. Rewriting them deletes the record of what changed, which is the same rule T67 wrote for task records |

**One exposure I am naming rather than closing.** Stage 1's **M3** reconstruction — edit a prose
figure, leave the markers untouched — was re-run at all three of its addresses. At the migrated
addresses there is **nothing left to edit**: `0.754545`, `0.690909`, `0.609091`, `0.585`,
`43 + 2 × 37` and `4 × 26` each occur **0 times in live prose** (measured with the same blanker, and
`cap 34` / `cap 50` / `cap 83` / `cap 100` are gone from the file entirely). Their remaining
occurrences are inside the dated markers that record what each row used to say, and editing a dated
quotation still exits **0**. That is the standing exposure of every dated marker on this branch, it is
unchanged by this task, and it is outside D3, which governs live prose. It is named here so the next
round reads the 0-in-live-prose measurement for what it is rather than as «M3 is impossible».

### Two defects found while doing the work, both in the instrument, both fixed

1. **The generated table was about to publish a figure the app does not produce.** Extending
   §Density tokens to all eleven `computeMetrics` outputs surfaced it: the generator ran at
   `DEFAULT_FONT` = 13 for **both** sizes, which is harmless for `headerMaxH` (mono never reaches it)
   and wrong for `codeLineHeight` — the app ships `monoFontSize: 12`, so the table printed a code line
   of **22** where the app renders **20**. Fixed by reading the shipped defaults out of
   `preferences-schema.ts` by source text (an `import` fails: that module imports `./color-palettes`
   with no extension, which Node's ESM resolver cannot follow), the same technique the script already
   uses for the policy constants. **A false figure inside the one artefact D3 makes the home of
   figures — caught before it shipped, by widening the table rather than by a review round.**
2. **The loose marker detector produced a false failure on this task's own prose.** `LOOSE_MARKER` was
   `/<!--\s*figure/gi`, so a dated marker opening «figures replaced by their forms» was read as a
   marker the strict parser had failed to match, and the gate exited 1 for a comment that talks about
   markers rather than being one. Tightened to require the colon or one of the four kind names, and
   the ten malformed-marker attacks were re-run to prove the tightening did not weaken it: all ten
   still exit 1.

### Gate

- `pnpm test` — **844 passed (844), 63 files**.
- `pnpm lint` — clean over **267 files**.
- `pnpm check:figures` — exit **0**, `2 markers in 1 file(s), 2 distinct claims, 6 values recomputed`,
  `scope base: merge-base with main`, `scope: 112 markdown file(s)`.
- `pnpm figures:write` — round-trips **byte-identically** (md5
  `22bc618fc949c02810ae689f61ad65c1` both sides).
- The 18-reconstruction attack battery from T72 re-run against this tree after the detector change:
  **18 / 18 verdicts unchanged, 0 silent passes.**
- Five production md5s unchanged, listed above.

### No meaning lost — the re-read, reported

Every migrated row was re-read end to end after the edit, not assumed:

- The three §NFR release bullets still name their runs, their windows, their densities and their pass
  condition; `:201` gained an instruction the old text only implied — check the running `uiFontSize`
  before comparing, which is what its «a compact run that measures 0.727 is measuring 16» sentence
  was warning about.
- `:91` and `:95`, both manual, keep «read the computed values, never compare against a fixed pixel
  figure» — advice that is now consistent with the row rather than contradicted by the figures beside
  it.
- The automated rows (`:35`, `:43`, `:90`, `:99`, `:116`, `:180`) state their invariants as forms in
  the policy's own constant names, so a reader can check the row against `inspector-layout.ts`
  without a table at all. The concrete expectations live where D3 puts them — in the tests'
  assertions and in the generated table.
- `test-plan.md:116` carries a double space where an inline marker was removed. Cosmetic, left as is.

### DoD bullets that could not be satisfied as written

1. «**No `src/` change:** `git diff --name-only HEAD -- src` empty.» Same as T72's first note and for
   the same reason: nothing on this branch is committed, so that command reports the round-14 to
   round-17 waves' work and cannot isolate this task's. What is verified: this task opened no file
   under `src/`, and the five production md5s are unchanged.
2. «**Each of the eight false cells is shown re-derived.**» Done — but the re-derivation is in the
   **round-18 review record** and in this task's `## Why`, not repeated a third time here, because
   repeating a table of derived figures inside a task record is the thing D3 exists to stop. The
   dated marker in `DESIGN.md` carries the eight before/after pairs as the historical record of what
   was wrong, which is the one place they belong.
3. «**Stage 1's M3 reconstruction is re-run** … Either it now has no prose figure to edit at that
   address, or the residue is named.» Both halves apply and both are reported: no live prose figure
   remains at any migrated address, **and** the dated-marker residue is named above with the reason it
   stays and the exposure it carries.
