---
id: T53
title: "Round-13 criteria amendment: the artefacts the carve-out still has not reached"
layer: "docs"
deps: []
acs: ["AC-03", "AC-18"]
files_hint: [
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T53 — Round-13 criteria amendment

## Why

T50 carried the corrected carve-out to six artefacts and verified byte-identity mechanically. **Five**
more state the same guarantee with no exception at all — four found independently by both reviewers
(`_review/review-2026-09-08-round13.md`, **R13-S1-F1**) and one found while executing this task:

| site | what it says today |
|---|---|
| `sad.md:368` | §6 F2, the «inspector placed at the bottom» branch: «the list keeping at least the share it has on the right» |
| **`sad.md:380`** | the prose paragraph that narrates the same F2 diagram: «at the bottom the same policy runs over the shorter remainder and the list keeps at least the share it has on the right» — **a fifth site neither reviewer enumerated**, found by sweeping every phrasing of the claim rather than the four they named |
| `ux-flows.md:170` | the US-07 flowchart, node C: «the list keeping at least the share it has on the right» |
| `ux-flows.md:219` | ux-flows' own AC → flow map, the AC-18 row: «the list keeps at least its right-hand share» |
| `screens.md:343` | Rendering variants → «Inspector at the bottom»: «the commit file list keeps at least the share of the column it has on the right» |

All five are **false at the app's reachable minimum**. Measured from the shipped policy at
`MIN_BOTTOM_PX` 220 with both stacked panels at 30 % + 20 %, so a remainder of 110, header collapsed:

| configuration | cap | share | right-hand floor |
|---|---|---|---|
| 220 / 110 collapsed comfortable | 34 | **0.690909** | 0.750 |
| 220 / 110 collapsed compact | 30 | **0.727273** | 0.750 |

This is **R12-S1-F2's exact class** — a carve-out that reached the sites an owner decision named and
not the rest — recurring in the wave sent to close it, and then once more inside the finding itself:
the reviewers enumerated four carriers and there were five. Two of the three files (`ux-flows.md`,
`screens.md`) are in T50's own `files_hint`, and both `ux-flows.md` and `sad.md` are the sharp case —
`ux-flows.md:179` and `sad.md:733` carry the canonical sentence while `:170` / `:219` and `:368` /
`:380` of those same files contradict it, so each file gives a reader two answers for one measurement:
the defect R12-S1-F2 flagged in `test-plan.md` and T52 fixed there. **The lesson this task pays for:
enumerate carriers by sweeping every phrasing of the claim, not by taking a finding's list.**

## What

**Owner decision (2026-09-08, round 13, decision 1): the canonical sentence in prose, an explicit
pointer in the diagram node and the index cell.** The verifiable criterion is that no artefact states
the guarantee without its exception; a 313-character sentence inside a mermaid node label would be
unreadable and is not what the decision asks for.

**Correction to the decision's premise, made while executing it and recorded here rather than
silently:** the decision was put to the owner with `sad.md:368` described as a prose site. It is not —
it is a message label inside the §6 F2 `sequenceDiagram`, the same kind of carrier as
`ux-flows.md:170`. `sad.md`'s prose carrier is `:380`, the paragraph that narrates that diagram, which
neither reviewer enumerated. The decision's own criterion settles both: the prose sites take the
sentence, the diagram labels take the pointer. So the split below is five sites, not four, and it
follows the decision rather than departing from it.

1. **`sad.md:380`** (the F2 prose paragraph) and **`screens.md:343`** — carry T50's canonical
   sentence **byte-identical** to the six sites that already have it:

   > `**except where the header-cap guard binds — a remainder under 68 px comfortable / 60 px compact with the header expanded, or under 136 px / 120 px collapsed: there the cap is lifted to a full panel head and the ratio yields, because a header shorter than its own head disappears behind its own scrollbar (AC-03)**`

   `screens.md:343` keeps its "the 50 % / 75 % shares are not measured here" clause; the carve-out is
   additional, not a replacement.
2. **`sad.md:368`** (the F2 sequence message), **`ux-flows.md:170`** (flowchart node C) and
   **`ux-flows.md:219`** (AC-18 row of the AC → flow map) — append the pointer
   `except where the header-cap guard binds (AC-18)`. A label stays a label; the reader who needs the
   numbers follows AC-18, which the prose of both files also quotes in full.
3. Each of the five carries a **dated round-13 marker** naming R13-S1-F1 and the measured shares, so
   the next reader does not re-derive them.
4. Register **T53, T54, T55** in `tasks.json`, `_epic.md` and `tracker.md` — 55 tasks, `T53 → T54`,
   `T53 → T55`, `T54 → T55`, acyclic, `files_hint` in the JSON identical to each task file's.

## Definition of Done

- [x] `sad.md:380` and `screens.md:343` carry the canonical sentence, **extracted by regex and
      compared as strings** against the six existing sites — one distinct value over all eight, 313
      characters. Do not eyeball it; this is the bullet round 11 reported as met and was not.
- [x] `sad.md:368`, `ux-flows.md:170` and `:219` each carry the pointer, and a sweep for every
      phrasing of the claim returns no carrier that is not either followed by the carve-out / pointer
      or quoted inside a dated marker or a review record.
- [x] Each of the five sites has a dated round-13 marker citing R13-S1-F1 — **three literally, two by
      adjacency**.
      <!-- qualified 2026-09-09 (T58, review round 14 O2): `sad.md:380`, `ux-flows.md:219` and
      `screens.md:343` carry their own marker. The other two sites are mermaid labels — `sad.md:368`, a
      sequenceDiagram message, and `ux-flows.md:170`, flowchart node C — and a markdown comment cannot
      live inside a mermaid block, so each is named explicitly inside the adjacent prose marker
      («neither the F2 message label nor this paragraph»; «this map row and node C of the diagram
      above»). Substantively met, structurally impossible to meet literally. -->
- [x] `tasks.json` has 55 tasks, parses, no duplicate id, no dangling dep, DFS finds no cycle, and its
      `files_hint` agrees with every task file for T1…T55 (0 mismatches, checked mechanically over all
      55, not by inspection).
- [x] `_epic.md` edges and `tracker.md` Deps column agree with `tasks.json` for T53–T55; `tracker.md`
      says «Total: 55 tasks» and links this round's record.
- [x] No `src/` change in this task: `git diff --stat HEAD -- src src-tauri` unchanged by it.
- [x] Any DoD bullet written as a grep that cannot be satisfied because the retired wording survives
      inside its own marker is **named in the Outcome**, with the reason — all of them (R12-S1-F4's
      class, and the practice T52 got right).

## Notes

`test-plan.md` is **T55's** file and `sad.md` / `ux-flows.md` / `screens.md` are this task's, so the
two docs tasks of this wave share no file — the split T50 and T52 used, for the same reason.

`deps: []`: this task writes the wording T54's comments and T55's records must both match, so it goes
first.

## Outcome (2026-09-08)

Landed. Docs only — `git diff --stat HEAD -- src src-tauri` unchanged by this task.

**Every carrier of the claim now states its exception, and the sentence is byte-identical at eight
sites.** Extracted by regex from each file and compared as strings, not read: **8 occurrences, 313
characters, one distinct value** — `spec.md:198` (AC-18), `spec.md:231` (§6 NFR row 3), `sad.md:733`
(§10 QG-1), **`sad.md:380`** (the F2 prose, new), `screens.md:343` (Rendering variants, new),
`ux-flows.md:179` (US-07 prose), `test-plan.md:91` (the AC-18 manual row) and `test-plan.md:167` (the
§NFR bullet). The pointer `except where the header-cap guard binds (AC-18)` is at the three label /
index carriers: `sad.md:368`, `ux-flows.md:170`, `ux-flows.md:219`.

**The residual sweep is empty.** A grep for every phrasing the claim has ever taken on this branch —
«share it has on the right», «share it keeps with the inspector on the right», «at least the share of
the column», «right-hand share» — returns, outside `_review/` and the round-10 / round-13 task files
that quote them deliberately, **no occurrence** that is not either followed by the carve-out or the
pointer, or quoted inside a dated marker. That is the check the four previous waves did not run, and
it is the one that found `sad.md:380`.

**Registration.** `tasks.json` parses, **55 tasks**, 0 duplicate ids, 0 dangling deps, DFS finds no
cycle; `T53 → T54`, `T53 → T55`, `T54 → T55` mirrored in `_epic.md`'s graph and rows and in
`tracker.md`, which reads «Total: 55 tasks» and links the round-13 record. The JSON was edited by
**textual insertion**, not by a parse-and-dump round trip: `git diff --numstat` on it is **321 / 0**,
so the 52 existing entries keep their formatting byte for byte. (The first attempt used
`json.dumps` and reflowed 54 pre-existing lines that collapse short arrays onto one line; it was
reverted from the reviewer worktree's copy before anything else was touched. Recorded because a
formatting churn on 52 untouched tasks would have been invisible in a summary and unpleasant in a
diff.)

**DoD bullets that could not be satisfied as written: none as written here — one qualification added
2026-09-09 by T58 (review round 14, O2).** Bullet 3 asks that each of the **five** sites carry a dated
round-13 marker. Three do; the two mermaid labels cannot hold a markdown comment at all and are named
inside the adjacent prose markers instead. That is the only implementation the format allows, and each
covering marker names its label site explicitly — but reporting the bullet as plainly met glossed a
structural impossibility rather than naming it, which is the practice rounds 10–14 have been asking
for. Original claim preserved: «none».

The last bullet asks for any such bullet
to be named; there is nothing to name in this task. The premise correction — `sad.md:368` presented to
the owner as prose when it is a `sequenceDiagram` message, and the fifth site that surfaced with it —
is recorded in **What** above and reported to the owner in the same message as this wave, rather than
being left in a task file only.
