import type { RepoChangeKind } from '../../models';

/**
 * Serialises the refreshes of one repository tab.
 *
 * At most one refresh runs and at most one waits behind it: everything asked
 * for while one is running merges into that single follow-up, so a burst of
 * watcher events costs two rounds instead of one round per event.
 */
export class RefreshCoalescer {
  private running: Promise<void> | null = null;
  private queued: Set<RepoChangeKind> | null = null;

  constructor(
    private readonly refresh: (kinds: ReadonlySet<RepoChangeKind>) => Promise<void>,
  ) {}

  /** Resolves once the round this request landed in, and any round queued
   * after it, has finished. */
  run(kinds: Iterable<RepoChangeKind>): Promise<void> {
    if (this.queued === null) this.queued = new Set(kinds);
    else for (const kind of kinds) this.queued.add(kind);
    this.running ??= this.drain();
    return this.running;
  }

  private async drain(): Promise<void> {
    try {
      while (this.queued !== null) {
        const kinds = this.queued;
        // Cleared before awaiting, so a request arriving from here on opens the
        // next round rather than being swallowed by the one already started.
        this.queued = null;
        await this.refresh(kinds);
      }
    } finally {
      this.running = null;
    }
  }
}
