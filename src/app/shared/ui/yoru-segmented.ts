import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { YoruIconName } from '../icons';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: YoruIconName;
}

/**
 * Single-choice control for view modes (unified/split, tree/list).
 *
 * ```html
 * <yoru-segmented [options]="diffModes" [(value)]="diffMode" ariaLabel="Diff layout" />
 * ```
 */
@Component({
  selector: 'yoru-segmented',
  imports: [NgIcon],
  templateUrl: './yoru-segmented.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class YoruSegmented {
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly value = model.required<string>();
  readonly ariaLabel = input<string>('');

  private readonly buttons =
    viewChildren<ElementRef<HTMLButtonElement>>('optionButton');

  protected select(value: string): void {
    this.value.set(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;

    const options = this.options();
    if (options.length === 0) return;

    event.preventDefault();
    const current = options.findIndex((o) => o.value === this.value());
    const next = (current + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;

    this.value.set(option.value);
    this.buttons()[next]?.nativeElement.focus();
  }
}
