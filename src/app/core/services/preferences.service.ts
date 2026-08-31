import { computed, effect, Injectable, signal } from '@angular/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Store } from '@tauri-apps/plugin-store';
import type { PullMode } from '../models';
import {
  asNumber,
  clampContextLines,
  clampMinutes,
  clampPercent,
  DEFAULT_PREFERENCES,
  type DiffViewMode,
  type DurablePreferences,
  migratePreferences,
  type RailView,
  SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  sanitizePreferences,
  sanitizeSections,
  type UiDensity,
} from './preferences-schema';

export type {
  DiffViewMode,
  DurablePreferences,
  PreferencesSchema,
  RailView,
  UiDensity,
} from './preferences-schema';

const STORE_FILE = 'preferences.json';

/** localStorage key for the trivial sidebar-section toggle state. */
const LS_SIDEBAR_SECTIONS = 'prefs.sidebarSections';

/** How long (ms) to wait after the last change before flushing to disk. */
const STORE_DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly _durable = signal<DurablePreferences>({
    ...DEFAULT_PREFERENCES,
  });

  /** Cheap to rebuild if lost, so it stays in synchronous localStorage. */
  private readonly _sidebarSections = signal<Record<string, boolean>>(
    loadSidebarSections(),
  );

  // ── Public read-only signals ────────────────────────────────────────────
  readonly all = this._durable.asReadonly();
  readonly workspaceTabs = this.select('workspaceTabs');
  readonly activeTabPath = this.select('activeTabPath');
  readonly sidebarWidth = this.select('sidebarWidth');
  readonly workbenchSplit = this.select('workbenchSplit');
  readonly diffViewMode = this.select('diffViewMode');
  readonly diffIgnoreWhitespace = this.select('diffIgnoreWhitespace');
  readonly diffWordWrap = this.select('diffWordWrap');
  readonly diffContextLines = this.select('diffContextLines');
  readonly uiDensity = this.select('uiDensity');
  readonly externalEditor = this.select('externalEditor');
  readonly terminal = this.select('terminal');
  readonly autoFetchMinutes = this.select('autoFetchMinutes');
  readonly pullMode = this.select('pullMode');
  readonly confirmDangerous = this.select('confirmDangerous');
  readonly showRemoteBranchesPerRemote = this.select('showRemoteBranchesPerRemote');
  readonly railView = this.select('railView');
  readonly refsPanelOpen = this.select('refsPanelOpen');
  readonly commitsColumns = this.select('commitsColumns');
  readonly sidebarSections = this._sidebarSections.asReadonly();

  private readonly _storeReady = signal(false);

  /**
   * `true` once the plugin-store has been loaded and initial values applied.
   * Consumers watch this to defer logic that depends on persisted state.
   */
  readonly storeReady = this._storeReady.asReadonly();

  private store: Store | null = null;

  /** Handle for the debounced write timer. */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Defaults stay in place until the durable store resolves.
    void this.initStore();
    this.registerFlushHooks();

    effect(() => {
      const sections = this._sidebarSections();
      try {
        localStorage.setItem(LS_SIDEBAR_SECTIONS, JSON.stringify(sections));
      } catch {
        // localStorage unavailable (private mode, etc.) — fail silent.
      }
    });

    // Debounced flush of durable state. Reading `_storeReady` here means the
    // effect re-runs (and persists) as soon as the store becomes available.
    effect(() => {
      const values = this._durable();
      if (!this._storeReady()) return;
      if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        void this.writeToStore(values);
      }, STORE_DEBOUNCE_MS);
    });
  }

  // ── Setters ─────────────────────────────────────────────────────────────

  /** Generic typed setter; every named setter below funnels through it. */
  set<K extends keyof DurablePreferences>(key: K, value: DurablePreferences[K]): void {
    this._durable.update((current) => ({ ...current, [key]: value }));
  }

  setWorkspaceTabs(tabs: string[]): void {
    this.set('workspaceTabs', tabs);
  }

  setActiveTabPath(path: string): void {
    this.set('activeTabPath', path);
  }

  setSidebarWidth(percent: number): void {
    this.set('sidebarWidth', clampPercent(percent));
  }

  setWorkbenchSplit(split: number): void {
    this.set('workbenchSplit', clampPercent(split));
  }

  setDiffViewMode(mode: DiffViewMode): void {
    this.set('diffViewMode', mode);
  }

  setDiffIgnoreWhitespace(value: boolean): void {
    this.set('diffIgnoreWhitespace', value);
  }

  setDiffWordWrap(value: boolean): void {
    this.set('diffWordWrap', value);
  }

  setDiffContextLines(lines: number): void {
    this.set('diffContextLines', clampContextLines(lines));
  }

  setUiDensity(density: UiDensity): void {
    this.set('uiDensity', density);
  }

  setExternalEditor(command: string): void {
    this.set('externalEditor', command.trim());
  }

  setTerminal(command: string): void {
    this.set('terminal', command.trim());
  }

  setAutoFetchMinutes(minutes: number): void {
    this.set('autoFetchMinutes', clampMinutes(minutes));
  }

  setPullMode(mode: PullMode): void {
    this.set('pullMode', mode);
  }

  setConfirmDangerous(value: boolean): void {
    this.set('confirmDangerous', value);
  }

  setShowRemoteBranchesPerRemote(value: boolean): void {
    this.set('showRemoteBranchesPerRemote', value);
  }

  setRailView(view: RailView): void {
    this.set('railView', view);
  }

  setRefsPanelOpen(open: boolean): void {
    this.set('refsPanelOpen', open);
  }

  setCommitsColumns(columns: string[]): void {
    this.set('commitsColumns', columns);
  }

  /** Toggle the collapsed state of a named sidebar section. */
  setSidebarSectionCollapsed(key: string, collapsed: boolean): void {
    this._sidebarSections.update((s) => ({ ...s, [key]: collapsed }));
  }

  /** Writes pending changes immediately instead of waiting for the debounce. */
  async flush(): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.writeToStore(this._durable());
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private select<K extends keyof DurablePreferences>(key: K) {
    return computed(() => this._durable()[key]);
  }

  /**
   * Opens the plugin-store, reads persisted values into the signal, then marks
   * the store as ready so the persistence effect can take over.
   */
  private async initStore(): Promise<void> {
    try {
      this.store = await Store.load(STORE_FILE);
      const stored: Record<string, unknown> = {};
      for (const [key, value] of await this.store.entries()) {
        stored[key] = value;
      }
      const version = asNumber(stored[SCHEMA_VERSION_KEY]) ?? 0;
      this._durable.set({
        ...DEFAULT_PREFERENCES,
        ...sanitizePreferences(migratePreferences(stored, version)),
      });
      this._storeReady.set(true);
    } catch {
      // Store unavailable (browser-only dev environment) — keep the defaults.
    }
  }

  private async writeToStore(data: DurablePreferences): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
      for (const [key, value] of Object.entries(data)) {
        await this.store.set(key, value);
      }
      await this.store.save();
    } catch {
      // Disk write failed — fail silent.
    }
  }

  /**
   * Persists on the way out. `beforeunload` covers a browser reload; the Tauri
   * close hook covers the window's X button, which does not fire `beforeunload`
   * reliably on WebView2.
   */
  private registerFlushHooks(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => void this.flush());
    }
    try {
      void getCurrentWindow()
        .onCloseRequested(() => void this.flush())
        .catch(() => undefined);
    } catch {
      // Not running inside Tauri — `beforeunload` is the only hook available.
    }
  }
}

/**
 * Reads sidebar-section collapsed states from localStorage.
 * Returns an empty object on parse errors or a missing key.
 */
function loadSidebarSections(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_SIDEBAR_SECTIONS);
    if (!raw) return {};
    return sanitizeSections(JSON.parse(raw));
  } catch {
    // Malformed JSON or unavailable storage.
    return {};
  }
}
