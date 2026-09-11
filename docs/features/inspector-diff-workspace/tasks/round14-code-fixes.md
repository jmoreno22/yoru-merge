---
id: T57
title: "Round-14 code fixes: the stale `round(` in the AC-03 comment and the vacuous `fileCount === 0` arm"
layer: "domain"
deps: ["T56"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: [
  "src/app/shared/components/main-content/main-content.spec.ts",
  "src/app/core/services/inspector-layout.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T57 — Round-14 code fixes

## Why

Two things from `_review/review-2026-09-08-round14.md`. **Unlike the last four waves, this one changes
a production file** — one deleted condition in the layout policy — so the gate is not a formality.

**R14-S2-F2 — a comment names an operation the policy no longer performs, and the patch under review
is the patch that removed it.** `main-content.spec.ts:388`:

```
// round(560 − max(50 % floor 280, 2-row floor 34 + 2 × 30)) — the cap is
// what the list's share leaves the header, not what the diff's did
// (T31 — V3, re-pinned for the 2026-09-07 reversal).
```

At `805a32d` the policy really was `Math.round(Math.max(headerAllowance, panelHeadH))`
(`git show 805a32d:src/app/core/services/inspector-layout.ts`, line 77); the **uncommitted wave** —
T44, the round-10 fix for R10-S2-F2 — changed it to `Math.floor` at `inspector-layout.ts:84`, and the
T44 hunk did not sweep the companion comment. The comment was written true in `cd7f546`
(`git log -S "round(560"` confirms). So the tree under review contains a comment describing the
operation the same tree just removed.

It matters here specifically because `inspector-layout.spec.ts:322-330` adds the heights `421` and
`422` *only* to watch rounding, and `:504-528` states «FLOOR, not round» and quantifies it
(`inspector-layout.ts`'s FLOOR comment and the `Math.floor(Math.max(headerAllowance, panelHeadH))`
beside it: 434 of the heights between 40 and 1000 px expanded, and half of them
collapsed). One line in the companion component spec now says the opposite. A maintainer who acts on
it and restores `Math.round` costs the list its pixel at every odd column height — the regression
R10-S2-F2 removed. The sweep at `421` reddens, so it fails loud; the comment is still false.

The **value** is right: `560 − max(280, 94) = 280`, an integer where floor and round agree, so the
assertion at `:391` is correct. Only the operation name is wrong.

**R14-S2-F3 — the `fileCount === 0` arm of `listRows` is provably vacuous, so the rule is written
twice with nothing distinguishing the operative copy from the dead one.** `inspector-layout.ts:100-106`:

```ts
const listRows =
  fileListCollapsed || fileCount === 0
    ? 0
    : Math.min(
        fileCount,
        Math.max(LIST_ROWS_FLOOR, Math.floor(listHeight / fileRowH)),
      );
```

With `fileCount === 0` the else-branch already returns `Math.min(0, Math.max(2, …)) = 0`. Dropping the
`|| fileCount === 0` half (review mutation **C6**) leaves **839 green** — the only one of thirty-one
mutations this round that does — and stage 2 re-derived the equivalence exhaustively over **720 360**
configurations (both density token sets × `availableHeight` 0…2000 × `fileCount ∈ {0,1,2,6,30}` ×
`bodyLines ∈ {0,1,12}` × both collapse flags × `stackedPanelsHeight ∈ {0,110,200}`): **0 differing
outputs**.

Its sibling at `:73`, inside `protectedList`, is the arm that carries AC-04 / AC-05 — mutation **C5**
reddens three rows across two tiers (`inspector-layout.spec.ts:150` `expected 320 to be 606`, the
sweep at 200 px, `commit-inspector.spec.ts:583` `expected 400 to be 766`) — and the comment explaining
the displayed-row-count rule (`:68-71`) sits above **that** one. A maintainer told to «remove the
redundant `fileCount === 0`» has an even chance of removing `:73`, which at a 640 px column with an
empty file list changes the header cap from 606 to 320 and leaves half the inspector blank: exactly
the regression AC-05's no-share clause exists to prevent.

## What

**Owner decision (2026-09-08, round 14, decisions 2 and 3): fix the word, delete the arm.** Deleting
removes the ambiguity instead of documenting it — the rule stays written once, in the place that
executes it.

1. **`main-content.spec.ts:388`** — `round(` → `floor(`. Nothing else in the comment; the value and
   the assertion are correct. Add a short dated round-14 marker citing R14-S2-F2 so the next reader
   knows the word was corrected rather than always having been right.
2. **`inspector-layout.ts:101`** — delete `|| fileCount === 0` from the `listRows` condition, leaving
   `fileListCollapsed ? 0 : Math.min(fileCount, …)`. **Do not touch `:73`.** If the deletion leaves the
   two arms visually asymmetric enough to invite the opposite mistake, one clause in the `:68-71`
   comment saying that `protectedList` is where the rule lives and `listRows` gets it for free is
   welcome — but that comment must be true of the code after the edit, not before.
3. Nothing else in either file. No new test: a behaviour-neutral deletion cannot be pinned by a test
   that would fail either way, and writing one would be a false pass by construction. What proves it
   is the equivalence sweep in the DoD.

## Definition of Done

- [x] `grep -n "round(560" src/app/shared/components/main-content/main-content.spec.ts` returns
      nothing outside a dated marker that quotes the retired word; the line reads `floor(560 − …)`.
- [x] `inspector-layout.ts` no longer contains `fileCount === 0` in the `listRows` expression, and
      **still contains it in `protectedList`** — the condition goes from **two occurrences in code
      to one**, the `protectedList` arm. `grep -c "fileCount === 0" src/app/core/services/inspector-layout.ts`
      still returns **2**: `:79` is the arm, and `:74` is the round-14 comment quoting the retired
      condition in order to explain its removal, which is the house convention working.
      <!-- re-worded 2026-09-09 (T62, review round 15 R15-S1-F5): the bullet said the count
      «goes 2 → 1» and was ticked; the count went 2 → 2, with the second occurrence moving from
      code to prose, and the Outcome then declared that no bullet was unsatisfiable. The rule, for
      the third time: a bullet whose subject is a count says what the command returns, never what
      the change did to the code -->
- [x] **Equivalence, re-derived rather than trusted.** Sweep the policy before and after the deletion
      over at least the review's grid (both density token sets × `availableHeight` 0…2000 ×
      `fileCount ∈ {0,1,2,6,30}` × `bodyLines ∈ {0,1,12}` × both collapse flags ×
      `stackedPanelsHeight ∈ {0,110,200}`) and record **0 differing outputs** on all three returned
      fields. State the configuration count actually run.
- [x] **The operative sibling is still covered.** Re-run mutation **C5** (drop the `fileCount === 0`
      arm from `protectedList`) after the edit and confirm it still reddens **3 rows / 836**, quoting
      each row and message. This is the check that makes the deletion safe rather than merely green.
- [x] **The known caveat is recorded:** with `fileRowH = 0` the deleted arm was the only thing turning
      a `NaN` into `0` (`Math.floor(x/0) = NaN`, `Math.max(2, NaN) = NaN`, `Math.min(0, NaN) = NaN`).
      No density token set reaches `fileRowH = 0` (`styles.css:302` and the compact override), so the
      configuration is unreachable — say so in the Outcome rather than leaving it for a reviewer to
      find.
- [x] Whole gate: `pnpm test` green on **three consecutive serial runs with identical counts** (expect
      **839** — no test is added or removed; state the count), `pnpm lint` clean over 266 files,
      `tsc --noEmit -p tsconfig.spec.json` exit 0, `pnpm build` clean with no budget warning. Run it on
      an otherwise idle machine: round-14 **O9** measured five `Test timed out in 5000ms` in
      `diff-workspace.spec.ts` under CPU contention alone.
- [x] `git diff 805a32d -- src | grep -c '^-.*expect('` is **0** — no assertion removed, relaxed or
      emptied. No `it.skip` / `.only` / `.todo` / `.concurrent`.
- [x] `git diff --name-only 805a32d -- src` names the six files of the wave and no more, and the two
      this task changes are among them; no `src-tauri`. (Write the check against **`805a32d`**, not
      `HEAD` — T54's bullet was written against `HEAD` and could not be satisfied while the wave is
      uncommitted.)

## Notes

`deps: [T56]`: the criteria wording comes first, as in every wave since round 9.

Both files are this task's alone; T56 and T58 touch no `src/` file.

This is the first production change in four waves. The floor to beat is the round-14 battery: A1–A5,
B1–B7, C1–C5, C7–C9, D1–D3 and the lead's six all redden today and must still redden after the edit —
at minimum re-run **C5**, **C7** (`LIST_SHARE_FLOOR` 0.5 → 0.45, 9 rows), **C9** (`listRows`' own
2-row floor) and **A1**, since C9 and A1 sit closest to the line being deleted.

## Outcome (2026-09-09)

Landed. Two files under `src/`: one spec comment and one deleted condition in the policy.

**The word.** `main-content.spec.ts:388` now reads `floor(560 − max(50 % floor 280, 2-row floor 34 +
2 × 30))`, with a marker recording that it read `round(` until round 14, that it was true when written,
and that T44 changed the policy for R10-S2-F2 without sweeping it. `grep -n "round(560"` returns
**nothing** — the marker paraphrases the retired word rather than quoting the whole expression, so the
bullet is satisfied literally and no convention is bent.

**The arm.** `inspector-layout.ts`'s `listRows` is now `fileListCollapsed ? 0 : Math.min(fileCount,
Math.max(LIST_ROWS_FLOOR, Math.floor(listHeight / fileRowH)))`. `fileCount === 0` survives **once in
code**, in `protectedList`, and the comment above it now says so: it names that arm as the only place
the empty case is decided, says `listRows` gets 0 for free from the `Math.min`, and records the
asymmetry that made the two look interchangeable (removing this one reddens three rows across two
tiers, removing the other reddened nothing).

**`pnpm lint` failed on the first run, and it was a real failure — the only thing this wave's gate
actually caught.** With the shorter condition biome wants the whole expression on three lines instead
of seven (`Formatter would have printed the following content` at `:104-114`). Fixed with
`biome format --write` on that one file; `pnpm lint` clean over 266 files afterwards. Worth recording
because it is the first time in six waves that the gate rejected the wave rather than confirming it.

**Equivalence, re-derived twice.** `inspector-layout.ts` was compiled before and after the deletion
(`npx tsc --ignoreConfig --module commonjs`) and both versions run over the same grid: both density
token sets × `availableHeight` 0…2000 × `fileCount ∈ {0,1,2,6,30}` × `bodyLines ∈ {0,1,12}` × both
collapse flags × `stackedPanelsHeight ∈ {0,110,200}` = **720 360 configurations**, comparing all three
returned fields. **0 differing outputs**, matching R14-S2-F3's own number. Run **twice**: once against
the edited-but-unformatted file and again against the formatted file that actually ships, because the
first sweep predated the lint fix and the DoD asks for re-derivation, not for trust.

**The operative sibling is still covered.** Mutation **C5** (drop the `fileCount === 0` arm from
`protectedList`) re-run after the edit, on the **formatted** tree:

| row | message |
|---|---|
| `inspector-layout.spec.ts` «claims no share when there is nothing to draw, exactly as a collapsed list does (AC-04, AC-05)» | `expected 320 to be 606` |
| `inspector-layout.spec.ts` «keeps the list at or over its share in every configuration where the list is expanded» | `expected { availableHeight: 200, …(3) } to deeply equal { availableHeight: 200, …(3) }` |
| `commit-inspector.spec.ts` «AC-04: a filter that matches nothing releases the whole share, not just the rows» | `expected 400 to be 766` |

**3 failed / 836**, two tiers, exactly as round 14 measured. The deletion is therefore provably
behaviour-neutral **and** provably has not moved the cover of the arm that carries the behaviour.

**The rest of the floor still reddens**, each restored by md5:

| mutation | result |
|---|---|
| **C7** `LIST_SHARE_FLOOR` 0.5 → 0.45 | **9 failed / 830** across `inspector-layout.spec.ts` and `main-content.spec.ts` |
| **C9** `listRows` drops its own 2-row floor | **1 failed / 838** — «binds both hard floors at the bottom placement with blame and file history stacked», `expected 1 to be 2` |
| **C4** `Math.floor` → `Math.ceil` in `headerMaxH` | **1 failed / 838** — the T29 sweep at `availableHeight: 421` |
| **A1** the fourth basis `'0 0 28.6%'` → `'0 0 58.6%'` | **1 failed / 838** — `expected [ '0 0 58.6%' ] to deeply equal [ '0 0 28.6%' ]` |

**A harness bug of mine, disclosed rather than left as a gap.** C9's first run reported «MUTATION DID
NOT APPLY». The cause was my own driver, not the suite: the replacement text
`Math.floor(listHeight / fileRowH)` contains a `/`, which terminated the `perl s/…/…/` expression. Re-run
with the pattern and replacement passed through the environment instead of interpolated into the
regex, C9 reddens as above. The four mutations whose replacements contained no `/` were unaffected.

**No new test, and why.** A behaviour-neutral deletion cannot be pinned: any test would pass before and
after by construction, which is the false-pass the RED classification exists to catch. What stands in
for it is the 720 360-configuration equivalence sweep plus C5. The suite count is unchanged at **839**.

**The NaN caveat, sourced.** The deleted arm was the only thing turning `NaN` into `0` when
`fileRowH === 0` (`Math.floor(x/0) = NaN` → `Math.max(2, NaN) = NaN` → `Math.min(0, NaN) = NaN`). It is
unreachable **by construction, not by convention**: `fileRowHeight = Math.round(uiFontSize * 1.15 +
15 * padScale)` (`appearance-metrics.ts:80-85`) and `clampUiFontSize` bounds `uiFontSize` to
`[MIN_UI_FONT_SIZE, MAX_UI_FONT_SIZE] = [11, 17]` (`preferences-schema.ts:234-235, 440-443`), so the
smallest value any density can produce is **22 px** (compact, 11 px font, `padScale` 0.6).

**Gate, measured on an idle machine as O9 asks.** `pnpm test` **839 / 839, 63 files, three consecutive
serial runs identical** · `pnpm lint` clean, 266 files · `tsc --noEmit -p tsconfig.spec.json` exit 0 ·
`pnpm build` clean, **908.38 kB** initial total, no budget warning · and the Rust half of the configured
gate, which no previous wave in this series needed: `cargo fmt --check` exit 0, `cargo clippy
--all-targets -- -D warnings` exit 0, `cargo test --all-features` **388 passed / 0 failed / 1 ignored**.
No `Test timed out` line in any run.

`git diff 805a32d -- src | grep -c '^-.*expect('` = **0**; no `it.skip` / `.only` / `.todo` /
`.concurrent`; `git diff --name-only 805a32d -- src` names the six files of the wave and nothing else;
`src-tauri` empty in both `git status` and the feature diff.

**DoD bullets that could not be satisfied as written: one, named 2026-09-09 by T62** (review round
15, **R15-S1-F5**). Bullet 2 asserted that `grep -c "fileCount === 0"` on the policy
«goes 2 → 1». It returns **2**:

```
$ grep -c "fileCount === 0" src/app/core/services/inspector-layout.ts
2
$ grep -n "fileCount === 0" src/app/core/services/inspector-layout.ts
74:  // repeat `fileCount === 0` vacuously, which made the two arms look
79:    fileListCollapsed || fileCount === 0
```

`:79` is the surviving `protectedList` arm and `:74` is this wave's own comment quoting the retired
condition — correct behaviour, and the same shape as the bullet T58 had just re-worded for T54. The
substance held (the arm really is gone from `listRows`, and the equivalence was re-derived over
720 360 configurations by T57, 2 521 260 by round-15 stage 1 and 2 241 120 by the lead, all with 0
differing outputs); what failed was the report. The bullet is re-worded above with the original
preserved in its marker. The other bullet that could have tripped was written against `805a32d`
rather than `HEAD`, precisely because of R14-S2-F1, and holds as written.
