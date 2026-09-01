import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../../core/services/appearance-metrics';
import { DEFAULT_PREFERENCES } from '../../core/services/preferences-schema';
import {
  COMMIT_FOOTER_HEIGHT,
  COMMIT_HEADER_HEIGHT,
  COMMIT_ROW_HEIGHT,
  COMMIT_SEARCH_HEIGHT,
  CommitListLayout,
} from './commit-list-layout';

const defaultMetrics = computeMetrics({
  uiFontSize: DEFAULT_PREFERENCES.uiFontSize,
  monoFontSize: DEFAULT_PREFERENCES.monoFontSize,
  density: DEFAULT_PREFERENCES.uiDensity,
});

describe('commit list geometry', () => {
  /**
   * These constants are only the fallback for the first paint; the live values
   * come from `AppearanceService`. They still have to agree with what the
   * metrics compute at the default preferences, or the list, the `--row-h`
   * token and the graph's lanes start the session out of step — which is the
   * exact drift the derived layout exists to prevent.
   */
  it('keeps the fallback row height equal to the derived default', () => {
    expect(COMMIT_ROW_HEIGHT).toBe(defaultMetrics.rowHeight);
  });

  it('keeps the header and the search bar one panel head tall each', () => {
    expect(COMMIT_HEADER_HEIGHT).toBe(defaultMetrics.panelHeadHeight);
    expect(COMMIT_SEARCH_HEIGHT).toBe(defaultMetrics.panelHeadHeight);
  });

  it('keeps the footer one status bar tall', () => {
    expect(COMMIT_FOOTER_HEIGHT).toBe(defaultMetrics.statusbarHeight);
  });
});

describe('CommitListLayout', () => {
  it('starts at the header height, the chrome a bare list always draws', () => {
    const layout = new CommitListLayout();
    expect(layout.chromeHeight()).toBe(COMMIT_HEADER_HEIGHT);
    expect(layout.footerHeight()).toBe(COMMIT_FOOTER_HEIGHT);
  });

  it('carries the offset the graph has to shift its rows by', () => {
    const layout = new CommitListLayout();
    layout.chromeHeight.set(COMMIT_HEADER_HEIGHT + COMMIT_SEARCH_HEIGHT);
    expect(layout.chromeHeight()).toBe(68);
  });
});
