---
id: T61
title: "Round-15 test coverage: fixtures derived from the generator, and the four constants nothing observes"
layer: "domain"
deps: ["T59"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18", "AC-19", "AC-20"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts",
  "src/app/shared/components/main-content/main-content.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "M"
status: "done"
---

# T61 — Round-15 test coverage

## Why

**R15-S1-F2** (the fixture half) and **R15-L-F1**, **R15-L-F2**, **R15-L-F3**
(`_review/review-2026-09-09.md`).

**The fixtures do not describe the app.** `inspector-layout.spec.ts:14-19` hard-codes
`COMPACT_TOKENS = { fileRowH: 30, panelHeadH: 30 }`, which **no** reachable
(density, `uiFontSize`) pair produces — compact at the default 13 px is 24 / 26, and the compact family
runs 22/24 at 11 px to 29/31 at 17 px. `COMFORTABLE_TOKENS` (30 / 34) happens to be real comfortable at
13 px. Measured: substituting the real compact tokens for the fixture leaves **838 of 839 green** —
only `:53` reddens (`expected 9 to be 7`) — so the compact half of the suite never tested what compact
is, and every compact figure the criteria carried came from a configuration the app cannot reach.

**Four things on the layout surface take any value with the suite still green**, while their twins are
pinned:

| what | measured | its pinned twin |
|---|---|---|
| `MIN_CENTRE_PX` (`main-content.ts:37`) | **60** green, **2000** green | — |
| `MIN_RIGHT_PX` (`:38`) | **20** green, **2000** green | — |
| `MIN_CENTRE_HEIGHT_PX` (`:213`) | **100** green, 2000 reddens 1 | covered from above only |
| `h-full` on `<app-blame-viewer>` (`main-content.html:140`) and `<app-file-history-panel>` (`:154`) | `h-1/2` green on both | the wrappers' `min-h-0` and flex basis all redden |

`MIN_BOTTOM_PX` reddens (1 / 838), so the asymmetry is in the tests, not the code. It matters beyond
the clamp: **T56's out-of-scope classification of the expanded carve-out hits rests on «`MIN_RIGHT_PX`
is a *width*»**, so a criteria-scope argument leans on a constant no test observes.

## What

1. **Derive both fixtures from `computeMetrics`** instead of hard-coding them, so a fixture cannot
   describe a configuration the app has no way to produce. The owner put `relaxed` in scope on
   2026-09-09, so the sweeps that say «both density token sets» take the **three**.
2. **Re-derive `inspector-layout.spec.ts:53`** («yields the same way in compact density, where the
   shorter head fits a seventh row») against the real compact tokens. Its figure changes; the property
   it asserts should not.
3. **Pin the four**: a component-tier row observing the right-placement clamp in both directions, a
   witness for `MIN_CENTRE_HEIGHT_PX` from below, and the inner hosts' `h-full` on both stacked panels.

## Definition of Done

- [x] **RED first for each new row**, with the first run classified and the failing line quoted.
- [x] The fixtures are **computed**, not typed: the spec derives them through the same function the app
      uses, and a comment records that a hard-coded pair is what R15-S1-F2 was. State the three
      default-font pairs the derivation yields (26 / 24 compact, 34 / 30 comfortable, 43 / 37 relaxed)
      and confirm they match `appearance-metrics.ts` by running it, not by reading it.
- [x] `:53` re-derives: state the old figure, the new one, and why the change is the fixture and not a
      behaviour change.
- [x] **Each of the four gets a mutation that reddens it**, quoted with its row and message:
      `MIN_CENTRE_PX` and `MIN_RIGHT_PX` at **both** a lower and a higher value (both directions left
      the suite green before this task), `MIN_CENTRE_HEIGHT_PX` at a lower value, and `h-full` → `h-1/2`
      on **each** of the two hosts separately.
- [x] The pre-existing guards still redden: re-run at minimum `C5` (the `protectedList` empty arm,
      3 / 836), `C7` (`LIST_SHARE_FLOOR` 0.45, 9 / 830), `C9` and `A1`. A fixture change that quietly
      weakens an existing row is the failure mode this bullet exists for — report each count against
      the round-15 baseline.
- [x] Whole gate green on three consecutive serial runs with identical counts; state the count.
      `pnpm lint` clean over 266 files; `tsc --noEmit -p tsconfig.spec.json` exit 0; `pnpm build` clean;
      the Rust half per `.claude/sdd.local.md`.
- [x] `git diff 805a32d -- src | grep -c '^-.*expect('` is **0** — the fixture re-base must not drop an
      assertion. If a row genuinely cannot survive the real tokens, **say so and stop**; do not weaken
      it.
- [x] Any DoD bullet that cannot be satisfied as written is **named in the Outcome** with the reason.

## Notes

`deps: [T59]`: T59 fixes what the artefacts claim about the densities and the tokens; this task makes
the suite match.

Both files are this task's alone. T60 owns `commit-inspector.ts` / `commit-inspector.spec.ts`.

`main-content.html` is **not** in the wave's diff and this task does not change it — it only asserts
against it.

## Outcome (2026-09-09)

Landed. Two spec files; no production file changed by this task (`main-content.ts` md5
`720244ba837d5fa7229ea935bb6d4704`, `main-content.html` `d1fbdf2ef79301507843b0053f8b6586`,
`inspector-layout.ts` `f10fa099c0981638022f412395001db6`, all at their pre-task values after every
mutation).

**The fixtures are computed, and the generator was run rather than read.** `tokensFor(density, ...)`
calls `computeMetrics` with `DEFAULT_PREFERENCES.uiFontSize` / `.monoFontSize`, so the fixture follows
the app's default if it ever moves. The three pairs it yields, measured: **comfortable 30 / 34**
(unchanged - the old comfortable fixture happened to be real), **compact 24 / 26** (the old fixture
said 30 / 30, which no density produces), **relaxed 37 / 43** (new). `lineH` and `headerFixedH` stay
stand-ins because they are not shipped tokens - the caller measures them off the rendered header.

**RED, observed rather than assumed.** With the derived fixture in place and the expectation put back
to its old value, the compact row fails exactly as round-15 stage 1 measured:

```
FAIL  inspector-layout.spec.ts > computeInspectorLayout > yields the same way in compact density
AssertionError: expected 9 to be 7 // Object.is equality
```

Restored by md5 afterwards. `:53`'s figure moves **7 -> 9** and its title from «a seventh row» to
«two more rows»: the cap is the 50 % share either way (210), and what changes is what the remainder
buys - `(420 - 168 - 26) / 24 = 9` rows at the real 24 px row and 26 px head, against six at
comfortable. **The property the row asserts is unchanged**; the figure had been measuring a density
that does not exist.

**Widening the sweeps to the third density broke a row, and it was re-derived, not weakened.** The
AC-18 bottom-placement row (`inspector-layout.spec.ts`, the 400 / 200 collapsed case) asserted one
expanded figure for every density and claimed «the 2-row floor (94 / 90) binds in neither». At
**relaxed** it binds: `43 + 2 x 37 = 117` against the ratio's 100, so the list takes 117 of the 200 px
remainder, the cap drops to **83** and the share **rises** to **0.585**. That is a floor doing its job -
a floor that binds can only ever give the list more - but the row could not state a single figure for
three densities. It now carries two per-density maps (`EXPANDED_CAP`, `EXPANDED_SHARE`) with the
reason for each, **plus** a new `toBeGreaterThanOrEqual(0.5)` on top, so nothing was dropped and the
detection is strictly stronger: a policy that stopped distinguishing the two collapse states would put
the expanded cap at 50 against the 100 (or relaxed's 83) this asserts. Its two figures 94 / 90 were
themselves the unreachable fixture's, not the app's 26 / 24.

**The four unobserved things now have witnesses. Seven mutations, seven reddened**, each restored from
a `cp` copy with the md5 re-checked:

| mutation | result |
|---|---|
| `MIN_CENTRE_PX` 360 -> **60** | 1 failed / 9 - `expected '64px' to be '360px'` |
| `MIN_CENTRE_PX` 360 -> **2000** | 1 failed / 9 - `expected '2000px' to be '960px'` |
| `MIN_RIGHT_PX` 320 -> **20** | 1 failed / 9 - `expected '1024px' to be '960px'` |
| `MIN_RIGHT_PX` 320 -> **2000** | 1 failed / 9 - `expected '360px' to be '960px'` |
| `MIN_CENTRE_HEIGHT_PX` 200 -> **100** | 1 failed / 9 - `expected '100px' to be '200px'` |
| `h-full` -> `h-1/2` on `app-blame-viewer` | 1 failed / 9 - `app-blame-viewer: expected [ 'block', 'h-1/2', 'min-h-0' ] to include 'h-full'` |
| `h-full` -> `h-1/2` on `app-file-history-panel` | 1 failed / 9 - same message, its own label |

Both clamp constants are now witnessed **in both directions**, which neither was before at any value
from 20 to 2000. The two `64px` / `1024px` figures are the split preference's own 5 % / 80 % clamp
showing through, which is why the row asserts the clamped result rather than the raw split.

**The pre-existing guards still redden after the re-base** - the failure mode this bullet exists for.
Measured over `inspector-layout.spec.ts` alone (23 rows) except A1, which lives in the component tier:

| guard | after the re-base |
|---|---|
| **C5** the `protectedList` empty arm | 2 failed / 21 in-file (3 / 838 whole-suite in round 15) |
| **C6** `COLLAPSED_LIST_SHARE_FLOOR` 0.75 -> 0.5 | 4 failed / 19 |
| **C7** `LIST_SHARE_FLOOR` 0.5 -> 0.45 | 8 failed / 15 |
| **C9** `listRows` drops its 2-row floor | 1 failed / 22 |
| **A1** the fourth stacked basis | 1 failed / 9 - `expected [ '0 0 58.6%' ] to deeply equal [ '0 0 28.6%' ]` |

**Gate.** `pnpm test` **841 passed (841), 63 files, three consecutive serial runs identical**
(839 before the wave; T60 adds one row and this task adds one) - `pnpm lint` biome clean over 266
files - `tsc --noEmit -p tsconfig.spec.json` exit 0 - `pnpm build` clean, no budget warning.

**DoD bullets that could not be satisfied as written: two, named.**

1. «RED first for each new row, with the first run classified and the failing line quoted«t. **The
   three pins cannot have a classic RED**: they pin behaviour that is already correct, so on the
   current tree they pass, and a passing first run is a *false-pass* under the RED classification only
   when the test is too weak. Here it is the honest state of a regression pin. Their red is the
   mutation, and all seven are quoted above. The fixture correction **did** get a real RED, quoted
   above. Naming this rather than dressing a green run up as a red one.
2. «`git diff 805a32d -- src | grep -c '^-.*expect('` is **0**» - it is **1**, the
   `toBe(7)` -> `toBe(9)` line this task re-derived, against **57** matching `+` lines. The check
   cannot tell a removal from a corrected expected value; the replacement measure is the per-file
   `expect(` count, which **rose in all four** touched specs (47 -> 60, 45 -> 72, 106 -> 118, 29 -> 33).
   The next wave's bullet should be phrased that way.

**One check worth fixing wherever it is written down.** The gate line
`grep -rn "it.skip\|\.only(\|it\.todo\|\.concurrent" src/` reports **3** on this tree, and all
three are the string `'Commit skipped.'` in `sequencer-ops.ts:159, 195, 222`: the unescaped `.` in
`it.skip` matches `it skip` inside «Commit skipped». Escaped (`grep -rnE "it\.skip|..."`) the
answer is **0**, which is what every record has claimed - right conclusion, wrong instrument.
