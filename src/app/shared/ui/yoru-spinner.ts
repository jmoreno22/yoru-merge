import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';

/** Indeterminate activity indicator. Sized in px so it lines up with icons. */
@Component({
  selector: 'yoru-spinner',
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  templateUrl: './yoru-spinner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center justify-center',
    role: 'status',
    '[attr.aria-label]': 'label()',
  },
})
export class YoruSpinner {
  readonly size = input<number>(14);
  readonly label = input<string>('Loading');
}
