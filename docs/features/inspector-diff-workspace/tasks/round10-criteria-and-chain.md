---
id: T45
title: "Round-10 criteria and chain amendment: the empty-list rule, the flat KPI, and the layer T41 did not open"
layer: "docs"
deps: []
acs: ["AC-01", "AC-03", "AC-04", "AC-05", "AC-18", "AC-19"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/CONTEXT.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T45 — Round-10 criteria and chain amendment

## Why

T41 traced AC-01…AC-22 end to end for the first time and closed R9-S1-F1…F5, F7, F8, F10 and O5 at
the sites round 9 named. It stopped one layer short of where several of those findings actually
lived: the two measurements it removed from `spec.md` §6 are still what the SAD's own quality-goal
scenario tells the release checklist to run, and the preference count it corrected in three places
is still «two» in two others. Separately, the sharpest new rule of the T40 wave reached four
artefacts and the code but no criterion — [review round 10, R10-S1-F1…F7, F9, R10-S2-F4](../_review/review-2026-09-08-round10.md).

## What

### The criteria (owner decisions, 2026-09-08)

- **The empty-list rule becomes a criterion (R10-S1-F1)** — decision: **a clause in AC-04 plus a
  carve-out in the NFR rows**, not a new AC. `spec.md:113` AC-04 states the empty-commit rendering
  and nothing about the share; the reachable case is not «a commit with no changed files» but a
  filter matching nothing, because the policy is fed the *displayed* row count
  (`commit-inspector.ts:547`). Widen AC-04's *Given* to cover both, and add the clause: a list with
  no row to draw claims no share and keeps only its head, exactly as a collapsed one (AC-05).
  Then add the carve-out to the **Measurement** column of `spec.md:229` and `:230` — as written
  («≥ 50 % at every window size from 960 × 640 upward», measured
  `(inspector height − headerMaxH) / inspector height`) both rows forbid the behaviour: at 640 px
  with 0 displayed rows the policy gives `headerMaxH = 606` → 5.3 %.
- **Drop the ≥ 60 % clause (R10-S2-F4)** — decision: **remove it**. `spec.md:253`'s KPI asks for
  «≥ 60 % with the header expanded for a subject-only commit with two or fewer files», but under
  the measurement the same bullet defines the protected share is `max(94, 0.5·remainder) /
  remainder` = **exactly 0.50 for every remainder ≥ 188 px**, independent of file count and body
  length. It made sense against the pre-reversal «diff viewer share»; a protected share is a flat
  floor. The KPI keeps ≥ 50 % expanded and ≥ 75 % collapsed.

### `sad.md`

- **§10 QG-1 (R10-S1-F2)** — `sad.md:734` still verifies by «element-height measurement in the
  built app» and «side-by-side measurement against the 1.0.5 build», the two methods R9-S2-F6a and
  R9-S1-F7 closed and T41 removed from `spec.md` §6. Re-point both to the §6 measurement as
  restated (`the height the commit header may not cross`), and drop the 1.0.5 baseline for the
  bottom / stacked configurations — amended AC-18 replaced it. `sad.md:733` also still reads «its
  **height** is ≥ the share», the height/share mixture R9-S2-F6b resolved in favour of *share*.
- **§3 external systems (R10-S1-F6)** — `sad.md:73`, the row that enumerates what
  `preferences.json` gains from this feature, names two collapsed states and not
  `commitFileClickOpensWorkspace` (`preferences-schema.ts:94`, AC-22). The `sad.md:355` / `:399`
  sequence notes keep the phrase «the two collapsed states»: there it is accurate, not a count of
  what the feature adds.
- **C4 L2 container (R10-S1-F6)** — `sad.md:181` `ContainerDb(prefs, …, "…now including the two
  collapsed states")`. Three.
- **§2 constraints (O-8)** — `sad.md:36` still lists the inspector column as «commit inspector
  `flex-[2]`, diff viewer `flex-[3]`, blame `flex-[3]`, file history `flex-[2]`». It reads as the
  pre-feature baseline, which is what §2 is for; add the date marker that says so, or re-point it.

### `CONTEXT.md` (R10-S1-F7)

`docs/features/inspector-diff-workspace/CONTEXT.md:11` defines the commit file list as «shown in
the inspector **between the commit header and the diff viewer** … **bounded in height**», and
`:13` defines the diff viewer as «the diff pane inside the inspector». `sad.md:766` declares this
file canonical over the SAD's own repeats, and `spec.md:11`, `sad.md:14`, `ux-flows.md:15`,
`screens.md:15` and `test-plan.md:11` all send readers here first — so the canonical entry is now
the stale one, while `sad.md:772`'s copy was amended to «no upper bound». Amend both terms, move
`updated_at` off `2026-09-02`, and note in the diff-viewer entry that in History it is only a
parking slot. The repo-root `CONTEXT.md:12` (O-9) is weaker — still true of Changes — but is the
other half of the same two-level contract; decide it here.

### Bookkeeping (R10-S1-F9 and the observations)

- **T40's dependency on T43** is in `tasks.json` (`["T41","T43"]`) and in `_epic.md`'s mermaid
  graph (the `T43 --> T40` edge) and its T40 node, and missing from the three records a human
  reads: `round9-code-fixes.md:5` frontmatter, `tracker.md:47` and `_epic.md`'s T40 **Deps**
  cell.
  <!-- addresses replaced by anchors 2026-09-10 (T66, review round 16 R16-S1-F4): the three
  `_epic.md` line numbers here (`:93`, `:102`, `:151`) were correct when written and two of them
  now point at a T47 node and a blank line, because every later wave inserted registration rows
  above them. A task that registers tasks moves every line below its insertion point, so no
  record may address anything below that point by number --> T40's own Outcome says every measurement was taken after T43.
- **O-3** the four new task files list `tracker.md` / `_epic.md` / `tasks.json` in `files_hint`;
  `tasks.json` lists neither for any of them. T34–T39 agreed exactly (round 9 O11).
- **O-4** `tasks.json` T40 `files_hint` still names `diff-viewer/diff-view.spec.ts`; the chevron
  row landed in `diff-workspace/diff-workspace.spec.ts` (recorded honestly at
  `round9-code-fixes.md:96`, but the machine contract was not followed up).
- **O-10** `tracker.md:52`'s provenance sentence lists «T40–T42 of review round 9»; T43 is missing.
- **O-1** `screens.md:16` and `test-plan.md:12` still cite «`spec.md` §5 AC-01…21».
- **O-7** `screens.md:52`'s test-id list was not extended with `inspector-click-opens`.
- **O-12** AC-06's chevron clause reached `spec.md`, `sad.md` and `screens.md` but not
  `ux-flows.md:207`. Flow altitude, so arguably correct to omit — decide and record.
- **O-6** `commit-inspector.spec.ts:516`'s title still says «keeps … the file in the viewer»
  (title only; the assertion is correct).

## Definition of Done

- [ ] AC-04 carries the empty-list clause and a *Given* that covers the filter-with-no-match case;
      `spec.md:229` and `:230` carry the carve-out in their Measurement column.
- [ ] `grep -n "60 %" spec.md` returns nothing in §7.
- [ ] `grep -rniE "element-height|1\.0\.5 build" sad.md spec.md` returns only dated historical
      markers.
- [ ] `sad.md`'s §3 external-systems row and its C4 container name three durable preferences; the
      only surviving «two collapsed states» are the §6 sequence notes, where the phrase is right.
- [ ] `CONTEXT.md` no longer places the commit file list «between the commit header and the diff
      viewer» and no longer calls it bounded in height.
- [ ] T40's `deps` read `T41, T43` in all five records.
- [ ] `tasks.json` and every task file of the round-9 and round-10 waves agree on `files_hint`. <!-- corrected 2026-09-08 (T49, review round 11 R11-S1-F3): as written this bullet claimed the agreement, and two of seven records did not have it — T40's file still named `diff-viewer/diff-view.spec.ts`, and this task's own file omitted `screens.md` and `ux-flows.md`, which it amended -->
- [ ] Every amended line carries a dated `amended 2026-09-08 (owner, review round 10 …)` marker, as
      `269fba0` and T41 did.
- [ ] No `src/` change in this task.

## Outcome (2026-09-08)

Landed. Docs only — `git status --porcelain -- src` shows no file this task touched; `pnpm lint`
clean (266 files).

**Criteria.** AC-04's *Given* now covers both ways a list can have no row to draw (no changed files,
or a filter matching none) and its *Then* carries the no-share clause, pointing at AC-05 for the
rule it shares. The Measurement column of the two §6 protected-share rows carries the matching
carve-out. §7's KPI lost the ≥ 60 % clause, with the arithmetic that makes it unreachable recorded in
its marker rather than in a commit message nobody re-reads.

**Chain.** `sad.md` §10 QG-1 now verifies by the §6 measurement and says *share*, not height, for the
bottom and stacked configurations — the two methods R9-S2-F6a and R9-S1-F7 closed are gone from the
scenario that drives the release checklist. §3's external-systems row and the C4 container name three
durable preferences. §2's flex-stack line is marked as the pre-feature baseline it is (O11). The
canonical `CONTEXT.md` no longer places the commit file list «between the commit header and the diff
viewer», no longer calls it bounded in height, and its diff-viewer entry says where the pane actually
lives in each view; `updated_at` moved to 2026-09-08. `screens.md` cites AC-01…22 and lists
`inspector-click-opens`; `ux-flows.md`'s AC-06 row carries the chevron clause (O13 — decided *in*,
because the map is the artefact a future round greps).

**Bookkeeping.** T40's `deps` read `T41, T43` in all five records. `tasks.json` was corrected for
T40's chevron row, which landed in `diff-workspace.spec.ts` and was still recorded as
`diff-view.spec.ts` (O7). <!-- corrected 2026-09-08 (T49, review round 11 R11-S1-F3): this sentence
claimed `tasks.json` and the four round-9 task files agree on `files_hint`; only `tasks.json` was
fixed. T40's own file kept the stale path, and this task's `files_hint` never named `screens.md` or
`ux-flows.md` although its Outcome below reports amending five lines across them. Both are fixed now --> `tracker.md`'s provenance
sentence covers T43 (O14) and the round-10 wave; the totals moved to 46 tasks.

**One DoD wording corrected while running it.** The bullet «`grep -rn "two collapsed states"` returns
nothing» was wrong as a check: `sad.md:355` and `:399` are §6 sequence notes where the phrase is
accurate prose, not a count of what the feature adds. The DoD now names the two sites that had to
change (the §3 row and the C4 container) instead of a grep that would have pushed correct text
around.

## Notes

The commit must carry `SDD-Task: T45` and its `SDD-AC` trailers (R9-S1-F9).
