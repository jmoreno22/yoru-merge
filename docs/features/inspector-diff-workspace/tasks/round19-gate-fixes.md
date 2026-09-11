---
id: T75
title: "Round-19 gate fixes: stop the figure gate narrowing its own scope, and stop the registry gate reading prose as graph"
layer: "infra"
deps: []
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-20"]
files_hint: [
  "scripts/check-figures.mjs",
  "scripts/check-tasks.mjs",
  "scripts/registry-parse.mjs",
  "docs/features/inspector-diff-workspace/tasks.json",
  "docs/features/inspector-diff-workspace/tasks/round11-records.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T75 — Round-19 gate fixes

## Why

**R19-F1**, **R19-F2**, **R19-F3**, **R19-F4** and owner decisions **D1** and **D3** of
`_review/review-2026-09-11.md`, plus **R19-F8**'s docblock claim, which lives in the same comment
block D1 rewrites.

Round 18 made both instruments runnable. Round 19 found that each had kept a route to the outcome it
was built to prevent:

- **F1** — `check-figures.mjs` ordered its fallback rungs `main` → `origin/main` → `HEAD~` → whole
  tree, so the **narrowest** rung was preferred over the widest. `git merge-base HEAD HEAD~` is
  `HEAD~`, which scopes the sweep to the last commit: **3** markdown files on this branch against the
  **59** it touches, with all four ADRs, `spec.md`, `sad.md`, `screens.md`, `ux-flows.md` and
  `ARCHITECTURE.md` dropping out, and the run still printing «derived from the branch» and `OK`.
- **F2** — round 18's repair of the D4 scope check wrote `const ARTEFACTS = declared`, an alias to
  the same array, and put the comparison one line below it. The sweep is 343 lines further down, so
  narrowing it there — one `.filter()` at the `for` — exited 0 with the ADRs unread.
- **F3** — `check-tasks.mjs` regexed the mermaid block raw. `%%` is how a mermaid line is commented
  out, and a commented **edge** was still counted as drawn while a commented **node** was caught.
- **F4** — its frontmatter reader matched `field: [...]` only and skipped anything else in silence,
  so a list written as a YAML block sequence — the layout its own comment claims to tolerate — was
  never compared, and deleting a field was the silent way to resolve a mismatch. `acs` was not
  compared at all.

## Plan

1. **The parsers move to their own module.** `scripts/registry-parse.mjs` — `frontmatter`,
   `listField`, `stripMermaidComments`, `graphBlock`, `graphNodes`, `graphEdges`, `trackerRows`,
   `trackerTotal`. All total: no reads, no `git`, no exits, so **T76** can reach them without running
   the validator. → verify: `pnpm check:tasks` exits 0 with the same summary line as before.
2. **F1 per D1:** `HEAD~` leaves `SCOPE_BASES`. → verify: in a clean checkout with no `main` and no
   `origin/main`, the run names the widest rung instead of `HEAD~`, measured before and after in the
   same checkout.
3. **F2 per D3:** `ARTEFACTS` becomes its own `scopeFrom(all)` call, the loop appends what it reads
   to `visited`, and the D4 assertion runs **after** the loop over `visited`. → verify: the exact
   mutation that exited 0 in the review exits 1 and names the files it never read.
4. **F3:** `graphBlock` drops `%%` lines and, when the epic has a `## Task map` heading, reads only
   the block under it. → verify: a commented-out edge fails; a commented note does not inject one.
5. **F4:** `listField` returns `{ present, values }`, reads both layouts, and the caller fails when a
   field the registry populates is absent; `acs` joins the compared fields; a duplicated `tracker.md`
   row fails. → verify: the gate goes red on the live tree, which is the point.
6. **Resolve whatever `acs` turns up.** → verify: the AC chain still reaches 22/22 afterwards.

## Definition of Done

- `pnpm check:figures` and `pnpm check:tasks` exit 0 on the delivered tree.
- Each of the four defects has a mutation that exited 0 before this task and exits 1 after,
  **measured in the same place**, with the restore md5-verified.
- No sentence in either docblock claims a check the code does not perform.
- The AC chain is 22/22 after the `acs` comparison starts running.
- `pnpm test`, `pnpm lint`, the Rust half: green.

## Outcome (2026-09-11)

Landed. Instruments only. **This task edited no file under `src/`** and the five production md5s are
unchanged (`inspector-layout.ts` `f10fa099c0981638022f412395001db6`, `appearance-metrics.ts`
`f50d48f3108168abaf083311f6815eba`, `commit-inspector.ts` `44f017a4c415d7a1c001f7e0362d6a9c`,
`main-content.ts` `720244ba837d5fa7229ea935bb6d4704`, `main-content.html`
`d1fbdf2ef79301507843b0053f8b6586`).

### F1 — the chain can no longer degrade downwards, measured before and after in one checkout

`HEAD~` is gone from `SCOPE_BASES`. Both remaining rungs resolve a real merge-base, and anything else
falls to the whole tree, so **every rung is equal to or wider than the one before it**.

Measured in `C:\wt\r19ci`, a `git clone --depth 1 --single-branch` with the whole tree committed and
no `main`, running the pre-T75 script and the delivered one over the identical checkout:

| script | `scope base:` printed | markdown files swept |
|---|---|---|
| before | `HEAD~ (no main ref reachable — shallow checkout)` | **67** |
| after | `none — sweeping every markdown file under docs/ and the repo root` | **117** |

The 67 is this reconstruction's number, not the branch's: it committed the whole wave as one commit,
so `HEAD~..HEAD` covered all of it. On the branch as it now stands `git diff --name-only HEAD~..HEAD`
yields **3** markdown files against **59** from the real merge-base, which is the figure the review
blocked on. Both numbers are the same defect; only the reconstruction flattered it.

The docblock now states the invariant («every rung is equal to or wider than the one before it») and
gives the reason `HEAD~` cannot be one of them. **R19-F8 is closed in the same comment**: the claim
«rung 1 is what CI actually uses» is replaced by what `actions/checkout` does — on a `pull_request`
the merge commit is checked out detached and no local `main` is created, so **rung 2** is what fires;
rung 1 fires on a `push` to `main`, where the diff is empty and the run widens anyway.

`gitOrNull`'s silent `null` is left as it is, and the docblock says why: with the narrowing rung gone,
a git failure that is not «the ref is absent» can only widen the sweep. It fails safe now.

### F2 — the D4 check runs on what the loop visited

`ARTEFACTS` is a second `scopeFrom(all)` call rather than an alias; the sweep appends each file it
reads to `visited`; and the assertion that binds D4 runs **after** the loop, comparing `declared`
against `visited`. The cheap pre-flight against `ARTEFACTS` stays, so a narrowed set is still named
before six hundred lines of sweeping.

The control is the review's own mutation, run in the main tree, logged before it was applied and
md5-verified back to pristine:

```
for (const file of ARTEFACTS.filter((f) => !f.includes('/adr/'))) {
```

- before this task: **exit 0**, `scope: 112 markdown file(s)`, `OK — … no check went missing`
- after: **exit 1** — «the sweep visited 109 file(s) where the declared scope has 113 … the 4 never
  read include `adr/0001…`, `adr/0002…`, `adr/0003…`»

`adr/0003` is the file R17-F4 was raised about, and it is now named by path when it leaves the sweep.

### F3 and F4 — the registry gate reads graph as graph and frontmatter as frontmatter

`graphBlock` strips `%%` lines before either extraction and slices the block under `## Task map` when
that heading exists, so a second fenced block elsewhere no longer contributes. `listField` returns
`{ present, values }` and reads the block-sequence layout; the caller fails when a field the registry
populates is absent rather than skipping it; `acs` joins `deps` and `files_hint`; a duplicated
`tracker.md` row fails instead of printing one row count beside a different total.

Each is covered by a case in **T76**, and each of the three parser defects was proved detectable by
reverting that parser to its pre-fix form and watching the suite redden — C1 (no `%%` filter) 2
failed, C2 (inline-only `listField`) 3 failed, C3 (every mermaid block) 1 failed, the module
md5-verified back to pristine after each.

### The two `acs` drifts, resolved in opposite directions

Turning the comparison on made the gate **red on the live tree** at exactly the two addresses round
15 first recorded and rounds 16, 17 and 18 re-recorded as an observation:

```
T44 acs disagrees — tasks.json has [AC-01, AC-02, AC-03, AC-04, AC-05, AC-19],
                    round10-code-fixes.md has [AC-01, AC-03, AC-04, AC-05, AC-19]
T49 acs disagrees — tasks.json has [AC-01, AC-02, AC-03, AC-04, AC-18, AC-19],
                    round11-records.md has [AC-02, AC-03, AC-04, AC-18, AC-19]
```

They do not resolve the same way, which is why aligning one side wholesale would have been wrong:

- **T44** — `grep -c "AC-02" round10-code-fixes.md` returns **0**. The task never touched AC-02;
  `tasks.json` over-claimed. `AC-02` removed there.
- **T49** — `round11-records.md:53` re-points «`:35` (AC-01) and `:96` (AC-02)», so the work does
  touch AC-01 and the frontmatter was short. `AC-01` added there.

AC-02 is still claimed by **23** tasks afterwards, and an independent re-derivation of the chain over
all 22 criteria and 8 user stories reports **no AC dropping out at any hop** and no stray id.

### Gate

- `pnpm test` — **866 passed (866)**, 64 files (63 + the new `scripts` tier).
- `pnpm lint` — clean over **269** files.
- `pnpm check:figures` — exit **0**, `scope base: merge-base with main`, 113 markdown files,
  `2 markers in 1 file(s), 2 distinct claims, 6 values recomputed`, `coverage: 1 … 1`.
- `pnpm check:tasks` — exit **0**, `76 · ids T1…T76 · 76 task file(s) · 76 tracker row(s) ·
  76 graph node(s) · 87 graph edge(s)` once this wave is registered.
- `cargo` half: untouched by this task, measured once at the end of the wave.

### What this task did NOT do, named rather than left implied

**R19-F5**, **R19-F6** and **R19-F7** are docs findings and belong to T77 and T78; nothing here
touches them. The `check-figures.mjs` orchestration — scope derivation, the git rungs, the marker
sweep — is still covered only by its own reconstructions and by CI, not by a spec: T76 covers the
parsers, and the reason the rest is not covered is written there.
