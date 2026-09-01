import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * Label + control + hint/error wrapper for settings and dialog forms.
 *
 * With a single projected control the wrapper is a `<label>`, which associates
 * it implicitly, so any input, select or textarea works without an id.
 *
 * ```html
 * <yoru-field label="Author email" hint="Used for this repository only">
 *   <input class="s-input" [value]="email()" />
 * </yoru-field>
 * ```
 *
 * Set `group` when the field holds several controls — a segmented control, a
 * stepper, a row of swatches, a stack of switches. A `<label>` associates with
 * the *first* labelable descendant, and `<button>` is labelable, so wrapping a
 * group means hovering the caption highlights its first button and clicking the
 * caption presses it. On a stepper that silently changes the value. Grouped
 * fields render a plain `<div>` instead; the controls inside carry their own
 * `role` and `aria-label`, so nothing is lost to screen readers.
 *
 * ```html
 * <yoru-field label="Accent" group>
 *   <div role="radiogroup" aria-label="Accent">…</div>
 * </yoru-field>
 * ```
 */
@Component({
  selector: 'yoru-field',
  imports: [NgTemplateOutlet],
  templateUrl: './yoru-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class YoruField {
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly error = input<string>('');
  /** The field holds more than one control; see the class docs. */
  readonly group = input(false, { transform: booleanAttribute });
}
