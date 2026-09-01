import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { YoruIconName } from '../icons';
import { YoruSpinner } from './yoru-spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  // Glow only on hover/focus: at rest nothing in the app glows except HEAD.
  primary:
    'bg-accent text-yoru-950 font-semibold hover:bg-moon-50 hover:shadow-accent focus-visible:shadow-accent',
  secondary:
    'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:border-accent/50 hover:bg-[var(--app-panel)]',
  ghost:
    'text-[var(--app-text-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-text)]',
  danger:
    'border border-git-deleted/50 bg-git-deleted/10 text-git-deleted hover:bg-git-deleted/20',
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-8 gap-2 px-3 text-y-base',
};

/**
 * `<yoru-button variant="primary" (click)="save()">Commit</yoru-button>`
 *
 * Renders a real `<button>` so `disabled`, form submission and focus behave
 * natively; the label is projected content.
 *
 * `aria-label` and `title` are inputs, not host attributes: both belong on the
 * inner `<button>` (an icon-only button has no other accessible name, and a
 * tooltip on the wrapper would fire outside the control). The host bindings
 * strip whatever the template declared so neither ends up twice in the DOM.
 */
@Component({
  selector: 'yoru-button',
  imports: [NgIcon, YoruSpinner],
  templateUrl: './yoru-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
    '[attr.aria-label]': 'null',
    '[attr.title]': 'null',
  },
})
export class YoruButton {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<YoruIconName | null>(null);
  readonly loading = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly title = input<string | null>(null);

  protected readonly buttonClass = computed(
    () =>
      'inline-flex w-full items-center justify-center rounded-sm transition-colors ' +
      'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none ' +
      `${SIZES[this.size()]} ${VARIANTS[this.variant()]}`,
  );
}
