import { describe, expect, it } from 'vitest';
import type { FileEntry } from './changes-tree';
import {
  absolutePath,
  fileMenuItems,
  IGNORE_PREFIX,
  ignoreCandidates,
  parentDirectory,
} from './file-menu';

function entry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    path: 'src/app/main.ts',
    oldPath: null,
    status: 'modified',
    section: 'changes',
    isSubmodule: false,
    ...overrides,
  };
}

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe('ignoreCandidates', () => {
  it('offers the file, its extension and its folder', () => {
    expect(ignoreCandidates('src/app/main.ts').map((c) => c.pattern)).toEqual([
      'src/app/main.ts',
      '*.ts',
      'src/app/',
    ]);
  });

  it('never anchors with a leading slash, which git reads as absolute', () => {
    for (const candidate of ignoreCandidates('src/app/main.ts')) {
      expect(candidate.pattern.startsWith('/')).toBe(false);
    }
  });

  it('drops the folder entry for a root file', () => {
    expect(ignoreCandidates('README.md').map((c) => c.pattern)).toEqual([
      'README.md',
      '*.md',
    ]);
  });

  it('drops the extension entry for a dotfile', () => {
    expect(ignoreCandidates('.env').map((c) => c.pattern)).toEqual(['.env']);
  });
});

describe('absolutePath', () => {
  it('keeps posix separators', () => {
    expect(absolutePath('/home/me/repo', 'src/main.ts')).toBe(
      '/home/me/repo/src/main.ts',
    );
  });

  it('switches to backslashes for a windows repo path', () => {
    expect(absolutePath('C:\\repos\\yoru', 'src/main.ts')).toBe(
      'C:\\repos\\yoru\\src\\main.ts',
    );
  });

  it('does not double the separator', () => {
    expect(absolutePath('/home/me/repo/', 'main.ts')).toBe('/home/me/repo/main.ts');
  });
});

describe('parentDirectory', () => {
  it('cuts at the last separator of either flavour', () => {
    expect(parentDirectory('/home/me/repo/src/main.ts')).toBe('/home/me/repo/src');
    expect(parentDirectory('C:\\repos\\yoru\\main.ts')).toBe('C:\\repos\\yoru');
  });

  it('returns the input when there is no directory', () => {
    expect(parentDirectory('main.ts')).toBe('main.ts');
  });
});

describe('fileMenuItems', () => {
  it('offers Stage on an unstaged row and Unstage on a staged one', () => {
    const unstaged = fileMenuItems({ entry: entry(), targets: ['a'] });
    expect(ids(unstaged)).toContain('stage');

    const staged = fileMenuItems({
      entry: entry({ section: 'staged' }),
      targets: ['a'],
    });
    expect(ids(staged)).toContain('unstage');
    expect(ids(staged)).not.toContain('stage');
  });

  it('hides discard on a staged row, where git would restore from the index', () => {
    const items = fileMenuItems({
      entry: entry({ section: 'staged' }),
      targets: ['a'],
    });
    expect(ids(items)).not.toContain('discard');
  });

  it('counts the selection in the bulk labels', () => {
    const items = fileMenuItems({ entry: entry(), targets: ['a', 'b', 'c'] });
    expect(items.find((item) => item.id === 'stage')?.label).toBe('Stage 3 files');
  });

  it('says delete, not discard, for an untracked file', () => {
    const items = fileMenuItems({
      entry: entry({ status: 'untracked' }),
      targets: ['a'],
    });
    expect(items.find((item) => item.id === 'discard')?.label).toBe('Delete…');
  });

  it('carries the ignore patterns in the submenu ids', () => {
    const items = fileMenuItems({ entry: entry(), targets: ['a'] });
    const ignore = items.find((item) => item.id === 'ignore');
    expect(ignore?.children?.map((child) => child.id)).toEqual([
      `${IGNORE_PREFIX}src/app/main.ts`,
      `${IGNORE_PREFIX}*.ts`,
      `${IGNORE_PREFIX}src/app/`,
    ]);
  });

  it('disables history and blame on an untracked file, with the reason', () => {
    const items = fileMenuItems({
      entry: entry({ status: 'untracked' }),
      targets: ['a'],
    });
    const blame = items.find((item) => item.id === 'blame');
    expect(blame?.disabled).toBe(true);
    expect(blame?.disabledReason).toBeTruthy();
  });

  it('disables the on-disk actions for a deleted file', () => {
    const items = fileMenuItems({
      entry: entry({ status: 'deleted' }),
      targets: ['a'],
    });
    expect(items.find((item) => item.id === 'editor')?.disabled).toBe(true);
    expect(items.find((item) => item.id === 'reveal')?.disabled).toBe(true);
  });

  it('swaps the staging block for the conflict block on a conflicted row', () => {
    const items = fileMenuItems({
      entry: entry({ status: 'conflicted', section: 'conflicts' }),
      targets: ['a'],
    });
    expect(ids(items)).toEqual([
      'resolve',
      'take-ours',
      'take-theirs',
      'mark-resolved',
      'delete-conflicted',
      'history',
      'blame',
      'editor',
      'reveal',
      'terminal',
      'copy-path',
      'copy-relative',
    ]);
  });
});
