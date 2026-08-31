import { Directive, HostListener, inject, input, output, signal } from '@angular/core';
import {
  type DragDropEvent,
  type DragPayload,
  DragPayloadService,
} from '../../core/services/drag-payload.service';
import { shortSha } from '../../core/utils';
import { canDrop } from '../components/drop-action-menu/drop-actions';

export type { DragDropEvent };

/**
 * Native drag-and-drop for one row, as both source and target.
 *
 * Every draggable row in YoruMerge is also a drop target — a branch onto a
 * branch, a commit onto a branch, a branch onto a commit — so splitting the
 * two roles would double the host bindings and force every consumer to
 * remember two attributes.
 *
 * ```html
 * <li [appDragDrop]="payload" (appDrop)="onDrop($event)">…</li>
 * ```
 *
 * The payload lives in `DragPayloadService`, not in `DataTransfer`: WebView2
 * and WebKitGTK deliver custom MIME types inconsistently across the
 * dragstart → drop boundary, and a signal is readable synchronously and typed.
 * A `text/plain` copy is still written because some WebView2 builds abort a
 * drag whose `DataTransfer` is empty.
 */
@Directive({
  selector: '[appDragDrop]',
  host: {
    draggable: 'true',
    '[class.drag-over]': 'isOver()',
  },
})
export class DragDropDirective {
  /**
   * What this row represents as a drag source and as a drop target. `null`
   * disables both — a row that is not a git object yet.
   */
  readonly appDragDrop = input.required<DragPayload | null>();

  /** Fires when a foreign payload is dropped on this row. */
  readonly appDrop = output<DragDropEvent>();

  private readonly store = inject(DragPayloadService);

  /** Toggled by drag enter/leave so the host class binding can light up. */
  protected readonly isOver = signal(false);

  /** Depth counter — dragenter/dragleave fire per descendant, not per row. */
  private dragEnterDepth = 0;

  // ── source ──────────────────────────────────────────────────────────────

  @HostListener('dragstart', ['$event'])
  protected onDragStart(event: DragEvent): void {
    const payload = this.appDragDrop();
    if (!payload) {
      event.preventDefault();
      return;
    }
    // Keep a CDK scroll viewport from swallowing the gesture.
    event.stopPropagation();
    this.store.begin(payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', JSON.stringify(payload));
      try {
        event.dataTransfer.setData(
          'application/x-yorumerge-drag',
          JSON.stringify(payload),
        );
      } catch {
        // Some WebViews reject custom MIME types; the signal store is canonical.
      }
      setDragGhost(event.dataTransfer, payload);
    }
    document.body.classList.add('yoru-dragging');
  }

  @HostListener('dragend')
  protected onDragEnd(): void {
    this.store.end();
    this.isOver.set(false);
    this.dragEnterDepth = 0;
    document.body.classList.remove('yoru-dragging');
  }

  // ── target ──────────────────────────────────────────────────────────────

  @HostListener('dragenter', ['$event'])
  protected onDragEnter(event: DragEvent): void {
    if (!this.accepts()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterDepth += 1;
    this.isOver.set(true);
  }

  @HostListener('dragover', ['$event'])
  protected onDragOver(event: DragEvent): void {
    if (!this.accepts()) return;
    // preventDefault on dragover is what marks the element as a drop target;
    // without it the drop event never fires.
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  @HostListener('dragleave')
  protected onDragLeave(): void {
    this.dragEnterDepth = Math.max(0, this.dragEnterDepth - 1);
    if (this.dragEnterDepth === 0) this.isOver.set(false);
  }

  @HostListener('drop', ['$event'])
  protected onDrop(event: DragEvent): void {
    const source = this.store.payload();
    const target = this.appDragDrop();
    // Clear the affordance whether or not the drop is honoured.
    this.isOver.set(false);
    this.dragEnterDepth = 0;
    if (!source || !target || !this.accepts()) return;
    event.preventDefault();
    event.stopPropagation();
    const dropEvent: DragDropEvent = { source, target, event };
    // The menu needs both ends, so publish before the store is cleared.
    this.store.notifyDrop(dropEvent);
    this.appDrop.emit(dropEvent);
    // The source row's `dragend` still fires, but the drop may have recycled
    // that row: clear here too so a stale payload cannot leak into the next drag.
    this.store.end();
    document.body.classList.remove('yoru-dragging');
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** True when the in-flight drag can do something on this row. */
  private accepts(): boolean {
    const source = this.store.payload();
    const target = this.appDragDrop();
    if (!source || !target || isSameRow(source, target)) return false;
    return canDrop(source, target);
  }
}

/** True when source and target refer to the exact same git object. */
function isSameRow(source: DragPayload, target: DragPayload): boolean {
  if (source.type === 'commit' && target.type === 'commit') {
    return source.sha === target.sha;
  }
  if (source.type === 'branch' && target.type === 'branch') {
    return source.name === target.name && source.isRemote === target.isRemote;
  }
  return false;
}

/**
 * Replaces the browser's default drag image — a screenshot of the whole row,
 * which at panel width says nothing — with a chip naming what is being moved.
 *
 * The element has to be in the document when `setDragImage` snapshots it, and
 * must not be visible: it is parked off-screen and removed on the next frame.
 */
function setDragGhost(dataTransfer: DataTransfer, payload: DragPayload): void {
  const ghost = document.createElement('div');
  ghost.textContent = payload.type === 'branch' ? payload.name : shortSha(payload.sha);
  ghost.style.cssText = [
    'position:fixed',
    'top:-1000px',
    'left:-1000px',
    'z-index:var(--z-overlay)',
    'padding:2px 8px',
    'border-radius:6px',
    'border:1px solid var(--app-border)',
    'background:var(--app-surface-raised)',
    'color:var(--app-text)',
    'font-family:var(--font-mono)',
    'font-size:12px',
    'white-space:nowrap',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(ghost);
  dataTransfer.setDragImage(ghost, 12, 12);
  requestAnimationFrame(() => ghost.remove());
}
