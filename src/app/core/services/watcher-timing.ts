/**
 * How long after our own refresh a watcher event may be our own echo.
 * Long enough to cover the `.git` writes a refresh itself provokes.
 */
export const OWN_WRITE_WINDOW_MS = 1000;

/** Debounce for watcher-driven refreshes; the backend already coalesces bursts. */
export const WATCHER_DEBOUNCE_MS = 100;

/**
 * How long a watcher-driven refresh still has to wait, `0` once nothing holds
 * it back. A running operation or a refresh that just ended holds it instead
 * of dropping it: the event may be a change from outside landing in that
 * window, and dropping it left the view stale until the next event.
 */
export function watcherHoldMs(
  now: number,
  lastRefreshAt: number,
  busy: boolean,
): number {
  if (busy) return OWN_WRITE_WINDOW_MS;
  return Math.max(0, lastRefreshAt + OWN_WRITE_WINDOW_MS - now);
}
