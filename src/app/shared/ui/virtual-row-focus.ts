import type { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { afterNextRender, type Injector } from '@angular/core';

/**
 * Focuses the `[data-focus-key]` row at `index` of a virtual-scroll list,
 * bringing it into view first: a row outside the rendered range has no element
 * to focus, and the CDK only materialises the one it scrolls to a frame later
 * (AC-08).
 */
export function focusVirtualRow(
  viewport: CdkVirtualScrollViewport,
  index: number,
  focusKey: string,
  injector: Injector,
): void {
  const focus = (): void => {
    viewport
      .getElementRef()
      .nativeElement.querySelector<HTMLElement>(
        `[data-focus-key="${CSS.escape(focusKey)}"]`,
      )
      ?.focus();
  };

  // The owning list can still be hidden behind the workspace when the restore
  // reaches it, and a hidden element takes neither scroll nor focus.
  afterNextRender(
    () => {
      // The CDK caches the viewport box and re-reads it only on a window
      // resize, so a list that was hidden behind the workspace still reports
      // zero — an empty rendered range whose scroll then emits nothing.
      if (viewport.getViewportSize() === 0) viewport.checkViewportSize();
      const range = viewport.getRenderedRange();
      if (index >= range.start && index < range.end) {
        focus();
        return;
      }
      viewport.scrollToIndex(index);
      // The range moves an animation frame after the scroll and the rows it
      // brings in only reach the DOM in the render that follows.
      const pending = viewport.renderedRangeStream.subscribe(() => {
        pending.unsubscribe();
        afterNextRender(focus, { injector });
      });
    },
    { injector },
  );
}
