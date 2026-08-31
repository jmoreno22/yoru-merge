import { describe, expect, it } from 'vitest';
import {
  type FileEntry,
  filterEntries,
  folderPaths,
  listRows,
  treeRows,
} from './changes-tree';

function entry(path: string, status: FileEntry['status'] = 'modified'): FileEntry {
  return { path, oldPath: null, status, section: 'changes', isSubmodule: false };
}

const NONE: ReadonlySet<string> = new Set();

describe('listRows', () => {
  it('splits the directory prefix from the file name', () => {
    const [row] = listRows([entry('src/app/main.ts')]);
    expect(row).toMatchObject({ dir: 'src/app/', name: 'main.ts', depth: 0 });
  });

  it('leaves a root file without a directory prefix', () => {
    expect(listRows([entry('README.md')])[0]).toMatchObject({
      dir: '',
      name: 'README.md',
    });
  });

  it('sorts case-insensitively', () => {
    const rows = listRows([entry('b.ts'), entry('A.ts')]);
    expect(rows.map((r) => r.path)).toEqual(['A.ts', 'b.ts']);
  });
});

describe('treeRows', () => {
  it('emits a folder before its files and indents them', () => {
    const rows = treeRows([entry('src/main.ts')], NONE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'folder', name: 'src', depth: 0, count: 1 });
    expect(rows[1]).toMatchObject({ kind: 'file', name: 'main.ts', depth: 1 });
  });

  it('compacts a chain of single-child folders', () => {
    const rows = treeRows([entry('src/app/core/a.ts')], NONE);
    expect(rows[0]).toMatchObject({
      kind: 'folder',
      name: 'src/app/core',
      path: 'src/app/core',
    });
    expect(rows).toHaveLength(2);
  });

  it('stops compacting where the tree branches', () => {
    const rows = treeRows([entry('src/a/one.ts'), entry('src/b/two.ts')], NONE);
    expect(rows.filter((r) => r.kind === 'folder').map((r) => r.path)).toEqual([
      'src',
      'src/a',
      'src/b',
    ]);
  });

  it('hides the subtree of a collapsed folder but keeps its count', () => {
    const rows = treeRows([entry('src/a.ts'), entry('src/b.ts')], new Set(['src']));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'folder', count: 2, collapsed: true });
  });

  it('puts folders before root-level files', () => {
    const rows = treeRows([entry('README.md'), entry('src/a.ts')], NONE);
    expect(rows.map((r) => r.kind)).toEqual(['folder', 'file', 'file']);
  });

  it('keeps paths with spaces and non-ASCII segments intact', () => {
    const rows = treeRows([entry('señal ñ/a b.txt')], NONE);
    expect(rows[0]?.path).toBe('señal ñ');
    expect(rows[1]).toMatchObject({ name: 'a b.txt', path: 'señal ñ/a b.txt' });
  });
});

describe('filterEntries', () => {
  it('matches the path case-insensitively', () => {
    expect(filterEntries([entry('src/Main.ts')], 'main')).toHaveLength(1);
  });

  it('matches the rename source too', () => {
    const renamed: FileEntry = {
      path: 'b.ts',
      oldPath: 'old-name.ts',
      status: 'renamed',
      section: 'staged',
      isSubmodule: false,
    };
    expect(filterEntries([renamed], 'old-name')).toHaveLength(1);
  });

  it('returns everything for a blank query', () => {
    expect(filterEntries([entry('a.ts'), entry('b.ts')], '  ')).toHaveLength(2);
  });
});

describe('folderPaths', () => {
  it('lists every ancestor exactly once', () => {
    expect(folderPaths([entry('src/app/a.ts'), entry('src/b.ts')])).toEqual([
      'src',
      'src/app',
    ]);
  });
});
