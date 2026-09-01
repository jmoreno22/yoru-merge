import { computed, effect, Injectable, inject } from '@angular/core';
import { appearanceTokens, computeMetrics } from './appearance-metrics';
import { findPalette, paletteTokens } from './color-palettes';
import { PreferencesService } from './preferences.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

/**
 * The appearance preferences as concrete layout numbers, and the only place
 * allowed to write the appearance tokens onto the document root.
 *
 * Components read the row heights from here instead of from a constant so the
 * CDK `itemSize` and the `--row-h` token can never disagree; the arithmetic
 * itself lives in `appearance-metrics.ts`.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly prefs = inject(PreferencesService);
  private readonly theme = inject(ThemeService);
  private readonly toasts = inject(ToastService);

  /** The resolved palette, so the settings picker can label what is active. */
  readonly palette = computed(() => findPalette(this.prefs.colorPalette()));

  private readonly metrics = computed(() =>
    computeMetrics({
      uiFontSize: this.prefs.uiFontSize(),
      monoFontSize: this.prefs.monoFontSize(),
      density: this.prefs.uiDensity(),
    }),
  );

  readonly rowHeight = computed(() => this.metrics().rowHeight);
  readonly fileRowHeight = computed(() => this.metrics().fileRowHeight);
  readonly refRowHeight = computed(() => this.metrics().refRowHeight);
  readonly historyRowHeight = computed(() => this.metrics().historyRowHeight);
  readonly codeLineHeight = computed(() => this.metrics().codeLineHeight);
  readonly panelHeadHeight = computed(() => this.metrics().panelHeadHeight);
  readonly statusbarHeight = computed(() => this.metrics().statusbarHeight);

  // ── Visible chrome ──────────────────────────────────────────────────────
  //
  // Zen is an override, not a mutation: it hides every optional surface while
  // it is on and leaves the individual toggles untouched, so leaving zen
  // restores exactly the chrome the user had. The titlebar is absent on
  // purpose — `decorations` is false, so it carries the only window controls
  // there are and hiding it would trap the window.

  readonly showToolbar = computed(
    () => !this.prefs.zenMode() && this.prefs.showToolbar(),
  );
  readonly showStatusBar = computed(
    () => !this.prefs.zenMode() && this.prefs.showStatusBar(),
  );
  readonly showGraph = computed(() => !this.prefs.zenMode() && this.prefs.showGraph());
  readonly showSidebar = computed(
    () => !this.prefs.zenMode() && this.prefs.refsPanelOpen(),
  );

  /**
   * Enters or leaves zen, and on the way in says how to get back out.
   *
   * The announcement is not a nicety: zen hides the toolbar and the status bar,
   * which are the surfaces that would otherwise advertise the way back, so
   * without it the only exits are a shortcut you have to already know and a
   * settings dialog you have no visible route to.
   */
  setZen(on: boolean): void {
    this.prefs.setZenMode(on);
    if (on) this.toasts.info(ZEN_EXIT_HINT);
  }

  toggleZen(): void {
    this.setZen(!this.prefs.zenMode());
  }

  constructor() {
    // Zen is durable, so a session can START with the chrome hidden; the exit
    // hint has to repeat once the stored preferences have loaded.
    const zenOnStartup = effect(() => {
      if (!this.prefs.storeReady()) return;
      if (this.prefs.zenMode()) this.toasts.info(ZEN_EXIT_HINT);
      zenOnStartup.destroy();
    });

    effect(() => {
      const tokens = appearanceTokens({
        uiFontSize: this.prefs.uiFontSize(),
        monoFontSize: this.prefs.monoFontSize(),
        density: this.prefs.uiDensity(),
        codeTabWidth: this.prefs.codeTabWidth(),
        codeLigatures: this.prefs.codeLigatures(),
      });
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      for (const [name, value] of Object.entries(tokens)) {
        root.style.setProperty(name, value);
      }
      // The surface palette replaces the whole --app-* contract, so it is
      // written as one set on every palette or theme change: a partial write
      // would leave a token from the previous palette behind.
      const surfaces = paletteTokens(this.palette(), this.theme.resolved());
      for (const [name, value] of Object.entries(surfaces)) {
        root.style.setProperty(name, value);
      }

      // Read back by `runThemeTransition`, and by the CSS that neutralises
      // every animation and transition in one rule.
      root.dataset['animations'] = this.prefs.animations() ? 'on' : 'off';
      root.dataset['density'] = this.prefs.uiDensity();
      root.dataset['accent'] = this.prefs.accent();
      root.dataset['graphPalette'] = this.prefs.graphPalette();
      root.dataset['palette'] = this.palette().id;
    });
  }
}

const ZEN_EXIT_HINT = 'Zen mode — press Ctrl+Shift+Z to exit';
