---
slug: inspector-diff-workspace
date: "2026-09-04"
round: 5
verdict: CHANGES REQUESTED
feature_size: "M"
route: standard
branch: feat/inspector-diff-workspace
base: 7cd47b4
head: 7601d2b
previous_review: review-2026-09-04-round4.md (CHANGES REQUESTED, Q1–Q7)
reviewers: 2 × sdd:reviewer (clean context, read-only, model opus, effort high) — stage 1 closure of Q1–Q7 + claimed ACs + chain backstop; stage 2 quality of the changed surface. Reports written to scratchpad files first, then relayed (the idle message truncates). Lead recomputed the Q1 and Q5 values and the Q7 timer ordering, and verified the two behavioural items in the code before the rulings.
---

# Re-review round 5 — inspector-diff-workspace — 2026-09-04

## Scope

Fifth review of the branch, after T30 (the round-4 follow-ups). Whole feature diff `7cd47b4..7601d2b`: 36 commits, 122 files, +11 578 / −330. Changed surface since round 4 (`a662a2a..7601d2b`): `819d981` (docs: round-4 record + T30) and `7601d2b` (T30, `fix`: `commitRowKey` / `focusKeyOwner` exported next to `focusKeyFor` and imported by the commit list and the inspector; the inspector expires an owned bare-path key once the loaded commit lacks the path; the AC-03 host row equals the policy; `headerMaxH` 116 / 120 pinned; the clamp comment; `afterDebounce` exact), 15 files, +313 / −21, nothing under `src-tauri/`. `SDD-AC` trailers claim AC-03, AC-08, AC-16.

Gate at review time, run by the lead on `7601d2b`: `pnpm test` 830 tests / 63 files green (two tiers under `ng test --no-watch`) · `pnpm lint` (biome, 266 files) clean · `pnpm build` clean (906.71 kB main, under the 1.2 MB budget). Rust gate unchanged (no `src-tauri` change). The one stderr line (`[cdkFocusInitial]` not focusable, from the AC-10 row) is the known jsdom noise.

## Resolution of the round-4 findings

| Finding | Resolved | Evidence at HEAD | Revert-sensitive |
|---|---|---|---|
| Q1 host cap asserted by value | yes | `main-content.spec.ts:315-334` — `--inspector-header-max-h` equals `computeInspectorLayout` for the fixture (560 px, 4 drawn rows, tokens 34 / 30) | yes — a wrong `fileCount` or an unbounded writer breaks the equality; the value itself is V3 |
| Q2 inspector expires its own absent-row key | yes | `commit-inspector.ts:332-348`; `commit-inspector.spec.ts:711-748` | yes — without `focusRestored` the key `b.ts` stays pending at `:745-748` |
| Q3 test-plan «sha» | yes | `test-plan.md:95` says `commit:<sha>` (fixed by round 4) | n/a |
| Q4 shared row-key shapes | yes | `diff-workspace-state.ts:62-82`; `commit-list.ts:271-272,300`; `diff-workspace-state.spec.ts:306-314` | yes — a changed prefix fails `diff-workspace-state.spec.ts:314` and `commit-list.spec.ts:288` |
| Q5 `headerMaxH` pinned in the pure table | yes | `inspector-layout.spec.ts:40` (116), `:59` (120) | yes — either literal mutated fails |
| Q6 policy comment | yes | `inspector-layout.ts:48-50`; true — an expanded header's cap is independent of `clampLines` | n/a |
| Q7 exact debounce wait | yes | `working-changes.spec.ts:244-248` — `WATCHER_DEBOUNCE_MS` then a 0 ms macrotask; the AC-16 row still asserts the refresh at `:539,546` | n/a |

**Recomputed by the lead.** Q1: the fixture files are `src/app/app.ts` and `assets/data.bin`; tree mode chains `src` into `src/app`, so the list draws folder + file twice = 4 rows (`FIXTURE_FILE_ROWS`, `main-content.spec.ts:135`); the fixture has no body, so production feeds `lineH` 0, `bodyLines` 0 and `headerFixedH` 0 (`commit-inspector.ts:552-561`), stacked panels measure 0 and the column is 560. No yield fires (406 over the 280 floor) and the cap is `round(560 − 280 − (34 + 4 × 30))` = 126 px. Q5: comfortable — floor 210, list floor 94, cap 116, the 130 px header caps to it, `diffHeight` 210; compact — list 90, cap 120, the 114 px header fits under it, `diffHeight` 216. Q7: the watcher listener schedules its debounce synchronously on delivery (`current-repo.service.ts:858`) inside the awaited `emit`, so at equal delay its timer precedes the helper's and the 0 ms flush follows it — not a flake.

**The landed Q2 guard, traced.** It fires only when `focusKeyOwner(key)` is `commit-file`, `details()` is loaded and its `files` lack the path. A filter keystroke or a collapsed folder keeps the path in `details().files`, so nothing expires (the AC-11 reasoning); a panel with no details returns silently, which is why the T29 foreign-key row holds (`commit-list.spec.ts:242`, null details asserted at `:245`). `details()` is read inside the effect, so a later load re-runs the expiry. `focusRestored` no-ops unless the key matches (`diff-workspace.service.ts:265`) and the three owner branches are disjoint for real keys, so no double expiry; `open()` clears the pending key (`diff-workspace.service.ts:180`), so none outlives the next open. The GREEN ruling that rejected the literal «owned key and `index < 0`» guard is right: the inspector mounts on every view but Changes, and a panel with no commit loaded would have expired a key it knew nothing about.

**Claimed ACs.** AC-03 genuine — pinned by value in the pure table (116 / 120) and by equality on the host. AC-08 genuine — the expiry plus a row asserting a null pending key and nothing focused, before and after the path returns; the T29 rows `commit-list.spec.ts:242,270,316` stay green. AC-16 hygiene only, as the task scoped it.

## Chain trace

**User stories.** US-01..US-08 each keep ≥ 1 AC and a `sad.md` §6 flow (unchanged).

**Acceptance criteria.** Every AC-01..AC-21 reaches code and at least one automated assertion, except AC-20 (manual by owner decision). The three T30 rows `test-plan.md:107-109` map to real `it`s whose assertions match their expected columns. `tasks.json` T30 equals `tasks/round4-fixes.md` in acs, deps and all ten `files_hint` entries; `tracker.md:37` has T30 `done`, T26 `blocked`; every source file in `7601d2b` is inside `files_hint` (the two extras are the tracker and the task file itself); no `.skip` / `.only` / `.todo` / `xit` under `src/`; no assertion removed or loosened in `7601d2b` (the T20 row's rename from a local literal to the imported helper keeps every `expect`).

**Focus-key ripple.** `commit-list.ts:271-272,300` (owner `commit-row`, `commitRowKey`), `working-changes/changes-list.ts:112-128` (its own positive `side:` match — the GREEN ruling holds: `focusKeyOwner` returns `working-tree` without the side, and each list must not expire the other side's key), `commit-inspector.ts:332-352` (owner `commit-file` in the absent-row branch), `diff-workspace.service.ts:285-294` (reads `dataset.focusKey` off the DOM, shape-agnostic), `diff-workspace-state.ts:58` (`focusKeyFor` unchanged). Module boundary: `features → core/services` runs downwards (`ARCHITECTURE.md:110`); pure string shapes beside `focusKeyFor` suit a pure-TS core module.

## Findings — stage 1

None. Every round-4 finding is closed with a revert-sensitive test and no AC is violated on a traced path.

## Findings — stage 2

- **V1 `focusKeyOwner` has no direct row** — `diff-workspace-state.spec.ts:303-322`; AC-08; the T20 row imports `commitRowKey` (Q4) but still tests ownership with local `startsWith` literals, so the shared predicate is pinned only through component rows and its `working-tree` arm by none. The arm is not dead code: it is what keeps the inspector's `=== 'commit-file'` guard (`commit-inspector.ts:341`) from expiring a `side:` key whose «path» the loaded commit lacks — pin it, do not drop it. → **Fix now → T31**.
- **V2 `WORKING_SIDES` restates the source union** — `diff-workspace-state.ts:63` against `:4`; AC: n/a; the two literals are typed `as const`, not from `DiffWorkspaceSource`, so a renamed side still compiles. → **Fix now → T31** (type the constant from the union).
- **V3 The Q1 host row pins host == policy, not the value** — `main-content.spec.ts:320-334`; AC-03; `expected` is recomputed from mirrored inputs, so a policy and a writer that drift together stay green, while T30's DoD says «equals the policy's value». The RED note at `tasks/round4-fixes.md:61` records a «126 → 127» mutation on a literal that never landed. → **Fix now → T31** (`expect(expected.headerMaxH).toBe(126)`; correct the note).
- **V4 One vacuous assertion in the Q2 row** — `commit-inspector.spec.ts:739`; AC-08; `activeRowPath(host)` is null because the list draws zero rows there, so it cannot fail; the proof is the closing `activeElement` check at `:745-748`. → **Fix now → T31** (assert `document.activeElement` there, or drop the line).
- **V5 `AppearanceService` injected twice in one row** — `main-content.spec.ts:312,320`; AC: n/a; the inline `TestBed.inject` and the new `appearance` const are the same singleton. → **Fix now → T31** (hoist).
- **V6 The `commit-file` fallback misreads a POSIX path starting with a key prefix** — `diff-workspace-state.ts:78-82`; AC-08; raised as stage 1 by the reviewer, reclassified by the lead: Windows forbids `:` in file names, and on POSIX it takes a repo-relative path whose first segment starts with `commit:`, `staged:` or `unstaged:`; the cost is a lost focus restore (the service falls back to the `[tabindex]` ancestor), never a wrong write. Pre-existing since T29; hardening it means prefixing the file keys too (`focusKeyFor`, the T20 row, every `data-focus-key` reader). → **Not an issue** (owner; recorded here as an accepted limitation).
- **V7 An AC-17 close whose next selected commit carries the same path focuses that commit's row** — `commit-inspector.ts:349-352`; AC-17 / AC-08; `close()` keeps only the key, so the guard cannot tell whose commit the path came from and a drawn row wins first. `tasks/round4-fixes.md` left this to the implementer; the behaviour keeps the user's attention on the same path. → **Not an issue** (owner; recorded here as an accepted behaviour).

Checked and clean (stage 2): the Q2 row proves the expiry (`setFiles([], 'external')` keeps a commit workspace open with `file` still `b.ts`, so `close()` publishes it — `diff-workspace-state.ts:124,145`); `restoreRowFocus` runs once per restore, so one string per loaded row in `findIndex` is fine; the Q5 comments' arithmetic is right; the Q6 sentence is true; no `as any`, no duplicated `src/testing/` helper, nothing dangling from the dropped `ROW_FOCUS_PREFIX`; `provideTestIcons()` in each rendering TestBed; `test-plan.md:107-109` matches the assertions; `tasks.json` T30 is well-formed.

## Owner decisions (2026-09-04, round 5)

1. **V1–V5 (stage 2):** fix now, one task — T31 «Round-5 fixes: pin the shared key owner, type the working sides, fix the host cap's literal, test hygiene».
2. **V6, V7:** not an issue — recorded above as accepted limitations with their reasons; no spec §8 entry.

## Artifacts changed by this review

- `tasks/round5-fixes.md` (T31) written; `tasks.json`, `tasks/tracker.md`, `tasks/_epic.md`: T31 added (`todo`); T26 stays `blocked`.
- `test-plan.md`: two round-5 rows appended for T31.

## Gate result

**CHANGES REQUESTED** — stage 2 only. Every round-4 finding T30 owned is closed with a revert-sensitive test, the claimed ACs are genuine and the chain is intact; what remains is one shared predicate without a direct pin (V1, V2), a host row that pins equality but not the value plus a RED note that misreports it (V3) and two test-hygiene lines (V4, V5), which the owner chose to fix now. Re-review the changed surface after `/sdd:implement inspector-diff-workspace` runs T31; T26's screenshots, the R15 Linux check and the manual checklist stay owner-only prerequisites for `ship`.
