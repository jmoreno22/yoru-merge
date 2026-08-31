import { Injectable, signal } from '@angular/core';

/**
 * Discriminated union of every payload kind that the YoruMerge UI can drag.
 *
 * Each payload is **identity-only** — just enough metadata for the drop
 * handler to know *what* was dragged and *which* git object it refers to.
 * Heavyweight data (full BranchInfo / CommitInfo) is intentionally NOT
 * carried; consumers re-derive it from the canonical signals on
 * `CurrentRepoService` once the drop fires.
 *
 * - `commit` — a single commit row from the commit list.
 * - `branch` — a local or remote branch row from the sidebar.
 */
export type DragPayload =
  | { readonly type: 'commit'; readonly sha: string }
  | {
      readonly type: 'branch';
      readonly name: string;
      readonly isRemote: boolean;
      readonly isCurrent: boolean;
    };

/**
 * Structured event emitted when a valid drag-and-drop completes.
 *
 * Defined here — not in `DragDropDirective` — so that `DropActionMenu`
 * can import it from the service without creating a circular dependency
 * (directive already imports this service).
 */
export interface DragDropEvent {
  /** Payload of the element that *initiated* the drag (the source). */
  readonly source: DragPayload;
  /** Payload of the element that *received* the drop (the target). */
  readonly target: DragPayload;
  /** Raw browser event — useful for positioning the action menu. */
  readonly event: DragEvent;
}

/**
 * Singleton signal store for the *current* in-flight drag operation
 * and the completed-drop pending-menu state.
 *
 * The browser's native `DataTransfer` is intentionally avoided as the source
 * of truth — it serializes to strings, fires non-deterministically across
 * the dragstart → drop boundary on WebView2/WebKitGTK, and forces the
 * drop handler to JSON-parse on every event.  Instead, we mirror the
 * payload into this in-memory signal so:
 *
 * 1. The drop target can read the source's identity *synchronously* and
 *    *typed* — no JSON parsing in the hot path.
 * 2. The visual affordance (dragover row highlight) can short-circuit if
 *    the source and target are the same row.
 * 3. The action menu can be opened from the drop coordinates without
 *    having to re-parse the payload.
 *
 * The companion `DragDropDirective` keeps a string copy in `dataTransfer`
 * for browser-native compatibility, but the dispatched `DragDropEvent`
 * always carries the rich, typed payload from this service.
 */
@Injectable({ providedIn: 'root' })
export class DragPayloadService {
  private readonly _payload = signal<DragPayload | null>(null);

  /**
   * Set when a drop completes and the action overlay is waiting for
   * user input.  Cleared by `clearPendingDrop()` after the user picks an
   * action or dismisses the menu.
   */
  private readonly _pendingDrop = signal<DragDropEvent | null>(null);

  /** Read-only snapshot of the currently-dragged payload, or `null`. */
  readonly payload = this._payload.asReadonly();

  /**
   * Read-only snapshot of the last completed drop awaiting an action,
   * or `null` when no menu is open.
   */
  readonly pendingDrop = this._pendingDrop.asReadonly();

  /** Called by `DragDropDirective` on `dragstart`. */
  begin(payload: DragPayload): void {
    this._payload.set(payload);
  }

  /** Called by `DragDropDirective` on `dragend` and after `drop` fires. */
  end(): void {
    this._payload.set(null);
  }

  /**
   * Called by `DragDropDirective.onDrop` to expose the completed drop
   * to the global `DropActionMenu` overlay.
   */
  notifyDrop(event: DragDropEvent): void {
    this._pendingDrop.set(event);
  }

  /**
   * Called by `DropActionMenu` when the user selects an action or
   * dismisses the overlay.
   */
  clearPendingDrop(): void {
    this._pendingDrop.set(null);
  }
}
