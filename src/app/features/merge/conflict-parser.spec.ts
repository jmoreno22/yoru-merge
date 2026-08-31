import { describe, expect, it } from 'vitest';
import {
  findSequence,
  hasConflictMarkers,
  parseConflicts,
  replaceConflict,
} from './conflict-parser';

const TWO_WAY = [
  'const a = 1;',
  '<<<<<<< HEAD',
  'const b = 2;',
  '=======',
  'const b = 3;',
  '>>>>>>> feat/x',
  'const c = 4;',
].join('\n');

describe('parseConflicts', () => {
  it('finds a two-way block with both sides', () => {
    const [block, ...rest] = parseConflicts(TWO_WAY);
    expect(rest).toHaveLength(0);
    expect(block).toMatchObject({
      index: 0,
      oursLines: ['const b = 2;'],
      theirsLines: ['const b = 3;'],
      startLine: 1,
      endLine: 5,
    });
  });

  it('skips the ancestor section of a diff3 block', () => {
    const diff3 = [
      '<<<<<<< HEAD',
      'ours',
      '||||||| merged common ancestors',
      'base',
      '=======',
      'theirs',
      '>>>>>>> other',
    ].join('\n');
    const [block] = parseConflicts(diff3);
    expect(block?.oursLines).toEqual(['ours']);
    expect(block?.theirsLines).toEqual(['theirs']);
  });

  it('numbers several blocks in file order', () => {
    const text = `${TWO_WAY}\n${TWO_WAY}`;
    const blocks = parseConflicts(text);
    expect(blocks.map((b) => b.index)).toEqual([0, 1]);
    expect(blocks[1]?.startLine).toBeGreaterThan(blocks[0]?.endLine ?? 0);
  });

  it('returns nothing for a clean file', () => {
    expect(parseConflicts('a\nb\n')).toEqual([]);
  });

  it('handles empty sides', () => {
    const text = ['<<<<<<< HEAD', '=======', 'theirs', '>>>>>>> x'].join('\n');
    expect(parseConflicts(text)[0]?.oursLines).toEqual([]);
  });
});

describe('replaceConflict', () => {
  it('swaps the whole block, markers included', () => {
    const [block] = parseConflicts(TWO_WAY);
    if (!block) throw new Error('expected a block');
    const next = replaceConflict(TWO_WAY, block, block.theirsLines);
    expect(next).toBe('const a = 1;\nconst b = 3;\nconst c = 4;');
    expect(hasConflictMarkers(next)).toBe(false);
  });

  it('can keep both sides', () => {
    const [block] = parseConflicts(TWO_WAY);
    if (!block) throw new Error('expected a block');
    const next = replaceConflict(TWO_WAY, block, [
      ...block.oursLines,
      ...block.theirsLines,
    ]);
    expect(next.split('\n')).toEqual([
      'const a = 1;',
      'const b = 2;',
      'const b = 3;',
      'const c = 4;',
    ]);
  });
});

describe('hasConflictMarkers', () => {
  it('detects a lone separator left behind by a manual edit', () => {
    expect(hasConflictMarkers('a\n=======\nb')).toBe(true);
    expect(hasConflictMarkers('a\nb')).toBe(false);
  });
});

describe('findSequence', () => {
  it('locates a contiguous run', () => {
    expect(findSequence(['a', 'b', 'c', 'd'], ['b', 'c'])).toBe(1);
    expect(findSequence(['a', 'b', 'c'], ['c'])).toBe(2);
  });

  it('returns -1 when the run is absent or empty', () => {
    expect(findSequence(['a', 'b'], ['b', 'a'])).toBe(-1);
    expect(findSequence(['a'], [])).toBe(-1);
    expect(findSequence([], ['a'])).toBe(-1);
  });
});
