import { describe, expect, it } from 'vitest';
import {
  applySelection,
  type CommitSelection,
  EMPTY_SELECTION,
  pruneSelection,
} from './commit-selection';

const ORDER = ['a', 'b', 'c', 'd', 'e'];

describe('applySelection', () => {
  it('replaces the selection on a plain click and anchors there', () => {
    const next = applySelection(EMPTY_SELECTION, ORDER, 'c', 'replace');
    expect(next).toEqual({ anchor: 'c', shas: ['c'] });
  });

  it('adds to the selection on toggle, keeping row order', () => {
    const first = applySelection(EMPTY_SELECTION, ORDER, 'd', 'replace');
    const next = applySelection(first, ORDER, 'b', 'toggle');
    expect(next.shas).toEqual(['b', 'd']);
  });

  it('removes an already selected row on toggle', () => {
    const first: CommitSelection = { anchor: 'b', shas: ['b', 'd'] };
    const next = applySelection(first, ORDER, 'b', 'toggle');
    expect(next.shas).toEqual(['d']);
  });

  it('extends from the anchor down', () => {
    const first = applySelection(EMPTY_SELECTION, ORDER, 'b', 'replace');
    const next = applySelection(first, ORDER, 'd', 'extend');
    expect(next.shas).toEqual(['b', 'c', 'd']);
    expect(next.anchor).toBe('b');
  });

  it('extends from the anchor up', () => {
    const first = applySelection(EMPTY_SELECTION, ORDER, 'd', 'replace');
    const next = applySelection(first, ORDER, 'b', 'extend');
    expect(next.shas).toEqual(['b', 'c', 'd']);
  });

  it('keeps the anchor so a range can shrink again', () => {
    const first = applySelection(EMPTY_SELECTION, ORDER, 'b', 'replace');
    const grown = applySelection(first, ORDER, 'e', 'extend');
    const shrunk = applySelection(grown, ORDER, 'c', 'extend');
    expect(shrunk.shas).toEqual(['b', 'c']);
  });

  it('falls back to a single row when there is no anchor', () => {
    const next = applySelection(EMPTY_SELECTION, ORDER, 'c', 'extend');
    expect(next).toEqual({ anchor: 'c', shas: ['c'] });
  });

  it('falls back to a single row when the clicked sha left the list', () => {
    const first: CommitSelection = { anchor: 'a', shas: ['a'] };
    const next = applySelection(first, ORDER, 'zz', 'extend');
    expect(next).toEqual({ anchor: 'zz', shas: ['zz'] });
  });
});

describe('pruneSelection', () => {
  it('drops shas that are no longer on screen', () => {
    const current: CommitSelection = { anchor: 'b', shas: ['b', 'zz'] };
    expect(pruneSelection(current, ORDER)).toEqual({ anchor: 'b', shas: ['b'] });
  });

  it('clears an anchor that left the list', () => {
    const current: CommitSelection = { anchor: 'zz', shas: ['b'] };
    expect(pruneSelection(current, ORDER).anchor).toBeNull();
  });

  it('returns the same object when nothing changed', () => {
    const current: CommitSelection = { anchor: 'b', shas: ['b', 'c'] };
    expect(pruneSelection(current, ORDER)).toBe(current);
  });
});
