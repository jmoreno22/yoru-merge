# Tracker — inspector-diff-workspace

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Write the inspector layout policy | domain | Jhoan Moreno | M | — | done |
| T2 | Write the diff workspace state machine | domain | Jhoan Moreno | M | — | done |
| T3 | Write the Esc layer registry | domain | Jhoan Moreno | S | — | done |
| T4 | Add the two collapsed-state durable preferences | infra | Jhoan Moreno | S | — | done |
| T5 | Ship the Esc layer service and migrate the six consumers | app | Jhoan Moreno | M | T3 | done |
| T6 | Ship the diff workspace service | app | Jhoan Moreno | M | T2 | done |
| T7 | Build the diff workspace component | ui | Jhoan Moreno | M | T5, T6 | done |
| T8 | Wire the centre view and re-host the diff viewer | wiring | Jhoan Moreno | M | T7 | done |
| T9 | Make the commit header collapsible with a clamped body | ui | Jhoan Moreno | M | T4 | done |
| T10 | Put the six commit actions inline in the collapsed header with overflow into More | ui | Jhoan Moreno | S | T9 | done |
| T11 | Make the commit file list compact and apply the layout policy | ui | Jhoan Moreno | M | T1, T4, T9 | done |
| T12 | Add the open-large gesture to the commit inspector | ui | Jhoan Moreno | M | T6, T11 | done |
| T13 | Add the open-large gesture to the working-changes lists | ui | Jhoan Moreno | M | T6 | done |
| T14 | Document the inspector layout, the diff workspace and the Esc layer order | docs | Jhoan Moreno | S | T8, T12, T13 | done |
| T15 | Enable the component test tier in the existing unit runner | infra | Jhoan Moreno | M | — | done |
| T16 | Add the collapsed-header 75 % floor to the layout policy and drop the dead token | domain | Jhoan Moreno | S | — | done |
| T17 | Scope the Esc text-field rule to fields that opt in | app | Jhoan Moreno | S | — | done |
| T18 | Register the six workspace shortcuts from root-alive services | app | Jhoan Moreno | S | — | done |
| T19 | Refresh the workspace diff on watcher events and close on external emptying | app | Jhoan Moreno | M | — | done |
| T20 | Restore focus on close reliably, including the commit-row branch | app | Jhoan Moreno | M | — | done |
| T21 | Reconcile AC-07 with AC-17 and clear the stale diff | app | Jhoan Moreno | S | — | done |
| T22 | Inspector fixes: header measurement, filter republish, double fetch, docs bound | ui | Jhoan Moreno | M | T16 | done |
| T23 | Reuse the diff strip, hide the composer once, break the core→shared barrel import | ui | Jhoan Moreno | M | — | done |
| T24 | Component specs: commit inspector, open-large gesture and shortcuts help | ui | Jhoan Moreno | M | T15, T16, T17, T18, T20, T21, T22 | done |
| T25 | Component specs: diff workspace, centre wiring and working changes | ui | Jhoan Moreno | M | T15, T17, T18, T19, T21, T23 | done |
| T26 | Record the task-boundary widenings and refresh the screenshots | docs | Jhoan Moreno | S | T22, T23 | blocked |
| T27 | Component rows the plan declared (header, shortcuts, squeezed column, rows while open, commit-list restore, Esc layers, filter guard, hunk keys, watcher trigger) | ui | Jhoan Moreno | M | T24, T25 | done |
| T28 | Edge fixes (refresh race, shared origin, expiring focus key, residual AC-07 reset, bounded header, view-scoped toggles, zero-height restore) and repo docs | app | Jhoan Moreno | M | T19, T20, T21, T22, T23 | done |
| T29 | Round-3 fixes (owned focus keys, header cap feedback, the AC-03 and AC-09 rows, test hygiene) | app | Jhoan Moreno | M | T27, T28 | done |
| T30 | Round-4 fixes (the inspector expires its own key, the cap pinned on host and table, shared row-key shapes, exact debounce wait) | app | Jhoan Moreno | M | T29 | done |
| T31 | Round-5 fixes (pin the shared key owner, type the working sides, fix the host cap's literal, test hygiene) | app | Jhoan Moreno | S | T30 | done |
| T32 | Round-6 fixes (drop the unfailable focus line from the Q2 row, correct the two documents reporting V4 closed) | app | Jhoan Moreno | S | T31 | done |
| T33 | Round-7 fixes (drop the branch-independent focus field from the Q2 row, correct the claims that call the returning-path block mutation-verified) | app | Jhoan Moreno | S | T32 | done |

**Total:** 33 tasks, ~27½ person-days (M ≈ 1 day, S ≈ ½ day). T15–T26 are the follow-ups of [review 2026-09-03](../_review/review-2026-09-03.md); T27–T28 of [review 2026-09-04](../_review/review-2026-09-04.md); T29 of [review 2026-09-04 round 3](../_review/review-2026-09-04-round3.md); T30 of [review 2026-09-04 round 4](../_review/review-2026-09-04-round4.md); T31 of [review 2026-09-04 round 5](../_review/review-2026-09-04-round5.md); T32 of [review 2026-09-07 round 6](../_review/review-2026-09-07.md); T33 of [review 2026-09-07 round 7](../_review/review-2026-09-07-round7.md).

**T26 — blocked (owner):** the boundary notes are committed; the three screenshots (`docs/screenshots/history-dark.png`, `changes-light.png` recaptured, new `diff-workspace-dark.png` with the workspace open from History, plus its README line) need the built app with a real repository and a visual check, which the agents cannot run unattended.
