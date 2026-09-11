---
id: T47
title: "Round-11 code fixes: the collapsed residue height, the class-based grow, the displayed-row-count wiring, the caller's clamp guard and the collapsed twin"
layer: "domain"
deps: ["T48"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-18", "AC-19"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T47 — Round-11 code fixes

## Why

Four more instances of the defect class rounds 6–10 spent five rounds removing — a live guard, or a
load-bearing input, that the suite cannot see — each proved by a mutation that leaves all 835 tests
green, plus the threshold round 10 already asked to have corrected —
[review round 11, R11-S1-F1, R11-S1-F2, R11-S2-F1, R11-S2-F2, R11-S2-F4, R11-S2-F6](../_review/review-2026-09-08-round11.md).

No production behaviour is wrong here. Every fix in this task is a **test** or a **comment**: the
policy is correct across the whole reachable space, and what is missing is the row that would catch
its next change.

**The collapsed residue class is still unwatched (R11-S2-F1).** T44 added `421` to close R10-S2-F2,
but the two halves of that finding have different residues:

```
expanded   headerAllowance = 0.50 h   round-half-up bites iff h is odd            → 421 covers it
collapsed  headerAllowance = 0.25 h   round-half-up bites iff h ≡ 2, 3 (mod 4)    → nothing covers it
heights = [200, 300, 420, 421, 560, 700, 900]  →  0, 0, 0, 1, 0, 0, 0 (mod 4)
```

Mutation, measured: `const headerMaxH = (headerCollapsed ? Math.round : Math.floor)(…)` leaves
**835 green**, while the swept behaviour breaks the §6 collapsed floor at 528 heights (comfortable)
and 520 (compact) between 40 and 1000 px. With `422` in the table the same mutation reddens at
`availableHeight: 422`, and the shipped policy stays green with `422` — measured both ways.

**The widened `growingChildren()` is a whitelist (R11-S2-F2).** `main-content.spec.ts:204-213` sees
the `flex-1` class or an inline `flex` whose grow term is not `0`. The mechanism it cannot see is the
one `sad.md:36` records as the pre-feature stack: give blame `class="… flex-[3] …"` and drop its
`[style.flex]`, and a stacked panel that grows — the exact violation of AC-19, and the reason AC-05
can say «left empty» — leaves the suite **835 green**. Note the tier limit: with no stylesheet loaded
in jsdom, `getComputedStyle(child).flexGrow` reports the initial `0` for a class-based grow, so a
computed-style assertion does **not** close this. What is observable is the declared mechanism.

**The signal AC-04's new clause rests on is pinned nowhere (R11-S1-F2).** The clause's own marker and
`inspector-layout.ts:70-71` both say the policy is fed the *displayed* row count. Mutation:
`commit-inspector.ts:548` `this.fileRows().length → this.details()?.files.length ?? 0` leaves
**63 files / 835 tests green** — a 30-file commit whose filter matches nothing would keep the 50 %
share reserved for a list drawing no row, which is R10-S1-F1's defect verbatim.

**The caller's clamp guard is unpinned, and it hides the collapsed clamp (R11-S2-F6).**
`commit-inspector.ts:585-587` `Math.max(layout.clampLines, 1)` — «a zero clamp would blank the body
for that frame». Mutation: drop the `Math.max` → **835 green**. And because the only consumer
overrides it, no collapsed `clampLines` the policy returns ever reaches the DOM: the two unit rows
that assert `clampLines === 0` (`inspector-layout.spec.ts:194`, `:210`) describe nothing observable,
and the one row that reads `--inspector-clamp-lines` (`commit-inspector.spec.ts:435`) is expanded.

**The cross-placement collapsed twin (R11-S2-F4, assertion half).** T40's 220 / 110 row is the
tightest configuration the app can reach and asserts the **expanded** case only. Its collapsed twin
is where §6 NFR row 3 is missed (0.6909 vs 0.7500) — legitimate policy under the owner's round-11
carve-out, and therefore behaviour that must be pinned so it cannot drift silently.

**The restore threshold is still wrong (R11-S1-F1 ≡ R11-S2-F5).** `inspector-layout.spec.ts:426-435`
says the deleted clause «needs the clause only below 68 px expanded and **126 px** collapsed … both
densities» and closes «only for a height under ~68 px». Swept against the shipped policy:

```
comfortable   expanded h ≤ 67   collapsed h ≤ 135
compact       expanded h ≤ 59   collapsed h ≤ 119
```

`126` is neither density's bound. The band `[126, 135]` fails for a *different* reason — there
`0.75h > 94`, so the two-row floor no longer binds and the miss comes from
`Math.max(headerAllowance, panelHeadH)` lifting a 31.5–33.75 px allowance to 34. And `110` and `130`
are not hypothetical: they are the remainders the bottom placement produces.

## What

- **Add one collapsed-residue height (R11-S2-F1, AC-02)** — `inspector-layout.spec.ts:359`
  `heights` gains **`422`** (`≡ 2 (mod 4)`). The comment at `:354-358` must stop describing the class
  as «≡ 0 (mod 4)»: that is the expanded condition; state both residues and which height watches
  which. The loop must be green with `422` and must redden under the collapsed-only-round mutation.
- **Assert the declared mechanism, not a whitelist (R11-S2-F2, AC-19, AC-05)** — in the AC-19 row
  (`main-content.spec.ts:389-409`), add an assertion that each stacked panel's wrapper declares a
  non-growing basis and carries no growth utility: its resolved `[style.flex]` starts with `0 0`
  **and** its class list contains no `flex-1` / `flex-auto` / `grow` / `flex-[n]`. Keep
  `growingChildren()` for the four existing callers. The class-based mutation must redden the row.
- **Pin the displayed-row-count wiring (R11-S1-F2, AC-04)** — one **component** row: 30 files, type
  a filter term that matches none, assert the written `--inspector-header-max-h` is the bare-head cap
  (`availableHeight − panelHeadH`) and `--inspector-list-rows` is `0`. The filter-input helper is at
  `commit-inspector.spec.ts:228-233` and `:649` already drives the filter. Must redden under
  `fileRows().length → details()?.files.length ?? 0`.
- **Pin the caller's clamp guard (R11-S2-F6, AC-03)** — one component assertion: collapse the header
  and assert `--inspector-clamp-lines` is `1` while the policy returns `0`. Must redden when the
  `Math.max(layout.clampLines, 1)` is dropped. This is also the only observable cover the collapsed
  `clampLines` behaviour has.
- **Pin the collapsed twin (R11-S2-F4, AC-18)** — add the collapsed case to the 220 / 110 row (or a
  sibling row): `headerCollapsed: true`, asserting `headerMaxH === panelHeadH` and the share it
  implies, with the comment naming the carve-out T48 writes into AC-18 and §6 row 3. Must redden if
  the panel-head guard goes.
- **Correct the restore threshold (R11-S1-F1)** — state `h ≤ 67` / `h ≤ 59` expanded and
  **`h ≤ 135` / `h ≤ 119`** collapsed, name **both** causes (the two-row floor up to 125, the
  panel-head guard from 126 to 135), and make the closing instruction carry the collapsed number
  instead of dropping it.

## Definition of Done

- [ ] Each of the five mutations below reddens exactly the row it should, on a tree verified clean
      before and after; the failing row, its `file:line` and the run output are recorded here:
      collapsed-only `Math.round`; blame growing through `flex-[3]` with `[style.flex]` dropped;
      `fileRows().length → details()?.files.length ?? 0`; `Math.max(layout.clampLines, 1)` dropped;
      `Math.max(…, panelHeadH)` dropped (must now redden the collapsed twin too).
- [ ] The shipped policy is green with `422` in the table; the loop asserts every configuration
      (8 heights × 6 counts × 2 collapse states × 2 token sets = 192) with no escape hatch.
- [ ] The restore-threshold comment states 67 / 59 expanded and 135 / 119 collapsed and names both
      causes; no sentence in it says «only … under ~68 px».
- [ ] No existing assertion relaxed, removed or emptied; `expect(` counts per touched spec file
      recorded before and after.
- [ ] `pnpm test` green three consecutive runs (the T43 rule), `pnpm lint`, `pnpm build` green;
      `tsc --noEmit -p tsconfig.spec.json` clean; no `src-tauri/` change.
- [ ] No `src/**` production file changed by this task — it is tests and comments only. If a fix
      seems to need a production change, stop and raise it: the round-11 review found the policy
      correct across the reachable space.

## Outcome (2026-09-08)

Landed. **Tests and comments only** — `git diff --stat HEAD -- src` touches no production file, and
`git status --porcelain -- src-tauri` is empty.

**RED classification: three false-passes, by design.** All three new rows went green on their first
run, and that is the correct result for this task: round 11 found the *policy* right across the whole
reachable space and the *cover* missing, so a row that reddened here would mean the policy is wrong.
Their value is established by mutation instead, which is what the Definition of Done asks for. The
count moved 835 → **838**.

**Mutations.** Each applied in a detached worktree carrying the wave as a working patch, run through
the serial suite, then restored; the three production files were compared byte-for-byte against the
wave afterwards (`diff` of the two `git diff HEAD -- src` outputs: identical) and the post-battery
run is 838/838 green.

| # | Mutation | Result |
|---|---|---|
| MUT-A | `inspector-layout.ts` `(headerCollapsed ? Math.round : Math.floor)(…)` — round on the collapsed path only | **1 failed / 837** — the sweep, `expected { availableHeight: 422, …} to deeply equal {…}`. Before `422` this left 835/835 green (R11-S2-F1) |
| MUT-B | `main-content.html` blame given `flex-[3]` with `[style.flex]` dropped | **1 failed / 837** — the AC-19 row, `expected '' to match /^0 0 /`. Before this row the same mutation left 835/835 green (R11-S2-F2) |
| MUT-C | `commit-inspector.ts:548` `fileRows().length` → `details()?.files.length ?? 0` | **1 failed / 837** — the new AC-04 filter row, `expected '25' to be '0'`: the list keeps 25 rows' worth of share for a list drawing none (R11-S1-F2 / R11-S2-F3) |
| MUT-D | `commit-inspector.ts` `Math.max(layout.clampLines, 1)` → `layout.clampLines` | **1 failed / 837** — the new AC-03 collapsed-clamp row, `expected '0' to be '1'` (R11-S2-F6) |
| MUT-E | `inspector-layout.ts` drop `Math.max(…, panelHeadH)` | **2 failed / 836** — T40's guard row **and** the new collapsed twin, both `expected 16 to be 34`. Before this task it reddened one row (R11-S2-F4) |

**The collapsed residue class is watched.** `heights` is now
`[200, 300, 420, 421, 422, 560, 700, 900]` — **192 configurations** in the share sweep (8 × 6 × 2 × 2)
and 384 in the whole-pixel-cap row above it (which also iterates `fileListCollapsed`). The comment
states both residues and which height watches which: `421` odd for the expanded `0.5h` quotient,
`422 ≡ 2 (mod 4)` for the collapsed `0.25h` one. Every configuration still asserts something — the
`nothingToDraw` branch asserts the bare head, unchanged from T44.

**The AC-19 row now asserts the mechanism, not only its effect.** `growingChildren()` is left as it
is for its four existing callers; the row adds `stackedPanelWrappers()`, which asserts each stacked
panel *declares* `0 0 …` and carries no growth utility (`flex-1`, `flex-auto`, `grow`, `grow-[…]`,
`flex-[…]`). The helper's docblock records why the complement cannot be measured instead: with no
stylesheet loaded, jsdom's `getComputedStyle(el).flexGrow` reports the initial `0` for `flex-[3]`
exactly as it does for a fixed panel, so a computed-style assertion would not have reddened MUT-B.
That is a tier limit, and T49 carries it into the plan.

**The restore threshold is corrected and re-attributed.** The note now states `h ≤ 67` / `h ≤ 59`
expanded and `h ≤ 135` / `h ≤ 119` collapsed, names the two distinct causes (the 2-row floor up to
125 px, the `panelHeadH` cap guard from 126 to 135 — worked example `h = 130 → cap 34 → share
0.7385`), records that the deleted predicate held for every `h < 190` expanded and `h < 376`
collapsed, and closes with **both** numbers instead of «only … under ~68 px».

**Two component rows where the unit tier could not reach.** The AC-04 row types a filter matching
none of thirty files and asserts the written `--inspector-header-max-h` equals the bare-head cap the
policy returns for `fileCount: 0` — computed in the row from the injected `AppearanceService` tokens,
not hard-coded — plus `--inspector-list-rows: 0`. The AC-03 row collapses the header and asserts
`--inspector-clamp-lines` is `1` while the policy returns `0`, which is the only observable cover the
collapsed-clamp behaviour has.

`expect(` counts, `HEAD` → now: `inspector-layout.spec.ts` 47 → 55, `main-content.spec.ts` 45 → 52,
`commit-inspector.spec.ts` 106 → 113. Nothing removed, relaxed or emptied.

**One correction to my own reading of a DoD bullet.** «the loop asserts every one of its 192
configurations» is right for the share sweep; the row above it is 384, because it iterates
`fileListCollapsed` too. No artefact stated that second number before — recorded here and handed to
T49 (round 11 O9).

## Notes

`deps: [T48]` is for the criteria text only: the collapsed twin's comment quotes the carve-out T48
writes into AC-18 and §6 row 3. If T48 slips, the assertions are still correct.

The commit must carry `SDD-Task: T47` and its `SDD-AC` trailers (R9-S1-F9). Per round 11 O1, the same
commit still carries T40–T46, whose test halves are also uncommitted.
