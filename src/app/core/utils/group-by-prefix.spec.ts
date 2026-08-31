import { describe, expect, it } from 'vitest';
import { groupByPrefix } from './group-by-prefix';

const identity = (value: string): string => value;

describe('groupByPrefix', () => {
  it('groups by the segment before the first delimiter', () => {
    const { folders } = groupByPrefix(['feat/auth', 'feat/api'], identity);
    expect(folders.get('feat')).toEqual(['feat/auth', 'feat/api']);
  });

  it('caps the nesting at one folder level', () => {
    const { folders } = groupByPrefix(['feat/auth/login'], identity);
    expect([...folders.keys()]).toEqual(['feat']);
  });

  it('keeps keys without a delimiter flat', () => {
    const { flat } = groupByPrefix(['main', 'develop'], identity);
    expect(flat).toEqual(['main', 'develop']);
  });

  it('treats a trailing delimiter as flat', () => {
    const { folders, flat } = groupByPrefix(['feat/'], identity);
    expect(folders.size).toBe(0);
    expect(flat).toEqual(['feat/']);
  });

  it('honours a custom delimiter', () => {
    const { folders } = groupByPrefix(['a.b', 'a.c'], identity, '.');
    expect(folders.get('a')).toEqual(['a.b', 'a.c']);
  });
});
