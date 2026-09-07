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
  diffHeight: number;
  /**
   * Height the expanded header may take before the diff would drop under its
   * floor; past it the header scrolls inside the cap. Last in the yield order,
   * so a commit with many refs cannot starve the diff (AC-03). Whole pixels,
   * never under one panel head: a shorter cap would hide the commit behind
   * its own scrollbar.
   */
  headerMaxH: number;
}

const MAX_LIST_ROWS = 6;
const MAX_CLAMP_LINES = 4;
const LIST_ROWS_FLOOR = 2;
const CLAMP_LINES_FLOOR = 1;
const DIFF_SHARE_FLOOR = 0.5;
const COLLAPSED_DIFF_SHARE_FLOOR = 0.75;

/**
 * Sizes the file list and header clamp against the diff. Stacked panels are
 * fixed and come off the top (AC-19) before any floor is computed on what
 * remains. With the header collapsed, a stricter 75 % floor is checked
 * first: the list yields to its 2-row floor if that alone reaches it. Then
 * the standing 50 % floor runs as it does for an expanded header (AC-03):
 * rows yield before lines, the list shrinks to its floor of 2 rows first,
 * and only if that alone isn't enough does the header clamp give up its
 * floor of 1 line — a yield that only keeps the header under its cap without
 * scrolling, so it can lift the reported `diffHeight` above the floor but
 * never lower it. Whatever the diff's floor leaves over then becomes
 * `headerMaxH`, the cap the header scrolls inside: the floors hold, and the
 * header rather than the diff absorbs what does not fit. `diffHeight` is
 * reported against that capped header, so it is the height the slot really
 * gets once the cap binds rather than the one an unbounded header would leave.
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
  const floor = DIFF_SHARE_FLOOR * remainder;
  const collapsedFloor = COLLAPSED_DIFF_SHARE_FLOOR * remainder;

  let listRows =
    fileListCollapsed || fileCount === 0 ? 0 : Math.min(fileCount, MAX_LIST_ROWS);
  let clampLines = headerCollapsed ? 0 : Math.min(bodyLines, MAX_CLAMP_LINES);

  const headerHeight = (): number =>
    headerCollapsed ? panelHeadH : headerFixedH + clampLines * lineH;
  const fileListHeight = (): number =>
    fileListCollapsed ? panelHeadH : panelHeadH + listRows * fileRowH;

  let diffHeight = remainder - headerHeight() - fileListHeight();

  if (headerCollapsed && diffHeight < collapsedFloor && listRows > LIST_ROWS_FLOOR) {
    listRows = LIST_ROWS_FLOOR;
    diffHeight = remainder - headerHeight() - fileListHeight();
  }

  if (diffHeight < floor && listRows > LIST_ROWS_FLOOR) {
    listRows = LIST_ROWS_FLOOR;
    diffHeight = remainder - headerHeight() - fileListHeight();
  }

  if (diffHeight < floor && clampLines > CLAMP_LINES_FLOOR) {
    clampLines = CLAMP_LINES_FLOOR;
    diffHeight = remainder - headerHeight() - fileListHeight();
  }

  // Fractions come in with the measured stacked panels, and the caller keys a
  // dedup on this value before writing it as a custom property.
  const headerMaxH = Math.round(
    Math.max(remainder - floor - fileListHeight(), panelHeadH),
  );

  return {
    listRows,
    clampLines,
    diffHeight: remainder - Math.min(headerHeight(), headerMaxH) - fileListHeight(),
    headerMaxH,
  };
}
