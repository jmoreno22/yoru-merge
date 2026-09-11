---
id: T42
title: "Round-9 test-plan re-point: bring the AC → test map through the reversal and correct T39's outcome"
layer: "docs"
deps: ["T40", "T41"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-18", "AC-19", "AC-22"]
files_hint: [
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/docs-after-reversal.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T42 — Round-9 test-plan re-point

## Why

T39's Definition of Done reads «AC-22 has a row in `test-plan.md` naming at least one test, **and no test-plan row describes an assertion the wave removed**», and its *What* asked for «the AC-03 / AC-04 / AC-06 / **AC-18** rows re-pointed». Its own Outcome (`docs-after-reversal.md:43-44`) records what actually landed: «gained four AC-22 rows and re-pointed the AC-04 and AC-06 rows». AC-03 and AC-18 were not re-pointed, and `tracker.md:46` marks T39 `done` — [review round 9, R9-S1-F6 and R9-S2-F5](../_review/review-2026-09-08.md).

`test-plan.md` is the AC → test map every review round reads as its baseline. Left as it is, round 10 starts from a map whose four sharpest rows name a test this wave deleted, an output that no longer exists and three literals the code no longer produces.

## What

Re-point the fifteen rows below, each against what the committed tests now assert. Where a row's subject is gone rather than moved, say so with a dated marker rather than deleting the history.

| row | current text | what the code / tests now do |
|---|---|---|
| `:35` | «layout policy keeps **the diff** at half or more … never leave the diff below half» | the list's protected share; `inspector-layout.ts` has no diff output |
| `:38` | «**diff viewer** share with the header expanded … ≥ 50 %» | the list's share (spec §6 was amended, this row was not) |
| `:42` | «**diff** share ≥ 75 % collapsed» | the list's share |
| `:43` | «yields **the file list first** down to two rows, then the clamp … rows = 2, clamp = 1, diff ≥ half» | the yield order is **inverted**; `inspector-layout.spec.ts:33-52` asserts the opposite at that exact configuration |
| `:44` | «the host carries `--inspector-list-rows: 2`» | `commit-inspector.spec.ts:456-460` asserts `>= 2` |
| `:45` | «diff keeps at least half» | no diff in the History column |
| `:51` | «keeps the active file **in the diff viewer**» | amended AC-05: «the active file stays the one the diff workspace shows» |
| `:52` | «the released height goes to **the diff**» | amended AC-05 as corrected by T41: left empty |
| `:87` | «leaves **the diff slot** as the only growing child» | `main-content.spec.ts:403,411,421` assert `inspectorBlock` |
| `:88` / `:90` | «diff viewer height ≥ the 1.0.5 build»; «collapsing the header … grows only **the diff**» | amended AC-18 / AC-19: the list grows; the 1.0.5 comparison is dropped by T41 |
| `:95` | the T16 table, «tabled over 2 / 6 / 30 files at 540 and 700 px» | **that test was deleted by `a1694d7`** — the 12 runtime cases behind the 831 → 831 anomaly. Re-point at `inspector-layout.spec.ts:154-183` plus the 144-configuration loop at `:337-370`, and note what the exact-pixel pins were and why they could not survive |
| `:106` | «leaves the diff slot at or above the floor … `flex-1` slot ≥ 50 %» | the History slot is `h-0`; the list is the growing child |
| `:109` | «`headerMaxH` … fed back into **`diffHeight`** … `diffHeight` ≥ the floor whenever the cap binds» | `diffHeight` was removed from the API |
| `:112` | «`headerMaxH` **116** (comfortable) and **120** (compact) in the squeeze rows» | `inspector-layout.spec.ts:49,66` pin **210** and **210** |
| `:115` | «`expected.headerMaxH` is **126** next to the host equality» | `main-content.spec.ts:366` pins **280** |

Add, in the same pass:

- **The rows T40 lands** — the bottom-minimum-with-both-panels guard row (AC-03) and the chevron-gate row (AC-06), with the mutation each is verified against.
- **AC-05's corrected row** — once T41 rewords the criterion to «left empty», `inspector-layout.spec.ts:185-199` is its automated cover; say which half is automated and which stays manual.
- **T39's record** — append an outcome note to `docs-after-reversal.md` in the file's own Notes idiom (the shape T32 used at `round5-fixes.md:51`): the DoD bullet was not met, which rows were missed, and that T42 closes them. Do **not** rewrite T39's DoD — the team settled in round 7 (S4) that a task file is the record of what was asked. Leave `tracker.md` T39 `done` and let the note carry the correction.

## Definition of Done

- [ ] No `test-plan.md` row names `diffHeight`, `T16`, the six-row cap, the diff slot as a growing child, or a `headerMaxH` / `--inspector-list-rows` literal the suite does not produce; verified by re-reading each cited `file:line` against the row.
- [ ] Every AC-01…AC-22 row names a test that exists at HEAD; spot-checked by grepping the named spec file for the assertion the row describes.
- [ ] AC-22 keeps its four rows from T39 and they still match after T40.
- [ ] `docs-after-reversal.md` carries the outcome note; T39's DoD text is unchanged.
- [ ] `pnpm lint` green; `git diff --stat -- src/` empty.

## Notes

Documents only, and deliberately last in the wave: the map can only be re-pointed once T40's rows exist and T41's criteria are final.

The commit must carry `SDD-Task: T42` and its `SDD-AC` trailers (R9-S1-F9).
