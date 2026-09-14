---
id: T78
title: "Round-19 records: the gate output no commit can print, the rung CI does not use, and five observations"
layer: "docs"
deps: ["T77"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/round16-records.md",
  "docs/features/inspector-diff-workspace/tasks/round17-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round17-test-coverage.md",
  "docs/features/inspector-diff-workspace/tasks/round17-gate-hardening.md",
  "docs/features/inspector-diff-workspace/tasks/round17-records.md",
  "docs/features/inspector-diff-workspace/tasks/round18-gate-and-ci.md",
  "docs/features/inspector-diff-workspace/tasks/round18-d3-migration.md",
  "docs/features/inspector-diff-workspace/tasks/round18-records-and-graph.md",
  "DESIGN.md",
  "src/app/features/commit-inspector/commit-inspector.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T78 — Round-19 records

## Why

**R19-F7**, **R19-F8** and observations **O9**, **O10**, **O12**, **O13**, **O15** of
`_review/review-2026-09-11.md`.

**F7** is the fourth consecutive round of the same class: a record quoting a gate output the delivered tree
cannot produce. Round 18 blocked on it and routed the fix to T74; T74 restated the two bullets to
`23 markers / 45 values` and `coverage: 36 / 15` — figures T73 had already retired **in the same
uncommitted tree**, and which T74's own Gate section reports correctly as `2 markers / 6 values` and
`coverage: 1 / 1`. The wave measured the truth in one artefact and wrote something else into the
artefact it was correcting.

**F8**: the docblock and T72's Outcome both say «rung 1 is what CI will actually use», and on the
trigger the finding was written about — a pull request — it is not.

## Plan

1. Establish, by running it, what any commit actually prints, so the correction rests on a
   measurement rather than on the reasoning that a one-commit wave has no intermediate trees.
   → verify: the command's output.
2. Date every address of the class, including the four round 18 did not route. → verify: a grep for
   the retired figures returns only marked occurrences.
3. Correct the rung-1 claim in T72's Outcome; the docblock half was closed by T75. → verify: no live
   sentence asserts it.
4. O9, O10, O12, O13. O15 judged and named either way. → verify: each is either edited or declined
   **in writing**.

## Definition of Done

- Every stale quotation carries a dated marker naming what the tree prints instead.
- No record is deleted: a dated record of what a wave measured stays, per T67's D4 rule.
- Any routed observation not closed is declined explicitly, with its reason.
- `pnpm check:figures`, `pnpm check:tasks`, `pnpm test`, `pnpm lint` and the Rust half: green.

## Outcome (2026-09-13)

Landed.

**This task changed one file under `src/`** — a comment, O13 — so four of the five production md5s
are unchanged and `commit-inspector.ts` is now `776999a9c7f343600efa50837fbf0ccb` where round 18
recorded `44f017a4c415d7a1c001f7e0362d6a9c`. Stated here rather than left for the next reviewer to
find as a surprise: the md5 list is a tracking device, and a wave that moves one owes the new value.

### F7 — the measurement that settles it

The correction does not rest on reasoning about uncommitted trees. A worktree was checked out at
**`2db0519`**, the single commit that carries T40–T74, and the gate run there:

```
figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed
coverage: 1 figure(s) the heuristic can see in live prose, 1 of them on a line carrying fewer markers than figures
OK — every marked figure matches the shipped modules, and no check went missing.
```

**No commit in this repository prints `23 markers / 45 values` or `coverage: 36 / 15`,** and none ever
will: T73's D3 migration retired 21 of the 23 markers inside the same uncommitted tree that carried
them, and the whole wave landed as one commit. «The tree this wave delivered» named a tree that never
existed, which is precisely why the phrase is the defect and not the figures.

**Eleven addresses dated** — the three round 19 routed, the four it named as unrouted, and **four
more this task found**:

| file | what it quotes | routed? |
|---|---|---|
| `round17-code-fixes.md` | T74's restatement of the bullet | R19-F7 |
| `round17-test-coverage.md` | T74's restatement of the bullet | R19-F7 |
| `round18-gate-and-ci.md` | T72's own Gate block, «quoted as the command prints it» | R19-F7 |
| `round17-records.md` | the Gate table row | named, unrouted |
| `round17-gate-hardening.md` ×2 | the pasted run, and «23 markers, 45 values, exit 0» | named, unrouted |
| `round16-records.md` | «23 markers, 45 values, 1 unmarked» | named, unrouted |
| `round16-figure-gate.md:116` | **«Current state: 23 markers, 45 values checked, 1 figure unmarked.»** | **found here** |
| `round16-figure-gate.md:145` | **«As the tree stands: 36 figures … 15 of them …»** | **found here** |
| `round17-records.md:171` | **«As the tree stands: 36 figures …»** | **found here** |
| `round18-records-and-graph.md:165` | **«the delivered gate printed …»** | **found here** |

**The four this task found are the worst of the eleven**, and round 19 missed them: they are the only
ones written in the **present tense**. «Current state:» and «As the tree stands:» are not a record of
what a wave measured on its date — they are assertions about the reader's tree, and every one of them
is false on it. The seven the review named are past-tense quotations, which is the milder half of the
class.

How they were found, so the next round can repeat it rather than re-derive it: a sweep for the
retired figures **intersected with present-tense phrasings** (`Current state`, `As the tree stands`,
`the delivered gate printed`, `On the tree this wave delivered`), then an adjacency check asking
whether a `superseded`/`restated` marker follows within eight lines. The first version of that check
blanked comments and reported all eleven as still live — a false positive of its own definition,
because a marker placed *beside* a sentence leaves the sentence visible, which is exactly what D4
requires. The adjacency form reports **4 marked, 0 unmarked**.

Every one keeps its sentence. A record of what a wave measured on its own date is the history it is,
and deleting it deletes the finding's substance — T67's D4 rule, applied here rather than quoted.
What each gains is a marker naming the commit, the command and the output, so a reader who runs it
and gets something else knows why within one line.

### F8 — the rung CI does not use

`round18-gate-and-ci.md`'s «rung 1 is what CI will actually use» is corrected in place. On a
`pull_request` `actions/checkout` checks the merge commit out **detached** and creates no local
`main`, so `fetch-depth: 0` yields `origin/main` and **rung 2** fires; rung 1 fires on a `push` to
`main`, where the diff is empty and the run widens anyway. The marker also records that T75 removed
the `HEAD~` rung the sentence's «wider rungs» referred to, so a reader is not left looking for a rung
that no longer exists.

### The observations

- **O9 closed.** `round18-d3-migration.md` read «the eight artefacts D3 names plus both ADRs — 11
  files», and 8 + 2 is not 11. The total was right under the reading «seven named files + the four
  ADRs the eighth entry covers»; the sentence now says that. There are four ADRs, not two.
- **O10 closed.** `DESIGN.md`'s «**Each** is `round(textRatio × typeSize + PAD.<surface> ×
  densityScale)`» is not true of `--panel-pad`, which `appearance-metrics.ts` computes as
  `Math.round(PAD.panel * padScale)` with no text term. The exception is now named in the prose, not
  only in the table cell above it.
- **O12 closed.** The O3 and O4 counts in `round18-records-and-graph.md` now carry the commands that
  produced them. Both are scope-sensitive — round 19's stage 1 re-ran them over its own scope and got
  different numbers, which is a reproduction problem and not a discrepancy. A count quoted without
  its command can only be believed.
- **O13 closed, after five waves unrouted.** `commit-inspector.ts`'s guard comment folded two
  different failures into one parenthetical. They are distinct: an absent body makes `lineH` measure
  **0**, so `(headerAllowance − headerFixedH) / lineH` is **Infinity** — or NaN in the single case
  where the numerator is also 0 — while jsdom resolving `line-height: normal` makes `lineH` **NaN
  outright**, which propagates whatever the numerator. One guard covers both; the comment now says so.
  Round-16 O2 recorded this for the first time and four waves passed it over, each because the file
  was «not this task's surface».
- **O15 declined, and here is the reason.** The `files_hint` divergence message prints both lists in
  full where the reader wants the element that differs. Closing it means a set-difference helper and
  a longer message for a case that has occurred **zero** times on this branch — the two live
  divergences T75 found were in `acs`, and its message names the lists because the lists are short.
  It is cosmetic, it is in a gate that now has a suite, and it is cheaper to leave than to carry the
  helper. Recorded as declined rather than silently skipped.

### Gate

- `pnpm test` — **866 passed (866)**, 64 files. Re-run after the `src/` comment change, not before.
- `pnpm lint` — clean over **269** files.
- `pnpm check:figures` — exit **0**, `2 markers in 1 file(s), 2 distinct claims, 6 values recomputed`,
  `coverage: 1 … 1`.
- `pnpm check:tasks` — exit **0** once T77 and T78 are registered. It caught their absence while this
  task was being written, which is the first time the registry gate has found something before a
  reviewer did.
- Rust half: `cargo test` **388 passed**, clippy and `fmt --check` clean.
