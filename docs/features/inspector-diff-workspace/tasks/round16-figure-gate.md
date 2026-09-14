---
id: T65
title: "Round-16 figure gate: recompute every figure the artefacts quote from the generator and the shipped policy, and fail on drift"
layer: "infra"
deps: ["T63", "T64"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "scripts/check-figures.mjs",
  "package.json",
  ".github/workflows/ci.yml",
  "docs/features/inspector-diff-workspace/test-plan.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T65 — Round-16 figure gate

## Why

**The owner decision of 2026-09-10** (`_review/review-2026-09-10.md`, Verdict): after five
consecutive rounds in which a prose sweep found real carriers and still stopped one artefact short,
the strategy changes. T63 and T64 remove most of the figures by replacing them with closed forms;
this task catches whatever remains, mechanically, in the gate.

**The class this closes has recurred for six rounds and every instance is the same shape** — an
artefact quotes a number derived from code, the code moves, and nothing notices:

| round | the figure | what moved |
|---|---|---|
| R10-S1-F10 | «144 configurations» | 24 of them asserted nothing |
| round-11 O9 | the same count | the sweep's shape |
| R13 | «the 126 px figure» | the fixture |
| R15-S1-F2 | «30 px and 30 px at compact» | no density ever produced it |
| R15-S1-F1 | «68 / 60 px expanded, 136 / 120 collapsed» | derived at the fixtures, not the generator |
| **R16-S1-F3** | «192 / 384 / 32» | **T61 widened `DENSITIES` after T59 wrote them** |

R16-S1-F3 is the proof that a sweep cannot fix this: T59 swept 171 files *by meaning*, found the AC-02
carrier four waves had missed, and was still falsified inside the same wave by a task that ran after
it. A human sweep is a snapshot; the figures move on the next commit.

**A verifier is cheap because both sides are already pure.** `computeMetrics`
(`appearance-metrics.ts`) and `computeInspectorLayout` (`inspector-layout.ts`) are pure TypeScript
with no DOM and no Angular import — ADR-0004's whole point. A script can import them, recompute every
figure, and diff against what the artefacts claim.

## Plan

1. **A machine-readable claim block.** Each surviving figure in an artefact carries a marker naming
   what it is and how to derive it, e.g.
   `<!-- figure: share density=compact font=13 remainder=110 collapsed=true expect=0.754545 -->`.
   The script parses these; a figure with no marker is not checked, so the script also **reports how
   many figures it found and how many it could check**, and that ratio is the honest coverage number.
2. **`scripts/check-figures.mjs`** — imports the two pure modules, evaluates every claim, and exits
   non-zero on the first mismatch with `file:line`, the claimed value and the computed one. No
   network, no DOM, no test runner.
3. **Wire it into the gate**: a `check:figures` script in `package.json`, run by `pnpm lint`'s lane in
   `.github/workflows/ci.yml` (or its own step — it is not a lint), and named in `test-plan.md`'s
   CI-placement section so the row that quotes a figure says what checks it.
4. **Prove it catches the six historical instances.** For each row of the table above, reconstruct the
   claim as it was written, run the script, and confirm it fails. A verifier that would not have
   caught R16-S1-F3 is not done.
5. **Cover the counts too, not only the shares.** `DENSITIES.length × heights.length ×
   fileCounts.length × 2` is a figure like any other; if T63 left any count concrete, the script
   recomputes it by importing the spec's own arrays.

## Definition of Done

- [ ] `pnpm check:figures` exits **0** on the tree T63 and T64 leave, and its output states **how many
      figures it found, how many it checked, and how many it could not check for want of a marker**.
- [ ] **It fails on each of the six historical instances**, reconstructed one at a time. Report each
      as `instance · the claim as written · the script's message`. This is the bullet that decides
      whether the task worked.
- [ ] It fails when a **generator constant** moves: run `PAD.fileRow` 15 → 20 and confirm non-zero
      exit with the drifted figure named. Restore and re-confirm 0.
- [ ] It fails when a **policy constant** moves: run `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 likewise.
- [ ] The script imports the shipped modules rather than re-implementing them: `grep -n "Math.max\|
      Math.floor\|0\.75\|panelHeadH \*" scripts/check-figures.mjs` shows no re-derivation of the
      policy's arithmetic. A verifier that reimplements the thing it verifies certifies itself.
- [ ] It is in the gate: `pnpm check:figures` runs in CI, and a deliberately drifted figure pushed to
      a scratch branch fails the workflow. If CI cannot be exercised, say so and state what was run
      locally instead.
- [ ] Marker coverage is stated as a number, not as «all»: how many figures across the live artefacts
      carry a checkable marker after T63, and which files still hold unmarked ones.
- [ ] No `src/` change: `git diff --name-only HEAD -- src` is what T64 left.
- [ ] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason.

## Notes

`deps: [T63, T64]`: the script verifies the figures those two leave behind, so it must be written
against the final set, not the current one.

**Scope discipline.** This is a verifier for *this feature's* figures. Do not generalise it into a
docs linter for the repo; ADR-worthy scope creep on an infra task is how a gate becomes unmaintained.
If the shape turns out to be reusable, say so in the Outcome and leave the generalisation to its own
spec.

**The honest failure mode to disclose.** A marker-based verifier only checks what is marked, so it
converts «a figure nobody re-derived» into «a figure nobody marked». That is a real weakening and it
must be stated, with the marker-coverage number, rather than sold as full coverage. It is still
strictly better than a sweep, because coverage becomes a measurable number instead of a claim.

## Outcome (2026-09-10)

Landed. `scripts/check-figures.mjs` (new), `package.json`, `.github/workflows/ci.yml`,
`test-plan.md`'s CI-placement section. No `src/` change.

**It imports the shipped modules; there is no build step.** Node 24 strips TypeScript types natively,
so a plain `.mjs` can `import { computeMetrics } from '../src/app/core/services/appearance-metrics.ts'`
and get the arithmetic the app runs. Verified by probe before any of the script was written — that
import working is the whole reason this design is cheap. `grep -nE "Math\.max|Math\.floor|0\.75|
panelHeadH \*|LIST_SHARE" scripts/check-figures.mjs` returns **nothing**: the verifier re-derives no
policy arithmetic, which is what keeps it from certifying itself.

**Current state: 23 markers, 45 values checked, 1 figure unmarked.**

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7, found by this task rather
than routed to it): this is a PRESENT-TENSE claim about a tree that no longer exists. No commit in
this repository prints these figures — measured at `2db0519`, the one commit carrying T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`.
T70 deleted the `unmarked` output outright (R17-F8) and T73's D3 migration retired 21 of the 23
markers. Kept as the dated record it is; see `round19-records.md` -->

```
$ pnpm check:figures
figures: 23 markers, 45 values checked, 1 unmarked
  unmarked at: DESIGN.md:73
OK — every marked figure matches the shipped modules.
```

The one unmarked hit is `DESIGN.md`'s `fontSize: 0.875rem` inside a type-scale code block — a
heuristic false positive, not a policy-derived figure.

<!-- coverage claim corrected 2026-09-10 (T71, review round 17 R17-F8): this read «So **marker
coverage of derived figures is 45 of 45**, and the honest coverage number is that plus the standing
limit below». It was not a ratio. **45 counted VALUES and 1 counted LINES**, and one marker exempted
its whole line, so a row with one marker and eight derived figures reported zero unmarked. Measured
by round 17's stage 2: 34 of the 35 heuristic-visible figures in live prose sat on lines the gate
reported as `0 unmarked`. `45` was itself inflated — the 23 markers carry **10 distinct claims** and
22 distinct computed values, one claim being placed five times.

What T70 measures instead, with its definition, which is the part that was missing:
`unbound(line) = max(0, heuristic-visible figures in that line's prose − strict markers on that
line)`. Both sides are **occurrences**. As the tree stands: **36 figures the heuristic can see in
live prose, 15 of them on a line carrying fewer markers than figures**, and the gate prints the
sites. On `test-plan.md:43` — stage 2's proof point — that is 6 figures against 3 markers, so 3
unbound, where this claim reported 0.

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7, found by this task): the
same present-tense class as `:116` above, eleven lines on. The coverage pair T70 defined here is
`1 / 1` on every commit that carries this wave, because T73's D3 migration moved the prose the
heuristic was counting. Kept as the record of what T70 measured on its own date -->

`15` means «fifteen visible figures sit on a line with fewer markers than figures». It does **not**
say which, because nothing binds a marker to the figure beside it — that is R17-F5's structural half,
deliberately deferred to its own spec (spec §8, owner Jhoan Moreno). The gate now says so in its own
output rather than in a docblock, and it names the heuristic's blind spots there too. -->


**It fails on each of the six historical instances, reconstructed one at a time**, each injected,
measured, and the file restored with its md5 re-checked (`5a579b737b3c6e2d07c7394844725a88`):

| instance | the claim as written | the script's message |
|---|---|---|
| **R10-S1-F10** / round-11 **O9** | `expect=share:144,cap:288,zerofile:24` | `sweep-counts share: artefact says 144, computed 288 (DENSITIES 3 x heights 8 x fileCounts 6)` |
| **R13** «the 126 px figure» | `expect=compact:126,comfortable:126,relaxed:126` | `cap compact r=110 collapsed=true: artefact says 126, computed 27` |
| **R15-S1-F2** «30 px and 30 px at compact» | `metric=panel-head-h expect=compact:30,…` | `token panel-head-h compact/13: artefact says 30, computed 26` |
| **R15-S1-F1** the fixture-derived band | `share density=compact … expect=0.727273` | `share compact/13 r=110 collapsed=true: artefact says 0.727273, computed 0.754545` |
| **R16-S1-F3** «192 / 384 / 32» | `expect=share:192,cap:384,zerofile:32` | `sweep-counts share: artefact says 192, computed 288 (…)` |
| **control** — a correct claim | `share … expect=0.754545` | exit **0**, no output |

All five reconstructions exit 1 and the control exits 0. **One honest caveat on that table:** R15-S1-F1
was a statement about a *band* («a remainder under 68 px / 136 px»), and a band is not directly
expressible in this schema. What the row above reconstructs is its measurable **consequence** — the
share that band's fixture implied at a reachable remainder. The band's own wording is now a closed
form in the artefacts (T63) rather than a number, so there is nothing left for the script to check
there; if a future wave writes a band back as figures, the schema needs a `band` kind.

**It fails when a constant moves, in either direction of the dependency.** Both logged before
applying, both restored with the md5 re-checked and the checker re-run to exit 0:

| mutation | figures reported as drifted | example |
|---|---|---|
| generator — `appearance-metrics.ts` `PAD.fileRow` 15 → 20 | **14** | `screens.md:23 token file-row-h compact/13: artefact says 24, computed 27` · `test-plan.md:43 cap compact r=110 collapsed=false: artefact says 36, computed 30` |
| policy — `inspector-layout.ts` `COLLAPSED_LIST_SHARE_FLOOR` 0.75 → 0.5 | **3** | `test-plan.md:90 share compact/13 r=110 collapsed=true: artefact says 0.754545, computed 0.672727` |

**Density values in a marker are NAMED, never positional.** The first markers T63 placed used
positional triples (`expect=34/36/43`) and were normalised before the script was written, because a
positional triple is the same ambiguity that produced the figures the script exists to catch — nothing
in `34/36/43` says which density is which, and the artefacts around them are inconsistent about the
order (`screens.md` writes comfortable first, `test-plan.md` compact first).

**Wired into the gate as its own step**, after Lint and before the unit tests, because it is not a
lint: `pnpm check:figures` in `package.json`, and «Figure drift check» in `.github/workflows/ci.yml`.
`test-plan.md`'s CI-placement section now says that when a row quotes a derived figure, its marker is
what checks it.
<!-- dated 2026-09-10 (T74, review round 18 R18-F6): the sentence above is T65's record of what it
wrote and it stays, but «now says» is a claim about the LIVE `test-plan.md`, and that file says the
opposite today — «What a marker checks is the marker — the script never reads the prose beside it»
(R17-F5's claims half, corrected by T70). T70 named this leftover for T71 by file and line, with the
words «so the wave does not stop one artefact short again», and T71 edited this very file for its
«45 of 45» and did not take it. T67's own D4 rule draws the line here: a record is not rewritten when
it describes past work, but IS rewritten when it asserts a live invariant. This marker dates the
claim rather than deleting the record. -->

**The gate caught a defect in this task's own edit, within the hour.** The CI-placement note quoted
the marker syntax inline as an example; the scanner cannot tell an example from a real marker and
failed with `test-plan.md:185 unknown figure kind: …`. Fixed by referring to «a `figure:` marker
comment» instead, and the convention is now recorded in the script's header. Reported because a gate
that fires on its author's first commit is the only evidence that it fires at all.

**DoD bullets that could not be satisfied as written: two, named.**

1. «It is in the gate: a deliberately drifted figure pushed to a scratch branch fails the workflow.»
   **Not run.** Nothing was pushed — this branch commits nothing, per the standing rule that the owner
   commits. What was exercised instead is the same command CI runs (`pnpm check:figures`), locally,
   against five reconstructed drifts and two constant mutations. The CI step itself is unexercised
   until the first push.
2. «Marker coverage is stated as a number … and which files still hold unmarked ones.» Stated, but the
   number is coverage of *figures the heuristic recognises*, not of every figure. The heuristic is a
   share-shaped decimal or an `a / b` pixel pair; a figure written any other way (a bare `34 px`, a
   percentage, a count in words) is invisible to both the checker and the coverage number. That is the
   standing limit of a marker-based check and it is the price of the design: it converts «a figure
   nobody re-derived» into «a figure nobody marked», which is strictly better only because the second
   is measurable.

**Scope held.** The script checks *this feature's* figures and is not a docs linter for the repo. The
shape looks reusable — any pure module plus any artefact quoting its outputs — but generalising it
belongs in its own spec, not in an infra task of a review wave.
