import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { RenderedCell, RenderedHunk } from './diff-view';

/** A pointer event on one cell, handed to `DiffView`, which owns the selection. */
export interface DiffCellEvent {
  readonly event: MouseEvent;
  readonly cell: RenderedCell;
}

/**
 * The rows of one hunk.
 *
 * Its own OnPush view so that refreshing `DiffView` — a line click, a `busy`
 * flip, a frame of the chunked insert — only re-checks the hunks whose inputs
 * changed: a refresh of the parent template otherwise walks every painted row
 * of the patch. Styles come from `diff-view.css`, scoped under `app-diff-view`.
 */
@Component({
  selector: 'app-diff-hunk',
  imports: [NgIcon],
  templateUrl: './diff-hunk.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dv-hunk-body', '[style.--dv-rows]': 'hunk().rows.length' },
})
export class DiffHunk {
  readonly hunk = input.required<RenderedHunk>();
  readonly selecting = input<boolean>(false);
  /** Ids of the selected lines when this hunk holds the selection, else empty. */
  readonly selected = input.required<ReadonlySet<string>>();
  /** The roving line when it belongs to this hunk, else `null`. */
  readonly activeLineId = input<string | null>(null);

  readonly lineClick = output<DiffCellEvent>();
  readonly cellMenu = output<DiffCellEvent>();
  readonly expandGap = output<string>();
}
