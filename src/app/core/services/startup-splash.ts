import { DOCUMENT, effect, inject } from '@angular/core';
import { PreferencesService } from './preferences.service';
import { WorkspaceStore } from './workspace.store';

/** The splash `index.html` paints before Angular boots. */
export const SPLASH_ID = 'yoru-splash';

/** Long enough for the intro to finish when the first view is ready at once. */
export const SPLASH_MIN_MS = 450;

/** Past this a slow repository shows its own loading state instead. */
export const SPLASH_MAX_MS = 2500;

/** The fade in `index.html`. */
export const SPLASH_EXIT_MS = 220;

/** What the splash needs to know about the tab the first view opens on. */
export interface StartupTab {
  readonly loading: boolean;
  readonly opened: boolean;
  readonly refreshed: boolean;
  readonly failed: boolean;
}

/**
 * Whether the first view is the one that stays.
 *
 * `refreshed` is not redundant with `!loading`: the open and the refresh that
 * follows it each hold `loading`, and between the two an opened tab reads as
 * idle for as long as the repo-changed listener takes to register.
 */
export function startupSettled(
  prefsReady: boolean,
  storedTabs: number,
  tab: StartupTab | null,
): boolean {
  if (!prefsReady) return false;
  if (storedTabs === 0) return true;
  if (tab === null || tab.loading) return false;
  return tab.failed || (tab.opened && tab.refreshed);
}

/** Fades the splash out and takes it out of the DOM. */
export function dismissSplash(doc: Document): void {
  const splash = doc.getElementById(SPLASH_ID);
  if (!splash) return;
  splash.classList.add('is-leaving');
  setTimeout(() => splash.remove(), SPLASH_EXIT_MS);
}

/**
 * Lifts the splash once the first view is final. Runs in an injection
 * context, at the moment the shell is created, which is about when the splash
 * first reaches the screen — so the bounds are counted from here.
 */
export function watchStartupSplash(): void {
  const doc = inject(DOCUMENT);
  if (!doc.getElementById(SPLASH_ID)) return;
  const prefs = inject(PreferencesService);
  const workspace = inject(WorkspaceStore);
  const started = performance.now();

  const leave = (): void => {
    watcher.destroy();
    clearTimeout(cap);
    const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - started));
    setTimeout(() => dismissSplash(doc), wait);
  };
  const cap = setTimeout(leave, SPLASH_MAX_MS);
  const watcher = effect(() => {
    const tab = workspace.activeRepoState();
    const settled = startupSettled(
      prefs.storeReady(),
      prefs.workspaceTabs().length,
      tab && {
        loading: tab.loading(),
        opened: tab.repo() !== null,
        refreshed: tab.changes() !== null,
        failed: tab.error() !== null || tab.notFound(),
      },
    );
    if (settled) leave();
  });
}
