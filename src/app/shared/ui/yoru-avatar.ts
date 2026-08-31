import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { avatarGradient, initialsFrom } from './avatar';

/**
 * Author chip. The gradient is derived from `seed` (use the email — it is the
 * stable identity in a Git history) so the same person keeps the same colour
 * across commit list, blame and inspector.
 */
@Component({
  selector: 'yoru-avatar',
  templateUrl: './yoru-avatar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[style.background-image]': 'gradient()',
    '[attr.title]': 'name() || seed()',
    'aria-hidden': 'true',
  },
})
export class YoruAvatar {
  /** Display name, used for the initials when present. */
  readonly name = input<string>('');
  /** Stable identity for the gradient; falls back to the name. */
  readonly seed = input<string>('');
  readonly size = input<16 | 20 | 28>(20);

  protected readonly initials = computed(() =>
    initialsFrom(this.name() || this.seed()),
  );

  protected readonly gradient = computed(() => {
    const { from, to } = avatarGradient(this.seed() || this.name());
    return `linear-gradient(135deg, ${from}, ${to})`;
  });

  protected readonly hostClass = computed(() => {
    const size = this.size();
    const box = size === 16 ? 'h-4 w-4' : size === 28 ? 'h-7 w-7' : 'h-5 w-5';
    const type = size === 28 ? 'text-[10.5px]' : 'text-[8.5px]';
    return `inline-flex shrink-0 select-none items-center justify-center rounded-full font-mono font-bold uppercase leading-none text-yoru-950 ${box} ${type}`;
  });
}
