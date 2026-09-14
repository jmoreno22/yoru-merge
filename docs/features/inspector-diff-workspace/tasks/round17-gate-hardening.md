---
id: T70
title: "Round-17 gate hardening: make a lost marker loud, stop the verifier modelling the loop, make the coverage number mean something, and widen the scope to the branch"
layer: "infra"
deps: ["T67"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "scripts/check-figures.mjs",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/reference-figures.md",
  "package.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T70 — Round-17 gate hardening

## Why

**R17-F5** (claims half), **R17-F6**, **R17-F7**, **R17-F8** (semantics half), **R17-F9**, plus the
lead's `ARTEFACTS`-scope finding and owner decisions **D1**, **D3**, **D4**
(`_review/review-2026-09-10-round17.md`).

T65's gate is real and its strength is measured: it catches every module-side drift that could be
constructed against it — `PAD.fileRow` 15→20 named 14 figures, `TEXT_LINE_RATIO` 39,
`COLLAPSED_LIST_SHARE_FLOOR` 3, the head-cap guard 10, `LIST_ROWS_FLOOR` 5 — each with `file:line`,
the claim and the computed value. It imports the shipped modules rather than reimplementing them.

What blocks is that it **certifies more than it checks**, in five ways, and says so nowhere.

**F5 — it never reads the prose it certifies.** The only comparison is the marker's `expect=` against
the recomputed value (`check-figures.mjs:127-215`); nothing ties a marker to the figure in the
sentence beside it. Every historical instance reconstructed **in the prose, marker untouched**, exits
0: «30 / 30 compact» (R15-S1-F2 verbatim), «compact meets it at 0.727273» (R15-S1-F1's dead figure),
«As the suite stands: 192, 384 and 32» (R16-S1-F3 verbatim), and a marked row's own «`headerMaxH` =
99 comfortable» against a marker still saying 34. So `test-plan.md:185`'s «when a row quotes a
derived figure, its marker is what checks it» is false as a reader takes it, and T65's «it fails on
each of the six historical instances» holds only because the drift was injected into the markers.

**F6 — losing a marker is a silent pass.** The regex is `/<!-- figure:\s*(\S+)\s+([^>]*?)-->/g`, so
`<!--figure:` (no space), `<!-- Figure:` (capitalised), a marker reflowed across two lines, or one
deleted outright each drop a check while the gate exits **0** and prints `OK` — markers go 23 → 22
and nothing asserts the count. The coverage counter cannot catch it either: the figure then sits
inside an unmatched comment, so `insideSameLine` suppresses it.

**F7 — `sweep-counts` certifies its own model of the loop.** `:202` computes
`{ share: nd*nh*nf*2, cap: nd*nh*nf*4, zerofile: nd*nh*2 }`. Only the three array lengths are read
from the spec file; the `×2`, the `×4` and the `nf`-independence of the zero-file subset are the
verifier's own hardcoded shape. Removing the collapse dimension from the share loop (real 288 → 144)
and adding a fifth nested dimension to the cap loop (576 → 1152) **both leave the gate at exit 0**.
That is R16-S1-F3 reproduced with the gate installed, and T65's DoD «a verifier that reimplements the
thing it verifies certifies itself» is unmet for the one kind whose historical instances are counts.

**F8 — the coverage number does not measure coverage.** `45` counts *values*, `1` counts *lines*, and
one marker exempts its whole line (`:230`, `!line.includes('<!-- figure:')`) — 34 of the 35
heuristic-visible figures in live prose sit on lines reported as `0 unmarked`. The heuristic (`:104`)
sees only a `0.ddd`–`0.dddddd` decimal or a 20–49 px pair, so it cannot see `68 / 60`, `136 / 120`,
`192 / 384 / 32`, `288`, `cap 50`, `cap 100`, `43 + 2 × 37 = 117` — the figures of R15-S1-F1,
R16-S1-F3 and R10-S1-F10, the very instances T65's table claims to close. `45` is itself inflated:
23 markers carry **10 distinct claims** / 22 distinct computed values.

**F9 — two named arguments silently ignored.** `share`'s `fileCount=` is discarded (`shareFor`,
`:78-88`, hardcodes 30) and `cap`'s `font=` is discarded (`capFor`, `:68-77`, hardcodes 13).
`protectedList` branches on `fileCount === 0` (AC-04 / AC-05), so a marker written for the empty-list
case is silently verified against the 30-file case; and the branch's worst reachable share,
**0.647059 at relaxed / 17 px**, cannot be marked at all. The script's own header calls named
arguments «deliberate … a positional triple is the same ambiguity that produced the figures this
script exists to catch», then discards two of them without a word.

**The scope, per D4.** `ARTEFACTS` (`:39-48`) is an **enumerated list of eight files** — the
structure the owner abolished after R15-S1-F3, reinstated in the wave's own anti-recurrence
instrument. `adr/0003` (where R17-F4 lives) is outside it, as are `_epic.md`, the task records,
`CONTEXT.md` and `CHANGELOG.md`. No marker is currently orphaned outside the scope, so this is
latent rather than exploited — and it is disclosed nowhere.

## Plan

1. **F6 — make a lost marker loud.** The gate must fail when the marker inventory shrinks. Either
   pin the expected count and require it to be updated deliberately, or (better) detect
   marker-shaped text the parser did not match — `<!--\s*[Ff]igure` that the strict regex missed —
   and fail with the site. The second catches reflow and mis-capitalisation without a magic number.
2. **F9 — stop discarding named arguments.** Either honour `fileCount=` and `font=`, or reject a
   marker that carries an argument the kind does not use. Honouring them is better: it makes the
   empty-list case and the worst reachable share expressible. **Fail on an unknown key either way** —
   silently ignoring one is how both defects reached the reviewer.
3. **F7 — stop modelling the loop.** Read the loop's *shape* from the spec file, not just the array
   lengths — count the nested `for` levels and which flags each iterates — or retire the
   `sweep-counts` kind and let the counts live only in the generated reference table (D3), where
   they cannot drift. Retiring it is the smaller surface; decide and record why.
4. **F8 — make the coverage number mean one thing.** Count occurrences, not lines: a line with one
   marker and eight derived figures must report seven unmarked, not zero. Report the two numbers as
   comparable quantities, and state the heuristic's blind spots **in the output**, not only in the
   docblock.
5. **The scope, per D4.** Replace `ARTEFACTS` with «every tracked file the branch touches», derived
   rather than enumerated, with any exclusion named in the script beside its reason. Add the **D4
   mechanical check**: a sweep whose declared scope is narrower than the scope it executed fails.
6. **D3's generated reference table.** Build the generator: one artefact, produced from
   `computeMetrics` and the shipped policy, that is the single home of concrete reference figures.
   Wire it so a stale checked-in copy fails the gate.
7. **The claims, per D1.** Correct `test-plan.md:185` to what the gate actually checks, correct the
   docblock, and add the honest coverage statement. **Record F5's structural half — binding a marker
   to the figure in its prose — in spec §8 as a deferred item with owner + due.** It is a prose
   parser and does not belong inside a review wave.

## Definition of Done

- [ ] **Each of F6, F7, F9 has a reconstruction that now fails and did not before.** For every one:
      inject it, paste the gate's exit code and message, restore, re-verify the md5. The pre-task
      md5 of `scripts/check-figures.mjs` is `8cf3336e78b9d59ce15a405f6287af9f`.
- [ ] The 24 malformed-marker attacks stage 2 ran are re-run and **each either fails loudly or is
      justified as an intentional pass**. The four that were silent passes — `<!--figure:`,
      `<!-- Figure:`, `share … fileCount=0`, `cap … font=17` — must now fail or be honoured.
      Enumerate all 24 with their outcome; «the ones I thought of» is how F6 shipped.
- [ ] **F7's two shape drifts fail**: removing the collapse dimension from the share loop and adding
      a fifth nested dimension to the cap loop. If the `sweep-counts` kind is retired instead, show
      that the counts it used to check are now checked elsewhere, and that removing the collapse
      dimension is caught by that other thing.
- [ ] The coverage number counts comparable quantities. State it, and **prove it on
      `test-plan.md:43`** — the line stage 2 measured as carrying eight derived figures under one
      marker. It must no longer report 0 unmarked for that line.
- [ ] **`pnpm check:figures` still exits 0 on the real tree**, and all currently-marked values still
      re-derive correctly. Widening the scope must not be achieved by loosening a check.
- [ ] The module-direction strength is **preserved and re-measured**: the five module drifts stage 2
      ran (`PAD.fileRow` 15→20, `TEXT_LINE_RATIO` 1.15→1.4, `COLLAPSED_LIST_SHARE_FLOOR` 0.75→0.5,
      the head-cap guard dropped, `LIST_ROWS_FLOOR` 2→3) each still exit 1 and name at least as many
      figures as before. Paste the counts.
- [ ] The scope is derived from the branch, not enumerated, and a narrower declared scope fails.
      Demonstrate with a deliberately narrowed declaration.
- [ ] **No `src/` change**: all five production md5s unchanged; `git diff --name-only HEAD -- src` is
      what T68 and T69 left.
- [ ] `test-plan.md:185`, the docblock and the gate's own output state what it checks **and what it
      does not**. No sentence in the tree claims the marker checks the prose figure.
- [ ] F5's structural half is in spec §8 with owner + due.
- [ ] Gate: `pnpm test` green with the count stated, `pnpm lint` clean, `pnpm check:figures` exit 0.
- [ ] Any DoD bullet that cannot be satisfied as written is named in the Outcome with the reason —
      and the Outcome does not restate a coverage figure it did not measure. **T65's «45 of 45» is
      the defect this task exists to fix; do not write its successor.**

## Notes

Depends on **T67**: same lane (`test-plan.md`, `spec.md`), and it needs D3's and D4's rule text to
point at.

**The CI step is unexercisable here** — nothing is pushed from this branch, so «a drifted figure
fails the workflow» cannot be demonstrated. T65 disclosed the same limit. Exercise the exact command
CI runs, locally, and say that is what was done.

**Scope discipline.** This hardens *this feature's* figure gate. The shape looks reusable — any pure
module plus any artefact quoting its outputs — but generalising it into a repo-wide docs linter
belongs in its own spec, as T65 already recorded.

## Outcome (2026-09-10)

Landed. `scripts/check-figures.mjs` (rewritten in place), `package.json` (`figures:write`),
`docs/features/inspector-diff-workspace/reference-figures.md` (**new, generated**), `test-plan.md`'s
CI-placement row and its D3 conventions pointer, `spec.md` §8. No `src/` change: the four production
md5s the lane was given are byte-identical at exit, and so is `inspector-layout.spec.ts`, the fifth
file this task mutated and restored.

```
inspector-layout.ts      f10fa099c0981638022f412395001db6   unchanged
appearance-metrics.ts    f50d48f3108168abaf083311f6815eba   unchanged
commit-inspector.ts      44f017a4c415d7a1c001f7e0362d6a9c   unchanged
inspector-layout.spec.ts d3139298910a92e58b6f2e6718879913   unchanged (mutated 7x, restored 7x)
check-figures.mjs        8cf3336e78b9d59ce15a405f6287af9f -> bcde4f743357bb3ab169c603186a1b75
```

**Gate.** `pnpm test` → **842 passed (842), 63 files** — unchanged, as it must be with no `src/` edit.
`pnpm lint` → `Checked 266 files in 195ms. No fixes applied.` `pnpm check:figures` → exit **0** on the
real tree, every currently-marked value still re-deriving. The Rust half was **skipped**: `src-tauri`
is byte-identical to the base across the whole branch and T71 measures it once at the end.

### What the gate says about itself now

```
scope: 108 markdown file(s) derived from the branch — every markdown file the branch touches:
       `git diff --name-only <merge-base main>..HEAD`, plus the working tree and untracked files
  − 77 excluded: not markdown …
figures: 23 markers in 3 file(s), 10 distinct claims, 45 values recomputed
  defaults applied: 12 share marker(s) checked at 30 files, 2 cap marker(s) at 13 px
coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer
          markers than figures
  … the blind-spot sentence, then the four coverage exclusions with their reasons
OK — every marked figure matches the shipped modules, and no check went missing.
```

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7): no commit in this
repository prints these figures. Measured at `2db0519`, the single commit that carries T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`,
because T73's D3 migration retired 21 of the 23 markers inside the same uncommitted tree. Kept as
the dated record it is; `round19-records.md` says why a one-commit wave cannot speak of «the tree
this wave delivered» -->

**The new coverage number, with its definition.** For each line of a live artefact:
`unbound(line) = max(0, figure-shaped values the heuristic sees in that line's prose − strict markers
on that line)`; the reported pair is `Σ figures = 36` and `Σ unbound = 15`. **Both sides are
occurrences**, which is the whole correction: T65's «45 of 45» compared 45 *values* against 1 *line*,
and one marker exempted its whole line. What `15` means is «fifteen visible figures sit on lines
carrying fewer markers than figures»; it does **not** say which fifteen, because nothing binds a
marker to a figure — that is F5's structural half, deferred. So `0 unbound` would mean «no line
carries more visible figures than markers», never «every figure is verified», and the run prints that
sentence plus the heuristic's blind spots: it sees a `0.ddd`–`0.dddddd` decimal or a 20–49 px `a / b`
pair, and does not see `68 / 60`, `192 / 384 / 32`, `288`, «cap 50», `43 + 2 × 37 = 117`, a bare
`34 px`, a percentage or a count in words.

**Proved on `test-plan.md:43`** — the line stage 2 measured as carrying eight derived figures under
one marker. The pre-task gate folded it into `0 unmarked`; the hardened gate reports
`test-plan.md:43 (6 figure(s), 3 marker(s))`, i.e. **3 unbound**. Six, not eight, because the
heuristic sees six of that row's figures and is blind to two — which is why the blind-spot sentence
now prints beside the number instead of living in the docblock.

**The scope, per D4.** `ARTEFACTS` was an enumerated eight-file list; it is now derived — **108**
markdown files, including `adr/0003` (where R17-F4 lived), `_epic.md`, the task records, `CONTEXT.md`
and `CHANGELOG.md`. Two automatic exclusions carry their reason in the script (**not markdown**,
**deleted on the branch**), and the *coverage heuristic* — only the heuristic, never the marker check —
skips four classes, each named with its reason in the code and printed on every run: 17 review
records, 73 task records, `CHANGELOG.md`, and the generated table itself. Markers in those files are
still parsed and still checked, so an orphan marker anywhere on the branch fails. Widening cost
nothing in strictness: 23 markers, 45 values, exit 0.

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7): no commit in this
repository prints these figures. Measured at `2db0519`, the single commit that carries T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`,
because T73's D3 migration retired 21 of the 23 markers inside the same uncommitted tree. Kept as
the dated record it is; `round19-records.md` says why a one-commit wave cannot speak of «the tree
this wave delivered» -->

### Reconstructions — each injected, measured, restored, md5 re-verified

Every case was run twice: against the **pre-task gate** (the pristine
`8cf3336e78b9d59ce15a405f6287af9f`, copied in as `scripts/check-figures.pre.mjs` for the duration and
removed after) and against the **hardened** one, so «now fails and did not before» is measured in this
run rather than quoted from the review.

| # | reconstruction | pre | post | the hardened gate's message |
|---|---|---|---|---|
| **F6a** | `<!--figure:` (no space) | **0** | **1** | `test-plan.md:90  1 marker-shaped comment(s) the parser did not match — a mis-typed prefix or a marker reflowed across lines drops its check`, plus `reference-figures.md: …test-plan.md carries 17 marker(s), the pinned inventory says 18 — a check was added or lost` |
| **F6b** | `<!-- Figure:` (capitalised) | **0** | **1** | the same two; markers 23 → 22 |
| **F6c** | marker reflowed across two lines | **0** | **1** | the same two |
| **F6d** | **marker deleted outright** | **0** | **1** | `reference-figures.md: …test-plan.md carries 17 marker(s), the pinned inventory says 18 — a check was deleted`, plus `reference-figures.md:79 is stale against a fresh generation … run pnpm figures:write` |
| **F7a** | share loop loses the collapse dimension | **0** | **1** | `test-plan.md:181  sweep-counts share: artefact says 288, the loop in src/app/core/services/inspector-layout.spec.ts runs 144 (tokens 3 x availableHeight 8 x fileCount 6)` — and `sweep-counts zerofile: artefact says 48, … runs 24` |
| **F7b** | cap loop gains a fifth nested dimension | **0** | **1** | `sweep-counts cap: artefact says 576, … runs 1152 (tokens 3 x availableHeight 8 x fileCount 6 x headerCollapsed 2 x fileListCollapsed 2 x extraDimension 2)` |
| **F9a** | `share … fileCount=0` | **0** | **1** | `test-plan.md:90  share compact/13 r=110 collapsed=true files=0: artefact says 0.754545, computed 0.236364` — honoured, and the empty-list branch really is a different figure |
| **F9b** | `cap … font=17` | **0** | **1** | three lines: `cap compact/17 … says 36, computed 31`; `comfortable/17 … 34 → 39`; `relaxed/17 … 43 → 48` |
| **D4** | the declaration narrowed back to round 16's enumerated eight-file list | — | **1** | 100 failures, one per file: `scope: the sweep read AGENTS.md, which the declared scope does not cover — a declared scope narrower than the executed one is what R17-F4 exposed` |
| **D3a** | one token figure edited by hand in the generated table | — | **1** | `reference-figures.md:17 is stale against a fresh generation — expected «compact 26 24 26», found «compact 30 30 30»` |
| **D3b** | the sweep count edited by hand in the generated table | — | **1** | `reference-figures.md:65 is stale … expected «… 288», found «… 192»` |
| **F5 P1–P4** | the four historical instances rebuilt **in the prose, markers untouched** | 0 | **0** | `OK` — unchanged, and deliberately so: this is F5's structural half, deferred |

**How F7 was fixed, and why the kind was kept.** The plan offered retiring `sweep-counts`; it was
**hardened instead**. Retiring it is the smaller surface, but it moves three counts the artefacts
already quote out of any check that points at them and into a table nobody is obliged to read, and
the DoD's alternative — «show that removing the collapse dimension is caught by that other thing» —
would then be satisfied only by table staleness, with no message naming `test-plan.md:181`. What the
kind does now: it locates each loop by its `it()` **title**, walks the block, resolves every
`for (const x of y)` to its iterable (an inline literal, or a `const` array in the same file), and
multiplies. Nothing about the shape is written in the verifier — the `× 2`, the `× 4` and the
zero-file subset's independence from `fileCounts` are gone; the zero subset is the same product with
the `fileCount` dimension cut to the entries that equal `0`. A renamed test, a counting
`for (let …;…)` loop it cannot size, or an iterable that is not an array each fail loudly instead of
defaulting.

**F9 — nothing is discarded any more.** Per-kind key sets: an unknown key, a key given twice, a
non-numeric value, a `collapsed=` that is not `true`/`false`, an unknown density inside `expect=`, a
missing density inside `expect=`, and a density that is not shipped all fail with the site and the
key. `fileCount=` on `share` and `font=` on `cap` are **honoured**, so the empty-list branch
(AC-04 / AC-05) and the worst reachable share are now expressible. The two defaults that remain
(`fileCount=30`, `font=13`) are printed on every run with a count — `12 share marker(s) checked at 30
files, 2 cap marker(s) at 13 px` — because the defect was never the default, it was the silence.

### The 24 malformed-marker attacks, re-run

**On the count, first.** The review's O12 says «24 malformed-marker attacks». The record **enumerates
22**: A1–A18 in stage 2 §2a and A19–A22 in §2f. Rather than report a number the evidence does not
carry, all 22 were re-run **and two more were defined and named** — A23 and A24, covering the class
the hardening opens (a key the kind does not use; an `expect=` missing a density, the path where
`checked += 1` used to run before the `undefined` test). 24 attacks, every one identified.

| # | attack | pre | post | outcome |
|---|---|---|---|---|
| A1 | `density=cmopact` | 1 | **1** | fires — the density is not shipped (was `computed NaN`) |
| A2 | `expect=` removed | 1 | **1** | fires — `the argument expect= is missing` |
| A3 | key mis-typed `expectt=` | 1 | **1** | fires — `unknown argument expectt=` |
| A4 | unknown kind `figure: shares` | 1 | **1** | fires — `unknown figure kind` |
| **A5** | **`<!--figure:` no space** | **0** | **1** | **now fires** — marker-shaped text unmatched, and inventory 18 → 17 |
| **A6** | **`<!-- Figure:` capitalised** | **0** | **1** | **now fires** — the same |
| A7 | duplicated `density=` | 1 | **1** | fires — `the argument density is given twice` (was «last wins»: loud, but about the wrong density) |
| A8 | value drifted `0.754545` → `0.764545` | 1 | **1** | fires |
| A9 | bare flag `collapsed` | 1 | **1** | fires — `«collapsed» is not a key=value argument` |
| **A10** | **`share … fileCount=0`** | **0** | **1** | **now honoured**: computed `0.236364` against the claimed `0.754545` |
| **A11** | **`cap … expect=…,bogus:999`** | **0** | **1** | **now fires** — `expect= carries an unknown key bogus` |
| A12 | duplicated density key in `expect=` | 1 | **1** | fires — `expect= gives comfortable twice` |
| **A13** | **`cap font=17 …`** | **0** | **1** | **now honoured**: 31 / 39 / 48 against the claimed 36 / 34 / 43 |
| A14 | non-numeric `comfortable:abc` | 1 | **1** | fires — `expect= gives comfortable=abc, which is not a number` |
| A15 | `sweep-counts spec=` a nonexistent path | 1 | **1** | fires — ENOENT |
| A16 | `sweep-counts spec=package.json` | 1 | **1** | fires — `no test titled «keeps the list at or over its share…»` |
| A17 | a **correct** marker inside a fenced block | 0 | **0** | **intentional pass, now for the right reason**: fenced blocks are blanked, so it is no longer counted as a check and no longer inflates the count (markers stay 23; they went 23 → 24 before) |
| A18 | a **wrong** marker inside a fenced block | 1 | **0** | **intentional change**: an example of a drift inside a fence no longer breaks CI. Round-17 O6 flagged the old behaviour in both directions; a marker inside a fence is documentation, not a claim, and the header's «do not quote the delimiters inline» convention is now enforced by the scanner instead of by discipline |
| **A19** | **reflowed across two lines** | **0** | **1** | **now fires** — unmatched marker-shaped text, and the inventory |
| **A20** | **reflowed and wrong** | **0** | **1** | **now fires** — the same |
| **A21** | **deleted outright** | **0** | **1** | **now fires** — `the pinned inventory says 18 … a check was deleted` |
| A22 | marker moved to an unrelated line at EOF | 0 | **0** | **justified pass**: the marker still exists and its value is still correct; only a marker↔prose binding could object — F5, deferred |
| **A23** | **`token … remainder=110`**, a key the kind does not use | **0** | **1** | **now fires** — `unknown argument remainder= — the kind uses font, metric, expect` |
| A24 | `token expect=` missing `comfortable` | 1 | **1** | fires — `expect= has no expectation for comfortable`, and `values recomputed` drops 45 → 42 instead of counting three comparisons it never made (round-17 O7) |

Twenty-one of the 24 fail; three pass by construction (A17, A18, A22) with the reason stated; and the
four the DoD singled out — A5, A6, A10, A13 — now fail or are honoured. Every one was applied to
`test-plan.md`, run, restored, and its md5 re-verified against `63dd1fdf77283b4cd4e7bc1f9a0b8554`.

### The module direction — preserved and re-measured

| drift | figures named, round 17 | figures named now |
|---|---|---|
| `appearance-metrics.ts` `PAD.fileRow` 15 → 20 | 14 | **15** |
| `appearance-metrics.ts` `TEXT_LINE_RATIO` 1.15 → 1.4 | 39 | **40** |
| `inspector-layout.ts` `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 | 3 | **4** |
| `inspector-layout.ts` head-cap guard dropped | 10 | **11** |
| `inspector-layout.ts` `LIST_ROWS_FLOOR` 2 → 3 | 5 | **6** |

Each names at least as many as before — exactly one more in every case, and the extra is always the
generated reference table going stale in the same run, which is the D3 artefact doing its job. Every
message still carries `file:line`, the claim and the computed value, e.g.
`test-plan.md:43  cap relaxed/13 r=110 collapsed=false files=30: artefact says 43, computed -7`. All
five were logged before applying, restored, and md5-verified.

### D3's generated reference table

`docs/features/inspector-diff-workspace/reference-figures.md`, produced by the same script
(`pnpm figures:write`) from `computeMetrics` and `computeInspectorLayout`, and **byte-compared** by
`pnpm check:figures` — a stale checked-in copy fails with the first divergent line quoted (D3a, D3b
above). It carries the density tokens, the header cap and list share at the three remainders the
criteria measure, the carve-out's measured top per density and collapse state (the floors read out of
`inspector-layout.ts` rather than restated here), the sweep configuration counts beside the dimensions
they came from, and the **pinned marker inventory** that makes a deleted marker loud. It is the only
place on the branch where a concrete derived figure is written and not re-derived on every run, which
is what D3 asks for.

One property to know before the next wave: the inventory is a **pin**, so adding or removing a marker
takes a deliberate `pnpm figures:write` that shows up in the diff. That is the mechanism, not a side
effect — the alternative was a magic number inside the script, and this one is reviewable.

### Deferred, and where it is recorded

F5's structural half — binding a marker to the figure in its prose — is in **`spec.md` §8**, owner
**Jhoan Moreno**, due **before the next review round, as its own spec**, with the four reconstructions
that pass today named by their finding ids rather than by their figures (D3). It is a prose parser and
does not belong inside a review wave. The gate says so in its docblock, in `test-plan.md:213` and on
every run.

### DoD bullets that could not be satisfied as written: five, named

1. «`git diff --name-only HEAD -- src` **is what T68 and T69 left**.» **Not verifiable here.** T68 and
   T69 are lane A, in a different worktree (`C:\wt\r17a`); this lane never sees their output. What was
   verified is the equivalent available: `src` is byte-identical to this tree's entry state — the same
   seven modified files, the four production md5s and `inspector-layout.spec.ts` all unchanged.
2. «**All five production md5s** unchanged.» The lane was given **four**. All four are unchanged; the
   fifth named above is `inspector-layout.spec.ts`, the file F7's two shape drifts mutated, restored
   and re-verified. If the intended fifth was `main-content.ts`, this task never touched it.
3. «**The 24 malformed-marker attacks stage 2 ran.**» The record enumerates **22**. All 22 were re-run;
   A23 and A24 are this task's own additions, defined above, to reach 24 with every case identified.
   The «24» in the review's O12 is itself an unenumerated figure — flagged for T71, which owns that
   record.
4. «**No sentence in the tree claims the marker checks the prose figure.**» True of every live
   artefact: `grep` over the tree finds the sentence only where it is quoted **as a defect** (this
   task's `## Why`, the round-17 review). One dated record still asserts it —
   `tasks/round16-figure-gate.md:164-165`, T65's own Outcome. That file is T71's surface, and T71's
   plan item 3 covers its «45 of 45» but **not** this sentence: **named here so the wave does not stop
   one artefact short again.** T71 should also take the coverage replacement from this Outcome — `36`
   visible figures, `15` unbound, with the definition above.
5. «**The CI step.**» **Unexercisable** — nothing is pushed from this branch, so «a drifted figure
   fails the workflow» cannot be shown. What was exercised is the exact command CI runs
   (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-figures.mjs`), locally: **50
   invocations** in the attack harness (2 baselines plus 24 attacks against each of the two gates) and
   **16** in the drift harness (4 loop-shape, 5 module, 1 scope, 2 staleness, 4 prose), plus the
   baseline and post-edit runs by hand. T65 disclosed the same limit; this adds nothing to that claim.

**Scope held.** The hardening stays inside this feature's figure gate. It reads `git` for its scope
now, which makes it look repo-shaped, but it still knows only this feature's markers and this
feature's two modules; generalising it into a docs linter belongs in its own spec, as T65 recorded.
