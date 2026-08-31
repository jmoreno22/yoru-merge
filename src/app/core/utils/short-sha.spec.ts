import { describe, expect, it } from 'vitest';
import { isFullSha, shortSha } from './short-sha';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('shortSha', () => {
  it('abbreviates to seven characters by default', () => {
    expect(shortSha(SHA)).toBe('a1b2c3d');
  });

  it('honours a custom length', () => {
    expect(shortSha(SHA, 12)).toBe('a1b2c3d4e5f6');
  });

  it('leaves ref names untouched', () => {
    expect(shortSha('main')).toBe('main');
    expect(shortSha('origin/feature')).toBe('origin/feature');
  });

  it('leaves already-short shas untouched', () => {
    expect(shortSha('a1b2c3')).toBe('a1b2c3');
  });
});

describe('isFullSha', () => {
  it('accepts 40-character object ids', () => {
    expect(isFullSha(SHA)).toBe(true);
  });

  it('rejects abbreviations and ref names', () => {
    expect(isFullSha('a1b2c3d')).toBe(false);
    expect(isFullSha('main')).toBe(false);
  });
});
