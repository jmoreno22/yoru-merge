import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../../core/services/preferences-schema';
import { COMMIT_COLUMNS, toggleColumn } from './commit-columns';

describe('COMMIT_COLUMNS', () => {
  it('offers only the columns the list can actually hide', () => {
    expect(COMMIT_COLUMNS.map((column) => column.id)).toEqual([
      'author',
      'date',
      'sha',
    ]);
  });

  it('every offered column is in the shipped default, so none starts hidden', () => {
    for (const column of COMMIT_COLUMNS) {
      expect(DEFAULT_PREFERENCES.commitsColumns).toContain(column.id);
    }
  });
});

describe('toggleColumn', () => {
  const all = ['graph', 'message', 'author', 'date', 'sha'];

  it('removes a visible column', () => {
    expect(toggleColumn(all, 'date')).toEqual(['graph', 'message', 'author', 'sha']);
  });

  it('adds a hidden column back in the canonical position', () => {
    expect(toggleColumn(['graph', 'message', 'sha'], 'author')).toEqual([
      'graph',
      'message',
      'author',
      'sha',
    ]);
  });

  it('keeps the required columns whatever is toggled', () => {
    expect(toggleColumn(all, 'message')).toContain('message');
    expect(toggleColumn(all, 'graph')).toContain('graph');
  });

  it('never returns an empty list, which the schema would reject', () => {
    let columns = [...all];
    for (const column of COMMIT_COLUMNS) {
      columns = toggleColumn(columns, column.id);
    }
    expect(columns.length).toBeGreaterThan(0);
  });

  it('preserves an id written by a newer version of the app', () => {
    expect(toggleColumn(['graph', 'message', 'refs'], 'date')).toEqual([
      'graph',
      'message',
      'date',
      'refs',
    ]);
  });

  it('round-trips: toggling twice returns the canonical order', () => {
    expect(toggleColumn(toggleColumn(all, 'sha'), 'sha')).toEqual(all);
  });
});
