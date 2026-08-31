import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { relaunch } from '@tauri-apps/plugin-process';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { check } from '@tauri-apps/plugin-updater';
import { messageFromUnknown } from './git-auth-error';
import { ToastService } from './toast.service';

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateInfo {
  readonly version: string;
  readonly currentVersion: string;
  /** Release notes as authored — markdown source, never rendered as HTML. */
  readonly notes: string;
  /** `YYYY-MM-DD`, or null when the release carries no usable date. */
  readonly date: string | null;
}

/** The first check waits for the window to settle instead of racing the boot. */
const FIRST_CHECK_DELAY_MS = 10_000;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * The application updater: one background check on start and every six hours,
 * plus the manual check behind the palette command and the About panel.
 *
 * Everything the UI needs is a signal, so the timers are safe in a zoneless
 * app. Nothing here opens a dialog — the toolbar pill and the palette own
 * that, which keeps `core` free of a `features` import.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  private readonly toasts = inject(ToastService);

  private readonly _state = signal<UpdaterState>('idle');
  private readonly _info = signal<UpdateInfo | null>(null);
  private readonly _progress = signal<number | null>(null);

  readonly state = this._state.asReadonly();
  readonly info = this._info.asReadonly();
  /** Download percentage, or null while the release size is unknown. */
  readonly progress = this._progress.asReadonly();

  private update: Update | null = null;
  private downloadedBytes = 0;
  private contentLength: number | null = null;

  constructor() {
    const first = setTimeout(
      () => void this.checkForUpdates(false),
      FIRST_CHECK_DELAY_MS,
    );
    const timer = setInterval(
      () => void this.checkForUpdates(false),
      CHECK_INTERVAL_MS,
    );
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(first);
      clearInterval(timer);
    });
  }

  /**
   * `interactive` separates the manual command from the background timer. In
   * development — and whenever the release endpoint is unreachable — `check()`
   * throws, and a silent run has to leave no trace of that.
   */
  async checkForUpdates(interactive: boolean): Promise<void> {
    const state = this._state();
    if (state === 'checking' || state === 'downloading' || state === 'ready') return;
    // A background tick has nothing to add once an update is already waiting.
    if (state === 'available' && !interactive) return;

    this._state.set('checking');
    try {
      const found = await check();
      this.closeUpdate();
      this.update = found;
      if (!found) {
        this._info.set(null);
        this._state.set('idle');
        if (interactive) this.toasts.info("You're on the latest version.");
        return;
      }
      this._info.set({
        version: found.version,
        currentVersion: found.currentVersion,
        notes: found.body?.trim() ?? '',
        date: releaseDay(found.date),
      });
      this._state.set('available');
    } catch (error: unknown) {
      // A re-check that fails must not bury a release already found: the pill
      // keeps offering it, and only the toast reports the failed check.
      if (this.update !== null) this._state.set('available');
      else this._state.set(interactive ? 'error' : 'idle');
      if (interactive) {
        this.toasts.error(`Could not check for updates: ${messageFromUnknown(error)}`);
      }
    }
  }

  async downloadAndInstall(): Promise<void> {
    const update = this.update;
    if (!update || this._state() !== 'available') return;

    this.downloadedBytes = 0;
    this.contentLength = null;
    this._progress.set(null);
    this._state.set('downloading');
    try {
      await update.downloadAndInstall((event) => this.onDownloadEvent(event));
      this._state.set('ready');
    } catch (error: unknown) {
      // Back to `available`, not `error`: the release is still there and the
      // toolbar pill has to keep offering the retry.
      this._progress.set(null);
      this._state.set('available');
      this.toasts.error(`Update failed: ${messageFromUnknown(error)}`);
    }
  }

  /** Restarts into the installed version. Only meaningful once `ready`. */
  async restart(): Promise<void> {
    if (this._state() !== 'ready') return;
    try {
      await relaunch();
    } catch (error: unknown) {
      this.toasts.error(`Could not restart: ${messageFromUnknown(error)}`);
    }
  }

  private onDownloadEvent(event: DownloadEvent): void {
    switch (event.event) {
      case 'Started':
        this.contentLength = event.data.contentLength ?? null;
        this._progress.set(this.contentLength === null ? null : 0);
        break;
      case 'Progress': {
        this.downloadedBytes += event.data.chunkLength;
        const total = this.contentLength;
        if (total !== null && total > 0) {
          this._progress.set(
            Math.min(100, Math.round((this.downloadedBytes / total) * 100)),
          );
        }
        break;
      }
      case 'Finished':
        if (this.contentLength !== null) this._progress.set(100);
        break;
    }
  }

  /** `Update` holds a Rust-side resource; a replaced handle has to be freed. */
  private closeUpdate(): void {
    const previous = this.update;
    this.update = null;
    previous?.close().catch(() => {});
  }
}

/**
 * Tauri reports the release date as RFC 3339 with a trailing UTC offset that
 * `Date` refuses to parse, and the time of day is noise here anyway.
 */
function releaseDay(raw: string | undefined): string | null {
  return raw ? (/^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0] ?? null) : null;
}
