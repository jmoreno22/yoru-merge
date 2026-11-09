import type { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

/**
 * Gives one `cdk-virtual-scroll-viewport` the box a browser would have given
 * it, so the CDK renders rows in jsdom.
 *
 * jsdom lays nothing out: the viewport measures `clientHeight` 0, the fixed-size
 * strategy concludes that no row is visible and the list renders empty however
 * many items it was handed. This defines the three things the CDK reads on that
 * one element — `clientHeight` (what it measures), a writable `scrollTop` that
 * emits the `scroll` event jsdom never fires, and a `scrollTo` that funnels into
 * it — and then re-runs the CDK's own measurement, so the rendered range is the
 * one `height` implies and `scrollToIndex` moves it exactly as in a browser.
 *
 * Call it once the viewport exists (after the first `detectChanges()`), then
 * let the CDK's frame land: its scroll pipeline is audited on
 * `animationFrameScheduler`, so a `setTimeout` of a few ms — not a bare
 * microtask — is what settles a scroll.
 */
export function sizeVirtualViewport(
  viewport: CdkVirtualScrollViewport,
  height: number,
): void {
  const element = viewport.elementRef.nativeElement;
  let scrollTop = 0;

  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
      element.dispatchEvent(new Event('scroll'));
    },
  });
  Object.defineProperty(element, 'scrollTo', {
    configurable: true,
    writable: true,
    value: (options: ScrollToOptions) => {
      if (options?.top != null) element.scrollTop = options.top;
    },
  });

  viewport.checkViewportSize();
}
