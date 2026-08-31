import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { YoruIconName } from '../icons';

/**
 * Empty / zero-result panel content.
 *
 * `kanji` paints a large watermark behind the copy at 6 % opacity — a Yoru
 * Night signature, never a load-bearing label. Use one of the app kanji:
 * yoru (night), go (merge), eda (branch).
 */
@Component({
  selector: 'yoru-empty-state',
  imports: [NgIcon],
  templateUrl: './yoru-empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-10 text-center',
  },
})
export class YoruEmptyState {
  readonly icon = input<YoruIconName | null>(null);
  readonly title = input.required<string>();
  readonly hint = input<string>('');
  readonly kanji = input<string>('');
}
