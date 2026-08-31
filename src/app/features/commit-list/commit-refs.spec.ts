import { describe, expect, it } from 'vitest';
import type { RefInfo } from '../../core/models';
import { describeRef, isHeadCommit, MAX_REF_PILLS, splitRefs } from './commit-refs';

const ref = (name: string, ref_type: RefInfo['ref_type']): RefInfo => ({
  name,
  ref_type,
});

describe('splitRefs', () => {
  it('orders HEAD, branches, remotes and tags in that sequence', () => {
    const { shown } = splitRefs(
      [ref('v1.0.0', 'tag'), ref('origin/main', 'remote'), ref('main', 'head')],
      3,
    );
    expect(shown.map((r) => r.ref_type)).toEqual(['head', 'remote', 'tag']);
  });

  it('drops the branch that duplicates the HEAD pill', () => {
    const { shown } = splitRefs([ref('main', 'head'), ref('main', 'branch')]);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.ref_type).toBe('head');
  });

  it('keeps a branch whose name differs from HEAD', () => {
    const { shown } = splitRefs([ref('main', 'head'), ref('release', 'branch')]);
    expect(shown.map((r) => r.name)).toEqual(['main', 'release']);
  });

  it('sorts refs of the same type by name', () => {
    const { shown } = splitRefs([ref('zeta', 'branch'), ref('alpha', 'branch')]);
    expect(shown.map((r) => r.name)).toEqual(['alpha', 'zeta']);
  });

  it('moves everything past the limit into the overflow bucket', () => {
    const refs = ['a', 'b', 'c', 'd', 'e'].map((n) => ref(n, 'branch'));
    const { shown, hidden } = splitRefs(refs, 3);
    expect(shown).toHaveLength(3);
    expect(hidden.map((r) => r.name)).toEqual(['d', 'e']);
  });

  it('defaults the limit to MAX_REF_PILLS', () => {
    const refs = ['a', 'b', 'c', 'd'].map((n) => ref(n, 'branch'));
    expect(splitRefs(refs).shown).toHaveLength(MAX_REF_PILLS);
  });

  it('treats a negative limit as zero instead of slicing from the end', () => {
    const { shown, hidden } = splitRefs([ref('a', 'branch')], -2);
    expect(shown).toEqual([]);
    expect(hidden).toHaveLength(1);
  });

  it('returns empty buckets for a commit with no refs', () => {
    expect(splitRefs([])).toEqual({ shown: [], hidden: [] });
  });
});

describe('describeRef', () => {
  it('prefixes the ref name with its type', () => {
    expect(describeRef(ref('v1.0.0', 'tag'))).toBe('tag: v1.0.0');
  });
});

describe('isHeadCommit', () => {
  it('is true only when a head ref is present', () => {
    expect(isHeadCommit([ref('main', 'head')])).toBe(true);
    expect(isHeadCommit([ref('main', 'branch')])).toBe(false);
    expect(isHeadCommit([])).toBe(false);
  });
});
