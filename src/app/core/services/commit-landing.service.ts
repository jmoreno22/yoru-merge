import { Injectable, inject, signal } from '@angular/core';
import { CurrentRepoService } from './current-repo.service';

/** Long enough for the row's slide and the graph's two ripples to finish. */
export const LANDING_MS = 2400;

/**
 * Hands a fresh commit from the composer to History.
 *
 * The commit is made in Changes, where History is not mounted, so the tab
 * keeps it as `landedSha` until History opens and claims it. Claiming spends
 * it: the row and the graph node play `playing` once, and reopening History
 * later shows nothing.
 */
@Injectable({ providedIn: 'root' })
export class CommitLandingService {
  private readonly repo = inject(CurrentRepoService);
  private readonly _playing = signal<string | null>(null);

  /** The commit whose row and graph node are playing their landing. */
  readonly playing = this._playing.asReadonly();

  claim(): void {
    const sha = this.repo.landedSha();
    if (sha === null) return;
    this.repo.landedSha.set(null);
    this._playing.set(sha);
    setTimeout(() => {
      if (this._playing() === sha) this._playing.set(null);
    }, LANDING_MS);
  }
}
