import type { SectionId } from './changes-tree';

/**
 * Multi-selection across one section at a time.
 *
 * Selecting in a different section replaces the selection rather than merging
 * the two: a bulk action reads "stage 4 files" or "unstage 4 files", never
 * both at once.
 */
export interface SelectionState {
  readonly section: SectionId | null;
  readonly paths: readonly string[];
  /** Where a Shift range starts. */
  readonly anchor: string | null;
  /** The row the keyboard is on; also the row a context menu acts upon. */
  readonly active: string | null;
}

export interface ClickModifiers {
  readonly ctrl: boolean;
  readonly shift: boolean;
}

export const EMPTY_SELECTION: SelectionState = {
  section: null,
  paths: [],
  anchor: null,
  active: null,
};

/**
 * Click / arrow-key selection.
 *
 * `visible` is the file order currently on screen (folders excluded), so a
 * Shift range never picks up rows hidden by the filter or by a closed folder.
 */
export function selectRow(
  state: SelectionState,
  section: SectionId,
  path: string,
  visible: readonly string[],
  modifiers: ClickModifiers,
): SelectionState {
  const sameSection = state.section === section;

  if (modifiers.shift && sameSection && state.anchor !== null) {
    const from = visible.indexOf(state.anchor);
    const to = visible.indexOf(path);
    if (from >= 0 && to >= 0) {
      const [start, end] = from <= to ? [from, to] : [to, from];
      return {
        section,
        paths: visible.slice(start, end + 1),
        anchor: state.anchor,
        active: path,
      };
    }
  }

  if (modifiers.ctrl && sameSection) {
    const has = state.paths.includes(path);
    const paths = has ? state.paths.filter((p) => p !== path) : [...state.paths, path];
    return { section, paths, anchor: path, active: path };
  }

  return { section, paths: [path], anchor: path, active: path };
}

/** `Ctrl+A` inside a section. */
export function selectAllIn(
  section: SectionId,
  visible: readonly string[],
): SelectionState {
  const first = visible[0] ?? null;
  return {
    section,
    paths: [...visible],
    anchor: first,
    active: visible[visible.length - 1] ?? first,
  };
}

/** Moves the keyboard cursor without touching the selection. */
export function setActive(
  state: SelectionState,
  section: SectionId,
  path: string,
): SelectionState {
  return state.section === section
    ? { ...state, active: path }
    : { ...EMPTY_SELECTION, section, active: path };
}

/** Drops rows that no longer exist (staged, discarded, filtered out). */
export function pruneSelection(
  state: SelectionState,
  visible: readonly string[],
): SelectionState {
  const alive = new Set(visible);
  const paths = state.paths.filter((path) => alive.has(path));
  if (paths.length === state.paths.length) return state;
  return {
    section: paths.length > 0 ? state.section : null,
    paths,
    anchor: state.anchor !== null && alive.has(state.anchor) ? state.anchor : null,
    active: state.active !== null && alive.has(state.active) ? state.active : null,
  };
}

/**
 * Index of the row `delta` steps away from `current`, clamped to the list.
 * Returns `-1` for an empty list; a missing `current` starts at either end.
 */
export function nextIndex(
  rows: readonly string[],
  current: string | null,
  delta: number,
): number {
  if (rows.length === 0) return -1;
  const from = current === null ? -1 : rows.indexOf(current);
  if (from < 0) return delta > 0 ? 0 : rows.length - 1;
  return Math.min(rows.length - 1, Math.max(0, from + delta));
}

/** Paths a bulk action should run on: the selection, or the row under it. */
export function actionTargets(
  state: SelectionState,
  section: SectionId,
  path: string,
): string[] {
  if (state.section === section && state.paths.includes(path)) {
    return [...state.paths];
  }
  return [path];
}
