/** Density tokens the layout policy needs; the caller measures and supplies them. */
export interface InspectorLayoutTokens {
  fileRowH: number;
  panelHeadH: number;
  lineH: number;
  headerFixedH: number;
}

export interface InspectorLayoutInput {
  availableHeight: number;
  fileCount: number;
  bodyLines: number;
  headerCollapsed: boolean;
  fileListCollapsed: boolean;
  stackedPanelsHeight: number;
  tokens: InspectorLayoutTokens;
}

export interface InspectorLayout {
  listRows: number;
  clampLines: number;
  /**
   * Height the expanded header may take before the file list would drop under
   * its share; past it the header scrolls inside the cap. Last in the yield
   * order, so a commit with many refs cannot starve the list (AC-03). Whole
   * pixels, never under one panel head: a shorter cap would hide the commit
   * behind its own scrollbar.
   */
  headerMaxH: number;
}

const MAX_CLAMP_LINES = 4;
const LIST_ROWS_FLOOR = 2;
const CLAMP_LINES_FLOOR = 1;
const LIST_SHARE_FLOOR = 0.5;
const COLLAPSED_LIST_SHARE_FLOOR = 0.75;

/**
 * Sizes the commit header against the file list, which is the block the policy
 * protects (ADR-0004, amended 2026-09-07: the History inspector hosts no diff
 * viewer, so the list is the growing child). Stacked panels are fixed and come
 * off the top (AC-19) before any floor is computed on what remains.
 *
 * The list's protected height is the greater of its share of the remainder —
 * 50 % expanded, 75 % with the header collapsed — and its own 2-row floor,
 * which wins on a column too short for the ratio to be worth honouring. What
 * is left is `headerMaxH`, and the header yields into it in the order AC-03
 * fixes: the body clamp shrinks first, down to one line plus «show more», and
 * only then does the expanded header scroll inside the cap. The list never
 * gives up a row to the header; it shows every row the space it keeps fits,
 * with no upper bound — the old 6-row cap existed only to feed the diff slot.
 */
export function computeInspectorLayout(input: InspectorLayoutInput): InspectorLayout {
  const {
    availableHeight,
    fileCount,
    bodyLines,
    headerCollapsed,
    fileListCollapsed,
    stackedPanelsHeight,
    tokens,
  } = input;
  const { fileRowH, panelHeadH, lineH, headerFixedH } = tokens;

  const remainder = availableHeight - stackedPanelsHeight;
  const shareFloor =
    (headerCollapsed ? COLLAPSED_LIST_SHARE_FLOOR : LIST_SHARE_FLOOR) * remainder;
  // A list with nothing to draw is a bare head and claims no share — collapsed,
  // or with no row to show at all: the height it releases stays empty (AC-05).
  // `fileCount` is the DISPLAYED row count, so a filter that matches nothing is
  // this case too, not only a commit that changes no file (AC-04). This is the
  // ONLY place the empty case is decided: `listRows` below gets 0 for free from
  // `Math.min(fileCount, …)`, so it tests `fileListCollapsed` alone. It used to
  // repeat `fileCount === 0` vacuously, which made the two arms look
  // interchangeable when only this one carries behaviour — removing this one
  // reddens three rows across two tiers, removing the other reddened nothing
  // (review round 14, R14-S2-F3).
  const protectedList =
    fileListCollapsed || fileCount === 0
      ? panelHeadH
      : Math.max(panelHeadH + LIST_ROWS_FLOOR * fileRowH, shareFloor);

  const headerAllowance = remainder - protectedList;
  // Fractions come in with the measured stacked panels, and the cap is keyed
  // for a dedup before it is written as a custom property. FLOOR, not round:
  // rounding a half-pixel cap up takes that pixel from the list and drops its
  // share just under the floor — 434 of the heights between 40 and 1000 px
  // expanded, and half of them collapsed (review round 10, R10-S2-F2).
  // Flooring can only ever give the list more.
  const headerMaxH = Math.floor(Math.max(headerAllowance, panelHeadH));

  const clampLines = headerCollapsed
    ? 0
    : Math.min(
        bodyLines,
        MAX_CLAMP_LINES,
        Math.max(
          CLAMP_LINES_FLOOR,
          Math.floor((headerAllowance - headerFixedH) / lineH),
        ),
      );

  const headerHeight = headerCollapsed ? panelHeadH : headerFixedH + clampLines * lineH;
  const listHeight = remainder - Math.min(headerHeight, headerMaxH) - panelHeadH;

  const listRows = fileListCollapsed
    ? 0
    : Math.min(fileCount, Math.max(LIST_ROWS_FLOOR, Math.floor(listHeight / fileRowH)));

  return { listRows, clampLines, headerMaxH };
}
