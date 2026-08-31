import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { matchesCombo, type ParsedCombo, parseCombo } from './combo';

export interface Shortcut {
  /** Stable id, also used to unregister and to key the settings table. */
  readonly id: string;
  /** Combo string, e.g. `mod+enter`. `mod` is Ctrl on Windows and Linux. */
  readonly combo: string;
  /** Human label for the command palette and the Keyboard settings page. */
  readonly label: string;
  /** Skip the shortcut when this returns false (e.g. no repository open). */
  readonly when?: () => boolean;
  readonly run: () => void;
  /** Fire even while the user is typing in an input. Default: false. */
  readonly allowInInputs?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * The single keydown listener for application shortcuts.
 *
 * ```ts
 * const off = shortcuts.register({
 *   id: 'commit',
 *   combo: 'mod+enter',
 *   label: 'Commit staged changes',
 *   allowInInputs: true,
 *   when: () => this.canCommit(),
 *   run: () => this.commit(),
 * });
 * ```
 *
 * `shortcuts()` exposes everything registered so the palette and the Keyboard
 * settings page render real bindings instead of a hardcoded list.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly _shortcuts = signal<readonly Shortcut[]>([]);
  readonly shortcuts = this._shortcuts.asReadonly();

  private readonly parsed = new Map<string, ParsedCombo>();
  private listening = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.listening) {
        document.removeEventListener('keydown', this.onKeydown);
        this.listening = false;
      }
    });
  }

  /** Registers a shortcut and returns the function that removes it. */
  register(shortcut: Shortcut): () => void {
    this.parsed.set(shortcut.id, parseCombo(shortcut.combo));
    this._shortcuts.update((list) => [
      ...list.filter((s) => s.id !== shortcut.id),
      shortcut,
    ]);
    this.listen();
    return () => this.unregister(shortcut.id);
  }

  unregister(id: string): void {
    this.parsed.delete(id);
    this._shortcuts.update((list) => list.filter((s) => s.id !== id));
  }

  private listen(): void {
    if (this.listening) return;
    document.addEventListener('keydown', this.onKeydown);
    this.listening = true;
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    // Auto-repeat would fire a command once per repeat tick.
    if (event.repeat) return;

    const editable = isEditableTarget(event.target);
    for (const shortcut of this._shortcuts()) {
      if (editable && !shortcut.allowInInputs) continue;
      const combo = this.parsed.get(shortcut.id);
      if (!combo || !matchesCombo(event, combo)) continue;
      if (shortcut.when && !shortcut.when()) continue;

      event.preventDefault();
      shortcut.run();
      return;
    }
  };
}
