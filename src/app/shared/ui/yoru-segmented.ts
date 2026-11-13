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
    const options = this.options();
    const count = options.length;
    if (count === 0) return;

    const current = options.findIndex((o) => o.value === this.value());
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const option = options[next];
    if (!option) return;

    this.value.set(option.value);
    this.buttons()[next]?.nativeElement.focus();
  }
}
