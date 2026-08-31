import { Injectable, signal } from '@angular/core';

/**
 * Open state for the command palette, so a shortcut, the toolbar command bar
 * and any feature can raise it without going through the shell.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly _open = signal(false);
  readonly isOpen = this._open.asReadonly();

  open(): void {
    this._open.set(true);
  }

  close(): void {
    this._open.set(false);
  }

  toggle(): void {
    this._open.update((value) => !value);
  }
}
