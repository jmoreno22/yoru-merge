import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch, fuzzyScore } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches a subsequence and reports the indices', () => {
    expect(fuzzyMatch('fb', 'feature/branch')).toMatchObject({
      indices: [0, 8],
    });
  });

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyMatch('zz', 'feature/branch')).toBeNull();
  });

  it('matches everything with an empty query', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('MAIN', 'main')).not.toBeNull();
  });

  it('scores consecutive runs above scattered matches', () => {
    expect(fuzzyScore('mai', 'main')).toBeGreaterThan(fuzzyScore('mai', 'm-a-i-n'));
  });

  it('scores word starts above mid-word matches', () => {
    expect(fuzzyScore('fb', 'feat/bar')).toBeGreaterThan(fuzzyScore('fb', 'fabulous'));
  });

  it('prefers the shorter of two equally good targets', () => {
    expect(fuzzyScore('rel', 'release')).toBeGreaterThan(
      fuzzyScore('rel', 'release-candidate-branch'),
    );
  });
});

describe('fuzzyFilter', () => {
  const branches = ['main', 'feat/auth', 'feat/api', 'fix/auth-crash'];

  it('keeps only the matches, best first', () => {
    expect(fuzzyFilter(branches, 'auth', (b) => b)).toEqual([
      'feat/auth',
      'fix/auth-crash',
    ]);
  });

  it('returns a copy of the input for an empty query', () => {
    const all = fuzzyFilter(branches, '  ', (b) => b);
    expect(all).toEqual(branches);
    expect(all).not.toBe(branches);
  });
});
