import {
  computed,
  DestroyRef,
  effect,
  Injectable,
  inject,
  signal,
} from '@angular/core';
import { runThemeTransition } from './view-transition';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Read before first paint by the inline script in `index.html`, so it has to
 * stay in localStorage (the Tauri store loads asynchronously).
 */
const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _current = signal<ThemeMode>(loadInitialMode());

  /** OS-level preference, kept in sync by the media-query listener. */
  private readonly _osDark = signal<boolean>(prefersDark());

  /** Mode chosen by the user (may be 'system'). */
  readonly current = this._current.asReadonly();

  /** OS preference as a signal, for UI that labels the "System" option. */
  readonly osTheme = computed<ResolvedTheme>(() => (this._osDark() ? 'dark' : 'light'));

  /** What is actually applied right now. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const mode = this._current();
    return mode === 'system' ? this.osTheme() : mode;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const resolved = this.resolved();
      if (typeof document === 'undefined') return;
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    });

    effect(() => {
      const mode = this._current();
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // localStorage may be unavailable (private mode) — fail silent.
      }
    });

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (event: MediaQueryListEvent): void => {
        this._osDark.set(event.matches);
      };
      mq.addEventListener('change', handler);
      destroyRef.onDestroy(() => mq.removeEventListener('change', handler));
    }
  }

  set(mode: ThemeMode): void {
    runThemeTransition(() => this._current.set(mode));
  }

  /**
   * Toggles dark ↔ light.
   *
   * From 'system' it jumps to the opposite of what is currently on screen, so
   * every click produces a visible change instead of an identical-looking
   * intermediate state.
   */
  cycle(): void {
    const mode = this._current();
    const next: ResolvedTheme =
      mode === 'system'
        ? this.osTheme() === 'dark'
          ? 'light'
          : 'dark'
        : mode === 'dark'
          ? 'light'
          : 'dark';
    runThemeTransition(() => this._current.set(next));
  }
}

function loadInitialMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return 'system';
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
