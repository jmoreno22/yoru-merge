/**
 * Line selection inside a diff.
 *
 * A selection never spans two hunks: the patch that stages it is built with
 * `buildLinePatch(fileDiff, hunkIndex, selectedLineIndexes, mode)`, which
 * rewrites exactly one hunk. Clicking into another hunk therefore starts a new
 * selection instead of silently widening the old one.
 */

export interface LineTarget {
  readonly fileIndex: number;
  readonly hunkIndex: number;
  /** Position in the hunk body, as `buildLinePatch` counts it. */
  readonly bodyIndex: number;
}

export interface LineSelection {
  readonly fileIndex: number;
  readonly hunkIndex: number;
  /** Where a Shift-click measures from. */
  readonly anchor: number;
  /** Selected body positions, ascending. */
  readonly indexes: readonly number[];
}

export type SelectMode = 'replace' | 'toggle' | 'range';

/** Modifier keys of a click, mapped to the selection gesture they mean. */
export function selectModeFor(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): SelectMode {
  if (event.shiftKey) return 'range';
  if (event.ctrlKey || event.metaKey) return 'toggle';
  return 'replace';
}

function sameHunk(selection: LineSelection, target: LineTarget): boolean {
  return (
    selection.fileIndex === target.fileIndex && selection.hunkIndex === target.hunkIndex
  );
}

/**
 * Applies a click to the current selection.
 *
 * `selectable` is the ascending list of body positions the user may pick in
 * that hunk — the added and removed lines. Clicking anything else (a context
 * line, a collapsed gap) leaves the selection untouched.
 */
export function selectLine(
  current: LineSelection | null,
  target: LineTarget,
  mode: SelectMode,
  selectable: readonly number[],
): LineSelection | null {
  if (!selectable.includes(target.bodyIndex)) return current;

  const fresh: LineSelection = {
    fileIndex: target.fileIndex,
    hunkIndex: target.hunkIndex,
    anchor: target.bodyIndex,
    indexes: [target.bodyIndex],
  };

  if (current === null || !sameHunk(current, target)) return fresh;

  if (mode === 'range') {
    const from = Math.min(current.anchor, target.bodyIndex);
    const to = Math.max(current.anchor, target.bodyIndex);
    return {
      ...current,
      indexes: selectable.filter((index) => index >= from && index <= to),
    };
  }

  if (mode === 'toggle') {
    const has = current.indexes.includes(target.bodyIndex);
    const indexes = has
      ? current.indexes.filter((index) => index !== target.bodyIndex)
      : [...current.indexes, target.bodyIndex].sort((a, b) => a - b);
    if (indexes.length === 0) return null;
    return { ...current, anchor: target.bodyIndex, indexes };
  }

  // A plain click on the only selected line clears the selection, so the same
  // gesture that starts one also ends it.
  if (current.indexes.length === 1 && current.indexes[0] === target.bodyIndex) {
    return null;
  }
  return fresh;
}

/** True when `line` belongs to the current selection. */
export function isSelected(
  selection: LineSelection | null,
  target: LineTarget,
): boolean {
  return (
    selection !== null &&
    sameHunk(selection, target) &&
    selection.indexes.includes(target.bodyIndex)
  );
}
