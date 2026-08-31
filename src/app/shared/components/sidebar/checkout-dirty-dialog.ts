import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { YoruButton, YoruDialog } from '../../ui';

/** What the user chose in front of a checkout that would lose local work. */
export type CheckoutChoice = 'stash' | 'force' | 'cancel';

/**
 * Shown when `checkout_branch` reports `would_overwrite`: the files it lists
 * are the ones the switch would clobber, so they are the whole decision.
 */
@Component({
  selector: 'app-checkout-dirty-dialog',
  imports: [YoruButton, YoruDialog],
  templateUrl: './checkout-dirty-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutDirtyDialog {
  readonly branch = input.required<string>();
  readonly files = input.required<readonly string[]>();

  readonly chose = output<CheckoutChoice>();
}
