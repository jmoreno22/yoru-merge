import { computed, Directive, input } from '@angular/core';

export type IconButtonSize = 'xs' | 'sm' | 'md';
export type IconButtonTone = 'ghost' | 'outline' | 'danger';

const SIZES: Readonly<Record<IconButtonSize, string>> = {
  xs: 'size-[var(--control-h-xs)] rounded-xs',
  sm: 'size-[var(--control-h-sm)] rounded-xs',
  md: 'size-[var(--control-h)] rounded-sm',
};

const TONES: Readonly<Record<IconButtonTone, string>> = {
  // Flat at rest: it sits inside a row or a strip, where a resting fill on
  // every icon would be noise.
  ghost:
    'text-[var(--app-text-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-text)] ' +
    'aria-pressed:bg-[var(--app-panel)] aria-pressed:text-accent-ink',
  // Framed: it stands on its own, with nothing around it to say it is a control.
  outline:
    'border border-[var(--app-border)] bg-[var(--app-surface-raised)] text-[var(--app-text-muted)] ' +
    'hover:border-accent/50 hover:text-[var(--app-text)] ' +
    'aria-pressed:border-accent/50 aria-pressed:text-accent-ink',
  danger:
    'border border-git-deleted/40 bg-git-deleted/5 text-git-deleted-ink hover:bg-git-deleted/20',
};

/**
 * The one square icon button: `<button yoruIconButton aria-label="Close">`.
 *
 * `yoruIconButton="sm"` picks the size (`xs` by default, the size that fits a
 * row), `tone` the look. A toggle only has to set `aria-pressed`; the pressed
 * look follows it.
 *
 * A directive on the real `<button>` rather than a wrapper component: `disabled`,
 * `data-testid`, the tooltip and the click all stay on the element that owns
 * them, and an icon-only control has nothing to project anyway.
 */
@Directive({
  selector: 'button[yoruIconButton]',
  host: { '[class]': 'classes()' },
})
export class YoruIconButton {
  readonly size = input('xs', {
    alias: 'yoruIconButton',
    transform: (value: IconButtonSize | ''): IconButtonSize => value || 'xs',
  });
  readonly tone = input<IconButtonTone>('ghost');

  protected readonly classes = computed(
    () =>
      'inline-flex shrink-0 items-center justify-center transition-colors ' +
      'disabled:cursor-not-allowed disabled:text-[var(--app-text-faint)] ' +
      'disabled:hover:bg-transparent ' +
      `${SIZES[this.size()]} ${TONES[this.tone()]}`,
  );
}
