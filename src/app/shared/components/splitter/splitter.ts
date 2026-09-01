import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type OnDestroy,
  output,
  signal,
} from '@angular/core';

/**
 * Draggable splitter handle.
 *
 * A thin, reusable resize gripper backed by native pointer events
 * (no `@angular/cdk/drag-drop`).  Emits a pixel `delta` on every
 * `pointermove` while the user drags, and `resizeStart` / `resizeEnd`
 * around the drag.  The host (sidebar / workbench column) is responsible
 * for converting that delta into its own units, clamping, and persisting.
 *
 * - `orientation="vertical"`   → vertical bar, drags left/right (col-resize)
 * - `orientation="horizontal"` → horizontal bar, drags up/down  (row-resize)
 *
 * The bar is 4 px thick and uses the design-system
 * `--app-border` colour with an accent hover so the splitter stays
 * discoverable without becoming visually noisy.
 */
@Component({
  selector: 'app-splitter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '[class]': 'hostClass()',
    '[attr.role]': '"separator"',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-valuenow]': 'ariaValueNow()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    'data-testid': 'splitter',
  },
})
export class Splitter implements OnDestroy {
  /** Vertical bar (drag X) or horizontal bar (drag Y). */
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');

  /** Current size as a 0–100 percentage — surfaced via `aria-valuenow`. */
  readonly value = input<number | null>(null);

  /** Pixel delta on every pointermove (positive = right / down). */
  readonly resize = output<number>();
  readonly resizeStart = output<void>();
  readonly resizeEnd = output<void>();

  private readonly active = signal(false);
  private lastCoord = 0;

  // Listener handles kept on the instance so we can remove the exact
  // closures we attached — `bind` would create new references each call.
  private moveListener: ((event: PointerEvent) => void) | null = null;
  private upListener: ((event: PointerEvent) => void) | null = null;
  private pointerId: number | null = null;
  private captureTarget: HTMLElement | null = null;

  protected readonly hostClass = computed(() => {
    const vertical = this.orientation() === 'vertical';
    const base = vertical
      ? 'block w-1 h-full cursor-col-resize'
      : 'block h-1 w-full cursor-row-resize';
    // The handle stays subtle until hovered/dragged so it doesn't compete
    // with the diff viewer chrome.
    const visual = this.active()
      ? 'bg-accent/60'
      : 'bg-[var(--app-border)] hover:bg-accent/40 transition-colors';
    return `${base} shrink-0 select-none ${visual}`;
  });

  protected readonly ariaValueNow = computed<number | null>(() => {
    const v = this.value();
    return v === null || Number.isNaN(v) ? null : Math.round(v);
  });

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    this.captureTarget = target;
    this.pointerId = event.pointerId;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers / synthetic events can't capture — drag still works
      // via the window-level listeners.
    }

    const vertical = this.orientation() === 'vertical';
    this.lastCoord = vertical ? event.clientX : event.clientY;
    this.active.set(true);
    this.resizeStart.emit();

    this.moveListener = (e: PointerEvent) => this.onMove(e, vertical);
    this.upListener = (e: PointerEvent) => this.onUp(e);

    window.addEventListener('pointermove', this.moveListener);
    window.addEventListener('pointerup', this.upListener);
    window.addEventListener('pointercancel', this.upListener);
  }

  private onMove(event: PointerEvent, vertical: boolean): void {
    if (!this.active()) return;
    const coord = vertical ? event.clientX : event.clientY;
    const delta = coord - this.lastCoord;
    if (delta === 0) return;
    this.lastCoord = coord;
    this.resize.emit(delta);
  }

  private onUp(_event: PointerEvent): void {
    if (!this.active()) return;
    this.active.set(false);
    this.releaseCapture();
    this.detachWindowListeners();
    this.resizeEnd.emit();
  }

  private releaseCapture(): void {
    if (this.captureTarget && this.pointerId !== null) {
      try {
        this.captureTarget.releasePointerCapture(this.pointerId);
      } catch {
        // Either capture was never set or the pointer is gone — safe to ignore.
      }
    }
    this.captureTarget = null;
    this.pointerId = null;
  }

  private detachWindowListeners(): void {
    if (this.moveListener) {
      window.removeEventListener('pointermove', this.moveListener);
      this.moveListener = null;
    }
    if (this.upListener) {
      window.removeEventListener('pointerup', this.upListener);
      window.removeEventListener('pointercancel', this.upListener);
      this.upListener = null;
    }
  }

  ngOnDestroy(): void {
    this.detachWindowListeners();
    this.releaseCapture();
  }
}
