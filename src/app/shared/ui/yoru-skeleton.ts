import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loading placeholder driven by the shared `.skeleton` shimmer in styles.css. */
@Component({
  selector: 'yoru-skeleton',
  templateUrl: './yoru-skeleton.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'skeleton block',
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.borderRadius]': 'radius()',
  },
})
export class YoruSkeleton {
  readonly width = input<string>('100%');
  readonly height = input<string>('12px');
  readonly radius = input<string>('var(--radius-xs)');
}
