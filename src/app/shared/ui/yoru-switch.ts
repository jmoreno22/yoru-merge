import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * `<yoru-switch [(checked)]="signOff" label="Add Signed-off-by" />`
 *
 * A `role="switch"` button rather than a checkbox: the visual is a track and a
 * thumb, and screen readers announce on/off instead of checked/unchecked.
 */
@Component({
  selector: 'yoru-switch',
  templateUrl: './yoru-switch.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class YoruSwitch {
  readonly checked = model<boolean>(false);
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly disabled = input<boolean>(false);

  protected toggle(): void {
    if (this.disabled()) return;
    this.checked.update((value) => !value);
  }
}
