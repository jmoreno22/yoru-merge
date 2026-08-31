import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * 34 px panel header: caps label, optional count, and an `[actions]` slot for
 * the icon buttons that belong to the section.
 *
 * ```html
 * <yoru-section-header label="Staged" [count]="3">
 *   <yoru-button actions size="sm" variant="ghost">Unstage all</yoru-button>
 * </yoru-section-header>
 * ```
 */
@Component({
  selector: 'yoru-section-header',
  templateUrl: './yoru-section-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-[var(--panel-head-h)] shrink-0 items-center gap-2 border-b border-[var(--app-border)] px-3',
  },
})
export class YoruSectionHeader {
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
}
