import { Injectable, signal } from '@angular/core';

/** Height of one commit row. Must equal the CDK `itemSize` and the graph's. */
export const COMMIT_ROW_HEIGHT = 34;

/** Column header strip inside the commit list. */
export const COMMIT_HEADER_HEIGHT = 34;

/** Search bar rendered above the header while the list owns it. */
export const COMMIT_SEARCH_HEIGHT = 34;

/** "N of M commits loaded" strip under the last row. */
export const COMMIT_FOOTER_HEIGHT = 26;

/**
 * The vertical bounds the commit list and the branch graph must agree on.
 *
 * The two are rendered as siblings by the layout, so the graph has no way to
 * measure how much chrome (search bar, column header, footer) the list drew
 * around its rows. The list publishes it here and the graph offsets and clips
 * its canvas to match; `<app-branch-graph [graphTopOffset] [graphBottomOffset]>`
 * overrides both when a layout stacks them differently.
 */
@Injectable({ providedIn: 'root' })
export class CommitListLayout {
  readonly chromeHeight = signal<number>(COMMIT_HEADER_HEIGHT);
  readonly footerHeight = signal<number>(COMMIT_FOOTER_HEIGHT);
}
