import type { UiDensity } from './preferences-schema';

/**
 * Height of one line of interface text as a multiple of the type size. Every
 * row and every bar in the chrome is "one line of text plus padding", so this
 * is the single ratio that turns a type size into a layout.
 */
const TEXT_LINE_RATIO = 1.15;

/**
 * Line height of code as a multiple of the code type size. 12px x 1.667 = 20px,
 * the height the diff and blame shipped with.
 */
const CODE_LINE_RATIO = 1.667;

/** File-history rows stack a subject over its metadata. */
const HISTORY_ROW_TEXT_RATIO = 2.3;

/**
 * Padding budget per surface, in px at `comfortable`. Density scales these and
 * leaves the text ratio alone: density means "how much air around the text",
 * not "how big is the text" — that is what the type size is for.
 *
 * The numbers are the paddings the app shipped with, recovered by subtracting
 * one 13px text line from each hardcoded height (34, 30, 30, 34, 38, 48, 26).
 */
const PAD = {
  row: 19,
  fileRow: 15,
  refRow: 15,
  panelHead: 19,
  titlebar: 23,
  toolbar: 33,
  rail: 33,
  statusbar: 11,
  historyRow: 16,
  /** Pure spacing, with no text line under it. */
  panel: 16,
} as const;

const DENSITY_PAD_SCALE: Record<UiDensity, number> = {
  compact: 0.6,
  comfortable: 1,
  relaxed: 1.5,
};

/** Concrete pixel layout for one combination of appearance preferences. */
export interface AppearanceMetrics {
  rowHeight: number;
  fileRowHeight: number;
  refRowHeight: number;
  historyRowHeight: number;
  codeLineHeight: number;
  panelHeadHeight: number;
  titlebarHeight: number;
  toolbarHeight: number;
  railWidth: number;
  statusbarHeight: number;
  panelPad: number;
}

export interface AppearanceInput {
  uiFontSize: number;
  monoFontSize: number;
  density: UiDensity;
}

/**
 * Turns the appearance preferences into the pixel layout.
 *
 * Kept as a pure function because the CDK virtual viewports need the row
 * heights as numbers — `itemSize` is a plain input, and a CSS token that
 * disagrees with it misplaces every row and drifts the branch-graph lanes off
 * their commits. One function feeding both the token and the `itemSize` makes
 * that disagreement impossible.
 */
export function computeMetrics(input: AppearanceInput): AppearanceMetrics {
  const { uiFontSize, monoFontSize, density } = input;
  const padScale = DENSITY_PAD_SCALE[density];
  const textLine = uiFontSize * TEXT_LINE_RATIO;
  const height = (basePad: number): number => Math.round(textLine + basePad * padScale);

  return {
    rowHeight: height(PAD.row),
    fileRowHeight: height(PAD.fileRow),
    refRowHeight: height(PAD.refRow),
    historyRowHeight: Math.round(
      uiFontSize * HISTORY_ROW_TEXT_RATIO + PAD.historyRow * padScale,
    ),
    // Code ignores density: its spacing *is* the code line height, and padding
    // it on the density axis would slide the line numbers off the lines they
    // number.
    codeLineHeight: Math.round(monoFontSize * CODE_LINE_RATIO),
    panelHeadHeight: height(PAD.panelHead),
    titlebarHeight: height(PAD.titlebar),
    toolbarHeight: height(PAD.toolbar),
    railWidth: height(PAD.rail),
    statusbarHeight: height(PAD.statusbar),
    panelPad: Math.round(PAD.panel * padScale),
  };
}

export interface AppearanceTokenInput extends AppearanceInput {
  codeTabWidth: number;
  codeLigatures: boolean;
}

/**
 * The full token set written onto the document root, as one object so the
 * effect writes it in a single pass and a test can assert the whole thing.
 */
export function appearanceTokens(input: AppearanceTokenInput): Record<string, string> {
  const metrics = computeMetrics(input);
  return {
    '--ui-font-size': `${input.uiFontSize}px`,
    '--mono-font-size': `${input.monoFontSize}px`,
    '--row-h': `${metrics.rowHeight}px`,
    '--file-row-h': `${metrics.fileRowHeight}px`,
    '--ref-row-h': `${metrics.refRowHeight}px`,
    '--history-row-h': `${metrics.historyRowHeight}px`,
    '--code-line-h': `${metrics.codeLineHeight}px`,
    '--panel-head-h': `${metrics.panelHeadHeight}px`,
    '--panel-pad': `${metrics.panelPad}px`,
    '--titlebar-h': `${metrics.titlebarHeight}px`,
    '--toolbar-h': `${metrics.toolbarHeight}px`,
    '--rail-w': `${metrics.railWidth}px`,
    '--statusbar-h': `${metrics.statusbarHeight}px`,
    '--code-tab-width': `${input.codeTabWidth}`,
    // `calt` carries JetBrains Mono's ligatures; switching both off is what
    // "no ligatures" means for a variable font that ships them on by default.
    '--code-font-features': input.codeLigatures ? 'normal' : '"calt" 0, "liga" 0',
  };
}
