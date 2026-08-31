import { describe, expect, it } from 'vitest';
import {
  COMMIT_FOOTER_HEIGHT,
  COMMIT_HEADER_HEIGHT,
  COMMIT_ROW_HEIGHT,
  COMMIT_SEARCH_HEIGHT,
  CommitListLayout,
} from './commit-list-layout';

describe('commit list geometry', () => {
  it('keeps the row height at the density spec value', () => {
    // The CDK `itemSize`, the graph's `rowHeight` and the `--row-h` token all
    // read this number; a change here silently misaligns the lanes.
    expect(COMMIT_ROW_HEIGHT).toBe(34);
  });

  it('makes the header and the search bar one row tall each', () => {
    expect(COMMIT_HEADER_HEIGHT).toBe(34);
    expect(COMMIT_SEARCH_HEIGHT).toBe(34);
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
