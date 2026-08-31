import { Injectable, signal } from '@angular/core';

/**
 * Lets anything outside the working-changes panel put the caret in the commit
 * composer (the command palette does). The request is a latch rather than an
 * event because the caller usually has to switch to the Changes view first, so
 * the composer does not exist yet when the request is made: it consumes the
 * latch on creation instead of missing it.
 */
@Injectable({ providedIn: 'root' })
export class CommitComposerFocus {
  private readonly pending = signal(false);

  readonly requested = this.pending.asReadonly();

  request(): void {
    this.pending.set(true);
  }

  /** Called by the composer once the caret is in. */
  consume(): void {
    this.pending.set(false);
  }
}
