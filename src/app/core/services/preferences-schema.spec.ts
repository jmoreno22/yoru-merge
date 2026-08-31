import { describe, expect, it } from 'vitest';
import {
  clampContextLines,
  clampMinutes,
  clampPercent,
  DEFAULT_PREFERENCES,
  migratePreferences,
  sanitizePreferences,
  sanitizeSections,
} from './preferences-schema';

describe('sanitizePreferences', () => {
  it('keeps values that match the schema', () => {
    expect(
      sanitizePreferences({
        workspaceTabs: ['C:/a', '/home/b'],
        activeTabPath: '/home/b',
        sidebarWidth: 22,
        diffViewMode: 'split',
        pullMode: 'rebase',
        confirmDangerous: false,
        commitsColumns: ['message', 'date'],
      }),
    ).toEqual({
      workspaceTabs: ['C:/a', '/home/b'],
      activeTabPath: '/home/b',
      sidebarWidth: 22,
      diffViewMode: 'split',
      pullMode: 'rebase',
      confirmDangerous: false,
      commitsColumns: ['message', 'date'],
    });
  });

  it('drops keys whose type is wrong so the default applies', () => {
    expect(
      sanitizePreferences({
        workspaceTabs: 'C:/a',
        activeTabPath: 42,
        diffWordWrap: 'yes',
        refsPanelOpen: 1,
      }),
    ).toEqual({});
  });

  it('rejects an array that is not all strings', () => {
    expect(sanitizePreferences({ workspaceTabs: ['a', 3] })).toEqual({});
  });

  it('rejects values outside the enum', () => {
    expect(
      sanitizePreferences({
        diffViewMode: 'inline',
        uiDensity: 'cosy',
        pullMode: 'squash',
        railView: 'nope',
      }),
    ).toEqual({});
  });

  it('drops percentages that look like legacy pixel values', () => {
    expect(sanitizePreferences({ sidebarWidth: 230 })).toEqual({});
    expect(sanitizePreferences({ workbenchSplit: 0 })).toEqual({});
  });

  it('drops an empty column list rather than hiding every column', () => {
    expect(sanitizePreferences({ commitsColumns: [] })).toEqual({});
  });

  it('clamps numbers it does keep', () => {
    expect(sanitizePreferences({ diffContextLines: 999 })).toEqual({
      diffContextLines: 20,
    });
    expect(sanitizePreferences({ autoFetchMinutes: -5 })).toEqual({
      autoFetchMinutes: 0,
    });
  });

  it('ignores unknown keys', () => {
    expect(sanitizePreferences({ somethingElse: true })).toEqual({});
  });

  it('drops leftColumnSplit, which no layout reads any more', () => {
    expect(sanitizePreferences({ leftColumnSplit: 58 })).toEqual({});
    expect(DEFAULT_PREFERENCES).not.toHaveProperty('leftColumnSplit');
  });

  it('survives an empty store', () => {
    expect(sanitizePreferences({})).toEqual({});
  });
});

describe('migratePreferences', () => {
  it('passes a version-0 payload through unchanged', () => {
    const stored = { sidebarWidth: 20 };
    expect(migratePreferences(stored, 0)).toEqual(stored);
  });
});

describe('clamps', () => {
  it('bounds percentages to the usable range', () => {
    expect(clampPercent(1)).toBe(5);
    expect(clampPercent(95)).toBe(80);
    expect(clampPercent(Number.NaN)).toBe(5);
  });

  it('bounds context lines and rounds them', () => {
    expect(clampContextLines(3.4)).toBe(3);
    expect(clampContextLines(-1)).toBe(0);
    expect(clampContextLines(Number.NaN)).toBe(DEFAULT_PREFERENCES.diffContextLines);
  });

  it('bounds the auto-fetch interval', () => {
    expect(clampMinutes(10)).toBe(10);
    expect(clampMinutes(1000)).toBe(180);
    expect(clampMinutes(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('sanitizeSections', () => {
  it('keeps boolean entries only', () => {
    expect(sanitizeSections({ local: true, tags: 'no' })).toEqual({
      local: true,
    });
  });

  it('rejects non-objects', () => {
    expect(sanitizeSections(['local'])).toEqual({});
    expect(sanitizeSections(null)).toEqual({});
    expect(sanitizeSections('local')).toEqual({});
  });
});
