/**
 * Applies the stored theme and type scale to <html> before the first paint, so
 * launching the app never flashes the wrong background or the wrong metrics
 * while Angular boots.
 *
 * Loaded as a render-blocking <script src> rather than inlined: the Tauri CSP
 * is `script-src 'self'`, which rejects inline scripts but allows this file.
 *
 * The storage keys and their values must stay in sync with
 * `core/services/theme.service.ts` (ThemeMode: 'light' | 'dark' | 'system')
 * and with the `prefs.appearance` mirror written by
 * `core/services/preferences.service.ts`.
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

/**
 * The appearance mirror is written by the app itself, so the only way it holds
 * a value outside the schema is a hand-edited store: the bounds below mirror
 * MIN_UI_FONT_SIZE / MAX_UI_FONT_SIZE and the UiDensity union.
 */
(function applyStoredAppearance() {
  try {
    var stored = JSON.parse(localStorage.getItem('prefs.appearance') || '{}');
    var size = stored.uiFontSize;
    if (typeof size === 'number' && size >= 11 && size <= 17) {
      document.documentElement.style.setProperty('--ui-font-size', size + 'px');
    }
    var density = stored.uiDensity;
    if (density === 'compact' || density === 'comfortable' || density === 'relaxed') {
      document.documentElement.dataset.density = density;
    }
  } catch (error) {
    // No mirror yet, malformed JSON or storage unavailable: styles.css declares
    // the defaults and Angular writes the real values on its first tick.
  }
})();
