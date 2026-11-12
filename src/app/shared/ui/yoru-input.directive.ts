import { computed, Directive, ElementRef, inject, input } from '@angular/core';

export type InputSize = 'xs' | 'sm' | 'md';

const HEIGHTS: Readonly<Record<InputSize, string>> = {
  xs: 'h-[var(--control-h-xs)]',
  sm: 'h-[var(--control-h-sm)]',
  md: 'h-[var(--control-h)]',
};

const FRAMES: Readonly<Record<InputSize, string>> = {
  xs: 'rounded-xs px-2 text-y-md',
  sm: 'rounded-xs px-2 text-y-md',
  md: 'rounded-sm px-2.5 text-y-base',
};

/**
 * The one text field: `<input yoruInput placeholder="Filter refs" />`.
 *
 * `yoruInput="xs"` picks the size (`md` by default: dialogs and forms; `sm`
 * and `xs` for a field inside a panel head or a strip). A `<textarea>` takes
 * the frame and keeps its own height.
 *
 * Focus is the global ring and nothing else — no border recolouring on top of
 * it. The ring is turned one pixel inward so it stays inside a strip that is
 * barely taller than the field.
 */
@Directive({
  selector: 'input[yoruInput], textarea[yoruInput]',
  host: { '[class]': 'classes()' },
})
export class YoruInput {
  readonly size = input('md', {
    alias: 'yoruInput',
    transform: (value: InputSize | ''): InputSize => value || 'md',
  });

  // A textarea is as tall as its rows; only a single-line field takes the
  // control height.
  private readonly singleLine =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'INPUT';

  protected readonly classes = computed(
    () =>
      'min-w-0 border border-[var(--app-border)] bg-[var(--app-surface)] ' +
      'text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] ' +
      '[--focus-offset:-1px] disabled:cursor-not-allowed ' +
      `disabled:text-[var(--app-text-faint)] ${FRAMES[this.size()]} ` +
      (this.singleLine ? HEIGHTS[this.size()] : ''),
  );
}
