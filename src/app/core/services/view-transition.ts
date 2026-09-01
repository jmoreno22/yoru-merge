/**
 * Runs a theme or palette change inside a View Transition, so the repaint
 * sweeps across the window instead of cutting.
 *
 * The motion state is read off the document rather than injected: the caller
 * would otherwise have to depend on `AppearanceService`, and `ThemeService`
 * cannot — `AppearanceService` already depends on it. `data-animations` is
 * written by `AppearanceService`, which is the one place that owns it.
 *
 * Falls back to applying the change directly when
 * - the user turned animations off, or the OS asks for reduced motion;
 * - the engine has no View Transitions API. Tauri ships WebView2 on Windows,
 *   which does, and WebKitGTK on Linux, which does not — so this is a real
 *   path, not a theoretical one.
 */
export function runThemeTransition(apply: () => void): void {
  if (typeof document === 'undefined') {
    apply();
    return;
  }

  const start = document.startViewTransition?.bind(document);
  if (!start || !motionAllowed()) {
    apply();
    return;
  }

  start(apply);
}

function motionAllowed(): boolean {
  if (document.documentElement.dataset['animations'] === 'off') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
