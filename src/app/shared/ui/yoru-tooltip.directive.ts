import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/** Distance between the host element and the tooltip. */
const OFFSET = 6;
const VIEWPORT_MARGIN = 8;

let nextTooltipId = 0;

/**
 * `<button [yoruTooltip]="'Fetch all remotes'">` — a title-like hint that is
 * styled, delayed, and announced through `aria-describedby` (the native
 * `title` attribute is neither styleable nor reliably announced).
 *
 * Use it for icon-only controls and for truncated text. It is not a substitute
 * for an accessible name: an icon-only button still needs `aria-label`.
 */
@Directive({
  selector: '[yoruTooltip]',
  host: {
    '(mouseenter)': 'schedule()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
    '(click)': 'hide()',
  },
})
export class YoruTooltip {
  readonly text = input.required<string>({ alias: 'yoruTooltip' });
  readonly tooltipDelay = input<number>(400);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private element: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly id = `yoru-tooltip-${nextTooltipId++}`;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => this.show(), this.tooltipDelay());
  }

  protected show(): void {
    this.clearTimer();
    const text = this.text().trim();
    if (text === '' || this.element) return;

    const tip = document.createElement('div');
    tip.id = this.id;
    tip.setAttribute('role', 'tooltip');
    tip.textContent = text;
    tip.className =
      'yoru-fade-in pointer-events-none fixed z-[var(--z-overlay)] max-w-[18rem] rounded-xs border ' +
      'border-[var(--app-border)] bg-[var(--app-surface-raised)] px-2 py-1 text-y-sm ' +
      'leading-[16px] text-[var(--app-text)] shadow-panel';
    document.body.appendChild(tip);
    this.element = tip;
    this.host.nativeElement.setAttribute('aria-describedby', this.id);
    // Bound only while a tooltip is on screen: a host listener would put one
    // document listener on every element that carries the directive.
    document.addEventListener('keydown', this.onEscape);

    this.place(tip);
  }

  protected hide(): void {
    this.clearTimer();
    if (this.element) {
      document.removeEventListener('keydown', this.onEscape);
      this.element.remove();
      this.element = null;
    }
    this.host.nativeElement.removeAttribute('aria-describedby');
  }

  private readonly onEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide();
  };

  private place(tip: HTMLElement): void {
    const anchor = this.host.nativeElement.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;

    let top = anchor.top - height - OFFSET;
    if (top < VIEWPORT_MARGIN) top = anchor.bottom + OFFSET;

    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - width;
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(
      Math.max(centered, VIEWPORT_MARGIN),
      Math.max(maxLeft, VIEWPORT_MARGIN),
    );

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
