---
id: T33
title: "Round-7 fixes: drop the branch-independent focus field from the Q2 row and correct the claims that call the returning-path block mutation-verified"
layer: "app"
deps: ["T32"]
acs: ["AC-08"]
files_hint: [
  "src/app/features/commit-inspector/commit-inspector.spec.ts",
  "docs/features/inspector-diff-workspace/test-plan.md",
  "docs/features/inspector-diff-workspace/tasks/round6-fixes.md",
  "docs/features/inspector-diff-workspace/tasks/tracker.md",
  "docs/features/inspector-diff-workspace/tasks/_epic.md",
  "docs/features/inspector-diff-workspace/tasks.json"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "todo"
---

# T33 — Round-7 fixes

## Why

T32 removed the standalone line round-6 F1 named, and removed nothing else — but it promoted the returning-path block to «the row's proof», and one member of that block behaves exactly like the line it replaced: `focusedTheRow: false` (`commit-inspector.spec.ts:753`) holds whether or not the key expires — [review round 7, R7-F1 / S1 / S2](../_review/review-2026-09-07-round7.md).

Measured three times independently (lead + both reviewers), with `commit-inspector.ts:345` commented out and `:738` replaced by a probe so execution reaches the block:

```
LEAD-P1 {"pending":"b.ts"}
LEAD-P2 {"pending":null,"focusedTheRow":false,"active":"BODY","hasRow":true}   28 passed
```

The row **is** drawn on the returning path (`hasRow: true`) and the key **was** still pending at close (`LEAD-P1`), yet the focus stays on `document.body`: the normal arm (`commit-inspector.ts:351`) consumes the key and calls `focusVirtualRow`, whose `.focus()` is deferred through `afterNextRender` + `scrollToIndex` + `renderedRangeStream` (`virtual-row-focus.ts:26-45`) and does not land on a viewport the emptied list re-created. Adding `settleScroll()` × 3 and a `sizeVirtualViewport` on the repopulated viewport does not change it.

Two claims therefore have to go with the field. T32's own DoD bullet 1 (`round6-fixes.md:35`) reports the block as «verified by running the mutation», and the same reading reached `test-plan.md:111`. The round-7 record also settles the wider point the earlier rounds had wrong: **the DOM consequence «an expired key does not steal the focus» is not observable at the component tier anywhere** — the commit list's own negative row behaves the same way (commenting out `commit-list.ts:278` reddens only `commit-list.spec.ts:308`, the key; its focus assertions at `:309` and `:310-313` stay green). What AC-08 has failably pinned is the mechanism (the key expires) plus the positive direction (an honoured key lands focus: `commit-inspector.spec.ts:657`, `:680`, `:708`).

## What

No production change; one assertion field removed, one comment clause corrected, three documents brought in line:

- **Drop the field (R7-F1, AC-08)** — `commit-inspector.spec.ts:751-754`: remove `focusedTheRow: document.activeElement === row` from the object and `focusedTheRow: false` from the expectation. What remains is `expect(row).not.toBeNull()` (the repopulated list drew the row) plus the key assertion — write the latter in whatever shape reads cleanest once it is the object's only member (a plain `expect(workspace.pendingFocusKey()).toBeNull()` is fine).
- **Say what each surviving assertion proves (S2)** — in the row's comments, name the mutation that reddens each: `:738` reddens on removing `focusRestored` from `commit-inspector.ts:345` (single point); the returning-path key assertion reddens only when **neither** arm consumes the key (`:345` *and* `:351`), since in the clean tree the key is already `null` before the block and each arm alone still clears it; `expect(row).not.toBeNull()` reddens if the inspector keeps stale details. Do not advertise the returning-path assertion as proof of the expiry.
- **Correct the comment's last clause (S1)** — `commit-inspector.spec.ts:739-741`: «The block below proves it against a drawn row» is true of the key and false of the focus. Keep the rest of the comment (it is verified true and it stops the next reader re-adding the line T31 added and T32 removed) and make the clause say that the block proves the key expired, not where the focus went.
- **`tasks/round6-fixes.md`** — append an outcome note in the file's own Notes idiom (the shape T32 used at `round5-fixes.md:51`): DoD bullet 1's first clause held and was verified, its second clause («the returning-path block still asserts nothing took the focus») was disproved in round 7, with the measurement above. Do not rewrite the DoD itself — the task is done and its file is the record of what was asked.
- **`test-plan.md:111`** — restate the AC-08 half to match what the block contains after this task: the row's proof is `pendingFocusKey()` at `:738` (red by removing `commit-inspector.ts:345`), the returning-path row-drawn check and the key still being null; nothing at this tier asserts where the focus went, in either phase. Leave the AC-03 half untouched — it is accurate.

## Definition of Done

- [ ] The Q2 row (`commit-inspector.spec.ts`, AC-08) carries no assertion advertised against a mutation it cannot detect: `focusedTheRow` is gone, and every remaining assertion is named in the row's comments together with the mutation that reddens it.
- [ ] Verified by **running** both mutations, not by reading: (a) removing `focusRestored` from `commit-inspector.ts:345` reddens the row at `pendingFocusKey()` — expect 1 failed / 27 passed, `expected 'b.ts' to be null`; (b) removing it from **both** `:345` and `:351` reddens the returning-path key assertion. Record both outputs in a «Verification» section here, and restore the tree with `git checkout --` afterwards.
- [ ] `tasks/round6-fixes.md` carries the outcome note; `test-plan.md:111` describes what landed and claims no assertion that is gone.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `tsc --noEmit` clean; no production file and no `src-tauri` change.
- [ ] Any file outside `files_hint` recorded in a «Files beyond `files_hint`» note here. Per the round-7 record (S4), edits to `tracker.md` / `_epic.md` / `tasks.json` that only register this task's own row or status need no note — they are listed in `files_hint` anyway.

## Verification

Both mutations were run against the edited row; the production file was restored with `git checkout --` after each and `git diff -- src/app/features/commit-inspector/commit-inspector.ts` is empty.

Baseline, HEAD + this task's edit:

```
Test Files  1 passed (1)
     Tests  28 passed (28)
```

**(a) single point** — `focusRestored` commented out in the `index < 0` arm (`commit-inspector.ts:345`):

```
AssertionError: expected 'b.ts' to be null
Test Files  1 failed (1)
     Tests  1 failed | 27 passed (28)
```

The single failure is the Q2 row, at the first `expect(workspace.pendingFocusKey()).toBeNull()`.

**(b) two points** — the same, plus the normal arm at `:351`. The row then fails at the *first* assertion, so to observe the one after the path returns the first was replaced by a probe for this run only:

```
VERIFY-B neutralised-first {"pending":"b.ts"}
FAIL  CommitInspector focus restore on close (AC-08) > AC-08: a pending key whose commit file row is gone expires … (T30 — Q2)
FAIL  CommitInspector focus restore on close (AC-08) > AC-08: close focuses the row the gesture came from
AssertionError: expected 'b.ts' to be null   (× 2)
Test Files  1 failed (1)
     Tests  2 failed | 26 passed (28)
```

So the returning-path assertion is reddened by the two-point mutation and by nothing weaker — each arm alone still clears the key — which is exactly what its comment now says. The second failure is the sibling in-range restore row (`:657`), expected: mutation (b) removes the arm that row depends on.

**Files beyond `files_hint`:** none. `tasks/tracker.md`, `tasks/_epic.md` and `tasks.json` are listed in `files_hint`; no other file was touched.

## Notes

The alternative — keep the field as a forward guard and record it as an accepted limit, the way round-6 S2 and S3 were recorded — was declined by the owner: round 6 already refused that argument for the standalone line, and a field no mutation of the expiry can redden would bait an eighth round.

Round-7 S3 (`commit-inspector.spec.ts:572`, `expect(host).not.toBeNull()`, unfailable, from T24), S4 (the task-file `status` / `files_hint` convention) and S5 (`tracker.md:41` person-days ½ high, and the `:337-348` line citation that should read `:332`) are owner-recorded, not work — see the review record. R7-F3 (AC-19's UI check is manual, so AC-20 is not the only exception) is recorded there too, with no document edit.
