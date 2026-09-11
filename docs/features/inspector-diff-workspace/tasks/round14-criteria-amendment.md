---
id: T56
title: "Round-14 criteria amendment: the two carriers that say *less* instead of *share*"
layer: "docs"
deps: []
acs: ["AC-03", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T56 — Round-14 criteria amendment

## Why

**R14-S1-F1** (`_review/review-2026-09-08-round14.md`). T53 carried the carve-out to the five sites
round 13 named and verified byte-identity mechanically — the sentence is one distinct value, 313
characters, md5 `71e191bb259e30cb8285798a199677f3`, at eight artefact sites. Two more carriers state
the same guarantee with **no exception at all**, and both were invisible to T53's sweep because that
sweep enumerated four phrasings and **all four are built on the noun *share***. These two use the word
*less*:

| site | what it says today |
|---|---|
| `sad.md:21` | §1 *Top-3 quality goals*, QG-1: «the commit file list receives ≥ 50 % of the inspector height with the header expanded and ≥ 75 % collapsed (inspector right, no stacked panels), **and never less at the bottom or with stacked panels**» |
| `tasks/_epic.md`, the **List floor** invariant | the invariants list: «**List floor** (amended 2026-09-07, was the diff floor): the commit file list never receives less than 50 % of the inspector expanded and 75 % collapsed (AC-03), **and never less at the bottom or with stacked panels than it keeps on the right (AC-18, AC-19)**» |

Neither is quoted inside a dated marker and neither is a `_review/` record: both are live, current
assertions, and both cite the ACs the exception belongs to. Both are **false at the app's reachable
minimum** — measured from the shipped policy at `MIN_BOTTOM_PX` 220 with both stacked panels at
30 % + 20 % (a fixed 110 px remainder), header collapsed:

| configuration | protectedList | allowance | cap | share | right-hand floor |
|---|---|---|---|---|---|
| 220 / 110 collapsed comfortable | 94 | 16 | 34 | **0.690909** | 0.750 |
| 220 / 110 collapsed compact | 90 | 20 | 30 | **0.727273** | 0.750 |

`sad.md:21` is the sharp case: its own §10 QG-1 (`sad.md:733`) — the *full scenario for that same
quality goal*, by the §1 heading's own words «full scenarios in §10» — carries the exception, so the
SAD answers one question two ways inside one file. That is verbatim the defect R13-S1-F1 named for
`ux-flows.md` and T53 was written to remove, now in the wave sent to remove it. Both files are in
**T53's own `files_hint`**, and T53 edited `_epic.md` in this same wave to register T53–T55.

**The lesson this task pays for, one level deeper than T53's:** enumerate carriers by sweeping the
**negations** as well as the positive phrasings — `never less`, `no less`, `not less`, `never below`,
`never under`, `no worse` — not only every phrasing of one noun.

## What

**Owner decision (2026-09-08, round 14, decision 1): the canonical sentence in the SAD, the pointer in
the epic.** This is round-13 decision 1's criterion applied unchanged — prose takes the sentence, a
label or index takes the pointer.

1. **`sad.md:21`** — append T50's canonical sentence **byte-identical** to the eight sites that have
   it:

   > `**except where the header-cap guard binds — a remainder under 68 px comfortable / 60 px compact with the header expanded, or under 136 px / 120 px collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**`

   Keep the existing `(inspector right, no stacked panels)` scoping and the second sentence about the
   commit diff; the carve-out is additional, not a replacement.
2. **`tasks/_epic.md`'s `**List floor**` invariant** — append the pointer `except where the header-cap guard binds (AC-18)`. An
   invariant bullet stays a bullet; the reader who needs the numbers follows AC-18.
3. **`tasks/_epic.md`'s one-line goal** (round-14 **O1**, riding along) — it says «list floor of
   50 % / 75 %» with no placement scope. Either scope it («on the right, no stacked panels») or append
   the same pointer. It is a summary line, not a criterion, so the lighter of the two is fine — but
   say in the Outcome which was chosen and why.
4. Each of the three carries a **dated round-14 marker** naming R14-S1-F1 (O1 for `:7`) and the
   measured shares, so the next reader does not re-derive them.
5. Register **T56, T57, T58** in `tasks.json`, `_epic.md` and `tracker.md` — 58 tasks,
   `T56 → T57`, `T56 → T58`, `T57 → T58`, acyclic, `files_hint` in the JSON identical to each task
   file's. Edit `tasks.json` by **textual insertion**, not a parse-and-dump round trip: T53 recorded
   that `json.dumps` reflows 54 pre-existing lines, and the numstat must stay `n / 0`.

## Definition of Done

- [x] `sad.md:21` carries the canonical sentence, **extracted by regex and compared as strings**
      against the eight existing sites — one distinct value over all nine, 313 characters, md5
      `71e191bb259e30cb8285798a199677f3`. Do not eyeball it.
- [x] The **`**List floor**` invariant** of `_epic.md` carries the pointer `except where the header-cap guard binds (AC-18)`,
      byte-identical to the three sites that already have it (**47** characters, md5
      `c02eb85ec94f6385201a4f2de8f23d5e`; the review record's «59» was stage 1's regex artefact and is
      corrected there — see the Outcome).
- [x] **The negation sweep is clean.** Run
      `grep -rniE "never (less|below|under)|no less|not less|no worse" ` over `spec.md`, `sad.md`,
      `ux-flows.md`, `screens.md`, `test-plan.md`, `tasks.json`, `tasks/*.md`, the feature
      `CONTEXT.md` and the repo-root `CONTEXT.md`, **and** re-run T53's four *share* phrasings, and
      report every hit with a CARVED / BARE / OUT-OF-SCOPE classification. Every BARE hit must be
      either fixed by this task or explained in the Outcome with its scope (the two known
      out-of-scope hits are `screens.md:73`, an annotation inside the **right-placement** wireframe
      W-01a, and `test-plan.md:35`, which describes a test sweep rather than a guarantee — say so
      rather than leaving them unexplained).
- [x] Each of the three sites has a dated round-14 marker; `sad.md:21` and the `**List floor**` invariant cite **R14-S1-F1**, the goal line
      cites **O1**.
- [x] `tasks.json` has 58 tasks, parses, no duplicate id, no dangling dep, DFS finds no cycle, and its
      `files_hint` agrees with every task file for T1…T58 (0 mismatches, checked mechanically over all
      58, not by inspection). `git diff --numstat` on it is `n / 0`.
- [x] `_epic.md` edges and `tracker.md` Deps column agree with `tasks.json` for T56–T58;
      `tracker.md` says «Total: 58 tasks» and links this round's record.
- [x] No `src/` change in this task: `git diff --stat HEAD -- src src-tauri` unchanged by it.
- [x] Any DoD bullet that cannot be satisfied as written — including one whose grep still hits because
      the retired wording survives inside its own marker — is **named in the Outcome** with the
      reason. This is the bullet R14-S2-F1 exists because T54 did not honour.

## Notes

`deps: []`: this task writes the wording T58's records must match, and it registers the wave, so it
goes first.

`sad.md` / `_epic.md` / `tracker.md` / `tasks.json` are this task's alone; T57 touches only `src/`
and T58 only `round13-code-fixes.md` and `test-plan.md`, so the wave has no shared-file edge.

`_epic.md` is edited by this task for three separate reasons (the goal line, the **List floor**
invariant, and the T56–T58
registration). Do them in one pass and say so in the Outcome; three markers on one file is fine, three
passes over it is how a hunk gets lost.

## Outcome (2026-09-09)

Landed. Docs only — `git diff --stat HEAD -- src src-tauri` unchanged by this task (still the 6 files /
+438 / −22 that T54 left).

**Both carriers now state their exception, and the sentence is byte-identical at nine artefact sites.**
Extracted by regex from every artefact and compared as strings, not read: **one distinct value, 313
characters, md5 `71e191bb259e30cb8285798a199677f3`** — `spec.md:198` (AC-18), `spec.md:231` (§6 NFR row
3), `sad.md:733` (§10 QG-1), `sad.md:380` (the F2 prose), **`sad.md:21` (§1 QG-1, new)**,
`screens.md:343`, `ux-flows.md:179`, `test-plan.md:91` and `test-plan.md:167`. The pointer is likewise
one distinct value (47 characters, md5 `c02eb85ec94f6385201a4f2de8f23d5e`) at four carriers:
`sad.md:368`, `ux-flows.md:170`, `ux-flows.md:219` and **`_epic.md`’s `**List floor**` invariant (new)**. <!-- the parenthesis here gave the invariant's line number, twice corrected and twice stale within days — `:206` by T56's rows, then `:215` by T59's, then `:227` by T63's. Cited by anchor alone since 2026-09-10 (T66, review round 16 R16-S1-F4): an address that three consecutive waves moved is not worth recording, and the anchor never moves --> Both strings were
**extracted from disk** rather than retyped, so byte-identity is guaranteed by construction and not by
a comparison after the fact.

**Two wrong pointer lengths were found and corrected while doing this, and both are worth naming.**
The first attempt at this task asserted a hand-counted length of **46** and the assertion failed at 47.
Chasing that turned up the second: stage 1's report and, from it, this task's own DoD bullet 2 and the
round-14 review record all said the pointer is **59 characters** — stage 1's regex measured a wider
capture than the value it printed (`_r14-stage1-report.md:65`, `LEN 59  COUNT 5  VALUE: except where
the header-cap guard binds (AC-18)`, whose printed value is 47 characters). The record now carries a
dated correction and the DoD bullet the true figure. The byte-identity finding is unaffected — one
distinct value at every carrier either way — but a review record with a wrong measurement in it is the
same defect this branch has been sent back on five times, so it is corrected in place rather than left
for round 15.

**The epic's goal line (O1) is scoped, not pointed at.** «list floor of 50 % / 75 %» → «list floor of 50 % /
75 % **on the right without stacked panels**», matching how spec §6 rows 1–2 scope the same two
figures. The DoD asked which of the two options was taken and why: scoping, because this is a one-line
goal summary and the 47-character pointer is longer than the fact it qualifies, while the
cross-placement guarantee and its carve-out already live further down the same list, in the `**List floor**` invariant.

**The sweep, run over the negations as well as the noun.** `never less|no less|not less|never
below|never under|no worse|at least as much/large`, plus T53's four *share* phrasings, over `spec.md`,
`sad.md`, `ux-flows.md`, `screens.md`, `test-plan.md`, `tasks.json`, `tasks/*.md`, the feature
`CONTEXT.md` and the repo-root `CONTEXT.md`: **30 carriers, 10 carved, 20 bare** — and every one of the
twenty is out of scope, classified rather than left to a reviewer:

| bare hit | classification |
|---|---|
| `screens.md:73`, `test-plan.md:35`, `ux-flows.md:204` | the **expanded** 50 % floor, whose carve-out band is **unreachable in the app**. The smallest remainder any placement can produce is `MIN_BOTTOM_PX` 220 minus both stacked panels at 30 % + 20 % of 220 = **110 px**; `MIN_RIGHT_PX` is a *width* (`main-content.ts:38`), so on the right the column's height is the window's. The expanded bands are `h ≤ 67` comfortable / `h ≤ 59` compact — 110 clears both. Only the **collapsed** bands (`h ≤ 135` / `h ≤ 119`) contain 110, which is why every failure scenario rounds 11–14 wrote says «header collapsed». These three are true as written |
| `ux-flows.md:79` | «never below 2 rows with scroll» — the list's row floor, a different guarantee, and one the policy never breaks (`LIST_ROWS_FLOOR` binds unconditionally) |
| `inspector-layout-policy.md:17`, `:23` | T1's task file describing the **pre-reversal** contract (`min(fileCount, 6)`, «diff never below 50 %»). Historical, superseded by the 2026-09-07 reversal, and not a live criterion |
| the remaining 13 | `round9-`, `round13-` and `round14-` task files quoting the retired or swept wording deliberately, inside their own «what it says today» tables and sweep descriptions |

That is the check the previous five waves did not run, and it is the one that would have found
`sad.md:21` in round 12.

**Registration.** `tasks.json` parses, **58 tasks**, 0 duplicate ids, 0 dangling deps, DFS finds no
cycle; 58 task files, no id without a file, **0 `files_hint` mismatches over all 58**. `T56 → T57`,
`T57 → T58`, `T56 → T58` mirrored in `_epic.md`'s graph and rows and in `tracker.md`, which now has 58
task rows, reads «Total: 58 tasks» and links the round-14 record. The JSON was edited by **textual
insertion**: `git diff --numstat` on it is **360 / 0**, so the 55 existing entries keep their
formatting byte for byte.

**`_epic.md` was edited in one pass** for all three reasons (the goal line, the **List floor**
invariant, the T56–T58 registration),
as the Notes asked.

**DoD bullets that could not be satisfied as written: one, named here.** The sweep bullet asks that
«every BARE hit must be either fixed by this task or explained in the Outcome with its scope». Twenty
bare hits remain and none is fixed; all twenty are explained in the table above. The bullet reads as if
the expected steady state were zero bare hits, and it cannot be: six of the twenty are live artefacts
stating a *different* or *unreachable-band* claim, and thirteen are task files whose whole job is to
quote the wording being retired. The next wave's wording should be «every BARE hit is fixed or
classified», which is what was actually done.
