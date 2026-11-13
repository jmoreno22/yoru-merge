import { Injectable, signal } from '@angular/core';

/** `surge`: a remote operation went through. `falter`: it did not. */
export type NeonCue = 'surge' | 'falter';

/**
 * What the titlebar's neon sign should react to. Remote operations raise
 * cues; the titlebar plays them. The id makes two equal cues in a row two
 * reactions instead of one unchanged signal value.
 */
@Injectable({ providedIn: 'root' })
export class NeonSignService {
  private readonly _cue = signal<{
    readonly kind: NeonCue;
    readonly id: number;
  } | null>(null);
  private lastId = 0;

  readonly cue = this._cue.asReadonly();

  surge(): void {
    this._cue.set({ kind: 'surge', id: ++this.lastId });
  }

  falter(): void {
    this._cue.set({ kind: 'falter', id: ++this.lastId });
  }
}
