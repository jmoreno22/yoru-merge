import { describe, expect, it } from 'vitest';
import { buildLinePatch } from '../../core/utils/patch-builder';
import { isLfsPointer, OVERSIZED_DIFF_SENTINEL, parseUnifiedDiff } from './diff-parse';

const MODIFIED = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,4 +1,4 @@ export class App',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  ' const c = 4;',
  ' const d = 5;',
  '',
].join('\n');

describe('parseUnifiedDiff', () => {
  it('returns nothing for an empty patch or the oversize sentinel', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
    expect(parseUnifiedDiff(OVERSIZED_DIFF_SENTINEL)).toEqual([]);
  });

  it('reads paths, status and stats of a modified file', () => {
    const [file] = parseUnifiedDiff(MODIFIED);
    expect(file?.path).toBe('src/app.ts');
    expect(file?.status).toBe('modified');
    expect(file?.binary).toBe(false);
    expect(file?.additions).toBe(1);
    expect(file?.deletions).toBe(1);
    expect(file?.hunks).toHaveLength(1);
  });

  it('keeps the hunk header and its section label', () => {
    const hunk = parseUnifiedDiff(MODIFIED)[0]?.hunks[0];
    expect(hunk?.header).toBe('@@ -1,4 +1,4 @@ export class App');
    expect(hunk?.section).toBe('export class App');
  });

  it('numbers old and new lines independently', () => {
    const lines = parseUnifiedDiff(MODIFIED)[0]?.hunks[0]?.lines ?? [];
    expect(lines.map((l) => [l.kind, l.oldNumber, l.newNumber])).toEqual([
      ['context', 1, 1],
      ['delete', 2, null],
      ['insert', null, 2],
      ['context', 3, 3],
      ['context', 4, 4],
    ]);
  });

  it('indexes body lines the way buildLinePatch counts them', () => {
    const file = parseUnifiedDiff(MODIFIED)[0];
    const insert = file?.hunks[0]?.lines.find((l) => l.kind === 'insert');
    const patch = buildLinePatch(
      file?.raw ?? '',
      0,
      [insert?.bodyIndex ?? -1],
      'stage',
    );
    expect(patch).toContain('+const b = 3;');
    expect(patch).toContain(' const b = 2;');
  });

  it('numbers hunks by their ordinal inside the file', () => {
    const patch = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1,2 +1,2 @@',
      '-one',
      '+ONE',
      ' two',
      '@@ -10,2 +10,2 @@',
      '-ten',
      '+TEN',
      ' eleven',
      '',
    ].join('\n');
    const hunks = parseUnifiedDiff(patch)[0]?.hunks ?? [];
    expect(hunks.map((h) => h.index)).toEqual([0, 1]);
    expect(hunks[1]?.lines[0]?.oldNumber).toBe(10);
  });

  it('splits a multi-file patch and gives each file its own raw slice', () => {
    const patch = `${MODIFIED}${[
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '',
    ].join('\n')}`;
    const files = parseUnifiedDiff(patch);
    expect(files.map((f) => f.path)).toEqual(['src/app.ts', 'README.md']);
    expect(files[1]?.raw.startsWith('diff --git a/README.md')).toBe(true);
    expect(files[1]?.raw).not.toContain('src/app.ts');
  });

  it('detects an added file from the /dev/null side', () => {
    const patch = [
      'diff --git a/new.txt b/new.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1,2 @@',
      '+first',
      '+second',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(patch);
    expect(file?.status).toBe('added');
    expect(file?.path).toBe('new.txt');
    expect(file?.additions).toBe(2);
  });

  it('treats the Windows null device as a missing side', () => {
    const patch = [
      'diff --git a/NUL b/notes.txt',
      '--- a/NUL',
      '+++ b/notes.txt',
      '@@ -0,0 +1 @@',
      '+untracked',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(patch);
    expect(file?.status).toBe('added');
    expect(file?.path).toBe('notes.txt');
  });

  it('detects a deleted file and shows its old path', () => {
    const patch = [
      'diff --git a/gone.txt b/gone.txt',
      'deleted file mode 100644',
      '--- a/gone.txt',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-bye',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(patch);
    expect(file?.status).toBe('deleted');
    expect(file?.path).toBe('gone.txt');
  });

  it('detects a rename and keeps the source path', () => {
    const patch = [
      'diff --git a/old/name.ts b/new/name.ts',
      'similarity index 96%',
      'rename from old/name.ts',
      'rename to new/name.ts',
      '--- a/old/name.ts',
      '+++ b/new/name.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(patch);
    expect(file?.status).toBe('renamed');
    expect(file?.path).toBe('new/name.ts');
    expect(file?.oldPath).toBe('old/name.ts');
  });

  it('flags a binary file and leaves it without hunks', () => {
    const patch = [
      'diff --git a/logo.png b/logo.png',
      'index 1111111..2222222 100644',
      'Binary files a/logo.png and b/logo.png differ',
      '',
    ].join('\n');
    const [file] = parseUnifiedDiff(patch);
    expect(file?.binary).toBe(true);
    expect(file?.path).toBe('logo.png');
    expect(file?.hunks).toEqual([]);
  });

  it('attaches "no newline at end of file" to the line above it', () => {
    const patch = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1 +1 @@',
      '-one',
      '\\ No newline at end of file',
      '+two',
      '',
    ].join('\n');
    const lines = parseUnifiedDiff(patch)[0]?.hunks[0]?.lines ?? [];
    expect(lines[0]?.noNewline).toBe(true);
    expect(lines[1]?.kind).toBe('insert');
    // The marker occupies body position 1, so the insert is at 2 — which is
    // what buildLinePatch expects.
    expect(lines[1]?.bodyIndex).toBe(2);
  });

  it('keeps carriage returns as content', () => {
    const patch = [
      'diff --git a/crlf.txt b/crlf.txt',
      '--- a/crlf.txt',
      '+++ b/crlf.txt',
      '@@ -1 +1 @@',
      '-one\r',
      '+two\r',
      '',
    ].join('\n');
    const lines = parseUnifiedDiff(patch)[0]?.hunks[0]?.lines ?? [];
    expect(lines[0]?.text).toBe('one\r');
    expect(lines[1]?.text).toBe('two\r');
  });

  it('parses a bare hunk with no file header', () => {
    const patch = ['@@ -1,2 +1,2 @@', '-a', '+b', ' c', ''].join('\n');
    expect(parseUnifiedDiff(patch)).toEqual([]);
  });

  it('handles paths containing spaces through the ---/+++ lines', () => {
    const patch = [
      'diff --git a/my notes.txt b/my notes.txt',
      '--- a/my notes.txt',
      '+++ b/my notes.txt',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      '',
    ].join('\n');
    expect(parseUnifiedDiff(patch)[0]?.path).toBe('my notes.txt');
  });
});

describe('isLfsPointer', () => {
  const oid = 'a'.repeat(64);

  it('detects an added pointer', () => {
    const patch = [
      'diff --git a/video.mp4 b/video.mp4',
      '--- /dev/null',
      '+++ b/video.mp4',
      '@@ -0,0 +1,3 @@',
      '+version https://git-lfs.github.com/spec/v1',
      `+oid sha256:${oid}`,
      '+size 1048576',
      '',
    ].join('\n');
    expect(isLfsPointer(patch)).toBe(true);
  });

  it('detects a pointer whose oid changed', () => {
    const patch = [
      '@@ -1,3 +1,3 @@',
      ' version https://git-lfs.github.com/spec/v1',
      `-oid sha256:${oid}`,
      `+oid sha256:${'b'.repeat(64)}`,
      ' size 10',
      '',
    ].join('\n');
    expect(isLfsPointer(patch)).toBe(true);
  });

  it('needs both the version and the oid line', () => {
    expect(isLfsPointer('+version https://git-lfs.github.com/spec/v1')).toBe(false);
    expect(isLfsPointer(`+oid sha256:${oid}`)).toBe(false);
  });

  it('ignores a file that merely mentions git-lfs', () => {
    const patch = [
      '@@ -1 +1 @@',
      '+Install it from https://git-lfs.github.com/spec/v1, then run git lfs install.',
      '',
    ].join('\n');
    expect(isLfsPointer(patch)).toBe(false);
  });

  it('ignores an ordinary patch', () => {
    expect(isLfsPointer(MODIFIED)).toBe(false);
  });
});
