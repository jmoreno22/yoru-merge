import { describe, expect, it } from 'vitest';
import {
  isSelected,
  type LineSelection,
  selectLine,
  selectModeFor,
} from './line-selection';

const SELECTABLE = [1, 2, 5, 6, 7];

const target = (bodyIndex: number, hunkIndex = 0, fileIndex = 0) => ({
  fileIndex,
  hunkIndex,
  bodyIndex,
});

describe('selectModeFor', () => {
  it('reads the gesture from the modifier keys', () => {
    const base = { shiftKey: false, ctrlKey: false, metaKey: false };
    expect(selectModeFor(base)).toBe('replace');
    expect(selectModeFor({ ...base, shiftKey: true })).toBe('range');
    expect(selectModeFor({ ...base, ctrlKey: true })).toBe('toggle');
    expect(selectModeFor({ ...base, metaKey: true })).toBe('toggle');
    expect(selectModeFor({ ...base, shiftKey: true, ctrlKey: true })).toBe('range');
  });
});

describe('selectLine', () => {
  it('starts a selection on a changed line', () => {
    const out = selectLine(null, target(5), 'replace', SELECTABLE);
    expect(out).toEqual({ fileIndex: 0, hunkIndex: 0, anchor: 5, indexes: [5] });
  });

  it('ignores a click on a line that cannot be staged', () => {
    const current = selectLine(null, target(5), 'replace', SELECTABLE);
    expect(selectLine(current, target(3), 'replace', SELECTABLE)).toBe(current);
    expect(selectLine(null, target(3), 'replace', SELECTABLE)).toBeNull();
  });

  it('extends from the anchor with a range gesture', () => {
    const first = selectLine(null, target(2), 'replace', SELECTABLE);
    const out = selectLine(first, target(6), 'range', SELECTABLE);
    expect(out?.indexes).toEqual([2, 5, 6]);
    expect(out?.anchor).toBe(2);
  });

  it('extends backwards too', () => {
    const first = selectLine(null, target(6), 'replace', SELECTABLE);
    expect(selectLine(first, target(1), 'range', SELECTABLE)?.indexes).toEqual([
      1, 2, 5, 6,
    ]);
  });

  it('adds and removes with a toggle gesture', () => {
    let selection = selectLine(null, target(1), 'replace', SELECTABLE);
    selection = selectLine(selection, target(7), 'toggle', SELECTABLE);
    expect(selection?.indexes).toEqual([1, 7]);
    selection = selectLine(selection, target(1), 'toggle', SELECTABLE);
    expect(selection?.indexes).toEqual([7]);
  });

  it('clears the selection when the last line is toggled off', () => {
    const selection = selectLine(null, target(1), 'replace', SELECTABLE);
    expect(selectLine(selection, target(1), 'toggle', SELECTABLE)).toBeNull();
  });

  it('clears the selection when the only selected line is clicked again', () => {
    const selection = selectLine(null, target(1), 'replace', SELECTABLE);
    expect(selectLine(selection, target(1), 'replace', SELECTABLE)).toBeNull();
  });

  it('restarts when the click lands in another hunk', () => {
    const first = selectLine(null, target(1), 'replace', SELECTABLE);
    const out = selectLine(first, target(2, 1), 'range', SELECTABLE);
    expect(out).toEqual({ fileIndex: 0, hunkIndex: 1, anchor: 2, indexes: [2] });
  });

  it('restarts when the click lands in another file', () => {
    const first = selectLine(null, target(1), 'replace', SELECTABLE);
    const out = selectLine(first, target(1, 0, 3), 'toggle', SELECTABLE);
    expect(out?.fileIndex).toBe(3);
    expect(out?.indexes).toEqual([1]);
  });
});

describe('isSelected', () => {
  const selection: LineSelection = {
    fileIndex: 0,
    hunkIndex: 1,
    anchor: 2,
    indexes: [2, 5],
  };

  it('only matches inside the selected hunk', () => {
    expect(isSelected(selection, target(5, 1))).toBe(true);
    expect(isSelected(selection, target(5, 0))).toBe(false);
    expect(isSelected(selection, target(5, 1, 2))).toBe(false);
    expect(isSelected(selection, target(4, 1))).toBe(false);
    expect(isSelected(null, target(5, 1))).toBe(false);
  });
});
