import { describe, expect, it } from 'vitest';
import { isRailItemActive, RAIL_ITEMS } from './rail-views';

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
