import { describe, expect, it } from 'vitest';
import { computeMetrics } from './appearance-metrics';
import { computeInspectorLayout } from './inspector-layout';
import { DEFAULT_PREFERENCES, type UiDensity } from './preferences-schema';

// The two tokens the policy actually reads are DERIVED from the same function
// that feeds the app, never typed here. A hand-written pair survived fifteen
// review rounds describing a density `computeMetrics` cannot produce -- compact
// was written 30 / 30 where the app renders 24 / 26 -- which put an unpassable
// figure in AC-20's only verification row and a false share in two criteria
// markers (review round 15, R15-S1-F2). `--line-h` and `--header-fixed-h` are
// NOT shipped tokens: the caller measures them off the rendered header, so they
// stay stand-ins, scaled by the same padding ratio as the tokens beside them.
const tokensFor = (density: UiDensity, lineH: number, headerFixedH: number) => {
  const { fileRowHeight, panelHeadHeight } = computeMetrics({
    uiFontSize: DEFAULT_PREFERENCES.uiFontSize,
    monoFontSize: DEFAULT_PREFERENCES.monoFontSize,
    density,
  });
  return { fileRowH: fileRowHeight, panelHeadH: panelHeadHeight, lineH, headerFixedH };
};

const COMFORTABLE_TOKENS = tokensFor('comfortable', 18, 112);
const COMPACT_TOKENS = tokensFor('compact', 18, 96);
// The third shipped density (`preferences-schema.ts`), in scope since the owner
// decision of 2026-09-09: it carries the widest header-cap band, so a sweep that
// stops at two densities never visits the configurations AC-18 is loosest in.
const RELAXED_TOKENS = tokensFor('relaxed', 18, 132);

const DENSITIES = [COMFORTABLE_TOKENS, COMPACT_TOKENS, RELAXED_TOKENS];

// The share the spec measures is the height the list BLOCK receives, not
// rows x rowH: with two files the list takes two rows and leaves the rest
// empty (AC-04, AC-05), so counting rows would report a false starvation.
// What the policy guarantees is that the header never eats into the share,
// and `headerMaxH` is exactly the line it may not cross.
const listShare = (
  availableHeight: number,
  stacked: number,
  headerMaxH: number,
): number => (availableHeight - stacked - headerMaxH) / (availableHeight - stacked);

describe('computeInspectorLayout', () => {
  it('gives the whole remainder to the list at the 960x640 squeeze: no yield is needed once the diff is gone', () => {
    const result = computeInspectorLayout({
      availableHeight: 420,
      fileCount: 30,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    // The list is the growing child now (ADR-0004 amendment): the header at
    // its full 4-line clamp is 184 px against a 210 px cap, so nothing yields
    // and the list keeps 420 - 184 - 34 = 202 px, six whole rows of 30.
    expect(result.listRows).toBe(6);
    expect(result.clampLines).toBe(4);
    // 420 - max(50 % floor 210, 2-row floor 94) = 210.
    expect(result.headerMaxH).toBe(210);
    expect(listShare(420, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.5);
  });

  it('yields the same way in compact density, where the shorter head and row fit two more rows', () => {
    const result = computeInspectorLayout({
      availableHeight: 420,
      fileCount: 30,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMPACT_TOKENS,
    });
    // Nine, not the seven this row asserted while the compact fixture was the
    // unreachable 30 / 30: the cap is the 50 % share either way (210), and what
    // changes is what the remainder buys -- (420 - 168 - 26) / 24 = 9 rows at
    // the real 24 px row and 26 px head, against six at comfortable. The
    // property is unchanged, the figure was measuring a density that does not
    // exist (review round 15, R15-S1-F2).
    expect(result.listRows).toBe(9);
    expect(result.clampLines).toBe(4);
    expect(result.headerMaxH).toBe(210);
    expect(listShare(420, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.5);
  });

  it('takes exactly two rows for two files and reserves no empty rows beyond them (AC-04)', () => {
    const result = computeInspectorLayout({
      availableHeight: 640,
      fileCount: 2,
      bodyLines: 0,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(2);
    expect(result.clampLines).toBe(0);
    expect(result.headerMaxH).toBe(320);
  });

  it('gives a single file a single row, never the 2-row floor as padding (AC-04)', () => {
    const result = computeInspectorLayout({
      availableHeight: 600,
      fileCount: 1,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(1);
  });

  it('reserves no clamp height beyond the actual body length for a short body', () => {
    const result = computeInspectorLayout({
      availableHeight: 600,
      fileCount: 3,
      bodyLines: 1,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(3);
    expect(result.clampLines).toBe(1);
  });

  it('reports 0 rows for 0 files, never a row for the empty-state line', () => {
    const result = computeInspectorLayout({
      availableHeight: 500,
      fileCount: 0,
      bodyLines: 3,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(0);
  });

  it('claims no share when there is nothing to draw, exactly as a collapsed list does (AC-04, AC-05)', () => {
    const empty = computeInspectorLayout({
      availableHeight: 640,
      fileCount: 0,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    const collapsed = computeInspectorLayout({
      availableHeight: 640,
      fileCount: 10,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: true,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    // A list with no rows to draw is the same layout case as a collapsed one:
    // both are a bare head. Reserving the 50 % share for it capped the header
    // at 320 and left half the column blank — reachable on any commit through
    // a filter that matches nothing, because the policy is fed the DISPLAYED
    // row count (`commit-inspector.ts` `fileRows().length`), not the commit's
    // file count. Reddens if the `fileCount === 0` arm of `protectedList` goes.
    expect(empty.listRows).toBe(0);
    expect(empty.headerMaxH).toBe(606);
    expect(empty.headerMaxH).toBe(collapsed.headerMaxH);
  });

  it('has no upper cap on the rows: nine files get nine rows when the column fits them (AC-04)', () => {
    const result = computeInspectorLayout({
      availableHeight: 800,
      fileCount: 9,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    // The pre-reversal policy capped this at 6 to protect the diff slot.
    expect(result.listRows).toBe(9);
    expect(result.clampLines).toBe(2);
  });

  it('shows as many rows as the column fits when the file count exceeds them (AC-04)', () => {
    const result = computeInspectorLayout({
      availableHeight: 800,
      fileCount: 30,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    // 800 - (112 + 2 x 18) - 34 = 618 -> 20 whole rows, and the list scrolls
    // the remaining ten files.
    expect(result.listRows).toBe(20);
  });

  it('zeroes the clamp when the header is collapsed and hands the list at least 75 %', () => {
    const result = computeInspectorLayout({
      availableHeight: 700,
      fileCount: 2,
      bodyLines: 12,
      headerCollapsed: true,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.clampLines).toBe(0);
    expect(result.listRows).toBe(2);
    expect(result.headerMaxH).toBe(175);
    expect(listShare(700, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.75);
  });

  it('reaches the same 75 % collapsed-header floor in compact density', () => {
    const result = computeInspectorLayout({
      availableHeight: 700,
      fileCount: 2,
      bodyLines: 12,
      headerCollapsed: true,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMPACT_TOKENS,
    });
    expect(result.clampLines).toBe(0);
    expect(result.headerMaxH).toBe(175);
    expect(listShare(700, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.75);
  });

  it('charges the collapsed header its own panel head, so the released height buys only the rows it can hold (AC-02)', () => {
    // AC-02's only observable is `listRows`, and until this row nothing in the
    // suite asserted it under collapse: the 220 / 110 twin below pins caps and
    // shares there and never a row count, so
    // `headerHeight = headerCollapsed ? panelHeadH : ...` could be `? 0 :` with
    // all 842 tests green (review round 17, R17-F10). It is not an equivalent
    // mutant — `headerMaxH >= panelHeadH` always, so `Math.min(headerHeight,
    // headerMaxH)` is the head itself and dropping it hands the list a whole
    // panel head of height it has no room for.
    //
    // Hence the property beside each figure: under collapse the remainder pays
    // for TWO panel heads, the header's and the list's, and the rest is rows.
    // A closed form in the tokens, so a density change cannot stale it.
    //
    // Two remainders, because the carve-out one alone cannot separate the
    // mutant in every density: at 110 the list's 2-row floor pins comfortable
    // and relaxed at 2 rows whether the head is charged or not, and only
    // compact separates (2 against 3). The carve-out remainder stays because it
    // is the configuration the branch is built around; the 300 px one is what
    // makes every density a detector rather than only the middle one.
    const EXPECTED = new Map([
      [COMFORTABLE_TOKENS.panelHeadH, { carveOut: 2, roomy: 7 }],
      [COMPACT_TOKENS.panelHeadH, { carveOut: 2, roomy: 10 }],
      [RELAXED_TOKENS.panelHeadH, { carveOut: 2, roomy: 5 }],
    ]);
    // A density added to DENSITIES without an expectation fails here rather
    // than being skipped (review round 16, O6).
    expect(EXPECTED.size).toBe(DENSITIES.length);

    for (const tokens of DENSITIES) {
      const expected = EXPECTED.get(tokens.panelHeadH);
      if (expected === undefined) {
        throw new Error(`no expectation for panelHeadH ${tokens.panelHeadH}`);
      }
      const cases = [
        { availableHeight: 220, stackedPanelsHeight: 110, rows: expected.carveOut },
        { availableHeight: 300, stackedPanelsHeight: 0, rows: expected.roomy },
      ];

      for (const { availableHeight, stackedPanelsHeight, rows } of cases) {
        const result = computeInspectorLayout({
          availableHeight,
          fileCount: 30,
          bodyLines: 12,
          headerCollapsed: true,
          fileListCollapsed: false,
          stackedPanelsHeight,
          tokens,
        });
        const remainder = availableHeight - stackedPanelsHeight;
        const twoHeads = Math.max(
          2,
          Math.floor((remainder - 2 * tokens.panelHeadH) / tokens.fileRowH),
        );

        expect({ ph: tokens.panelHeadH, remainder, rows: result.listRows }).toEqual({
          ph: tokens.panelHeadH,
          remainder,
          rows,
        });
        expect({ ph: tokens.panelHeadH, remainder, rows: result.listRows }).toEqual({
          ph: tokens.panelHeadH,
          remainder,
          rows: twoHeads,
        });
      }
    }
  });

  it('drops the list to its header-only height when the file list is collapsed', () => {
    const result = computeInspectorLayout({
      availableHeight: 600,
      fileCount: 10,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: true,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(0);
    // A collapsed list claims no share (AC-05: the released height is left
    // empty when nothing is stacked), so the cap is everything but its head.
    expect(result.headerMaxH).toBe(566);
  });

  it('treats a stacked panel share as fixed, subtracted before the floor is computed', () => {
    const result = computeInspectorLayout({
      availableHeight: 700,
      fileCount: 4,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 200,
      tokens: COMFORTABLE_TOKENS,
    });
    // remainder is 500, not 700: the floor is half of the 500 remainder.
    expect(result.listRows).toBe(4);
    expect(result.clampLines).toBe(2);
    expect(result.headerMaxH).toBe(250);
    expect(listShare(700, 200, result.headerMaxH)).toBeGreaterThanOrEqual(0.5);
  });

  it('never drops the list below 2 rows or the clamp below 1 line while yielding', () => {
    for (const tokens of DENSITIES) {
      for (let fileCount = 2; fileCount <= 30; fileCount += 4) {
        for (let bodyLines = 1; bodyLines <= 16; bodyLines += 3) {
          const result = computeInspectorLayout({
            availableHeight: 300,
            fileCount,
            bodyLines,
            headerCollapsed: false,
            fileListCollapsed: false,
            stackedPanelsHeight: 0,
            tokens,
          });
          expect(result.listRows).toBeGreaterThanOrEqual(2);
          expect(result.clampLines).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  describe('the inverted yield order (AC-03)', () => {
    it('shrinks the body clamp before the list gives up a single row', () => {
      // A 300 px column: the 50 % floor leaves the header 150 px, which fits
      // 112 fixed + 2 lines. The clamp gives up its 3rd and 4th line; the
      // list keeps every row the remaining space fits.
      const result = computeInspectorLayout({
        availableHeight: 300,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: COMFORTABLE_TOKENS,
      });
      expect(result.clampLines).toBe(2);
      expect(result.listRows).toBe(3);
      expect(listShare(300, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.5);
    });

    it('floors the body clamp rather than rounding it, so the header never claims a line its allowance cannot hold (AC-03)', () => {
      // The THIRD rounding site in the policy, and the only one nothing
      // observed: the T29 heights table below explains the mod-4 residue
      // classes for `headerMaxH`'s two quotients and its rows assert
      // `headerMaxH` and the share -- never `clampLines` -- so it cannot see
      // this one by construction. Mutating this `Math.floor` to `Math.round`
      // left all 841 tests green (review round 16, R16-S2-F2).
      //
      // Derived from the fixture, never pinned: in the share regime the
      // allowance is half the column, so a column of
      // `2 * (headerFixedH + 1.5 * lineH)` puts the quotient at exactly 1.5 --
      // the smallest fraction `Math.round` rounds up -- inside the
      // `[1, MAX_CLAMP_LINES)` window where the clamp is still free to move.
      // Change the fixture and the height follows it.
      const { headerFixedH, lineH } = COMFORTABLE_TOKENS;
      const availableHeight = 2 * (headerFixedH + 1.5 * lineH);

      const result = computeInspectorLayout({
        availableHeight,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: COMFORTABLE_TOKENS,
      });

      // 1.5 lines fit, so one line is what the allowance holds. Rounding
      // writes 2, and `headerFixedH + 2 * lineH` exceeds the allowance:
      // `Math.min(headerHeight, headerMaxH)` then clips the expanded header
      // into its own scrollbar with a half-cut line, and a clamp one line too
      // generous also stops «show more» appearing on a body that IS being cut,
      // because `measureBody` compares the body's `scrollHeight` to its
      // `clientHeight` (`commit-inspector.ts`, AC-01).
      expect(result.clampLines).toBe(1);
      // The property, stated independently of the figure: whatever the clamp
      // resolves to, the header it implies must fit inside the cap.
      expect(headerFixedH + result.clampLines * lineH).toBeLessThanOrEqual(
        result.headerMaxH,
      );
      expect(listShare(availableHeight, 0, result.headerMaxH)).toBeGreaterThanOrEqual(
        0.5,
      );
    });

    it('scrolls the expanded header inside its cap once the clamp is at its floor, rather than starving the list', () => {
      // A commit with thirty refs: the fixed header alone (400 px) is taller
      // than the 320 px the list's floor leaves it, so the cap binds and the
      // header scrolls inside it. The list still gets its half.
      const result = computeInspectorLayout({
        availableHeight: 640,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: { ...COMFORTABLE_TOKENS, headerFixedH: 400 },
      });
      expect(result.headerMaxH).toBe(320);
      expect(result.headerMaxH).toBeLessThan(400);
      expect(result.clampLines).toBe(1);
      expect(result.listRows).toBe(9);
      expect(listShare(640, 0, result.headerMaxH)).toBeGreaterThanOrEqual(0.5);
    });

    it('holds the 2-row floor when even the floors cannot all be met', () => {
      // 150 px of column: the 50 % floor is 75 px, under the list's own
      // 94 px 2-row floor, so the harder floor wins and the cap collapses to
      // 56 px. The list never drops under two rows.
      const result = computeInspectorLayout({
        availableHeight: 150,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: COMFORTABLE_TOKENS,
      });
      expect(result.listRows).toBe(2);
      expect(result.clampLines).toBe(1);
      expect(result.headerMaxH).toBe(56);
    });

    it('binds both hard floors at the bottom placement with blame and file history stacked', () => {
      // The tightest configuration the app can actually reach, and the only
      // one in the suite where either guard binds: the inspector at the bottom
      // sits on its own 220 px minimum (`main-content.ts` MIN_BOTTOM_PX) and
      // the two stacked panels hold a fixed 30 % + 20 % = 110 px
      // (`main-content.ts` blameFlex / fileHistoryFlex), leaving 110 px.
      //   headerAllowance = 110 - max(94, 55) = 16, so the panelHeadH guard
      //     lifts the cap to 34; without it the header is capped at 16 px and
      //     disappears behind its own scrollbar.
      //   listHeight = 110 - 34 - 34 = 42 and floor(42 / 30) = 1, so the 2-row
      //     floor lifts it to 2; without it the list shows a single row, and on
      //     a shorter remainder the count goes negative and is written as a
      //     negative `--inspector-list-rows`.
      // One assertion per guard; each mutation reddens this row alone.
      const result = computeInspectorLayout({
        availableHeight: 220,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 110,
        tokens: COMFORTABLE_TOKENS,
      });
      expect(result.headerMaxH).toBe(COMFORTABLE_TOKENS.panelHeadH);
      expect(result.listRows).toBe(2);
    });

    it('yields to the header-cap guard at the bottom minimum in the densities whose band reaches it, and meets the floor in the one whose does not (AC-18)', () => {
      // The collapsed twin of the row above, at the tightest remainder the app
      // can reach. It ran with `COMFORTABLE_TOKENS` alone until review round 16
      // (R16-L-F2), which is why two false claims survived here: that this is
      // «the one REACHABLE configuration where the guarantee yields» — the band
      // is reachable in 16 of the 21 token sets — and that the two collapse
      // states are «numerically identical» at this remainder, which holds at
      // comfortable and relaxed and fails at compact.
      //
      // The remainder is 110 and the collapsed band is `4 * panelHeadH`, so
      // whether the guard costs the list its ratio depends on the density:
      //
      //   comfortable  ph 34  band 136 > 110  protectedList max(94, 82.5) = 94
      //                       allowance 16 -> cap 34 = ph        share 0.690909  MISSES
      //   compact      ph 26  band 104 < 110  protectedList max(74, 82.5) = 82.5
      //                       allowance 27.5 -> cap 27 > ph      share 0.754545  MEETS
      //   relaxed      ph 43  band 172 > 110  protectedList max(117, 82.5) = 117
      //                       allowance -7 -> cap 43 = ph        share 0.609091  MISSES
      //
      // At compact the SHARE floor sets `protectedList` and the allowance clears
      // a panel head, so the guard never binds and the 75 % floor is met with no
      // carve-out needed. That is the per-density split AC-18 states, and the
      // last assertion is the property rather than the figures: the share misses
      // its floor exactly when the remainder is inside the collapsed band.
      //
      // This row pins the GUARD at the carve-out remainder; it does NOT pin the
      // collapsed 75 % floor, which at comfortable and relaxed is not what binds
      // here. The row below pins that floor, at a remainder where it does bind
      // (review round 12, R12-S2-F2 — the round-11 comment said the share floor
      // left «an allowance of 27.5», which the policy does compute, but at
      // compact rather than at the comfortable fixture the note was describing).
      // Pinned here because the sweep passes `stackedPanelsHeight: 0` throughout.
      const EXPECTED = new Map([
        [COMFORTABLE_TOKENS.panelHeadH, { cap: 34, share: 0.690909 }],
        [COMPACT_TOKENS.panelHeadH, { cap: 27, share: 0.754545 }],
        [RELAXED_TOKENS.panelHeadH, { cap: 43, share: 0.609091 }],
      ]);
      // A density added to DENSITIES without an expectation fails here rather
      // than being skipped.
      expect(EXPECTED.size).toBe(DENSITIES.length);

      for (const tokens of DENSITIES) {
        const expected = EXPECTED.get(tokens.panelHeadH);
        if (expected === undefined) {
          throw new Error(`no expectation for panelHeadH ${tokens.panelHeadH}`);
        }
        const result = computeInspectorLayout({
          availableHeight: 220,
          fileCount: 30,
          bodyLines: 12,
          headerCollapsed: true,
          fileListCollapsed: false,
          stackedPanelsHeight: 110,
          tokens,
        });
        const share = listShare(220, 110, result.headerMaxH);
        const insideBand = 110 < 4 * tokens.panelHeadH;

        expect({ ph: tokens.panelHeadH, cap: result.headerMaxH }).toEqual({
          ph: tokens.panelHeadH,
          cap: expected.cap,
        });
        expect(share).toBeCloseTo(expected.share, 4);
        // The property: the collapsed floor is missed exactly inside the band.
        expect({ ph: tokens.panelHeadH, misses: share < 0.75 }).toEqual({
          ph: tokens.panelHeadH,
          misses: insideBand,
        });
      }
    });

    it('holds the collapsed 75 % floor at the bottom placement, where that floor binds (AC-18)', () => {
      // The row above cannot see the collapsed floor: at a 110 px remainder what
      // binds is the 2-row floor at comfortable and relaxed, where the two collapse
      // states then coincide (34 / 34 and 43 / 43) — at compact they diverge, 36
      // expanded against 27 collapsed, because there the share floor sets
      // `protectedList` (review round 16, R16-L-F2: this comment said the states
      // were «numerically identical», true of the comfortable fixture it was
      // written against and false of the density the app ships beside it).
      // So removing COLLAPSED_LIST_SHARE_FLOOR outright left THE TWIN green —
      // 3 failed / 835 in round 12, the two 75 % unit rows and the sweep at
      // 200 px, with the twin absent from them; 4 / 835 once this row exists,
      // and this row is the new failure (review round 12, R12-S2-F2; the clause
      // said «all 838 tests green», which no round has ever measured — review
      // round 13, R13-S2-F1). A 200 px remainder is the smallest round
      // figure where the collapsed floor DOES bind (0.75 x 200 = 150 > 94) and
      // where the two states diverge — and it is above the carve-out band, so
      // AC-18's guarantee applies in full here:
      //   collapsed: protectedList 150 -> allowance  50 -> cap  50 -> share 0.75
      //   expanded:  protectedList 100 -> allowance 100 -> cap 100 -> share 0.50
      // The COLLAPSED half agrees across all three densities. The EXPANDED half
      // does not, and that is the policy working rather than failing: the list
      // gets the GREATER of its ratio and its own 2-row floor, and at relaxed
      // that floor is 43 + 2 x 37 = 117 against the ratio's 100, so the list
      // takes 117 of the 200 px remainder, the cap drops to 83 and the share
      // RISES to 0.585. A floor that binds can only ever give the list more.
      // This row used to state one expanded figure for every density and to
      // claim the 2-row floor bound in none of them, with the figures 94 / 90 --
      // both of which were the unreachable 30 / 30 compact fixture's, not the
      // app's 26 / 24 (review round 15, R15-S1-F2 and T61).
      const EXPANDED_CAP = new Map([
        [34, 100], // comfortable: the ratio binds, 94 < 100
        [26, 100], // compact: the ratio binds, 74 < 100
        [43, 83], // relaxed: the 2-row floor binds, 117 > 100
      ]);
      const EXPANDED_SHARE = new Map([
        [34, 0.5],
        [26, 0.5],
        [43, 0.585],
      ]);
      // A density added to DENSITIES without an entry fails here rather than
      // being skipped or compared against 0 (review round 16, O6).
      expect(EXPANDED_CAP.size).toBe(DENSITIES.length);
      expect(EXPANDED_SHARE.size).toBe(DENSITIES.length);
      for (const tokens of DENSITIES) {
        const expectedExpandedShare = EXPANDED_SHARE.get(tokens.panelHeadH);
        if (expectedExpandedShare === undefined) {
          throw new Error(`no expanded share for panelHeadH ${tokens.panelHeadH}`);
        }
        const input = {
          availableHeight: 400,
          fileCount: 30,
          bodyLines: 12,
          fileListCollapsed: false,
          stackedPanelsHeight: 200,
          tokens,
        };
        const collapsed = computeInspectorLayout({ ...input, headerCollapsed: true });
        const expanded = computeInspectorLayout({ ...input, headerCollapsed: false });

        // The floor itself, on the remainder the stacked panels leave.
        expect(listShare(400, 200, collapsed.headerMaxH)).toBeCloseTo(0.75, 4);
        expect(collapsed.headerMaxH).toBe(50);
        // And that it is the COLLAPSED floor: the expanded pass keeps its own
        // share, so a policy that stopped distinguishing them would redden here
        // -- using 0.75 for both would put the expanded cap at 50 against the
        // 100 (or relaxed's 83) this asserts.
        expect(expanded.headerMaxH, `panelHeadH ${tokens.panelHeadH}`).toBe(
          EXPANDED_CAP.get(tokens.panelHeadH),
        );
        expect(
          listShare(400, 200, expanded.headerMaxH),
          `panelHeadH ${tokens.panelHeadH}`,
        ).toBeCloseTo(expectedExpandedShare, 4);
        // Whichever of the two set it, the criterion-level floor still holds.
        expect(listShare(400, 200, expanded.headerMaxH)).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('T29 — the header cap the policy hands back (AC-03, AC-04)', () => {
    // The rounding class has two halves, because the cap has two formulas.
    // Expanded the header allowance is `0.5h`, so rounding half up steals the
    // list's pixel iff `h` is ODD — that is what `421` watches. Collapsed it
    // is `0.25h`, so it steals iff `h = 2, 3 (mod 4)` — that is what `422`
    // watches. Every other height here is `= 0 (mod 4)`, the one class where
    // both quotients are whole pixels and neither can fail. Round 10 added
    // `421` for the expanded half (R10-S2-F2); round 11 found the collapsed
    // half still unwatched — rounding on the collapsed path alone left all
    // 835 tests green (R11-S2-F1).
    const heights = [200, 300, 420, 421, 422, 560, 700, 900];
    const fileCounts = [0, 1, 2, 6, 7, 30];

    it('reports a whole-pixel cap never under one panel head, in every configuration of the table (R8, R9)', () => {
      for (const tokens of DENSITIES) {
        for (const availableHeight of heights) {
          for (const fileCount of fileCounts) {
            for (const headerCollapsed of [false, true]) {
              for (const fileListCollapsed of [false, true]) {
                const result = computeInspectorLayout({
                  availableHeight,
                  fileCount,
                  bodyLines: 12,
                  headerCollapsed,
                  fileListCollapsed,
                  stackedPanelsHeight: 0,
                  tokens,
                });
                expect({
                  availableHeight,
                  fileCount,
                  headerCollapsed,
                  fileListCollapsed,
                  whole: Number.isInteger(result.headerMaxH),
                  atLeastAHead: result.headerMaxH >= tokens.panelHeadH,
                }).toEqual({
                  availableHeight,
                  fileCount,
                  headerCollapsed,
                  fileListCollapsed,
                  whole: true,
                  atLeastAHead: true,
                });
              }
            }
          }
        }
      }
    });

    it('keeps the list at or over its share in every configuration where the list is expanded', () => {
      for (const tokens of DENSITIES) {
        for (const availableHeight of heights) {
          for (const fileCount of fileCounts) {
            for (const headerCollapsed of [false, true]) {
              const result = computeInspectorLayout({
                availableHeight,
                fileCount,
                bodyLines: 12,
                headerCollapsed,
                fileListCollapsed: false,
                stackedPanelsHeight: 0,
                tokens,
              });
              const floor = headerCollapsed ? 0.75 : 0.5;
              const share = listShare(availableHeight, 0, result.headerMaxH);
              // A list with no row to draw is a bare head and claims no share
              // by design — the same rule as a collapsed list, which this loop
              // excludes by passing `fileListCollapsed: false`.
              const nothingToDraw = fileCount === 0;
              // The empty case is ASSERTED, not skipped: it has its own
              // invariant — the head is all the list claims, so the cap is the
              // whole column but for that head. Excusing it instead switched
              // off the 24 configurations that exercise the arm which put it
              // here (review round 10, R10-S2-F1), leaving the broadest row in
              // the suite silent about the newest behaviour.
              //
              // The clause this replaced excused any configuration where the
              // list's 2-row floor is taller than its share. Every bound below
              // is a CLOSED FORM in the tokens, never a per-density figure:
              // rounds 12 to 16 each restated these numbers and each was
              // falsified by the next change to `computeMetrics` or to
              // `DENSITIES`, the last time inside the same wave (review round
              // 16, R16-S1-F2 / R16-S2-F3). A form cannot go stale.
              //
              // The share yields — i.e. the head-cap guard costs the list its
              // ratio — exactly below:
              //
              //   expanded    r < 2 * panelHeadH
              //   collapsed   r < 4 * panelHeadH
              //
              // which is `panelHeadH / (1 - shareRatio)`, carries no term from
              // the list's row floor, and does not move when that floor is set
              // to 0, 1, 3 or 6 rows. Verified at 201 474 points over all 21
              // reachable (density, uiFontSize) pairs, 0 mismatches.
              //
              // The guard BINDING is a different and wider predicate, and
              // conflating the two is what round 16 found in the criteria:
              //
              //   expanded    r < 2 * panelHeadH + 2 * fileRowH
              //   collapsed   r < 4 * panelHeadH
              //
              // because in the row-floor regime `protectedList` is
              // `panelHeadH + 2 * fileRowH` throughout, so the boundary carries
              // the row term ONCE — added to the head the guard itself needs,
              // not multiplied by it. Written `2 * (panelHeadH + 2 * fileRowH)`
              // it overstates the band by `2 * fileRowH` and mismatches the
              // guard at 5312 points; the sum matches at 0 (review round 17,
              // R17-F1). Also 0 mismatches over the same 201 474 points. The
              // expanded halves disagree at 5312 of them; the collapsed halves
              // coincide. Where the guard binds but the share is met the policy
              // is simply correct: the cap is `panelHeadH` exactly, so the list
              // keeps `1 - panelHeadH / r`, which starts AT the ratio floor
              // (`r = 2 * panelHeadH`) and stays under
              // `(panelHeadH + 2 * fileRowH) / (2 * panelHeadH + 2 * fileRowH)`.
              // A form, not the two figures that stood here: those were two
              // densities' shares at the single 110 px remainder, read as the
              // band's endpoints.
              //
              // The misses have exactly ONE cause: `Math.max(headerAllowance,
              // panelHeadH)`. Over 40…2000 px at the default font, all of them
              // are fixed by removing the head-cap guard and NONE by removing
              // the 2-row floor. Collapsed, the row floor does SET
              // `protectedList` below `4 * (panelHeadH + 2 * fileRowH) / 3`,
              // which is what the round-11 note mistook for a second cause: it
              // only ever RAISES the list's protected height, so it can only
              // ever raise the share. Worked example, h = 130 collapsed
              // comfortable: cap 34 -> share 0.7385, and without the guard cap
              // 32 -> share 0.7538 (review round 12, R12-S1-F1).
              //
              // The deleted predicate — `panelHeadH + 2 * fileRowH >
              // (1 - floor) * availableHeight` — held for every
              // `h < 2 * (panelHeadH + 2 * fileRowH)` expanded and
              // `h < 4 * (panelHeadH + 2 * fileRowH)` collapsed, so it excused
              // far more than it was needed for, which is why a
              // predicate-shaped escape hatch would swallow regressions at
              // heights already in this table. Dropped in review round 9 (O3).
              // Restore it, deliberately, only below the SHARE-YIELD bound
              // above — `2 * panelHeadH` expanded, `4 * panelHeadH` collapsed —
              // and only on the head-cap guard, never on the row floor. Do not
              // write those bounds out as numbers: the previous wording said
              // «68 / 60 px expanded, 136 / 120 px collapsed», whose compact
              // half came from the unreachable {30, 30} fixture this file no
              // longer contains, and following it at compact would have waived
              // the guarantee across heights where the policy meets it.
              expect({ availableHeight, fileCount, headerCollapsed, ok: true }).toEqual(
                {
                  availableHeight,
                  fileCount,
                  headerCollapsed,
                  ok: nothingToDraw
                    ? result.headerMaxH === availableHeight - tokens.panelHeadH
                    : share >= floor,
                },
              );
            }
          }
        }
      }
    });

    it('floors the cap to whole pixels when the measured inputs carry fractions (R9)', () => {
      // `getBoundingClientRect` on the stacked panels is fractional, and the
      // cap is keyed and written on every layout pass: a fraction there
      // defeats the dedup and writes a sub-pixel custom property.
      const result = computeInspectorLayout({
        availableHeight: 640,
        fileCount: 2,
        bodyLines: 2,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 33.4,
        tokens: COMFORTABLE_TOKENS,
      });

      expect(Number.isInteger(result.headerMaxH)).toBe(true);
    });
  });
});
