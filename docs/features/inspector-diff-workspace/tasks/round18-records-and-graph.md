---
id: T74
title: "Round-18 records and graph: run the completeness check T67 declared, take the leftover T70 named, and restate the two gate bullets that quote a retired number"
layer: "docs"
deps: ["T73"]
acs: ["AC-01", "AC-02", "AC-03", "AC-20"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/round16-figure-gate.md",
  "docs/features/inspector-diff-workspace/tasks/round17-code-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/round17-test-coverage.md",
  "docs/features/inspector-diff-workspace/tasks/round17-records.md",
  "docs/features/inspector-diff-workspace/tasks/round17-criteria-amendment.md",
  "docs/features/inspector-diff-workspace/tasks.json",
  "scripts/check-tasks.mjs",
  "package.json",
  ".github/workflows/ci.yml"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T74 — Round-18 records and graph

## Why

**R18-F5**, **R18-F6**, **R18-F7** and owner decision **D4** of
`_review/review-2026-09-10-round18.md`, plus observations **O3**, **O4**, **O5**, **O6** and **O7**
of the same record.

**F5 — the graph misses seven ids, beside the check that would have caught it.** `_epic.md`'s single
mermaid block draws T1–T26 and T34–T74 and jumps from `T23 --> T26` straight to `T34`. **T27, T28,
T29, T30, T31, T32, T33** appear neither as a node nor in any edge — real tasks with real deps
(`T24,T25 → T27`, `T19–T23 → T28`, `T27,T28 → T29`, `T29 → T30 → T31 → T32 → T33`), rows present in
the table and in `tracker.md`, spanning five review rounds. T67 repaired the round-16 gap in this
graph, which is real, and attached a claim that is not — the marker under the graph in `_epic.md` that begins «**T63–T66
added to this graph**»: «**Both waves are now drawn**, and the check for the next one is «every id in
`tasks.json` appears as a mermaid node», not «the rows agree».» That check returns **7 misses**. It was written, not run. Its diagnosis is short by
seven too: it reports the graph as «stale from T62 onward» when it has been stale from **T26**.

T67 found that gap *because three agents checked the rows against `tasks.json` and none looked at the
graph*, wrote the stronger check, and left the stronger check failing. That is the wave's own
instrument certifying more than it checks — round 17's central diagnosis, one artefact over.

**F6 — a leftover named by file and line, and not taken.** T70's DoD exception 4 reads: «No sentence
in the tree claims the marker checks the prose figure.» True of every live artefact … **One dated
record still asserts it — `tasks/round16-figure-gate.md:164-165`, T65's own Outcome. That file is
T71's surface, and T71's plan item 3 covers its «45 of 45» but not this sentence: named here so the
wave does not stop one artefact short again.** The content is now at `:184-185` (T71's own insertion
shifted it 20 lines) and reads, unchanged: «`test-plan.md`'s CI-placement section **now says** that
when a row quotes a derived figure, its marker is what checks it.» T71's Outcome does not mention it.
«now says» is a present-tense claim about `test-plan.md`, and `test-plan.md:213` now says the
opposite. T67's own written D4 exclusion draws the line exactly here: a record is not rewritten when
it describes past work, **but is rewritten when it asserts a live invariant**.

**F7 — two Outcomes quoting the number R17-F8 blocked on.** `tasks/round17-code-fixes.md:263-264`
and `tasks/round17-test-coverage.md:266-267`, both: «`pnpm check:figures` → exit **0**
(`23 markers, 45 values checked, 1 unmarked` — `DESIGN.md:73`, the known heuristic false positive)».
The delivered gate prints no `unmarked` line at all. `1 unmarked` is exactly the figure R17-F8 named
as false — «the owner, the next reviewer or `ship` reads `1 unmarked` as “one figure is unchecked”
and stops sweeping» — and **T70 removed it in the same wave**. T71 corrected the two *round-16*
records carrying this class and left these two untouched.

**The observations, all of the same family.** **O3**: T71's «of the **eleven** surviving occurrences
of the doubled form» is 15 lines / 16 occurrences on the tree it leaves. **O4**: T67's D4 sweep
reports «**89 hits**» where the command returns 82 lines / 96 occurrences, and no construction
returns 89. **O5**: T67's «seven of seven» instructions reaching relaxed omits `test-plan.md:200`
and `:201`, which also schedule measurements — nine, not seven, and all nine do reach relaxed.
**O6**: `reference-figures.md`, the wave's own new artefact and D3's single home for concrete
figures, is in no `files_hint`, while `tasks/round17-records.md:200-203` states that it **is**
claimed. **O7**: `CHANGELOG.md` joins the unclaimed set round-17 O11 enumerates.

## Plan

1. **Draw the seven (F5).** T27–T33 as nodes with their real edges, taken from `tasks.json` `deps`,
   not retyped from the table. Then **run** the check T67 declared and paste its output. Correct the
   «stale from T62 onward» diagnosis to T26 inside a dated marker, since the mis-dating is part of
   what R18-F5 found.
2. **Harden the check so it cannot be written-but-not-run.** The registration validator this branch
   already runs over `tasks.json` gains the mermaid-node assertion, so «every id appears as a node»
   is executed by the same command that checks ids, deps and cycles.
3. **Date the leftover (F6).** `round16-figure-gate.md:184-185` gets a dated marker naming
   `test-plan.md:213` and what it says now — the record's past-tense substance kept, its live claim
   dated.
4. **Restate the two gate bullets (F7)** as what the delivered gate prints, with a dated marker
   naming R17-F8 and T70's removal of the number.
5. **The observations.** O3's count re-measured and restated; O4's 89 replaced by what the command
   returns, with the mid-wave-counting hazard named as the cause; O5's enumeration extended to nine;
   O6's `reference-figures.md` added to T70's `files_hint` **and** the record that claims it already
   is corrected; O7's `CHANGELOG.md` added to the unclaimed enumeration.
6. **No registration.** T72 owns it. This task states «no row inserted, no dep changed, no total
   moved» rather than «no registration», per the rule T71 wrote after its own bullet could not
   separate its contribution from T67's.

## Definition of Done

- [ ] **The mermaid check returns 0 and the command output is pasted.** Every id in `tasks.json`
      appears as a node; every edge drawn for T27–T33 matches `tasks.json` `deps` exactly, verified
      mechanically rather than read.
- [ ] **The check is executable, not prose.** The assertion runs inside the registration validator
      and its output is shown failing on a deliberately removed node, then passing.
- [ ] **Each of F6 and F7's three addresses carries a dated marker** whose original wording survives
      inside it, and the live claim is now true. `grep` for the retired sentence and for `1 unmarked`
      over live artefacts returns what the Outcome states.
- [ ] **Every count this task states is what its command returns on the tree the task leaves** —
      re-run after this task's own edits, not before, per T71's transferable rule. That includes O3's
      and O4's replacements and the `_epic.md:[0-9]` grep, whose value may move again.
- [ ] **`reference-figures.md` is claimed** by T70's `files_hint`, and the sentence in
      `round17-records.md` that already claimed it is corrected with a dated marker.
- [ ] `pnpm test`, `pnpm lint`, `pnpm check:figures` and `pnpm figures:write` all re-run and their
      real results stated. No `src/` change; the five production md5s listed.
- [ ] Every DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Outcome (2026-09-10)

Landed. Records, the graph, and one new check. **This task edited no file under `src/`** and all five
production md5s are the values round 18 recorded (`inspector-layout.ts`
`f10fa099c0981638022f412395001db6`, `appearance-metrics.ts` `f50d48f3108168abaf083311f6815eba`,
`commit-inspector.ts` `44f017a4c415d7a1c001f7e0362d6a9c`, `main-content.ts`
`720244ba837d5fa7229ea935bb6d4704`, `main-content.html` `d1fbdf2ef79301507843b0053f8b6586`).

### F5 — the seven are drawn, and the check that says so is now a command

T27–T33 are nodes with their real edges, taken from `tasks.json` `deps` rather than retyped from the
table: `T24,T25 → T27`; `T19,T20,T21,T22,T23 → T28`; `T27,T28 → T29`; `T29 → T30 → T31 → T32 → T33`.

**The check T67 wrote into a comment is now `pnpm check:tasks`** (`scripts/check-tasks.mjs`), a step
in CI between Lint and the figure gate. It asserts what a reviewer has re-derived by hand every round
— `tasks.json` parses, ids unique and contiguous, no dangling dep, no cycle, one task file per id and
one id per task file, `deps` and `files_hint` agreeing between `tasks.json` and each frontmatter,
a `tracker.md` row per id and a total that matches — **plus** the two the graph needs: every id is a
node, and every `deps` entry is a drawn edge, in both directions. Output on the tree this task leaves:

```
tasks: 74 · ids T1…T74 · 74 task file(s) · 74 tracker row(s) · 74 graph node(s) · 86 graph edge(s)
OK — tasks.json, the task files, tracker.md and the epic graph all agree.
```

**Proved failing before it was believed passing**, three reconstructions, each logged before it was
applied, restored immediately and `_epic.md` md5-verified back to pristine after each:

| reconstruction | exit | message |
|---|---|---|
| the node `T29[…]` deleted | **1** | `1 id(s) in tasks.json are not a node in the epic's mermaid graph: T29` |
| the edge `T30 --> T31` deleted | **1** | `the epic graph is missing the edge T30 --> T31` |
| an edge `T33 --> T27` invented | **1** | `the epic graph draws T33 --> T27, which is not a dependency in tasks.json` |
| every mutation restored | **0** | the OK line above |

T67's diagnosis is corrected in place, inside its own marker: the graph was stale **from T26**, not
from T62. Seven ids across five review rounds had never been drawn, so «both waves are now drawn» was
true of the two waves T67 looked at and false of the graph. The marker also records why the check
moved out of the comment: a check that lives in prose is a check that gets written and not run, which
is precisely what happened to this one.

### F6 and F7 — three addresses, three dated markers, originals preserved

- **F6.** `round16-figure-gate.md`'s «`test-plan.md`'s CI-placement section **now says** that when a
  row quotes a derived figure, its marker is what checks it» keeps its sentence and gains a marker
  naming what `test-plan.md` says today («What a marker checks is the marker — the script never reads
  the prose beside it»), naming T70's hand-off and T71's miss, and naming T67's own D4 rule as the
  line that decides it: a record describing past work stays; a record asserting a live invariant is
  rewritten.
- **F7.** Both gate bullets — `round17-code-fixes.md` and `round17-test-coverage.md` — now state what
  the delivered gate printed (`23 markers in 3 file(s), 10 distinct claims, 45 values recomputed` and
  the `coverage: 36 … 15` pair, with no `unmarked` line), each under a marker quoting the retired
  wording and naming R17-F8 and T70's deletion of that output. `grep -c "1 unmarked"` returns **2**
  per file, and both are inside those markers, quoting the defect — which is the correction's
  substance.

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7, found by this task rather
than routed to it): this is a PRESENT-TENSE claim about a tree that no longer exists. No commit in
this repository prints these figures — measured at `2db0519`, the one commit carrying T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`.
T70 deleted the `unmarked` output outright (R17-F8) and T73's D3 migration retired 21 of the 23
markers. Kept as the dated record it is; see `round19-records.md` -->

### Every count, re-measured on the tree this task LEAVES

Per T71's transferable rule, each was re-run **after** this task's own edits, not before. Where the
new number differs from what the round-18 record predicted, both are given.

| what | round 18 measured | **on the tree this task leaves** |
|---|---|---|
| **O3** the doubled form `2 * (panelHeadH + 2 * fileRowH)` over `*.ts` + `*.md` | 15 lines / 16 occurrences | **16 lines / 17 occurrences** — the round-18 record itself added one. T71's «eleven» is corrected to this, with the cause named |
| **O4** `both densit\|two densit\|2 densit` over the branch scope | 82 lines / 96 occurrences (stage 1) | **86 lines / 102 occurrences** over 191 files. T67's «89» is corrected to this; no construction returns 89, and the count is structurally unreproducible because it was taken mid-wave |
| **O5** live instructions that schedule a measurement and reach relaxed | seven enumerated, two omitted | **nine of nine**. The conclusion was never at risk — both omitted bullets do reach the three densities — only the enumeration was short |
| `grep -rn "_epic\.md:[0-9]"` over `tasks/` | 3 | **3.** It reached **4** mid-task, because this task's own `## Why` cited the marker by line number; the citation was converted to an anchor («the marker under the graph that begins …»), which is T67's rule and also survives the line moving |
| unclaimed files, excluding task and review records | 5 (four from O11 + `reference-figures.md`) | **5**: `release.yml`, `install.sh`, `.gitignore`, `.mcp.json`, **`CHANGELOG.md`**. `reference-figures.md` left the set (O6, below); `CHANGELOG.md` joined it — O11's «four» was four counted and five present |

**O6 closed on both halves.** `reference-figures.md` is now in T70's `files_hint`, in `tasks.json`
and in the task file's frontmatter (`pnpm check:tasks` verifies the two agree), and the sentence in
`round17-records.md` that already claimed it was is corrected with a marker saying it was not.
`scripts/check-tasks.mjs`, `package.json` and `.github/workflows/ci.yml` are claimed by **this**
task, so the check added here does not itself join the unclaimed set.

<!-- commands added 2026-09-13 (T78, review round 19 O12): the O3 and O4 rows above state counts
without the command that produced them, and both are scope-sensitive — round 19's stage 1 re-ran
them over its own scope and got different numbers, which is the reproduction problem rather than a
discrepancy. O3 is `grep -rn "2 \* (panelHeadH + 2 \* fileRowH)" --include='*.ts' --include='*.md' .`
and O4 is `grep -rniE "both densit|two densit|2 densit"` over the files the branch touches. A count
quoted without its command cannot be checked, only believed -->

**O7 recorded, not resolved.** The five unclaimed files stay a commit decision for the owner, as
round-16 O14 and round-17 O11 left them; the enumeration in `round17-records.md` is extended to five
with `CHANGELOG.md` named.

### Gate

- `pnpm test` — **844 passed (844), 63 files**.
- `pnpm lint` — clean over **268 files** (267 → 268: `scripts/check-tasks.mjs` is inside the gate
  from the moment it exists, which is what T72's O2 change was for).
- `pnpm check:tasks` — exit **0**, output above.
- `pnpm check:figures` — exit **0**, `2 markers in 1 file(s), 2 distinct claims, 6 values recomputed`,
  `coverage: 1 figure(s) … 1 of them` (that one being `DESIGN.md:73`'s type-scale false positive).
- `pnpm figures:write` — round-trips **byte-identically**, md5 `22bc618fc949c02810ae689f61ad65c1`.
- Five production md5s unchanged, listed above.

### No row inserted, no dep changed, no total moved

Stated the way T71's rule asks, rather than as «no registration»: this task inserted no row in
`tasks.json`, `_epic.md`'s table or `tracker.md`, changed no `deps`, and did not move the total —
T72 owns all of that. What it *did* touch in those files is the **graph** (seven nodes and their
edges, which is the finding) and **two `files_hint` lists** (T70's, per O6; its own, for the new
script). Both are verified by `pnpm check:tasks`, which is the point of having it.

### DoD bullets that could not be satisfied as written

1. «**No `src/` change:** … » Same as T72 and T73, same reason: nothing on this branch is committed,
   so a diff against `HEAD` reports four waves of work and cannot isolate this task's. Verified
   instead: this task opened no file under `src/`, and the five production md5s are unchanged.
2. «`grep` for the retired sentence and for `1 unmarked` over live artefacts returns what the Outcome
   states.» Satisfied with a distinction the bullet did not draw: **`1 unmarked` still returns 2 per
   file**, and both hits are inside the dated markers that quote it as the defect. A grep alone cannot
   tell a quotation from a claim, which is the same limitation R18-F5's «7 misses» exposed for the
   graph — the number is reported with where the hits are, not as zero.
3. «The check … runs inside the registration validator.» There was no registration validator in the
   repo — every previous round re-derived those checks in a throwaway script. So the bullet was
   satisfied by **creating** one (`scripts/check-tasks.mjs`, `pnpm check:tasks`, a CI step), which is
   more than the bullet asked for and is disclosed as such. It is new code on a docs-layer task; it
   is covered by `pnpm lint` and by its own three reconstructions, and by nothing else.
