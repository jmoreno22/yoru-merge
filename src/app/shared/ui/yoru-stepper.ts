import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * `<yoru-stepper [value]="13" [min]="11" [max]="17" suffix="px" (valueChange)="…" />`
 *
 * A numeric value with a decrement and an increment button. Used for the type
 * sizes, where the useful range is a handful of steps and a free-text number
 * field invites values the app then has to clamp behind the user's back.
 */
@Component({
  selector: 'yoru-stepper',
  imports: [NgIcon],
  templateUrl: './yoru-stepper.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class YoruStepper {
  readonly value = input.required<number>();
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  /** Rendered after the value, e.g. `px`. */
  readonly suffix = input<string>('');
  readonly ariaLabel = input<string>('');

  readonly valueChange = output<number>();

  protected readonly canDecrement = computed(() => this.value() > this.min());
  protected readonly canIncrement = computed(() => this.value() < this.max());

  protected decrement(): void {
    if (!this.canDecrement()) return;
    this.valueChange.emit(Math.max(this.min(), this.value() - this.step()));
  }

  protected increment(): void {
    if (!this.canIncrement()) return;
    this.valueChange.emit(Math.min(this.max(), this.value() + this.step()));
  }
}
