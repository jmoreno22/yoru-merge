// @vitest-environment jsdom
import type { ListRange } from '@angular/cdk/collections';
import type { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  Component,
  ElementRef,
  Injector,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { focusVirtualRow } from './virtual-row-focus';

/** Rows of a list long enough that the restore target sits well down it. */
const ROWS = Array.from({ length: 30 }, (_, i) => `row-${String(i).padStart(2, '0')}`);

const TARGET_INDEX = 12;

/** Every row in the DOM, as a viewport that had rendered them would hold. */
@Component({
  template: `@for (key of rows; track key) {
    <button type="button" [attr.data-focus-key]="key">{{ key }}</button>
  }`,
})
class RowHost {
  readonly rows = ROWS;
}

/**
 * The viewport a list hidden behind the diff workspace hands back: the CDK
 * cached a box of zero while an ancestor was hidden, so it reports an empty
 * rendered range and its scroll pipeline never emits a new one. Only
 * `checkViewportSize()` — the remeasure — makes it admit the range it has.
 */
class ZeroHeightViewport {
  readonly renderedRangeStream = new Subject<ListRange>();
  private measured = false;

  constructor(private readonly element: HTMLElement) {}

  getElementRef(): ElementRef<HTMLElement> {
    return new ElementRef(this.element);
  }

  getViewportSize(): number {
    return this.measured ? ROWS.length * 24 : 0;
  }

  getRenderedRange(): ListRange {
    return this.measured ? { start: 0, end: ROWS.length } : { start: 0, end: 0 };
  }

  checkViewportSize(): void {
    this.measured = true;
  }

  scrollToIndex(_index: number): void {
    // A scroll on a viewport that measures zero moves nothing, so no range
    // ever reaches `renderedRangeStream`.
  }
}

/** The remeasure focuses in the first `afterNextRender`; one tick reaches it. */
async function settle(): Promise<void> {
  TestBed.tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.tick();
}

describe('focusVirtualRow on a viewport that measures zero (AC-08)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('AC-08: focuses the restore target even though no rendered range ever arrives', async () => {
    const fixture = TestBed.createComponent(RowHost);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const viewport = new ZeroHeightViewport(host);
    const key = ROWS[TARGET_INDEX];

    focusVirtualRow(
      viewport as unknown as CdkVirtualScrollViewport,
      TARGET_INDEX,
      key,
      TestBed.inject(Injector),
    );
    await settle();

    expect(document.activeElement).toBe(
      host.querySelector(`[data-focus-key="${key}"]`),
    );
  });
});
