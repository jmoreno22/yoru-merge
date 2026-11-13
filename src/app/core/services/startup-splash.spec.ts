// @vitest-environment jsdom
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesService } from './preferences.service';
import {
  SPLASH_EXIT_MS,
  SPLASH_ID,
  SPLASH_MAX_MS,
  SPLASH_MIN_MS,
  type StartupTab,
  startupSettled,
  watchStartupSplash,
} from './startup-splash';
import { WorkspaceStore } from './workspace.store';

const IDLE_TAB: StartupTab = {
  loading: false,
  opened: false,
  refreshed: false,
  failed: false,
};

describe('startupSettled', () => {
  it('waits for the stored preferences', () => {
    expect(startupSettled(false, 0, null)).toBe(false);
  });

  it('settles on the welcome screen when no tab was stored', () => {
    expect(startupSettled(true, 0, null)).toBe(true);
  });

  it('waits for the stored tabs to be restored', () => {
    expect(startupSettled(true, 2, null)).toBe(false);
  });

  it('waits while the restored tab has not started opening', () => {
    expect(startupSettled(true, 1, IDLE_TAB)).toBe(false);
  });

  it('waits while the tab is loading', () => {
    expect(startupSettled(true, 1, { ...IDLE_TAB, loading: true, opened: true })).toBe(
      false,
    );
  });

  it('waits through the gap between the open and its first refresh', () => {
    expect(startupSettled(true, 1, { ...IDLE_TAB, opened: true })).toBe(false);
  });

  it('settles once the opened tab has refreshed', () => {
    expect(
      startupSettled(true, 1, { ...IDLE_TAB, opened: true, refreshed: true }),
    ).toBe(true);
  });

  it('settles on a tab that failed to open', () => {
    expect(startupSettled(true, 1, { ...IDLE_TAB, failed: true })).toBe(true);
  });
});

describe('watchStartupSplash', () => {
  const prefs = {
    storeReady: signal(false),
    workspaceTabs: signal<string[]>([]),
  };
  const tab = {
    loading: signal(false),
    repo: signal<object | null>(null),
    changes: signal<object | null>(null),
    error: signal<string | null>(null),
    notFound: signal(false),
  };
  const workspace = { activeRepoState: signal<typeof tab | null>(null) };

  const splash = () => document.getElementById(SPLASH_ID);

  beforeEach(() => {
    vi.useFakeTimers();
    prefs.storeReady.set(false);
    prefs.workspaceTabs.set([]);
    tab.loading.set(false);
    tab.repo.set(null);
    tab.changes.set(null);
    tab.error.set(null);
    tab.notFound.set(false);
    workspace.activeRepoState.set(null);
    document.body.innerHTML = `<div id="${SPLASH_ID}"></div>`;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PreferencesService, useValue: prefs },
        { provide: WorkspaceStore, useValue: workspace },
      ],
    });
    TestBed.runInInjectionContext(watchStartupSplash);
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('stays while the first view is still changing', () => {
    prefs.workspaceTabs.set(['/repo']);
    prefs.storeReady.set(true);
    workspace.activeRepoState.set(tab);
    tab.repo.set({});
    TestBed.tick();
    vi.advanceTimersByTime(SPLASH_MAX_MS - 1);

    expect(splash()?.classList.contains('is-leaving')).toBe(false);
  });

  it('fades out, then leaves the DOM, once the restored tab has refreshed', () => {
    vi.advanceTimersByTime(SPLASH_MIN_MS);
    prefs.workspaceTabs.set(['/repo']);
    prefs.storeReady.set(true);
    workspace.activeRepoState.set(tab);
    tab.repo.set({});
    tab.changes.set({});
    TestBed.tick();
    vi.advanceTimersByTime(0);

    expect(splash()?.classList.contains('is-leaving')).toBe(true);
    vi.advanceTimersByTime(SPLASH_EXIT_MS);
    expect(splash()).toBeNull();
  });

  it('keeps the intro on screen when the app is ready at once', () => {
    prefs.storeReady.set(true);
    TestBed.tick();
    vi.advanceTimersByTime(SPLASH_MIN_MS - 1);

    expect(splash()?.classList.contains('is-leaving')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(splash()?.classList.contains('is-leaving')).toBe(true);
  });

  it('gives way to the loading state of a slow repository', () => {
    prefs.workspaceTabs.set(['/repo']);
    prefs.storeReady.set(true);
    workspace.activeRepoState.set(tab);
    tab.loading.set(true);
    TestBed.tick();
    vi.advanceTimersByTime(SPLASH_MAX_MS);
    // The fake clock pushes a zero delay scheduled mid-tick to the next millisecond.
    vi.advanceTimersToNextTimer();

    expect(splash()?.classList.contains('is-leaving')).toBe(true);
  });
});
