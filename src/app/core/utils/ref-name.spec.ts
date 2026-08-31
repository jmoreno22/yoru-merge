import { describe, expect, it } from 'vitest';
import { isRefNameSubmittable, validateRefName } from './ref-name';

describe('validateRefName', () => {
  it('accepts an ordinary branch name', () => {
    expect(validateRefName('feat/refs-panel')).toBeNull();
  });

  it('treats an empty value as not ready rather than wrong', () => {
    expect(validateRefName('')).toBeNull();
    expect(validateRefName('   ')).toBeNull();
  });

  it.each([
    ['feat branch', 'spaces'],
    ['feat~1', 'tilde'],
    ['feat^', 'caret'],
    ['feat:x', 'colon'],
    ['feat?', 'question mark'],
    ['feat*', 'asterisk'],
    ['feat[x', 'bracket'],
    ['feat\\x', 'backslash'],
    ['feat..x', 'double dot'],
    ['feat@{x', 'at-brace'],
    ['-feat', 'leading dash'],
    ['/feat', 'leading slash'],
    ['feat/', 'trailing slash'],
    ['feat//x', 'empty segment'],
    ['feat.', 'trailing dot'],
    ['feat.lock', 'lock suffix'],
    ['feat/.hidden', 'segment starting with a dot'],
  ])('rejects %s (%s)', (name) => {
    expect(validateRefName(name)).not.toBeNull();
  });

  it('reports a name that already exists', () => {
    expect(validateRefName('main', ['main', 'dev'])).toBe('main already exists.');
  });

  it('ignores surrounding whitespace when comparing against taken names', () => {
    expect(validateRefName('  main  ', ['main'])).toBe('main already exists.');
  });

  it('allows a unicode branch name', () => {
    expect(validateRefName('feat/señal-ñ')).toBeNull();
  });
});

describe('isRefNameSubmittable', () => {
  it('is false while the field is empty', () => {
    expect(isRefNameSubmittable('')).toBe(false);
  });

  it('is false for an invalid name', () => {
    expect(isRefNameSubmittable('feat branch')).toBe(false);
  });

  it('is true for a valid, unused name', () => {
    expect(isRefNameSubmittable('feat/x', ['main'])).toBe(true);
  });
});
