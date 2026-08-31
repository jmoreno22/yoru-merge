import { describe, expect, it } from 'vitest';
import { buildLinePatch, changedLineIndexes, patchApplyFlags } from './patch-builder';

/**
 * Body indexes:
 *   0 ' one'   1 '-two'   2 '+TWO'   3 ' three'   4 '-four'   5 '+FOUR'
 */
const DIFF = [
  'diff --git a/a.txt b/a.txt',
  'index 1111111..2222222 100644',
  '--- a/a.txt',
  '+++ b/a.txt',
  '@@ -1,5 +1,5 @@ fn main',
  ' one',
  '-two',
  '+TWO',
  ' three',
  '-four',
  '+FOUR',
  '',
].join('\n');

function bodyOf(patch: string): string[] {
  const lines = patch.split('\n');
  const at = lines.findIndex((l) => l.startsWith('@@'));
  return lines.slice(at + 1).filter((l) => l.length > 0 || false);
}

function headerOf(patch: string): string {
  return patch.split('\n').find((l) => l.startsWith('@@')) ?? '';
}

describe('patchApplyFlags', () => {
  it('maps each mode to the right git apply flags', () => {
    expect(patchApplyFlags('stage')).toEqual({ reverse: false, cached: true });
    expect(patchApplyFlags('unstage')).toEqual({ reverse: true, cached: true });
    expect(patchApplyFlags('discard')).toEqual({
      reverse: true,
      cached: false,
    });
  });
});

describe('changedLineIndexes', () => {
  it('lists the +/- positions inside the hunk body', () => {
    expect(changedLineIndexes(DIFF, 0)).toEqual([1, 2, 4, 5]);
  });

  it('returns an empty list for a hunk that does not exist', () => {
    expect(changedLineIndexes(DIFF, 3)).toEqual([]);
  });
});

describe('buildLinePatch — staging', () => {
  it('keeps the file header verbatim', () => {
    const patch = buildLinePatch(DIFF, 0, [1, 2], 'stage');
    expect(patch.startsWith('diff --git a/a.txt b/a.txt\n')).toBe(true);
    expect(patch).toContain('--- a/a.txt');
    expect(patch).toContain('+++ b/a.txt');
  });

  it('drops unselected additions and turns unselected removals into context', () => {
    // Stage only the second change (indexes 4 and 5).
    expect(bodyOf(buildLinePatch(DIFF, 0, [4, 5], 'stage'))).toEqual([
      ' one',
      ' two',
      ' three',
      '-four',
      '+FOUR',
    ]);
  });

  it('recomputes the @@ counts for the trimmed hunk', () => {
    // Pre-image: one, two, three, four → 4 lines. Post-image: FOUR replaces
    // four, so also 4.
    expect(headerOf(buildLinePatch(DIFF, 0, [4, 5], 'stage'))).toBe(
      '@@ -1,4 +1,4 @@ fn main',
    );
  });

  it('keeps the original start offsets', () => {
    const shifted = DIFF.replace('@@ -1,5 +1,5 @@', '@@ -40,5 +42,5 @@');
    expect(headerOf(buildLinePatch(shifted, 0, [1, 2], 'stage'))).toContain('-40,');
    expect(headerOf(buildLinePatch(shifted, 0, [1, 2], 'stage'))).toContain('+42,');
  });

  it('can stage a removal on its own', () => {
    expect(bodyOf(buildLinePatch(DIFF, 0, [1], 'stage'))).toEqual([
      ' one',
      '-two',
      ' three',
      ' four',
    ]);
  });

  it('can stage an addition on its own', () => {
    expect(bodyOf(buildLinePatch(DIFF, 0, [2], 'stage'))).toEqual([
      ' one',
      ' two',
      '+TWO',
      ' three',
      ' four',
    ]);
  });

  it('ends with a newline so git apply accepts it', () => {
    expect(buildLinePatch(DIFF, 0, [1], 'stage').endsWith('\n')).toBe(true);
  });
});

describe('buildLinePatch — reverse modes', () => {
  it('turns unselected additions into context and drops unselected removals', () => {
    expect(bodyOf(buildLinePatch(DIFF, 0, [4, 5], 'unstage'))).toEqual([
      ' one',
      ' TWO',
      ' three',
      '-four',
      '+FOUR',
    ]);
  });

  it('produces the same patch for unstage and discard', () => {
    expect(buildLinePatch(DIFF, 0, [1, 2], 'discard')).toBe(
      buildLinePatch(DIFF, 0, [1, 2], 'unstage'),
    );
  });

  it('counts the reversed pre-image correctly', () => {
    // Kept context: one, TWO, three → plus the -four/+FOUR pair.
    expect(headerOf(buildLinePatch(DIFF, 0, [4, 5], 'unstage'))).toBe(
      '@@ -1,4 +1,4 @@ fn main',
    );
  });
});

describe('buildLinePatch — edge cases', () => {
  it('returns an empty string when nothing was selected', () => {
    expect(buildLinePatch(DIFF, 0, [], 'stage')).toBe('');
  });

  it('returns an empty string when only context lines were selected', () => {
    expect(buildLinePatch(DIFF, 0, [0, 3], 'stage')).toBe('');
  });

  it('returns an empty string for a hunk index out of range', () => {
    expect(buildLinePatch(DIFF, 7, [1], 'stage')).toBe('');
  });

  it('returns an empty string when there is no hunk at all', () => {
    expect(buildLinePatch('diff --git a/a b/a\n', 0, [0], 'stage')).toBe('');
  });

  it('targets the requested hunk only', () => {
    const twoHunks = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1,2 +1,2 @@',
      ' a',
      '+b',
      '@@ -10,2 +11,2 @@',
      ' x',
      '+y',
      '',
    ].join('\n');
    const patch = buildLinePatch(twoHunks, 1, [1], 'stage');
    expect(headerOf(patch)).toBe('@@ -10,1 +11,2 @@');
    expect(bodyOf(patch)).toEqual([' x', '+y']);
    expect(patch).not.toContain('+b');
  });

  it('keeps the no-newline marker with its line and drops it with it', () => {
    const noNewline = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1,2 +1,2 @@',
      ' a',
      '-b',
      '\\ No newline at end of file',
      '+B',
      '\\ No newline at end of file',
      '',
    ].join('\n');

    // Selecting the removal keeps its marker; the unselected addition and its
    // marker both disappear.
    expect(bodyOf(buildLinePatch(noNewline, 0, [1], 'stage'))).toEqual([
      ' a',
      '-b',
      '\\ No newline at end of file',
    ]);
  });

  it('handles CRLF input', () => {
    const crlf = DIFF.replace(/\n/g, '\r\n');
    expect(bodyOf(buildLinePatch(crlf, 0, [1], 'stage'))).toEqual([
      ' one',
      '-two',
      ' three',
      ' four',
    ]);
  });
});
