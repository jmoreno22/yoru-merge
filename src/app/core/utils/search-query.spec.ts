import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './search-query';

describe('parseSearchQuery', () => {
  it('leaves a query without the token alone', () => {
    expect(parseSearchQuery('fix palette')).toEqual({
      text: 'fix palette',
      path: null,
    });
  });

  it('trims a query without the token', () => {
    expect(parseSearchQuery('  fix  ')).toEqual({ text: 'fix', path: null });
  });

  it('takes the token from the end', () => {
    expect(parseSearchQuery('fix palette path:src/app')).toEqual({
      text: 'fix palette',
      path: 'src/app',
    });
  });

  it('takes the token from the start', () => {
    expect(parseSearchQuery('path:src/app fix palette')).toEqual({
      text: 'fix palette',
      path: 'src/app',
    });
  });

  it('takes the token from the middle without gluing the words together', () => {
    expect(parseSearchQuery('fix path:src/app palette')).toEqual({
      text: 'fix palette',
      path: 'src/app',
    });
  });

  it('accepts a query that is only the token', () => {
    expect(parseSearchQuery('path:src/app')).toEqual({
      text: '',
      path: 'src/app',
    });
  });

  it('ignores an empty token', () => {
    expect(parseSearchQuery('path:')).toEqual({ text: '', path: null });
    expect(parseSearchQuery('fix path: palette')).toEqual({
      text: 'fix palette',
      path: null,
    });
  });

  it('reads a quoted path with spaces', () => {
    expect(parseSearchQuery('fix path:"my docs/notes.md" now')).toEqual({
      text: 'fix now',
      path: 'my docs/notes.md',
    });
  });

  it('only honours the first token', () => {
    expect(parseSearchQuery('path:a path:b')).toEqual({
      text: 'path:b',
      path: 'a',
    });
  });

  it('does not mistake a word ending in path: for the token', () => {
    expect(parseSearchQuery('filepath:src')).toEqual({
      text: 'filepath:src',
      path: null,
    });
  });
});
