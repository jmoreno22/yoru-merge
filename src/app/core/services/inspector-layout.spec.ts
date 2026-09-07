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

describe('computeInspectorLayout', () => {
  it('yields the file list to 2 rows then the body clamp to 1 line at the 960x640 squeeze', () => {
    const result = computeInspectorLayout({
      availableHeight: 420,
      fileCount: 30,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    // unshrunk: listRows 6, clampLines 4 -> diffHeight 22, far under the
    // 210 floor, so both yields fire in order. Both still leave a 130 px
    // header against a 116 px cap, so the header scrolls inside it and the
    // clamp lands the squeeze case exactly on the floor.
    expect(result.listRows).toBe(2);
    expect(result.clampLines).toBe(1);
    expect(result.diffHeight).toBe(210);
    // 420 − 210 floor − (34 head + 2 × 30 rows) = 116 (T30 — Q5).
    expect(result.headerMaxH).toBe(116);
  });

  it('yields the same way in compact density, with the floor met after both shrinks', () => {
    const result = computeInspectorLayout({
      availableHeight: 420,
      fileCount: 30,
      bodyLines: 12,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMPACT_TOKENS,
    });
    expect(result.listRows).toBe(2);
    expect(result.clampLines).toBe(1);
    expect(result.diffHeight).toBe(216);
    expect(result.diffHeight / 420).toBeGreaterThanOrEqual(0.5);
    // 420 − 210 floor − (30 head + 2 × 30 rows) = 120, and the 114 px header
    // fits under it, which is why the diff keeps its unclamped 216 (T30 — Q5).
    expect(result.headerMaxH).toBe(120);
  });

  it('takes exactly two rows for two files with no shrink needed, diff well over half', () => {
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
    expect(result.diffHeight).toBe(434);
    expect(result.diffHeight / 640).toBeGreaterThanOrEqual(0.6);
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
    expect(result.diffHeight).toBe(346);
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

  it('caps at 6 rows for 7 or more files at a comfortable height', () => {
    const result = computeInspectorLayout({
      availableHeight: 800,
      fileCount: 9,
      bodyLines: 2,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: COMFORTABLE_TOKENS,
    });
    expect(result.listRows).toBe(6);
    expect(result.clampLines).toBe(2);
    expect(result.diffHeight).toBe(438);
  });

  it('zeroes the clamp and shrinks the header to a summary line when it is collapsed, diff at least 75%', () => {
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
    expect(result.diffHeight).toBe(572);
    expect(result.diffHeight / 700).toBeGreaterThanOrEqual(0.75);
  });

  it('reaches the same 75% collapsed-header floor in compact density', () => {
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
    expect(result.diffHeight).toBe(580);
    expect(result.diffHeight / 700).toBeGreaterThanOrEqual(0.75);
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
    expect(result.diffHeight).toBe(418);
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
    // remainder is 500, not 700: the list still yields to 2 rows to keep
    // the diff at half of the 500 remainder, not half of the raw 700.
    expect(result.listRows).toBe(2);
    expect(result.clampLines).toBe(2);
    expect(result.diffHeight).toBe(258);
    expect(result.diffHeight / (700 - 200)).toBeGreaterThanOrEqual(0.5);
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

  describe('T16 — collapsed-header 75% floor', () => {
    // Reachability check done by hand before writing these rows: with the
    // header collapsed, the fixed cost is 2 * panelHeadH (summary-line
    // header + file-list header) plus the list's 2-row floor
    // (2 * fileRowH); the 75% floor is reachable only when that fixed cost
    // is <= 25% of availableHeight. Every combination below clears it —
    // comfortable at 540 px is the tightest, at 412 / 540 = 76.30% against
    // a 405 px floor (a 7 px margin) — so none of these twelve
    // configurations is the "cannot reach 75%" case the task's DoD asks to
    // document; that case only starts below ~512 px (comfortable) /
    // ~480 px (compact), outside this table's 540 / 700 px range.
    const collapsedCases: Array<{
      tokenLabel: string;
      tokens: typeof COMFORTABLE_TOKENS;
      availableHeight: number;
      fileCount: number;
      expectedDiffHeight: number;
    }> = [
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 540,
        fileCount: 2,
        expectedDiffHeight: 412,
      },
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 540,
        fileCount: 6,
        expectedDiffHeight: 412,
      },
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 540,
        fileCount: 30,
        expectedDiffHeight: 412,
      },
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 700,
        fileCount: 2,
        expectedDiffHeight: 572,
      },
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 700,
        fileCount: 6,
        expectedDiffHeight: 572,
      },
      {
        tokenLabel: 'comfortable',
        tokens: COMFORTABLE_TOKENS,
        availableHeight: 700,
        fileCount: 30,
        expectedDiffHeight: 572,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 540,
        fileCount: 2,
        expectedDiffHeight: 420,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 540,
        fileCount: 6,
        expectedDiffHeight: 420,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 540,
        fileCount: 30,
        expectedDiffHeight: 420,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 700,
        fileCount: 2,
        expectedDiffHeight: 580,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 700,
        fileCount: 6,
        expectedDiffHeight: 580,
      },
      {
        tokenLabel: 'compact',
        tokens: COMPACT_TOKENS,
        availableHeight: 700,
        fileCount: 30,
        expectedDiffHeight: 580,
      },
    ];

    it.each(collapsedCases)(
      'yields the list to its 2-row floor to keep the collapsed-header diff at >= 75% ($tokenLabel, $availableHeight px, $fileCount files)',
      ({ tokens, availableHeight, fileCount, expectedDiffHeight }) => {
        const result = computeInspectorLayout({
          availableHeight,
          fileCount,
          bodyLines: 12,
          headerCollapsed: true,
          fileListCollapsed: false,
          stackedPanelsHeight: 0,
          tokens,
        });
        expect(result.listRows).toBe(2);
        expect(result.diffHeight).toBe(expectedDiffHeight);
        expect(result.diffHeight / availableHeight).toBeGreaterThanOrEqual(0.75);
      },
    );

    it('does not apply the collapsed-header floor when the header is expanded', () => {
      const result = computeInspectorLayout({
        availableHeight: 1000,
        fileCount: 6,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: COMFORTABLE_TOKENS,
      });
      // Share here is 602 / 1000 = 60.2%: under 75%, but the existing 50%
      // floor (AC-03) is already met, so nothing should yield. A fix that
      // applied the 75% floor without gating on headerCollapsed would
      // wrongly shrink listRows to 2 here.
      expect(result.listRows).toBe(6);
      expect(result.clampLines).toBe(4);
      expect(result.diffHeight).toBe(602);
      expect(result.diffHeight / 1000).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('T29 — the header cap the policy hands back (AC-03, AC-04, AC-06)', () => {
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

    it('floors the cap at one panel head when the remainder leaves almost nothing over (R8)', () => {
      // 75 px of diff floor against a 94 px file list: the cap would be
      // negative, and a header of 0 px hides the commit entirely.
      const result = computeInspectorLayout({
        availableHeight: 150,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: COMFORTABLE_TOKENS,
      });

      expect(result.headerMaxH).toBe(COMFORTABLE_TOKENS.panelHeadH);
    });

    it('keeps the diff at its floor when the header is taller than the cap allows (R3)', () => {
      // A commit with 30 refs: the fixed header alone is taller than the
      // share the diff floor leaves it, so the header scrolls inside the cap
      // and the height the policy reports for the diff stays at the floor.
      const result = computeInspectorLayout({
        availableHeight: 640,
        fileCount: 30,
        bodyLines: 12,
        headerCollapsed: false,
        fileListCollapsed: false,
        stackedPanelsHeight: 0,
        tokens: { ...COMFORTABLE_TOKENS, headerFixedH: 400 },
      });

      expect(result.headerMaxH).toBeLessThan(400);
      expect(result.diffHeight).toBeGreaterThanOrEqual(0.5 * 640);
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
