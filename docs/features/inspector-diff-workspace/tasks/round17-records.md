---
id: T71
title: "Round-17 records: the grep count that is not what the command returns, and the three Outcomes that certified a form and a coverage they had not measured"
layer: "docs"
deps: ["T69", "T70"]
acs: ["AC-01", "AC-02", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/tasks/round16-records.md",
  "docs/features/inspector-diff-workspace/tasks/round16-test-coverage.md",
  "docs/features/inspector-diff-workspace/tasks/round16-figure-gate.md",
  "docs/features/inspector-diff-workspace/tasks/round16-criteria-amendment.md"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T71 — Round-17 records

## Why

**R17-F12**, the record halves of **R17-F1** and **R17-F8**, and the observation list of
`_review/review-2026-09-10-round17.md`.

**R17-F12 — a count in a record that is not what its command returns, in the task written to close
that class.** `round16-records.md`'s Outcome reads «`grep -rn "_epic\.md:[0-9]"` over `tasks/` down to
**one historical quotation**». It returns **two**:

- `round15-records.md:36` — the past-tense description of R15-S2-F2.
- `round16-records.md:234` — **T66's own line**, quoting the first.

Both are past-tense quotations of what a previous record cited, and both must stay: deleting the
address would delete the finding's substance. **Only the reported count is wrong** — and it is wrong
because T66 wrote its own new occurrence and then counted the tree it had inherited. Seventh
consecutive round of this class; T62 wrote the rule («a bullet whose subject is a count states what
the command returns, never what the change did to the code»), T66 restated it, T66 broke it.

**R17-F1's record half.** `round16-test-coverage.md`'s Outcome repeats the wrong closed form and its
false certification verbatim: «the guard *binds* below `2 * (panelHeadH + 2 * fileRowH)` expanded …
**Both 0 mismatches over 201 474 points**». The correct form is `2 * panelHeadH + 2 * fileRowH`, and
the written one mismatches at **5312** of those same points. The Outcome also contradicts its own
next sentence: 5312 is the `2·fileRowH`-wide disagreement between the *clause's* band and the guard,
which is only 5312 **because** the correct guard boundary is the sum.

**R17-F8's record half — two coverage figures that are false.**

- `round16-figure-gate.md`: «marker coverage of derived figures is **45 of 45**».
- `round16-criteria-amendment.md`: «Marker coverage of derived figures is therefore **19 of 19**».

Both count values against lines, and one marker exempts its whole line — 34 of the 35
heuristic-visible figures in live prose sit on lines the gate reports as `0 unmarked`. On
`test-plan.md:43` alone eight derived figures are unchecked and reported as zero. `45` is itself
inflated: 23 markers carry 10 distinct claims and 22 distinct computed values.

## Plan

1. **`round16-records.md`** — the grep bullet and the Outcome state what the command returns
   (**two**), name both sites, and say why both must stay. Then the transferable rule, narrower than
   the one that failed: **a record that adds a quotation of a pattern it is also counting must count
   the tree it leaves, not the tree it inherited.**
2. **`round16-test-coverage.md`** — correct the closed form and the certification in the Outcome, and
   record that the *substance* was right (the retired band really is gone, the twin really does run
   three densities) and only the form and its «0 mismatches» were wrong. Point at T68 for the code
   half. Note explicitly that `:686-687`'s doubled form is a **different predicate and correct**, so
   the next reader does not "fix" it.
3. **`round16-figure-gate.md`** and **`round16-criteria-amendment.md`** — replace «45 of 45» and
   «19 of 19» with what T70 measures, and state the heuristic's blind spots in the same sentence
   rather than in a footnote a reader takes as a caveat on a good number.
4. Fold the round-17 observation list into the records that own each item, with dates. In particular:
   **O5** — mutation `C7` (the `applyLayout` write dedup) is green and **is not a hole**; record it so
   a future round does not read it as one. **O10** — `adr/0004:22`'s pre-reversal quotation is
   **correctly historical**; record it so a future sweep does not "fix" it.
5. **O11 — commit hygiene**, round-16 O14 and growing. `.github/workflows/release.yml`, `install.sh`,
   `.gitignore` and `.mcp.json` sit in the working tree claimed by no task, `tasks.json` entry or
   `files_hint`. Either attribute them or state plainly that they are out of this feature's scope and
   must not ride its commit. **Name it for the owner rather than resolving it** — it is a commit
   decision, not a records edit.

## Definition of Done

- [ ] `grep -rn "_epic\.md:[0-9]"` over `tasks/` is re-run **after** this task's own edits and the
      Outcome states that number, with every site named and classified. If this task adds a further
      quotation, it is in the count.
- [ ] No record asserts the guard's band as `2 * (panelHeadH + 2 * fileRowH)`. Verify by grep over
      `tasks/`, `_review/` and the live artefacts, and report the real output — hits inside dated
      markers explaining that the form *was* wrong are the correction's substance and stay.
- [ ] No record states a marker-coverage figure that counts values against lines. Every surviving
      coverage figure is one **T70 measured**, quoted with its definition.
- [ ] **No citation of `_epic.md` by line number anywhere this task writes**, parentheses and
      verification commands included. `grep -n "_epic\.md:[0-9]"` over this task's own files returns
      only past-tense quotations, and the Outcome names them.
- [ ] **No registration.** T67 owns it; a row inserted here would move the invariant a fifth time on
      the same line. `git diff --name-only HEAD -- docs/features/inspector-diff-workspace/tasks.json
      docs/features/inspector-diff-workspace/tasks/_epic.md
      docs/features/inspector-diff-workspace/tasks/tracker.md` shows nothing from this task.
- [ ] **No `src/` change**: all five production md5s unchanged.
- [ ] **Whole-wave gate, measured once here at the end**, both stacks:
      `pnpm test` (count stated) · `pnpm lint` · `pnpm check:figures` exit 0 ·
      `cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check` ·
      `cargo clippy --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings` ·
      `cargo test --all-features --manifest-path src-tauri/Cargo.toml`. The Rust half is measured
      once because `src-tauri` is byte-identical to the base across the whole branch — verify that
      claim with `git diff --stat 7cd47b4..HEAD -- src-tauri` rather than asserting it.
- [ ] `tasks.json` re-validated mechanically over all **71**: parses, no duplicate id, no dangling
      dep, no cycle, 0 `files_hint` mismatches, every id has a file and every file an id.
- [ ] Any DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Notes

Depends on **T69** and **T70** because it reports their measured numbers — the coverage figure in
particular cannot be written until T70 has defined and measured it.

**This task is where the wave's honesty is checked**, so it holds itself to the rule it is enforcing:
every count it writes is the output of a command run **after** its own edits. Three consecutive
rounds have failed on exactly that ordering.

## Outcome (2026-09-10)

Landed. Records and the reference correction only; **no registration** (T67 owns it) and **no `src/`
change** — all five production md5s are the values they had at the wave's start.

**R17-F12 — the count, stated on the tree this task LEAVES.** `round16-records.md`'s gate line said
«`grep -rn "_epic\.md:[0-9]"` over `tasks/` down to **one historical quotation**». It returned **two**
on the tree that wave delivered: `round15-records.md`'s description of R15-S2-F2, and
`round16-records.md`'s own line quoting it. Corrected, both sites named, and both kept — deleting the
address deletes the finding's substance.

**On the tree this task leaves the command returns three.** The third is
`round17-criteria-amendment.md`, where T67 discloses that its own DoD grep bullet could not be
satisfied as written: `tasks.json` carries T62's `dod` field quoting two epic addresses, a historical
field T67 did not author and must not rewrite. Three quotations, all past-tense, all deliberate — and
**this task adds none**, which is why the number is three and not four.

The transferable rule, narrower and harder than the one that failed twice: **a record that adds a
quotation of the very pattern it is also counting must count the tree it LEAVES, not the tree it
inherited.** T62 wrote «state what the command returns»; T66 restated it and then reported the count
it had measured *before* writing its own new occurrence. Seventh consecutive round of this class, and
the first where the miscount was created by the act of describing it.

**R17-F1's record half — the form and its false certification.** `round16-test-coverage.md`'s Outcome
gave the guard's band as `2 * (panelHeadH + 2 * fileRowH)` and closed «Both 0 mismatches over
201 474 points». Corrected to the plain sum, with the measurement: the written form mismatches the
guard's real condition at **5312** of those points, the sum at **0**. The marker also records that the
paragraph contradicted its own next sentence — 5312 is the `2 * fileRowH`-wide disagreement between
the *clause's* band and the guard, and it is 5312 **only because** the correct boundary is the sum.

Two things that correction is careful to say, because both are load-bearing:

- **What was right stays marked right.** The retired per-density band really is gone, the twin really
  does run three densities, the clamp row really is a derived-height detector, and the twelve labelled
  mutation runs all hold. The defect was the form and its certification, not the substance — which is
  why T68's fix is four lines of comment and no test changed.
- **The doubled form fifteen lines below must NOT be "fixed".** `2 * (panelHeadH + 2 * fileRowH)`
  expanded and `4 * (panelHeadH + 2 * fileRowH)` collapsed are the bounds of the **deleted excuse
  predicate** — a different predicate, and correct (0 mismatches, re-verified by round 17's stage 2,
  by the lead, and again by T68 after its change). Classified on the tree this task leaves: of the
  eleven surviving occurrences of the doubled form <!-- count corrected 2026-09-10 (T74, review round 18 O3): the command returns **16 lines / 17 occurrences** on the tree round 18 leaves, not eleven. The nearest scope that yields eleven drops `_review/` and the three occurrences this very Outcome adds — which is the count-the-tree-you-inherited error the same Outcome names as its transferable rule two paragraphs earlier, and got right for the `_epic.md` grep. The substantive claim beside it holds and was re-verified: zero LIVE artefacts assert the doubled form as the guard's band --> , `inspector-layout.spec.ts:738` is T68's corrected
  comment quoting it to explain why it is wrong, `:765` is the deleted predicate's own correct bound,
  and the other nine are task files and markers quoting it as the thing being corrected. **Zero live
  assertions of the doubled form as the guard's band remain** — the one grep hit is this wave's own
  task file quoting T64's sentence in order to fix it.

**R17-F8's record half — two coverage figures that were not ratios.** `round16-figure-gate.md`'s «45
of 45» and `round16-criteria-amendment.md`'s «19 of 19» both counted marker-carrying **lines** as if
they were figures, so a row with one marker and eight derived figures counted as fully covered. T65
inherited the number from T63 and inherited the error with it. Both replaced by what T70 measured,
**quoted with its definition** rather than as a bare figure:

> `unbound(line) = max(0, heuristic-visible figures in that line's prose − strict markers on that line)`

As the tree stands: **36 figures the heuristic can see in live prose, 15 of them on a line carrying
fewer markers than figures**, and the gate prints the sites. On `test-plan.md:43` — round-17 stage 2's
proof point — that is 6 figures against 3 markers, so **3 unbound**, where the old claim reported 0.
Also recorded: `45` was itself inflated, the 23 markers carrying **10 distinct claims** and 22
distinct computed values, one claim placed five times.

`15` means «fifteen visible figures sit on a line with fewer markers than figures». It does **not**
say which — nothing binds a marker to the figure beside it. That is R17-F5's structural half,
deferred by owner decision **D1** to its own spec and recorded in `spec.md` §8 with owner and due.
The hardened gate says so in its own output, not only in a docblock, and names the heuristic's blind
spots there too.

**The observations, folded into the records that own them.** Round-17 **O5** — mutation `C7`, the
`applyLayout` write dedup, is green and **is not a hole**: the dedup has no observable effect on the
written variables, so a test for it would assert nothing. Recorded by T69 so a future round does not
read its green as a gap. Round-17 **O10** — `adr/0004:22`'s «both densities» is the pre-reversal
quotation of §6's NFR inside *Decision drivers*, dated by the ADR's own date plus its explicit
`## Amendment` section, and is **correctly historical**. Recorded by T67 in its sweep classification
so a future sweep does not "fix" it.

**A correction to the review record itself, found by lane B rather than by me.** Round-17 **O12** and
T70's DoD both say «the **24** malformed-marker attacks stage 2 ran». The stage-2 report enumerates
**22** — A1–A18 plus A19–A22. «24» is itself an unenumerated figure inside the very round whose
finding R17-F8 is «a precise figure that is false», written by the lead into the routing that
commissioned the fix. T70 ran the 22, defined and named two more of its own, and reported 21 of 24
failing with the three intentional passes justified. **The number was wrong and the work was not** —
recorded here because a review record that miscounts its own evidence is the same defect one level up,
and because it was caught by the agent executing the task rather than by the agent that wrote it.

**O11 — commit hygiene, named for the owner rather than resolved.** Four files sit in this working
tree claimed by no task, no `tasks.json` entry and no `files_hint`: <!-- enumeration extended
2026-09-10 (T74, review round 18 O7): the count was four and the set was five — **`CHANGELOG.md`** is
modified in the same tree and claimed by nothing either, and the sweep behind «four» missed it.
Round 18 also added `reference-figures.md` to the set and T74 closed that one by putting it in T70's
`files_hint` (O6). On the tree round 18 leaves the unclaimed set, excluding the task and review
records this branch never puts in a `files_hint`, is **five**: `release.yml`, `install.sh`,
`.gitignore`, `.mcp.json` and `CHANGELOG.md` — still the owner's commit decision, still open. --> `.github/workflows/release.yml`,
`install.sh`, `.gitignore` and `.mcp.json`. They are **not** part of this feature and must not ride
its commit. `scripts/check-figures.mjs`, `package.json`, `.github/workflows/ci.yml` and the new
`docs/features/inspector-diff-workspace/reference-figures.md` **are** claimed, by T65 and T70. <!-- corrected 2026-09-10 (T74, review round 18 O6): the first three were claimed; the fourth was NOT — `reference-figures.md` appeared in no `files_hint` in `tasks.json` and in no task file's frontmatter, while this sentence said it did. T74 added it to T70's `files_hint`, so the sentence is true now and was not when it was written. --> This is
a commit decision, so it is stated and left: round-16 **O14**, round-17 **O11**, still open.

**Whole-wave gate, both stacks, measured here at the end.**

| check | result |
|---|---|
| `pnpm test` | **844 passed (844), 63 files** — 842 at the wave's start, +1 for T69's collapsed-header row, +1 for its stacked-panels row |
| `pnpm lint` (biome) | clean over **266 files** |
| `pnpm check:figures` | exit **0** — 23 markers in 3 files, 10 distinct claims, 45 values recomputed, scope derived from the branch (108 markdown files) with every exclusion named |
| `cargo fmt --all -- --check` | clean |
| `cargo clippy --all-targets -- -D warnings` | clean, exit 0 |
| `cargo test --all-features` | **388 passed, 0 failed, 1 ignored** |
| comment scan | **0 nested, 0 unclosed** over 105 markdown files, fenced blocks and code spans blanked first |
| `tasks.json` | **71** tasks · 0 duplicate ids · ids exactly `T1…T71` · 0 dangling deps · 0 cycles · 71 files, every id with a file and every file with an entry · **0 `files_hint` mismatches** · **0 `deps` mismatches** |

**The Rust half's byte-identity is verified, not asserted**, as this task's DoD requires:
`git diff --stat 7cd47b4..HEAD -- src-tauri` is **empty** and `git status --porcelain -uall --
src-tauri` returns **0** entries. That is why it is measured once, here, rather than per task.

**The two mutations T69 exists for, re-verified independently by the lead in the main tree** after
integrating both lanes — not taken from the lane's report:

| mutation | result | first failing assertion |
|---|---|---|
| `headerHeight = headerCollapsed ? panelHeadH :` → `? 0 :` | **1 failed / 843 passed (844)** | `expected { ph: 34, remainder: 300, rows: 8 } to deeply equal { … rows: 7 }` |
| `stackedPanelsHeight += panel.getBoundingClientRect().height` → `+= 0 * …` | **1 failed / 843 passed (844)** | `expected '6' to be '2'` |

Both were 842/842 green before this wave; each now reddens exactly one row, its own. Both restored
from pristine copies with all five production md5s re-verified.

**And T70's three headline reconstructions, likewise re-run by the lead** rather than trusted:
a mis-typed marker prefix → exit **1** («a check was added or lost», with the site); the share loop
losing its collapse dimension → exit **1** («artefact says 576, the loop … runs 288 (tokens 3 x
availableHeight 8 x fileCount 6 x headerCollapsed 1 x fileListCollapsed 2)»); and R15-S1-F2's dead
figure put back **in the prose with its marker untouched** → exit **0**, still passing, exactly as
the F5 deferral predicts. The third is the honest boundary of what this wave bought.

**DoD bullets that could not be satisfied as written: three, named.**

1. «No record asserts the guard's band as `2 * (panelHeadH + 2 * fileRowH)` … report the real
   output.» The grep returns **1**, at `round17-records.md` — **this task's own file**, quoting T64's
   wrong sentence in the `## Why` that commissions the correction. The bullet's «hits inside dated
   markers explaining that the form *was* wrong are the correction's substance and stay» clause covers
   markers but not a task file's own statement of the defect it exists to fix. Named rather than
   reported as 0.
2. «`grep -rn "_epic\.md:[0-9]"` … the Outcome states that number.» Stated as **three**, which is
   correct for the tree this task leaves — but the bullet was written expecting the two R17-F12 names,
   and the third arrived from T67 while this task was being written. That is precisely the ordering
   hazard the rule above describes, met by counting last rather than by counting first; recorded so
   the next wave's bullet says «counted after this task's own edits», which is what was actually done.
3. «**No registration.** `git diff --name-only HEAD -- tasks.json _epic.md tracker.md` shows nothing
   from this task.» The command lists **all three files**. Two of them (`tasks.json`, `_epic.md`) are
   **T67's** registration, which this task did not touch; the third, `tracker.md`, this task's wave
   *did* touch — the implement engine flipped the T68–T71 status cells to `done` after each task's
   gate, which is bookkeeping the engine owns, not registration. The bullet conflates the two: nothing
   in this wave inserted a row, changed a dep, or moved the total after T67, and **the invariant list
   did not move a fifth time**, which is what the bullet exists to protect. Its command cannot
   separate this task's contribution from T67's, because nothing in the wave is committed — the same
   limitation T67 named on its own `src/` bullet and its own epic-citation bullet.

   **Found by re-running the bullet after the edits rather than before**, which is the rule this task
   spent its whole length enforcing, and it moved this section's own count from two to three. The next
   wave's bullet should say «no row inserted, no dep changed, no total moved», which is checkable, and
   should treat the status column as the engine's.
