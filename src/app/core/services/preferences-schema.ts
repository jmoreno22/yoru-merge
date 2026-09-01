import type { PullMode } from '../models';
import { DEFAULT_PALETTE_ID } from './color-palettes';

export type DiffViewMode = 'unified' | 'split';
export type UiDensity = 'compact' | 'comfortable' | 'relaxed';
/** Which view the icon rail shows in the centre column. */
export type RailView = 'history' | 'changes' | 'reflog';

/** Accent presets. Every id maps to a colour already in the Yoru palette. */
export type AccentId = 'cyan' | 'violet' | 'sakura' | 'mint' | 'crimson';

/**
 * Branch-graph lane palettes. Kept apart from {@link AccentId}: the six lanes
 * have to stay mutually distinguishable, which deriving them from one accent
 * cannot guarantee, and 'colorblind' exists precisely to break from the accent.
 */
export type GraphPaletteId = 'yoru' | 'contrast' | 'colorblind';

/** Where the inspector column sits relative to the centre view. */
export type InspectorPlacement = 'right' | 'bottom';

export type SidebarSide = 'left' | 'right';

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
  /**
   * Base interface type size in px (11-17). Drives the whole UI scale: every
   * other UI size is a ratio of it, so one value moves the interface as a set.
   */
  uiFontSize: number;
  /**
   * Code type size in px (10-18). Deliberately independent of
   * {@link uiFontSize}: the diff and the blame gutters are numbered against
   * the code they sit beside, and a reader who wants a dense interface around
   * large code (or the reverse) is the common case, not the exception.
   */
  monoFontSize: number;
  /** `tab-size` for code surfaces (1-8). */
  codeTabWidth: number;
  /** Render JetBrains Mono's programming ligatures in code surfaces. */
  codeLigatures: boolean;

  accent: AccentId;
  graphPalette: GraphPaletteId;
  /**
   * Id of the full surface palette. A plain string rather than a union of the
   * built-in ids: a palette loaded from a file has an id this build has never
   * seen, and `findPalette` already falls back to the default for anything it
   * cannot resolve. Validating it against a closed list here would delete the
   * user's choice on every downgrade.
   */
  colorPalette: string;

  /**
   * Master switch for animation. Off also skips the theme View Transition,
   * which is the most expensive thing the UI animates. The OS
   * `prefers-reduced-motion` setting is honoured on top of this and cannot be
   * overridden by turning it on.
   */
  animations: boolean;

  inspectorPlacement: InspectorPlacement;
  sidebarSide: SidebarSide;
  showToolbar: boolean;
  showStatusBar: boolean;
  /** Show the branch-graph column beside the commit list. */
  showGraph: boolean;
  /**
   * Hides every optional surface at once without touching the individual
   * toggles, so leaving zen restores exactly the chrome the user had. The
   * titlebar is never hidden: `decorations` is false, so it carries the only
   * window controls there are.
   */
  zenMode: boolean;

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
export const SCHEMA_VERSION = 2;

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
  uiFontSize: 13,
  monoFontSize: 12,
  codeTabWidth: 2,
  codeLigatures: false,
  accent: 'cyan',
  graphPalette: 'yoru',
  colorPalette: DEFAULT_PALETTE_ID,
  animations: true,
  inspectorPlacement: 'right',
  sidebarSide: 'left',
  showToolbar: true,
  showStatusBar: true,
  showGraph: true,
  zenMode: false,
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
const UI_DENSITIES: readonly UiDensity[] = ['compact', 'comfortable', 'relaxed'];
const PULL_MODES: readonly PullMode[] = ['merge', 'rebase', 'ff_only'];
const RAIL_VIEWS: readonly RailView[] = ['history', 'changes', 'reflog'];
const ACCENTS: readonly AccentId[] = ['cyan', 'violet', 'sakura', 'mint', 'crimson'];
const GRAPH_PALETTES: readonly GraphPaletteId[] = ['yoru', 'contrast', 'colorblind'];
const INSPECTOR_PLACEMENTS: readonly InspectorPlacement[] = ['right', 'bottom'];
const SIDEBAR_SIDES: readonly SidebarSide[] = ['left', 'right'];

/**
 * Type-size bounds. The floors are legibility limits, not arbitrary: below
 * 11px the ratio-derived micro labels (0.65x) fall under 7px.
 */
export const MIN_UI_FONT_SIZE = 11;
export const MAX_UI_FONT_SIZE = 17;
export const MIN_MONO_FONT_SIZE = 10;
export const MAX_MONO_FONT_SIZE = 18;

/**
 * Upgrades a stored payload to {@link SCHEMA_VERSION}.
 *
 * Version 0 is "written before the version key existed": its keys already match
 * the current names, so nothing has to move. Version 1 -> 2 only added keys
 * (typography, accent, layout), and a missing key already falls back to its
 * default, so there is still nothing to move. Later migrations go here.
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

  const uiFontSize = asNumber(raw['uiFontSize']);
  if (uiFontSize !== null) out.uiFontSize = clampUiFontSize(uiFontSize);

  const monoFontSize = asNumber(raw['monoFontSize']);
  if (monoFontSize !== null) out.monoFontSize = clampMonoFontSize(monoFontSize);

  const tabWidth = asNumber(raw['codeTabWidth']);
  if (tabWidth !== null) out.codeTabWidth = clampTabWidth(tabWidth);

  const ligatures = raw['codeLigatures'];
  if (typeof ligatures === 'boolean') out.codeLigatures = ligatures;

  const accent = raw['accent'];
  if (isOneOf(accent, ACCENTS)) out.accent = accent;

  const graphPalette = raw['graphPalette'];
  if (isOneOf(graphPalette, GRAPH_PALETTES)) out.graphPalette = graphPalette;

  const animations = raw['animations'];
  if (typeof animations === 'boolean') out.animations = animations;

  const colorPalette = raw['colorPalette'];
  if (typeof colorPalette === 'string' && colorPalette.length > 0) {
    out.colorPalette = colorPalette;
  }

  const inspectorPlacement = raw['inspectorPlacement'];
  if (isOneOf(inspectorPlacement, INSPECTOR_PLACEMENTS)) {
    out.inspectorPlacement = inspectorPlacement;
  }

  const sidebarSide = raw['sidebarSide'];
  if (isOneOf(sidebarSide, SIDEBAR_SIDES)) out.sidebarSide = sidebarSide;

  const showToolbar = raw['showToolbar'];
  if (typeof showToolbar === 'boolean') out.showToolbar = showToolbar;

  const showStatusBar = raw['showStatusBar'];
  if (typeof showStatusBar === 'boolean') out.showStatusBar = showStatusBar;

  const showGraph = raw['showGraph'];
  if (typeof showGraph === 'boolean') out.showGraph = showGraph;

  const zenMode = raw['zenMode'];
  if (typeof zenMode === 'boolean') out.zenMode = zenMode;

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

export function clampUiFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.uiFontSize;
  return Math.min(MAX_UI_FONT_SIZE, Math.max(MIN_UI_FONT_SIZE, Math.round(value)));
}

export function clampMonoFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.monoFontSize;
  return Math.min(MAX_MONO_FONT_SIZE, Math.max(MIN_MONO_FONT_SIZE, Math.round(value)));
}

export function clampTabWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.codeTabWidth;
  return Math.min(8, Math.max(1, Math.round(value)));
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
