import { describe, expect, it } from 'vitest';
import {
  commitSubject,
  formatConventionalCommit,
  parseConventionalCommit,
} from './conventional-commit';

describe('parseConventionalCommit', () => {
  it('parses type, scope and subject', () => {
    expect(parseConventionalCommit('feat(sidebar): add ref filter')).toEqual({
      type: 'feat',
      scope: 'sidebar',
      breaking: false,
      subject: 'add ref filter',
      body: '',
    });
  });

  it('parses a header without a scope', () => {
    expect(parseConventionalCommit('fix: crash on empty repo')?.scope).toBeNull();
  });

  it('flags a breaking change from the bang', () => {
    expect(parseConventionalCommit('feat!: drop node 18')?.breaking).toBe(true);
  });

  it('flags a breaking change from the footer', () => {
    const parsed = parseConventionalCommit(
      'feat: new api\n\nBREAKING CHANGE: the old one is gone',
    );
    expect(parsed?.breaking).toBe(true);
    expect(parsed?.body).toBe('BREAKING CHANGE: the old one is gone');
  });

  it('keeps the body verbatim and handles CRLF', () => {
    expect(parseConventionalCommit('fix: a\r\n\r\nline one\r\nline two')?.body).toBe(
      'line one\nline two',
    );
  });

  it('returns null for a plain message', () => {
    expect(parseConventionalCommit('just a message')).toBeNull();
    expect(parseConventionalCommit('WIP')).toBeNull();
  });
});

describe('formatConventionalCommit', () => {
  it('round-trips a parsed message', () => {
    const message = 'feat(core)!: split the facade\n\nWhy it matters.';
    const parsed = parseConventionalCommit(message);
    expect(parsed).not.toBeNull();
    if (parsed) expect(formatConventionalCommit(parsed)).toBe(message);
  });

  it('omits the scope and the body when absent', () => {
    expect(
      formatConventionalCommit({
        type: 'chore',
        scope: null,
        breaking: false,
        subject: 'bump deps',
        body: '',
      }),
    ).toBe('chore: bump deps');
  });
});

describe('commitSubject', () => {
  it('takes the first line only', () => {
    expect(commitSubject('subject\n\nbody')).toBe('subject');
  });

  it('handles CRLF', () => {
    expect(commitSubject('subject\r\nbody')).toBe('subject');
  });
});
