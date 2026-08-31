/**
 * Applies the stored theme to <html> before the first paint, so launching the
 * app never flashes the wrong background while Angular boots.
 *
 * Loaded as a render-blocking <script src> rather than inlined: the Tauri CSP
 * is `script-src 'self'`, which rejects inline scripts but allows this file.
 *
 * The storage key and its values must stay in sync with
 * `core/services/theme.service.ts` (ThemeMode: 'light' | 'dark' | 'system').
 */
(function applyStoredTheme() {
  var dark = true;
  try {
    var stored = localStorage.getItem('theme');
    var mode =
      stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
    dark =
      mode === 'dark' ||
      (mode === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (error) {
    // localStorage unavailable: fall back to Yoru Night, the canonical theme.
  }
  document.documentElement.classList.toggle('dark', dark);
})();
