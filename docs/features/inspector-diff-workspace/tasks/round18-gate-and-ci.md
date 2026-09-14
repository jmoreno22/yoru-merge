---
id: T72
title: "Round-18 gate and CI fixes: make the figure gate runnable in the CI it is wired into, and make D4's scope check able to fail"
layer: "infra"
deps: []
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "scripts/check-figures.mjs",
  ".github/workflows/ci.yml",
  "biome.json",
  "package.json",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T72 — Round-18 gate and CI fixes

## Why

**R18-F1**, **R18-F4** and owner decisions **D1** and **D3** of
`_review/review-2026-09-10-round18.md`, plus observations **O1** and **O2** of the same record.

The round-17 wave did what **D4** asked and derived the figure gate's scope from the branch instead of
from an enumerated list. The derivation is real — 185 branch files reduce to 108 markdown ones,
`adr/0003` is inside them, and a marker planted there fails. Two things came with it.

**F1 — the gate cannot run in the CI it is wired into.** The scope derivation opens with
`git merge-base HEAD main` (`check-figures.mjs:131`), and `.github/workflows/ci.yml:31-32` checks out
with **no `with:` block**, so `actions/checkout` uses `fetch-depth: 1` and creates no local `main`
ref. Round 18 measured the exact CI command in a reconstructed shallow checkout, twice
independently: `fatal: Not a valid object name main` → «the scope could not be derived from the
branch» → **exit 1**. `git merge-base` does not fall back to `refs/remotes/origin/main`. The other
path fails too: on a `push` to `main` or `develop` — the only push branches the workflow listens to —
`merge-base HEAD main` *is* `HEAD`, so `git diff --name-only HEAD..HEAD` is empty, the tree is clean,
`all.length` is 0, and `:164-167` exits **1** with «the derived scope is 0 file(s) — refusing to
pass». The step is a plain `run:` with no `continue-on-error`, after Lint and **before** Unit tests,
on `ubuntu-latest` **and** `windows-latest`. So the branch's only mechanical defence against its
dominant defect class goes red on the first PR it will ever see, for a reason that has nothing to do
with figures, and takes Unit tests, the frontend build and the whole Rust half down with it. The
cheapest repair under time pressure is to delete the step.

Round-17 **O12** recorded this step as merely *unexercised*. It is worse than unexercised: T65's
version had an enumerated list and shelled out to nothing, so it would have run. The widening
introduced the dependency, and T70's own disclosure — «unexercisable — nothing is pushed from this
branch» — and its docblock limit 5 («the CI step is only as good as its placement») name the
placement, which is right, and not the command, which is not runnable there.

**F4 — D4's mechanical check cannot fail.** `check-figures.mjs:169-186` computes
`executed = scopeFrom(all)` where `all = branchFiles()`, then `const declared =
scopeFrom(branchFiles()).swept` — the same pure function over the same git output — and compares the
two sets in both directions. They cannot differ. The set the sweep actually iterates is `ARTEFACTS`
(`:170`, consumed at `:443`), and nothing compares `ARTEFACTS` to either side. Measured in round 18:

- replacing `const ARTEFACTS = executed.swept;` with an enumerated list that keeps the three
  marker-carrying files → **exit 0**, output byte-for-byte the baseline;
- adding one reasoned exclusion that drops `/adr/` → **exit 0**, with all four ADRs out of the sweep;
- narrowing the **declaration** to round 16's eight-file list → exit 1, which is the direction T70
  measured and reported as working, and is the harmless one.

The marker-count pin catches a narrowing only when it drops a marker-carrying file. The R17-F4 shape
is precisely a **marker-free** file leaving scope, which the pin cannot see. D4's text is explicit —
«a sweep that declares a narrower scope than the one it executed fails mechanically» — and the
direction that matters has no check at all, while the docblock's limit 4 claims it catches «an
enumerated file list reinstated, which is the round-17 failure».

**O1 — the loop-shape parser reads comments and strings.** `loopShape` (`:283-298`) regexes the raw
block text, while `blankCode` (`:412`) does exactly the comment/string blanking for markdown in the
same file. A commented-out `for (const bogus of [1, 2, 3])`, or one inside a string, makes the gate
report 864 configurations where the loop runs 288. It fails **safe** — a false failure, never a false
pass — but the repair the message suggests is `pnpm figures:write`, which would bake the phantom
dimension into the generated table, the one place a concrete derived figure is allowed to live.

**O2 — the gate script is outside both gates.** `pnpm lint` is `biome check src` and `biome.json`
includes only `src/**`, so `pnpm exec biome check scripts/check-figures.mjs` reports «0 files … these
paths were provided but ignored»; `tsconfig.spec.json` does not reach it either. Four Outcomes in the
round-17 wave report `pnpm lint` clean over 266 files beside a change to this file. It also carries
one confirmed dead field: `:99`, `pattern: /.*/`, never read, since only `applies` is consulted.

## Plan

1. **F1, the workflow half (D1).** Give the checkout `fetch-depth: 0` so `merge-base` has history to
   work with, with a comment saying why the depth is load-bearing.
2. **F1, the script half (D1).** A degradation chain in place of the single `merge-base` call:
   local `main` → `origin/main` → `HEAD~` → «every markdown file under `docs/` and the repo root».
   The chain must **name the rung it used in the output**, never exit 1 for want of a ref, and the
   final rung must be a real scope rather than an empty one, so the `push`-to-`main` path stops
   failing on an empty diff.
3. **F4 (D3).** Assert the declared scope equals `ARTEFACTS` **at the point of use** — the set the
   sweep iterates — so an enumerated list at the site round 16 used it fails. Rewrite docblock
   limit 4 to describe exactly what the check does and does not cover.
4. **O1.** Blank comments and string literals before `loopShape`'s `matchAll`, reusing the blanking
   the file already has rather than writing a second one.
5. **O2.** Bring `scripts/**/*.mjs` into `biome.json`, keep `pnpm lint` as the single lint entry
   point, and drop the dead `pattern` field.
6. **Registration.** Register T72–T74 in `tasks.json`, `_epic.md` (**table and graph**) and
   `tracker.md`. T74 owns the graph's pre-existing hole (R18-F5); this task owns only its own rows and
   edges, and says so.

## Definition of Done

- [ ] **A reconstructed CI checkout runs the gate green.** `git clone --depth 1 --single-branch` of
      this branch, the exact CI command run inside it, exit **0**, and the output names the rung the
      chain fell back to. Before/after exit codes both pasted in the Outcome.
- [ ] **The `push`-to-`main` path is exercised too**, where `merge-base HEAD main == HEAD` and the
      tree is clean: exit **0**, with the fallback rung named. Exit code pasted.
- [ ] **F4 has a reconstruction that now fails and did not before.** `ARTEFACTS` replaced by an
      enumerated list that keeps all three marker carriers: **exit 1** with a message naming the
      narrowing. The `/adr/`-exclusion reconstruction is run too and its verdict stated for what it
      is — a *declared* exclusion is what D4 sanctions, so it may legitimately pass, but the run must
      print it.
- [ ] **Every gate attack round 18 ran still behaves.** The 15 malformed-marker attacks, the five
      module drifts, the two staleness checks and the CRLF probes re-run after the change, with the
      count and the exit codes stated. No attack may become a silent pass.
- [ ] **O1 is proved.** A commented-out `for (const … of …)` and one inside a string each leave the
      sweep counts at 288 / 576 / 48 and the gate at exit 0. Exit codes pasted.
- [ ] `pnpm lint` reaches `scripts/check-figures.mjs` — the file count moves and the number is stated
      — and is clean.
- [ ] `pnpm figures:write` still round-trips byte-identically, and `pnpm check:figures` exits 0 in the
      main tree with its markers, claims, values, scope and coverage figures pasted **as the command
      prints them** (R18-F7's class: a bullet whose subject is a count states what the command
      returns).
- [ ] No `src/` change: `git diff --name-only HEAD -- src` is empty and all five production md5s are
      unchanged, each listed.
- [ ] Registration validated mechanically over all 74: parses · 74 tasks · ids exactly `T1…T74` ·
      0 duplicate ids · 0 dangling deps · 0 cycles · every id has one file and every file an entry ·
      0 `files_hint` mismatches · 0 `deps` mismatches. **The count of ids missing from the mermaid
      graph is stated as what the check returns, not as zero** — T74 closes it.
- [ ] Every DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Outcome (2026-09-10)

Landed. Infra and registration only. **This task edited no file under `src/`** — the seven `src`
entries `git diff --name-only HEAD -- src` reports are the round-14-to-round-17 waves' uncommitted
work, not this one's (see the DoD note below), and all five production md5s are the values round 18
recorded:

```
inspector-layout.ts       f10fa099c0981638022f412395001db6
appearance-metrics.ts     f50d48f3108168abaf083311f6815eba
commit-inspector.ts       44f017a4c415d7a1c001f7e0362d6a9c
main-content.ts           720244ba837d5fa7229ea935bb6d4704
main-content.html         d1fbdf2ef79301507843b0053f8b6586
```

### F1 — the gate now has an exit code in every checkout shape, measured in four of them

The single `git merge-base HEAD main` is replaced by a four-rung chain that **prints the rung it
used**. Each shape was reconstructed and run twice: once with the delivered script, once with the
pre-T72 derivation restored in that same checkout, so the before/after pair is measured in the same
place rather than compared across trees.

| # | checkout shape | before | after | rung the run named | md files swept |
|---|---|---|---|---|---|
| 1 | the main tree (local `main` present) | 0 | **0** | `merge-base with main` | 112 |
| 2 | `git clone --depth 1 --single-branch` — **`actions/checkout`'s defaults** | **1** · `fatal: Not a valid object name main` then «the scope could not be derived from the branch» | **0** | `none — sweeping every markdown file under docs/ and the repo root` | 72 |
| 3 | full clone, single branch, `origin/main` fetched, **no local `main`** | rung 1 unavailable — same fatal | **0** | `merge-base with origin/main (no local main ref)` | 67 |
| 4 | clean checkout whose base resolves to `HEAD` — **the `push`-to-`main` shape** | **1** · «the derived scope is 1 file(s) — that cannot be right; refusing to pass» | **0** | `merge-base with main, empty diff — widened to docs/ and the repo root` | 72 |

The empty-scope refusal is **kept** but no longer fires on a legitimately empty diff: when the branch
yields nothing the run falls to the widest rung instead of to zero files, so «refusing to pass» is now
reserved for a derivation that is actually broken.

`.github/workflows/ci.yml` gains `fetch-depth: 0` on the `build` job's checkout (**+13 lines**, the
comment included) naming the figure step as the reason, so **rung 1 is what CI will actually use** and
the wider rungs exist for clones nobody configured. The other two jobs' checkouts are untouched —
neither runs the figure step.

<!-- corrected 2026-09-13 (T78, review round 19 R19-F8): «rung 1 is what CI will actually use» is
false on the trigger this finding was written about. `actions/checkout` creates a local branch only
on the `refs/heads/` path; on a `pull_request` it checks the merge commit out DETACHED, so
`fetch-depth: 0` gives `origin/main` and no local `main`, and **rung 2** is what fires. Rung 1 fires
on a `push` to `main`, where the diff is empty and the run widens anyway. Reconstructed
command-for-command by round 19's stage 1. The same claim in `check-figures.mjs`'s docblock was
corrected by T75, which also removed the `HEAD~` rung this sentence's «wider rungs» referred to -->

**Two things measured here that the plan got wrong. They are corrections to the plan, not to the
finding.**

1. **Rung 2 needs history, not just the ref.** In shape 2 I fetched `origin/main` into the *shallow*
   clone and the run still fell to rung 4: with `depth 1` there is no common ancestor, so
   `merge-base HEAD origin/main` fails even though the ref resolves. Rung 2 fires in a **full**
   single-branch clone (shape 3) and not in a shallow one. Recorded because «fetch `origin/main` and
   rung 2 will catch it» is the obvious wrong repair for the next person.
2. **Rung 4's scope is bounded by the CHECKOUT, not by the diff.** The docblock first claimed it is
   «WIDER than the branch, never narrower». Shape 2 falsified that inside the reconstruction itself —
   72 files against the main tree's 112 — because a clone of this branch does not carry the 44
   untracked records. In a real CI checkout, where everything is committed, rung 4 is a superset of
   the diff; in a shallow one it is whatever was fetched. The docblock now says exactly that and tells
   the reader to check the `scope base:` line before quoting the file count. **The first version of
   that sentence was a claim I had not measured — the class this branch keeps finding — and it is
   corrected here rather than left standing.**

The four `fatal:` lines the probes used to print into the CI log are gone: `gitOrNull` now runs with
`stdio: ['ignore', 'pipe', 'ignore']`, because three `fatal:` lines above an `OK` read as a broken
step.

### F4 — D4's check now compares the declaration against the set the sweep iterates

`declared` and `ARTEFACTS` are separate bindings and the assertion sits at the point of use, in both
directions. Reconstructions, each logged before it was applied, restored immediately and the file
md5-verified back to pristine:

| reconstruction | before | after | what the run says now |
|---|---|---|---|
| `ARTEFACTS` to an enumerated list keeping all **three** marker carriers | **0**, output byte-for-byte the baseline | **1** | `scope: the sweep iterates 3 file(s) where the declared scope has 110 — a hand-narrowed sweep at the point of use is exactly the narrowing R17-F4 exposed; the 107 missing include AGENTS.md, ARCHITECTURE.md, CHANGELOG.md` |
| `ARTEFACTS` to an **eight**-file list, round 16's shape | **0** | **1** | same shape, `8 file(s)` against `110`, the 102 missing named |
| the **declared** side narrowed to eight files | 1 | **1** | unchanged |
| one reasoned exclusion dropping `/adr/` | 0 | **0** | **unchanged, and correct.** D4 sanctions a *declared* exclusion carrying its reason, and the run prints `− 4 excluded: <reason>` plus each unswept path. This is the one narrowing the check must **not** fail; naming it here is the point, so the next round does not re-find it as a defect |

Docblock limit 4 is rewritten to exactly that scope: it binds the rule to the iterated set; it does
not adjudicate a declared exclusion, and it does not verify the derivation itself.

### O1 — the loop-shape parser no longer counts a loop it is only talking about

`blankJs` blanks line comments, block comments and single/double/backtick string literals before
`matchAll`, width-preserved. **The control mutation is what found the real bug.** The first version
blanked correctly and the string case still reported 864: `loopBlock` sliced the block from the
**title text**, which sits *inside* a string literal, so the block's first quote character was the
title's closing quote and every quote pair after it was offset by one. `loopBlock` now slices from the
`it(` that owns the title. Measured, all four inserted inside the share block:

| reconstruction | before | after | want |
|---|---|---|---|
| `// for (const bogus of [1, 2, 3]) {}` | 864, exit 1 | **288, exit 0** | 0 |
| `const bogusSrc = 'for (const bogus of [1, 2, 3])';` | 864, exit 1 | **288, exit 0** | 0 |
| `/* for (const bogus of [1, 2, 3]) {} */` | 864, exit 1 | **288, exit 0** | 0 |
| **a real extra dimension**, `for (const bogus of [1, 2, 3]) { void bogus; }` — the control | 864, exit 1 | **864, exit 1**, naming `share: artefact says 288 … runs 864 (bogus 3 x tokens 3 x …)` and `zerofile: 48 … runs 144` | **1** |

So the blanking removed the false failures and none of the true ones. **One invalid reconstruction is
disclosed rather than counted:** an earlier control inserted the loop after `const heights`, which is
in the `describe` scope *above* both `it()` blocks, so `loopBlock` never saw it and its exit 0
measured nothing. Replaced by the version above.

### Every attack round 18 ran was re-run: 18 reconstructions, 18 verdicts as expected, 0 silent passes

10 marker attacks — mis-typed prefix, capitalised, reflowed across two lines, deleted outright,
trailing junk, unknown key, duplicated key, unparseable value, unknown density in `expect=`, a drifted
marked value — all **exit 1**. 5 module drifts — `PAD.fileRow` 15 to 20, `TEXT_LINE_RATIO` 1.15 to
1.2, `COLLAPSED_LIST_SHARE_FLOOR` 0.75 to 0.7, the head-cap guard dropped, `LIST_ROWS_FLOOR` 2 to 3 —
all **exit 1**. 2 staleness checks on the generated table — a token hand-edited, the marker inventory
hand-edited — both **exit 1**. 1 must-pass control, a well-formed marker inside a fenced block —
**exit 0**. Plus 4 CRLF probes over `test-plan.md`, `inspector-layout.ts`, `inspector-layout.spec.ts`
and `reference-figures.md` — all **exit 0**. Every mutated file md5-verified byte-identical to its
pristine copy after each restore; the mutation log is `C:\wt\t72-attack-log.txt`.

`pnpm figures:write` round-trips **byte-identically**, md5 `4fce755666e7058a0603b21d9764842b` on both
sides. `pnpm check:figures` in the main tree, quoted as the command prints it:

```
scope base: merge-base with main
scope: 112 markdown file(s) derived from the branch — every markdown file the branch touches: ...
figures: 23 markers in 3 file(s), 10 distinct claims, 45 values recomputed
  defaults applied: 12 share marker(s) checked at 30 files, 2 cap marker(s) at 13 px
coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer markers than figures
OK — every marked figure matches the shipped modules, and no check went missing.
```

<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7): no commit in this
repository prints these figures. Measured at `2db0519`, the single commit that carries T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`,
because T73's D3 migration retired 21 of the 23 markers inside the same uncommitted tree. Kept as
the dated record it is; `round19-records.md` says why a one-commit wave cannot speak of «the tree
this wave delivered» -->

The scope is **112**, not the 108 round 18 measured, because this wave added two markdown files — the
round-18 review record and this task file — and T73/T74's task files add more; the number moves with
the branch by design. The `coverage:` pair is **36 / 15**, unchanged and deliberately so: **T73**
performs the D3 migration that moves it. Stating it here rather than at zero is R18-F7's rule applied
to this task's own record.

### Gate

- `pnpm test` — **844 passed (844), 63 files**.
- `cargo test --all-features` — **389 running, 388 passed, 0 failed, 1 ignored**, plus two binaries
  with 0 tests and 0 doc-tests. **Measured here, not carried over:** the first run of this gate piped
  `cargo test` through `tail -8`, which cut the lib binary's summary and left only the doc-test
  section; reading that as the result would have reported «0 passed». Named because round 17's records
  state 388 and this is the first wave to re-measure it.
- `pnpm lint` — **clean over 267 files**; `cargo clippy --all-targets -- -D warnings` exit 0.
- `cargo fmt --all -- --check` — exit 0.
- `pnpm check:figures` — exit 0.

### Registration: additive, idempotent, and validated over all 74

`tasks.json` grows by **three entries, 1053 to 1102 lines, zero removed**, so no pre-existing entry
was reflowed; the adder skips an id already present, so re-running it leaves 74. Validated
mechanically rather than spot-checked: parses · **74** tasks · ids exactly `T1` to `T74` with none
missing or extra · **0** duplicate ids · **0** dangling deps · DFS finds **0** cycles · 74 task files,
every id with exactly one file and every file with an entry · **0 `files_hint` mismatches** ·
**0 `deps` mismatches** · `tracker.md` has **74** rows and no id missing.

The first validation run found **2 `files_hint` mismatches**, T72 and T73, between `tasks.json` and
the task files' frontmatter; both were reconciled to what the tasks actually touch — `package.json`
into T72, `spec.md` into T73 — and the re-run is 0. Reported because the check caught them, which is
what it is for.

`tracker.md`'s total is re-derived from its own rows rather than incremented: the parser reads 74
rows, **41 M + 33 S**, so **≈ 57.5 person-days**. The «≈ 55» the previous wave wrote went stale the
moment three rows were added, which is the same shape as every configuration count this branch has had
to fix, so it is now computed from the table each time rather than restated.

**The mermaid completeness check, stated as what it returns.** «Every id in `tasks.json` appears as a
mermaid node» returns **7 misses of 74** — `T27, T28, T29, T30, T31, T32, T33` — the pre-existing hole
**R18-F5** names, dating from T26 and not from T62. This task drew its own three nodes and the two
edges `T72 → T73 → T74` and deliberately did **not** touch the hole: **T74 owns it**, because closing
it and correcting the diagnosis that mis-dated it are the same finding, and splitting them is how the
round-17 wave came to report «both waves are now drawn» with seven ids missing.

### DoD bullets that could not be satisfied as written

1. «**No `src/` change:** `git diff --name-only HEAD -- src` is empty.» **Unsatisfiable as written,
   and not this task's doing.** The command returns **7** files, every one the uncommitted work of the
   round-14 to round-17 waves — nothing on this branch is committed, so a diff against `HEAD` cannot
   separate what this task authored from what it inherited. That is round 17's own recurring lesson,
   restated. What *is* verifiable, and is verified: this task opened no file under `src/`, and the five
   production md5s are byte-identical to the values round 18 recorded, before and after every
   reconstruction. The next wave's bullet should read «this task edited no file under `src/`, and the
   five md5s are unchanged», never «the diff is empty».
2. «**A reconstructed CI checkout** … exit 0.» Satisfied in four shapes, with one honesty note: a
   `--depth 1 --single-branch` clone of a *local* repository is the closest reconstruction available
   offline and it reproduces the failure exactly, but it cannot reproduce GitHub's `pull_request`
   merge-ref layout. **The CI step remains unexercised on a real runner** — nothing is pushed from
   this branch — so what is verified is the command in four checkout shapes, not a green GitHub run.
   Round-17 **O12** stays open in that narrow sense.
3. «`tsconfig.spec.json` does not reach it either», O2's second half. **Not closed, and deliberately
   not attempted.** The file is `.mjs`; type-checking it would mean renaming it to `.ts` with a build
   step — which its own docblock rejects, «Node strips the TypeScript types natively, so there is no
   build step» — or a second tsconfig for one file. Lint now covers it; typecheck does not.
4. «`pnpm lint` … and is clean.» True, and incomplete as a description of the change: biome's
   formatter had 1 error on first contact with the file, so it was formatted with
   `biome check --write`. That is a **whole-file mechanical reformat of a 983-line script**, and the
   semantic change is a small fraction of the resulting diff. Disclosed so a reviewer knows which
   hunks are format and which are behaviour.
