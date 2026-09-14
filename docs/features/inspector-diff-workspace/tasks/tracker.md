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
| T34 | Rewrite the layout policy around the commit file list as the protected block | domain | Jhoan Moreno | M | — | done |
| T35 | Feed the amended policy into the commit inspector and drop the diff-share patch | ui | Jhoan Moreno | M | T34 | done |
| T36 | Cover the open-behaviour control and its durable preference | ui | Jhoan Moreno | M | T35 | done |
| T37 | Rewrite the three centre-wiring rows against the collapsed History diff slot | ui | Jhoan Moreno | S | T35 | done |
| T38 | Rewrite the two AC-08 restore rows for the click-opens-workspace default | ui | Jhoan Moreno | S | — | done |
| T39 | Bring the repo docs and the test plan in line with the reversal | docs | Jhoan Moreno | S | T36, T37, T38 | done |
| T40 | Round-9 code fixes (pin the two live layout guards, cover the workspace chevron gate, release the empty list's share) | domain | Jhoan Moreno | M | T41, T43 | done |
| T41 | Round-9 chain amendment (sad.md, ux-flows.md, screens.md and spec.md §7 through the reversal) | docs | Jhoan Moreno | M | — | done |
| T42 | Round-9 test-plan re-point (the AC → test map, and T39's outcome) | docs | Jhoan Moreno | S | T40, T41 | done |
| T43 | Make the unit gate deterministic (run spec files serially) | infra | Jhoan Moreno | S | — | done |
| T44 | Round-10 code fixes (floor the header cap, restore a full assertion per configuration, pin the fixed flex bases) | domain | Jhoan Moreno | M | T45 | done |
| T45 | Round-10 criteria and chain amendment (the empty-list rule, the flat KPI, and the layer T41 did not open) | docs | Jhoan Moreno | M | — | done |
| T46 | Round-10 test-plan re-point (the thesis, the NFR validation section and the overstated sweep rows) | docs | Jhoan Moreno | S | T44, T45 | done |
| T47 | Round-11 code fixes (the collapsed residue height, the class-based grow, the displayed-row-count wiring, the caller's clamp guard, the collapsed twin) | domain | Jhoan Moreno | M | T48 | done |
| T48 | Round-11 criteria amendment (the cross-placement carve-out and the KPI bullet the reversal left behind) | docs | Jhoan Moreno | S | — | done |
| T49 | Round-11 records (the test-plan re-point and the files_hint drift) | docs | Jhoan Moreno | S | T47, T48 | done |
| T50 | Round-12 criteria amendment (the carve-out's real cause, its per-collapse-state band, and the two artefacts it never reached) | docs | Jhoan Moreno | M | — | done |
| T51 | Round-12 code fixes (the note's causal text, the collapsed share's own cover, and the constants the 110 px anchor rests on) | domain | Jhoan Moreno | M | T50 | done |
| T52 | Round-12 records (AC-18's coverage rows, the acs drift, and T48's third grep bullet) | docs | Jhoan Moreno | S | T50, T51 | done |
| T53 | Round-13 criteria amendment (the artefacts the carve-out still has not reached) | docs | Jhoan Moreno | S | — | done |
| T54 | Round-13 code fixes (the false suite result at :385, the single-density figure, and the fourth stacked basis) | domain | Jhoan Moreno | S | T53 | done |
| T55 | Round-13 records (T52's acs sweep, T51's undisclosed gap, and the AC-19 row) | docs | Jhoan Moreno | S | T53, T54 | done |
| T56 | Round-14 criteria amendment (the two carriers that say *less* instead of *share*) | docs | Jhoan Moreno | S | — | done |
| T57 | Round-14 code fixes (the stale `round(` and the vacuous `fileCount === 0` arm) | domain | Jhoan Moreno | S | T56 | done |
| T58 | Round-14 records (T54's unnamed DoD bullet, T53's marker adjacency, T57's attribution) | docs | Jhoan Moreno | S | T56, T57 | done |
| T59 | Round-15 criteria amendment (the band as the guard's closed form, the unreachable fixture, the sweep's file list) | docs | Jhoan Moreno | M | — | done |
| T60 | Round-15 production fix (guard the measured line height) | app | Jhoan Moreno | S | T59 | done |
| T61 | Round-15 test coverage (fixtures from the generator, four unobserved constants) | domain | Jhoan Moreno | M | T59 | done |
| T62 | Round-15 records (the false grep bullet, the moved address, the enumeration) | docs | Jhoan Moreno | S | T60, T61 | done |
| T63 | Round-16 criteria amendment | docs | Jhoan Moreno | M | — | done |
| T64 | Round-16 test coverage | domain | Jhoan Moreno | M | T63 | done |
| T65 | Round-16 figure gate | infra | Jhoan Moreno | M | T63, T64 | done |
| T66 | Round-16 records | docs | Jhoan Moreno | S | T64, T65 | done |
| T67 | Round-17 criteria amendment | docs | Jhoan Moreno | M | — | done |
| T68 | Round-17 code fixes | domain | Jhoan Moreno | S | T67 | done |
| T69 | Round-17 test coverage | domain | Jhoan Moreno | M | T68 | done |
| T70 | Round-17 gate hardening | infra | Jhoan Moreno | M | T67 | done |
| T71 | Round-17 records | docs | Jhoan Moreno | S | T69, T70 | done |
| T72 | Round-18 gate and CI fixes | infra | Jhoan Moreno | M | — | done |
| T73 | Round-18 D3 migration | docs | Jhoan Moreno | M | T72 | done |
| T74 | Round-18 records and graph | docs | Jhoan Moreno | S | T73 | done |
| T75 | Round-19 gate fixes (the narrowing rung, the aliased scope check, the mermaid comments, the frontmatter reader, the two acs drifts) | infra | Jhoan Moreno | M | — | done |
| T76 | Round-19 script test tier (the gates' parsers get a suite) | infra | Jhoan Moreno | M | T75 | done |
| T77 | Round-19 D3 completion (the four rows the migration missed, and the share floors as inputs) | docs | Jhoan Moreno | M | T75 | done |
| T78 | Round-19 records (the gate output no commit prints, the rung CI does not use, five observations) | docs | Jhoan Moreno | S | T77 | done |

**Total:** 78 tasks — **44 M + 34 S** (M ≈ 1 day, S ≈ ½ day), so ≈ 57.5 person-days. <!-- restated as the arithmetic 2026-09-10 (T67, review round 17, per owner decision D3): this read «~43 person-days», which was already stale before this wave — a sum over the rows below is a count derived from the table, so it goes stale every time a wave registers, exactly like the configuration counts R16-S1-F3 found. Stated as the estimate mix instead, which a reader can check against the rows. --> T15–T26 are the follow-ups of [review 2026-09-03](../_review/review-2026-09-03.md); T27–T28 of [review 2026-09-04](../_review/review-2026-09-04.md); T29 of [review 2026-09-04 round 3](../_review/review-2026-09-04-round3.md); T30 of [review 2026-09-04 round 4](../_review/review-2026-09-04-round4.md); T31 of [review 2026-09-04 round 5](../_review/review-2026-09-04-round5.md); T32 of [review 2026-09-07 round 6](../_review/review-2026-09-07.md); T33 of [review 2026-09-07 round 7](../_review/review-2026-09-07-round7.md); T34–T39 are the wave of the 2026-09-07 owner reversal (the History inspector loses its diff viewer, spec §8 reopened → AC-22, AC-03/AC-04/AC-05/AC-06/AC-18/AC-19 amended, [ADR-0004 amendment](../adr/0004-size-the-inspector-blocks-with-a-pure-typescript-layout-policy.md)), landed half-implemented by `2049df4` with nine tests left red on purpose; T40–T43 of [review 2026-09-08 round 9](../_review/review-2026-09-08.md); T44–T46 of [review 2026-09-08 round 10](../_review/review-2026-09-08-round10.md); T47–T49 of [review 2026-09-08 round 11](../_review/review-2026-09-08-round11.md); T50–T52 of [review 2026-09-08 round 12](../_review/review-2026-09-08-round12.md); T53–T55 of [review 2026-09-08 round 13](../_review/review-2026-09-08-round13.md); T56–T58 of [review 2026-09-08 round 14](../_review/review-2026-09-08-round14.md); T59–T62 of [review 2026-09-09 round 15](../_review/review-2026-09-09.md); T63–T66 of [review 2026-09-10 round 16](../_review/review-2026-09-10.md); T67–T71 of [review 2026-09-10 round 17](../_review/review-2026-09-10-round17.md); T72–T74 of [review 2026-09-10 round 18](../_review/review-2026-09-10-round18.md); T75–T78 of [review 2026-09-11 round 19](../_review/review-2026-09-11.md).

**T40–T42 — why the round-8 PASS did not survive.** Round 9 reviewed the reversal wave and found the code sound but two of its guards unpinned and the chain half-amended. `inspector-layout.ts:77` (the `panelHeadH` cap floor) and `:98` (the 2-row list floor) <!-- line numbers re-pointed 2026-09-08 (T52, review round 12 O12): after T44 the cap guard sits at `:84` and the 2-row floor at `:75` (`protectedList`) and `:105` (`listRows`). The figures above are the round-9 reading and are kept as the history they are; the guards are named as well as numbered, so the prose still resolves. --> can each be deleted with **831/831 still green** — the rows that covered them went out with the `diffHeight` table in `a1694d7` — and both bind at the bottom placement's 220 px minimum with blame and file history stacked. `sad.md` §6, `ux-flows.md`'s flows and `screens.md` still describe the inspector the owner reversed, AC-22 is absent from the SAD entirely, and AC-05 was amended into a claim the fixed-basis stacked panels cannot satisfy. Run T43 first (without it no gate in this wave means anything), then T41 (the criteria), then T40 (the code against them), then T42 (the map of what landed).

**T43 — the gate was not deterministic.** Found while running T40's RED step: under vitest's default file-level parallelism the same tree gives 1, 0 or 4 failures across three runs, always in the five component specs that wait on `afterNextRender`, the CDK portal or the virtual viewport. Measured on `228ab35`, the tree round 8 passed as «831 green». `fileParallelism: false` makes it 831 green three times out of three, at about twelve seconds a run. Every «831 green» in rounds 6–9 was therefore a lucky run; the named single-point mutations still hold, and the two whose evidence was «the mutation leaves 831/831 green» (R9-S2-F1, R9-S2-F2) were re-measured serially and stand.

**T26 — blocked (owner):** the boundary notes are committed; the three screenshots (`docs/screenshots/history-dark.png`, `changes-light.png` recaptured, new `diff-workspace-dark.png` with the workspace open from History, plus its README line) need the built app with a real repository and a visual check, which the agents cannot run unattended.

**T34–T39 — why a new wave after a PASS review:** [review round 8](../_review/review-2026-09-07-round8.md) passed against the pre-reversal criteria. The owner then reversed spec §8 on 2026-09-07 and `2049df4` shipped the production half (the zero-height History diff slot, the `commitFileClickOpensWorkspace` preference and its control) while stating that nine tests still assert the previous design. `pnpm test` at `2049df4`: **9 failed / 822 passed of 831** — four rows in `commit-inspector.spec.ts`, two in `commit-list.spec.ts`, three in `main-content.spec.ts`. `inspector-layout.ts` still implements the old subject (`MAX_LIST_ROWS = 6`, a diff share floor, `diffHeight`) with `commit-inspector.ts:597` patching over it, and AC-22 had no task at all.

**T34–T39 outcome (2026-09-07):** the wave landed in five commits on
`feat/inspector-diff-workspace` — `a1694d7` (T34+T35, one compile-coupled
gate), `27d5084` (T37), `ff1582e` (T38), `4f2357d` (T36), `805a32d` (T39). The
tree went from the nine reds `2049df4` left to **831 passing**; biome, clippy
`-D warnings`, `cargo fmt --check`, `tsc --noEmit` and `ng build` with
`strictTemplates` all clean.

Two boundary notes: T35's DoD asked for the zero-height-slot row, but the slot
lives in `main-content.html`, not the inspector's template, so that assertion
landed in T37 where it can actually see it. T36 reached no RED — AC-22's
production code shipped untested in `2049df4` — so its rows characterise the
existing behaviour and were verified against four mutations instead.
