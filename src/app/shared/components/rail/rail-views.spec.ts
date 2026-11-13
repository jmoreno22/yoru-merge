import { describe, expect, it } from 'vitest';
import { isRailItemActive, RAIL_ITEMS, railItemState } from './rail-views';

describe('RAIL_ITEMS', () => {
  it('has unique ids', () => {
    const ids = RAIL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every item a label and an icon', () => {
    for (const item of RAIL_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.startsWith('lucide')).toBe(true);
    }
  });

  it('covers the three centre views exactly once each', () => {
    const views = RAIL_ITEMS.filter((item) => item.section === null)
      .map((item) => item.view)
      .filter((view) => view !== null);
    expect(views.sort()).toEqual(['changes', 'history', 'reflog']);
  });

  it('keeps every section item on the history view', () => {
    for (const item of RAIL_ITEMS.filter((i) => i.section !== null)) {
      expect(item.view).toBe('history');
    }
  });
});

describe('railItemState', () => {
  const item = (id: string) => {
    const found = RAIL_ITEMS.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No rail item ${id}.`);
    return found;
  };

  // The whole point: the centre view and an open panel were drawn the same.
  it('tells the view on screen from a panel that is merely open', () => {
    expect(railItemState(item('history'), 'history', true)).toBe('view');
    expect(railItemState(item('refs'), 'history', true)).toBe('open');
  });

  it('always has exactly one view lit, whatever the panel does', () => {
    for (const view of ['changes', 'history', 'reflog'] as const) {
      for (const refsPanelOpen of [false, true]) {
        const lit = RAIL_ITEMS.filter(
          (candidate) => railItemState(candidate, view, refsPanelOpen) === 'view',
        );
        expect(lit.map((candidate) => candidate.id)).toEqual([view]);
      }
    }
  });

  it('leaves the refs toggle idle while the panel is closed', () => {
    expect(railItemState(item('refs'), 'changes', false)).toBe('idle');
  });
});

describe('isRailItemActive', () => {
  const byId = (id: string) => {
    const item = RAIL_ITEMS.find((i) => i.id === id);
    if (!item) throw new Error(`unknown rail item ${id}`);
    return item;
  };

  it('marks the item owning the current view', () => {
    expect(isRailItemActive(byId('history'), 'history', true)).toBe(true);
    expect(isRailItemActive(byId('changes'), 'history', true)).toBe(false);
    expect(isRailItemActive(byId('changes'), 'changes', false)).toBe(true);
    expect(isRailItemActive(byId('reflog'), 'reflog', false)).toBe(true);
  });

  it('follows the panel for the refs toggle', () => {
    expect(isRailItemActive(byId('refs'), 'history', true)).toBe(true);
    expect(isRailItemActive(byId('refs'), 'history', false)).toBe(false);
  });

  it('never marks a section shortcut, so history stays the only active view', () => {
    for (const id of ['remotes', 'tags', 'stashes']) {
      expect(isRailItemActive(byId(id), 'history', true)).toBe(false);
    }
  });
});
