import { describe, expect, it } from 'vitest';
import {
  paletteHint,
  paletteScore,
  parsePaletteQuery,
  prefixForMode,
  pushRecent,
  rankPaletteItems,
} from './palette-modes';

describe('parsePaletteQuery', () => {
  it('defaults to the command list', () => {
    expect(parsePaletteQuery('')).toEqual({ mode: 'commands', term: '' });
    expect(parsePaletteQuery('  push ')).toEqual({
      mode: 'commands',
      term: 'push',
    });
  });

  it('maps every prefix to its mode and strips it', () => {
    expect(parsePaletteQuery('>main')).toEqual({
      mode: 'branches',
      term: 'main',
    });
    expect(parsePaletteQuery('@ src/app')).toEqual({
      mode: 'files',
      term: 'src/app',
    });
    expect(parsePaletteQuery('#a1b2')).toEqual({
      mode: 'commits',
      term: 'a1b2',
    });
    expect(parsePaletteQuery(':git')).toEqual({ mode: 'settings', term: 'git' });
  });

  it('treats a bare prefix as an empty term', () => {
    expect(parsePaletteQuery('>')).toEqual({ mode: 'branches', term: '' });
  });

  it('round-trips prefixForMode', () => {
    for (const raw of ['>x', '@x', '#x', ':x']) {
      const parsed = parsePaletteQuery(raw);
      expect(prefixForMode(parsed.mode)).toBe(raw.charAt(0));
    }
    expect(prefixForMode('commands')).toBe('');
  });

  it('has a hint for every mode', () => {
    for (const mode of [
      'commands',
      'branches',
      'files',
      'commits',
      'settings',
    ] as const) {
      expect(paletteHint(mode).length).toBeGreaterThan(0);
    }
  });
});

describe('paletteScore', () => {
  it('keeps non-matches out', () => {
    expect(paletteScore('zzz', 'Fetch')).toBe(Number.NEGATIVE_INFINITY);
  });

  it('boosts recents and prefers the more recent one', () => {
    const cold = paletteScore('', 'Push');
    const older = paletteScore('', 'Push', 3);
    const newer = paletteScore('', 'Push', 0);
    expect(newer).toBeGreaterThan(older);
    expect(older).toBeGreaterThan(cold);
  });

  it('never resurrects a non-match through recency', () => {
    expect(paletteScore('zzz', 'Push', 0)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('rankPaletteItems', () => {
  const items = [
    { id: 'fetch', label: 'Fetch' },
    { id: 'push', label: 'Push' },
    { id: 'pull', label: 'Pull' },
  ];
  const getText = (i: { label: string }): string => i.label;
  const getId = (i: { id: string }): string => i.id;

  it('keeps the declared order when nothing is typed', () => {
    expect(rankPaletteItems(items, '', { getText })).toEqual(items);
  });

  it('filters and ranks by match quality', () => {
    const result = rankPaletteItems(items, 'pu', { getText });
    expect(result.map(getId)).toEqual(['push', 'pull']);
  });

  it('floats recents to the top of an unfiltered list', () => {
    const result = rankPaletteItems(items, '', {
      getText,
      getId,
      recents: ['pull'],
    });
    expect(result[0]?.id).toBe('pull');
  });

  it('honours the limit', () => {
    expect(rankPaletteItems(items, '', { getText, limit: 2 })).toHaveLength(2);
  });
});

describe('pushRecent', () => {
  it('moves the id to the front without duplicating it', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a'], 'a')).toEqual(['a']);
  });

  it('caps the list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
