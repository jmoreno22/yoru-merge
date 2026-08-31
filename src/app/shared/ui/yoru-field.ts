import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Label + control + hint/error wrapper for settings and dialog forms. The
 * control is projected, and the wrapping `<label>` associates it implicitly, so
 * any input, select or textarea works without an id.
 *
 * ```html
 * <yoru-field label="Author email" hint="Used for this repository only">
 *   <input class="yoru-input" [value]="email()" />
 * </yoru-field>
 * ```
 */
@Component({
  selector: 'yoru-field',
  templateUrl: './yoru-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class YoruField {
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly error = input<string>('');
}
