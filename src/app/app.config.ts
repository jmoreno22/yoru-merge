import {
  type ApplicationConfig,
  CSP_NONCE,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';

import { UpdaterService } from './core/services/updater.service';
import { provideYoruIcons } from './shared/icons';

/**
 * Tauri stamps a per-response nonce on every `<style>` of index.html and adds
 * that nonce to `style-src`, which by CSP rules makes `'unsafe-inline'` be
 * ignored. Angular has to reuse the same nonce on the `<style>` elements it
 * injects for component styles, or the webview silently drops every one of
 * them and only the linked global stylesheet survives.
 *
 * Read from the DOM rather than from a build-time constant: the nonce changes
 * on every response. Empty outside Tauri (the dev server sets no CSP), where
 * `null` restores Angular's default behaviour.
 */
function tauriStyleNonce(): string | null {
  return document.querySelector('style')?.nonce || null;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Nothing in the app depends on zone.js: state is signals end to end, and
    // the Tauri event listeners, observers and timers all write signals.
    provideZonelessChangeDetection(),
    { provide: CSP_NONCE, useFactory: tauriStyleNonce },
    provideYoruIcons(),
    // The updater runs on its own timers; constructing it is what starts them,
    // and no surface should have to be on screen for that to happen.
    provideAppInitializer(() => {
      inject(UpdaterService);
    }),
  ],
};
