import type { PullMode } from '../models';

export type DiffViewMode = 'unified' | 'split';
export type UiDensity = 'comfortable' | 'compact';
/** Which view the icon rail shows in the centre column. */
export type RailView = 'history' | 'changes' | 'reflog';

/**
 * Durable user preferences, stored in the Tauri plugin-store so they survive
 * app restarts even on platforms that wipe localStorage (e.g. Linux Snap).
 *
 * Sizes are percentages of the viewport / container rather than raw pixels so
 * panels reflow gracefully when the window is resized.
 */
export interface DurablePreferences {
  /** Ordered list of open workspace folder paths. */
  workspaceTabs: string[];
  /** Path of the currently active tab (may be empty). */
  activeTabPath: string;
  /** Sidebar panel width as a percentage of viewport width. */
  sidebarWidth: number;
  /** Main workbench split ratio (centre column %). */
  workbenchSplit: number;

  diffViewMode: DiffViewMode;
  diffIgnoreWhitespace: boolean;
  diffWordWrap: boolean;
  /** Context lines around each hunk (0–20). */
  diffContextLines: number;

  uiDensity: UiDensity;
  /** Command used by "Open in editor"; empty means $VISUAL/$EDITOR/`code`. */
  externalEditor: string;
  /** Command used by "Open in terminal"; empty means the OS default. */
  terminal: string;
  /** Minutes between background fetches; 0 disables auto-fetch. */
  autoFetchMinutes: number;
  pullMode: PullMode;
  /** Ask before destructive actions (discard, hard reset, force push, delete). */
  confirmDangerous: boolean;
  /** Group remote branches under one node per remote. */
  showRemoteBranchesPerRemote: boolean;

  railView: RailView;
  refsPanelOpen: boolean;
  /** Visible columns of the commit list, in display order. */
  commitsColumns: string[];
}

/** Full preference set, including the keys kept in localStorage. */
export interface PreferencesSchema extends DurablePreferences {
  /** Per-section collapsed state; key = section id, value = true if collapsed. */
  sidebarSections: Record<string, boolean>;
}

/** Bumped whenever a stored shape changes; drives {@link migratePreferences}. */
export const SCHEMA_VERSION = 1;

export const SCHEMA_VERSION_KEY = 'schemaVersion';

export const DEFAULT_PREFERENCES: DurablePreferences = {
  workspaceTabs: [],
  activeTabPath: '',
  // ~18 % of a 1280 px window ≈ 230 px sidebar by default.
  sidebarWidth: 18,
  // The centre column (graph + commit list, or the working tree) gets 62 % of
  // the workbench so the graph has room; the inspector column takes 38 %.
  workbenchSplit: 62,
  diffViewMode: 'unified',
  diffIgnoreWhitespace: false,
  diffWordWrap: false,
  diffContextLines: 3,
  uiDensity: 'comfortable',
  externalEditor: '',
  terminal: '',
  autoFetchMinutes: 0,
  pullMode: 'merge',
  confirmDangerous: true,
  showRemoteBranchesPerRemote: true,
  railView: 'history',
  refsPanelOpen: true,
  commitsColumns: ['graph', 'message', 'author', 'date', 'sha'],
};

/**
 * Sane percentage bounds for persisted size keys. Anything outside this range
 * is treated as corrupt / legacy-pixel data and ignored on load.
 */
const MIN_PERCENT = 5;
const MAX_PERCENT = 80;

const DIFF_VIEW_MODES: readonly DiffViewMode[] = ['unified', 'split'];
const UI_DENSITIES: readonly UiDensity[] = ['comfortable', 'compact'];
const PULL_MODES: readonly PullMode[] = ['merge', 'rebase', 'ff_only'];
const RAIL_VIEWS: readonly RailView[] = ['history', 'changes', 'reflog'];

/**
 * Upgrades a stored payload to {@link SCHEMA_VERSION}.
 *
 * Version 0 is "written before the version key existed": its keys already match
 * the current names, so nothing has to move. Later migrations go here.
 */
export function migratePreferences(
  stored: Record<string, unknown>,
  _fromVersion: number,
): Record<string, unknown> {
  return stored;
}

/**
 * Keeps only the values whose runtime shape matches the schema. A key that
 * fails validation is dropped so the default applies — a corrupt store must
 * never be able to leave the app unusable.
 */
export function sanitizePreferences(
  raw: Record<string, unknown>,
): Partial<DurablePreferences> {
  const out: Partial<DurablePreferences> = {};

  const tabs = raw['workspaceTabs'];
  if (isStringArray(tabs)) out.workspaceTabs = tabs;

  const activeTabPath = raw['activeTabPath'];
  if (typeof activeTabPath === 'string') out.activeTabPath = activeTabPath;

  const sidebarWidth = asPercent(raw['sidebarWidth']);
  if (sidebarWidth !== null) out.sidebarWidth = sidebarWidth;

  const workbenchSplit = asPercent(raw['workbenchSplit']);
  if (workbenchSplit !== null) out.workbenchSplit = workbenchSplit;

  const diffViewMode = raw['diffViewMode'];
  if (isOneOf(diffViewMode, DIFF_VIEW_MODES)) out.diffViewMode = diffViewMode;

  const ignoreWhitespace = raw['diffIgnoreWhitespace'];
  if (typeof ignoreWhitespace === 'boolean') {
    out.diffIgnoreWhitespace = ignoreWhitespace;
  }

  const wordWrap = raw['diffWordWrap'];
  if (typeof wordWrap === 'boolean') out.diffWordWrap = wordWrap;

  const contextLines = asNumber(raw['diffContextLines']);
  if (contextLines !== null) {
    out.diffContextLines = clampContextLines(contextLines);
  }

  const density = raw['uiDensity'];
  if (isOneOf(density, UI_DENSITIES)) out.uiDensity = density;

  const editor = raw['externalEditor'];
  if (typeof editor === 'string') out.externalEditor = editor;

  const terminal = raw['terminal'];
  if (typeof terminal === 'string') out.terminal = terminal;

  const autoFetch = asNumber(raw['autoFetchMinutes']);
  if (autoFetch !== null) out.autoFetchMinutes = clampMinutes(autoFetch);

  const pullMode = raw['pullMode'];
  if (isOneOf(pullMode, PULL_MODES)) out.pullMode = pullMode;

  const confirmDangerous = raw['confirmDangerous'];
  if (typeof confirmDangerous === 'boolean') {
    out.confirmDangerous = confirmDangerous;
  }

  const perRemote = raw['showRemoteBranchesPerRemote'];
  if (typeof perRemote === 'boolean') {
    out.showRemoteBranchesPerRemote = perRemote;
  }

  const railView = raw['railView'];
  if (isOneOf(railView, RAIL_VIEWS)) out.railView = railView;

  const refsPanelOpen = raw['refsPanelOpen'];
  if (typeof refsPanelOpen === 'boolean') out.refsPanelOpen = refsPanelOpen;

  const columns = raw['commitsColumns'];
  if (isStringArray(columns) && columns.length > 0) out.commitsColumns = columns;

  return out;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return MIN_PERCENT;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
}

export function clampContextLines(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.diffContextLines;
  return Math.min(20, Math.max(0, Math.round(value)));
}

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(180, Math.max(0, Math.round(value)));
}

/** Reads a persisted `Record<string, boolean>`, dropping non-boolean values. */
export function sanitizeSections(parsed: unknown): Record<string, boolean> {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Percentages outside the usable range are corrupt or legacy pixel values. */
function asPercent(value: unknown): number | null {
  const n = asNumber(value);
  if (n === null || n < MIN_PERCENT || n > MAX_PERCENT) return null;
  return n;
}
