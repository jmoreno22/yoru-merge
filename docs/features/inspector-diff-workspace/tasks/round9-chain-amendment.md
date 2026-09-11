---
id: T41
title: "Round-9 chain amendment: bring sad.md, ux-flows.md, screens.md and spec.md §7 through the reversal"
layer: "docs"
deps: []
acs: ["AC-03", "AC-04", "AC-05", "AC-06", "AC-18", "AC-19", "AC-22"]
files_hint: [
  "docs/features/inspector-diff-workspace/spec.md",
  "docs/features/inspector-diff-workspace/sad.md",
  "docs/features/inspector-diff-workspace/ux-flows.md",
  "docs/features/inspector-diff-workspace/screens.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "todo"
---

# T41 — Round-9 chain amendment

## Why

`269fba0` amended `spec.md` §4/§5, quality goal 1, four SAD paragraphs, ADR-0004 and two `ux-flows.md` bullets — and stopped. Everything downstream of §5 still describes the inspector the owner reversed, so seven acceptance criteria currently trace to artefacts that state the opposite of the criterion, the production code and the shipped tests — [review round 9, R9-S1-F1…F5, F7, F8, F10 and R9-S2-F6](../_review/review-2026-09-08.md).

The gap has a mechanical cause worth recording: the reversal's production code landed in `2049df4`, a commit with no task and no `SDD-AC` trailer (R9-S1-F9), and the wave that followed it (T34–T39) was scoped from the *failing tests*, not from the chain. T39, the only docs task, covers `DESIGN.md`, `README.md` and `test-plan.md` — no feature artefact.

The owner chose amendment in place over re-running `/sdd:sequences`, `/sdd:ux-flows` and `/sdd:screens`: the dated markers keep showing that this decision was taken twice, which is the same reason `269fba0` struck through the §8 resolution instead of rewriting it.

## What

Every edit carries an `<!-- amended 2026-09-08 (owner) -->` marker in the idiom `269fba0` used. No production change.

### `spec.md`

- **AC-05 (R9-S1-F8)** — `:119` currently sends the released height to «blame or file history when either is stacked below». It cannot: both stacked panels are fixed bases by deliberate design (`main-content.ts:267-274`, frozen by AC-19 so they cannot take a cut of what the inspector releases), and the list is fixed-height inside a `flex-1` block, so the pixels stay inside the commit-inspector block. Reword to «the released height is left empty» unconditionally — which is what the code does and what `inspector-layout.spec.ts:185-199` already asserts. Keep the rest of the criterion.
- **§7 KPI (R9-S1-F7)** — `:253` still measures «Diff viewer share of inspector height». Re-point it at the commit file list, matching the amended §6 rows at `:229-230`, and keep the baseline sentence honest about what changed.
- **§6 NFR row 3 (R9-S1-F7 / R9-S2-F6c)** — `:231` «Diff viewer height · inspector at the bottom, or blame / file history stacked ≥ the 1.0.5 build» has no subject in the History inspector any more, and amended AC-18 replaced the 1.0.5 comparison. Re-point or drop it; it is the only row in that table with no amendment marker.
- **§6 NFR rows 1–2, Measurement column (R9-S2-F6a)** — «element-height measurement in the built app» cannot be right for the list: AC-04 requires a two-file commit to take exactly two rows, ~9 % of a 640 px column. The invariant the policy actually guarantees is already worded correctly at `inspector-layout.spec.ts:20-30` — the header may not cross `headerMaxH`, so the list's *protected share* is `(remainder − headerMaxH) / remainder`. Restate the Measurement column in those terms.
- **AC-18 (R9-S2-F6b)** — `:198` claims the list «keeps at least the **height** it keeps with the inspector on the right». The policy makes no cross-placement height guarantee and cannot (`MIN_BOTTOM_PX = 220` against a full-height right column); `sad.md:693`, amended in the same commit, says «≥ the **share**». Align the spec to the SAD, which is what the code supports.
- **AC-06 (R9-S1-F10)** — add the clause that the per-file collapse chevron is not offered inside the diff workspace (the workspace shows the one file at full width; collapsing it would empty the centre). It shipped in `2049df4` with no criterion behind it.

### `sad.md`

- **§6 flow F1 (R9-S1-F2)** — `:312-315` the `one to six` / `more than six` file-count branch, `:317-321` the yield branch («shrink the file list first» then the clamp — amended AC-03 inverts it: the body clamp yields first, then the expanded header scrolls inside its cap, and the list never gives up a row), `:325` and `:327` («first file's diff in the diff viewer», «the diff viewer keeps at least half»), and `:330` the confirming prose. Redraw the branches to match `inspector-layout.ts:38-52` and the amended criteria.
- **§6 flow F2 (R9-S1-F2)** — `:344` precondition, `:352-362` («released height to the diff viewer», «the diff viewer now takes at least three quarters», «only the diff viewer grows», «never less than the diff viewer height of the previous build») and `:372`. Amended AC-18 / AC-19 hand the released height to the commit file list; `main-content.spec.ts:382-423` asserts it.
- **§6 coverage table (R9-S1-F1, F2)** — re-point the AC-03 row (`:616`) and the AC-04 row (`:617`), and **add the AC-22 row**. AC-22 also needs a runtime step: critical flow 1's opening gesture (`:221`) is still `double-click a file row`, with no single-click branch and no toggle step.
- **§4 pillar 5 (`:111`), §5 decomposition (`:139`) and the `data-model` persist note (`:639`)** — all three say two durable preferences. There are three (`preferences-schema.ts:89-95`).
- **§1 Intent (`:17`) (R9-S1-F3)** — still «make the diff viewer the dominant surface… the file list yields height before the diff does», four lines above the amended quality goal 1 that says the opposite.
- **§7 (`:650`), §11 (`:654`, `:714`), §12 (`:732`, `:737`, `:742`) (R9-S1-F3, F1)** — the release-time diff-share measurement, the «bounded to 6 visible rows» capacity note, the 6-row-cap risk row, the two glossary entries naming the diff viewer as part of the inspector, and «any of the three ways» where there are now four.
- **§10 QG-1 heading (`:691`) (O5)** — still «Diff dominance in the inspector»; only its When/Then body was amended.

### `ux-flows.md`

- **US-01 flow and prose (`:58`, `:65`)**, **US-02 (`:75`, `:82`)**, **US-03 (`:91`, `:102`)**, **US-07 (`:169-172`, `:177`)** — the inverted yield order, «height goes to the diff viewer», «more than six files show six rows», «the inspector hides its diff viewer» (the temporary-hide model, not the permanent one AC-06 now states) and the pre-AC-22 gesture list.
- **Screen inventory (`:33-35`)** — SCR-01 / SCR-02 / SCR-03 still list the inspector diff viewer.
- **AC → flow map (`:200-220`)** — re-point AC-01, AC-03, AC-04, AC-05, AC-06 and add the **AC-22** row.

### `screens.md`

Never opened by the reversal (R9-S1-F5).

- **SCR-01 (`:29`, `:33`)** — the column is commit header + commit file list, with a zero-height parking slot for the portalled viewer; the default state's «1–6 files take exactly that many rows; diff slot keeps ≥ 50 %» becomes the list keeping the share, with no upper bound on the rows.
- **AC-22's control** — add it to SCR-01's component list (`commit-inspector.html:245-264`, `data-testid="inspector-click-opens"`, beside the tree / flat toggles) and give it a state showing both modes.
- **Wireframes W-01a…W-01e (`:72`, `:87`, and the frames at `:54`, `:97`, `:116`, `:133`)** — redraw the inspector column without the `DIFF VIEWER … never below 50 %` block and with the new control in the files header.
- **Layout-modes table (`:343-344`)** — AC-18 / AC-19 rows still give the released height to the diff slot.
- **`:146` (R9-S1-F10)** — «its options bar, hunk navigation and Blame / History / Open / Reveal actions come with it unchanged» is no longer true of the per-file collapse chevron; note the one exception. `sad.md:107` («literally the same widgets») needs the same note.
- **AC → screen map (`:358-380`)** — add the AC-22 row.

### Bookkeeping

`tasks.json`, `tracker.md` and `_epic.md` gain T40–T42 and the round-9 line in the tracker's provenance sentence.

## Definition of Done

- [ ] `grep -n "six rows\|1 to 6\|1–6\|diff slot\|diff viewer" sad.md ux-flows.md screens.md` returns no line that describes the History inspector's composition or the layout policy's subject; every surviving hit is about the Changes view's inline viewer, the parking slot, or an explicitly dated historical note.
- [ ] AC-22 has a `sad.md` §6 runtime step, a row in the §6 coverage table, a row in the `ux-flows.md` AC → flow map, a component entry plus a state in `screens.md`, and a row in the `screens.md` AC → screen map.
- [ ] The three durable preferences are named as three in `sad.md` §4 pillar 5, §5 and the persist note.
- [ ] `spec.md` contains no measurement whose subject is the History inspector's diff viewer, and §6 / §7 / AC-18 agree with `sad.md:693` and with what `inspector-layout.ts` guarantees.
- [ ] AC-05 reads «left empty» unconditionally, and AC-06 states the workspace's missing chevron.
- [ ] `sad.md` §1 Intent and §10 QG-1's heading agree with quality goal 1.
- [ ] Every edit carries a dated amendment marker; no pre-reversal sentence is deleted without one where the record matters (the §8 resolution idiom).
- [ ] `pnpm lint` green (docs-only change, no code touched); `git diff --stat -- src/` empty.

## Notes

Documents only. The commit that lands this must carry `SDD-Task: T41` and the `SDD-AC` trailers above — R9-S1-F9 is the finding that says why.
