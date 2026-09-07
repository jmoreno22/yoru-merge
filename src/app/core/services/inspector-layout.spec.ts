import { describe, expect, it } from 'vitest';
import { computeInspectorLayout } from './inspector-layout';

// Real density values from DESIGN.md §Density; --line-h and --header-fixed-h
// are not shipped tokens (the caller measures them), so realistic stand-ins
// are used here.
const COMFORTABLE_TOKENS = {
  fileRowH: 30,
  panelHeadH: 34,
  lineH: 18,
  headerFixedH: 112,
};

const COMPACT_TOKENS = {
  fileRowH: 30,
  panelHeadH: 30,
  lineH: 18,
  headerFixedH: 96,
};

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

  it('yields the same way in compact density, where the shorter head fits a seventh row', () => {
    const result = computeInspectorLayout({
      availableHeight: 420,
      fileCount: 30,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMPACT_TOKENS,
    });
    expect(result.listRows).toBe(7);
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
    for (const tokens of [COMFORTABLE_TOKENS, COMPACT_TOKENS]) {
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
  });

  describe('T29 — the header cap the policy hands back (AC-03, AC-04)', () => {
    const heights = [200, 300, 420, 560, 700, 900];
    const fileCounts = [0, 1, 2, 6, 7, 30];

    it('reports a whole-pixel cap never under one panel head, in every configuration of the table (R8, R9)', () => {
      for (const tokens of [COMFORTABLE_TOKENS, COMPACT_TOKENS]) {
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
      for (const tokens of [COMFORTABLE_TOKENS, COMPACT_TOKENS]) {
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
              // The 2-row floor is the one exception: on a very short column
              // it is taller than the share, and hiding rows is worse than
              // missing the ratio.
              const twoRowFloorBinds =
                tokens.panelHeadH + 2 * tokens.fileRowH > (1 - floor) * availableHeight;
              expect({ availableHeight, fileCount, headerCollapsed, ok: true }).toEqual(
                {
                  availableHeight,
                  fileCount,
                  headerCollapsed,
                  ok: share >= floor || twoRowFloorBinds,
                },
              );
            }
          }
        }
      }
    });

    it('rounds the cap to whole pixels when the measured inputs carry fractions (R9)', () => {
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
