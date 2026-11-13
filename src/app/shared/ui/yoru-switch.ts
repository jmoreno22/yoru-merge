import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';

/**
 * `<yoru-switch [(checked)]="signOff" label="Add Signed-off-by" />`
 *
 * A `role="switch"` button rather than a checkbox: the visual is a track and a
 * thumb, and screen readers announce on/off instead of checked/unchecked.
 *
 * `row` lays it out as a settings row: the text on the left, the track on the
 * right, the whole width one target.
 */
@Component({
  selector: 'yoru-switch',
  imports: [NgTemplateOutlet],
  templateUrl: './yoru-switch.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "row() ? 'flex' : 'inline-flex'" },
})
export class YoruSwitch {
  readonly checked = model<boolean>(false);
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly row = input(false, { transform: booleanAttribute });

  protected toggle(): void {
    if (this.disabled()) return;
    this.checked.update((value) => !value);
  }
}
