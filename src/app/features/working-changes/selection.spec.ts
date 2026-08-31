import { describe, expect, it } from 'vitest';
import {
  actionTargets,
  EMPTY_SELECTION,
  nextIndex,
  pruneSelection,
  type SelectionState,
  selectAllIn,
  selectRow,
  setActive,
} from './selection';

const VISIBLE = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
const NO_MODS = { ctrl: false, shift: false };

describe('selectRow', () => {
  it('replaces the selection on a plain click', () => {
    const state = selectRow(
      { section: 'changes', paths: ['a.ts', 'b.ts'], anchor: 'a.ts', active: 'b.ts' },
      'changes',
      'd.ts',
      VISIBLE,
      NO_MODS,
    );
    expect(state).toEqual({
      section: 'changes',
      paths: ['d.ts'],
      anchor: 'd.ts',
      active: 'd.ts',
    });
  });

  it('adds with Ctrl and removes an already selected row', () => {
    const added = selectRow(EMPTY_SELECTION, 'changes', 'a.ts', VISIBLE, {
      ctrl: true,
      shift: false,
    });
    expect(added.paths).toEqual(['a.ts']);

    const withB = selectRow(added, 'changes', 'b.ts', VISIBLE, {
      ctrl: true,
      shift: false,
    });
    expect(withB.paths).toEqual(['a.ts', 'b.ts']);

    const removed = selectRow(withB, 'changes', 'a.ts', VISIBLE, {
      ctrl: true,
      shift: false,
    });
    expect(removed.paths).toEqual(['b.ts']);
  });

  it('selects the visible range with Shift, in either direction', () => {
    const anchored = selectRow(EMPTY_SELECTION, 'changes', 'c.ts', VISIBLE, NO_MODS);
    const forward = selectRow(anchored, 'changes', 'd.ts', VISIBLE, {
      ctrl: false,
      shift: true,
    });
    expect(forward.paths).toEqual(['c.ts', 'd.ts']);

    const backward = selectRow(anchored, 'changes', 'a.ts', VISIBLE, {
      ctrl: false,
      shift: true,
    });
    expect(backward.paths).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(backward.anchor).toBe('c.ts');
  });

  it('keeps the anchor so a second Shift click re-ranges from it', () => {
    const anchored = selectRow(EMPTY_SELECTION, 'changes', 'b.ts', VISIBLE, NO_MODS);
    const first = selectRow(anchored, 'changes', 'd.ts', VISIBLE, {
      ctrl: false,
      shift: true,
    });
    const second = selectRow(first, 'changes', 'c.ts', VISIBLE, {
      ctrl: false,
      shift: true,
    });
    expect(second.paths).toEqual(['b.ts', 'c.ts']);
  });

  it('never spans two sections', () => {
    const staged = selectRow(EMPTY_SELECTION, 'staged', 'a.ts', VISIBLE, NO_MODS);
    const jumped = selectRow(staged, 'changes', 'b.ts', VISIBLE, {
      ctrl: true,
      shift: false,
    });
    expect(jumped).toEqual({
      section: 'changes',
      paths: ['b.ts'],
      anchor: 'b.ts',
      active: 'b.ts',
    });
  });

  it('falls back to a plain selection when the anchor is gone', () => {
    const stale: SelectionState = {
      section: 'changes',
      paths: [],
      anchor: 'zzz.ts',
      active: null,
    };
    const state = selectRow(stale, 'changes', 'b.ts', VISIBLE, {
      ctrl: false,
      shift: true,
    });
    expect(state.paths).toEqual(['b.ts']);
  });
});

describe('selectAllIn', () => {
  it('takes every visible row', () => {
    expect(selectAllIn('staged', VISIBLE)).toEqual({
      section: 'staged',
      paths: VISIBLE,
      anchor: 'a.ts',
      active: 'd.ts',
    });
  });

  it('stays empty for an empty section', () => {
    expect(selectAllIn('staged', []).paths).toEqual([]);
  });
});

describe('setActive', () => {
  it('moves the cursor without touching the selection', () => {
    const state = selectAllIn('changes', VISIBLE);
    expect(setActive(state, 'changes', 'b.ts')).toMatchObject({
      paths: VISIBLE,
      active: 'b.ts',
    });
  });

  it('resets when the cursor enters another section', () => {
    const state = selectAllIn('changes', VISIBLE);
    expect(setActive(state, 'staged', 'x.ts')).toEqual({
      section: 'staged',
      paths: [],
      anchor: null,
      active: 'x.ts',
    });
  });
});

describe('pruneSelection', () => {
  it('drops rows that disappeared and clears a dangling anchor', () => {
    const state = selectAllIn('changes', VISIBLE);
    expect(pruneSelection(state, ['b.ts'])).toEqual({
      section: 'changes',
      paths: ['b.ts'],
      anchor: null,
      active: null,
    });
  });

  it('returns the same object when nothing changed', () => {
    const state = selectAllIn('changes', VISIBLE);
    expect(pruneSelection(state, VISIBLE)).toBe(state);
  });
});

describe('nextIndex', () => {
  it('clamps at both ends', () => {
    expect(nextIndex(VISIBLE, 'a.ts', -1)).toBe(0);
    expect(nextIndex(VISIBLE, 'd.ts', 1)).toBe(3);
  });

  it('starts from the matching end when nothing is active', () => {
    expect(nextIndex(VISIBLE, null, 1)).toBe(0);
    expect(nextIndex(VISIBLE, null, -1)).toBe(3);
  });

  it('returns -1 for an empty list', () => {
    expect(nextIndex([], null, 1)).toBe(-1);
  });
});

describe('actionTargets', () => {
  it('acts on the whole selection when the row is part of it', () => {
    const state = selectAllIn('changes', VISIBLE);
    expect(actionTargets(state, 'changes', 'b.ts')).toEqual(VISIBLE);
  });

  it('acts on the row alone when it is outside the selection', () => {
    const state = selectRow(EMPTY_SELECTION, 'changes', 'a.ts', VISIBLE, NO_MODS);
    expect(actionTargets(state, 'changes', 'c.ts')).toEqual(['c.ts']);
  });

  it('ignores a selection that belongs to another section', () => {
    const state = selectAllIn('staged', VISIBLE);
    expect(actionTargets(state, 'changes', 'a.ts')).toEqual(['a.ts']);
  });
});
