import { describe, expect, it } from 'vitest';
import type { CommitFile, FileChangeStatus } from '../../core/models';
import { buildFileRows, FILE_STATUS_STYLE, filterFiles } from './commit-files';

const file = (path: string, old_path: string | null = null): CommitFile => ({
  path,
  old_path,
  status: old_path === null ? 'modified' : 'renamed',
  additions: 1,
  deletions: 0,
  binary: false,
});

const NONE: ReadonlySet<string> = new Set<string>();

describe('filterFiles', () => {
  const files = [file('src/app/main.ts'), file('README.md', 'docs/readme.md')];

  it('returns everything for a blank query', () => {
    expect(filterFiles(files, '   ')).toBe(files);
  });

  it('matches on the path, case-insensitively', () => {
    expect(filterFiles(files, 'MAIN')).toHaveLength(1);
  });

  it('matches on the path a rename came from', () => {
    expect(filterFiles(files, 'docs/')[0]?.path).toBe('README.md');
  });
});

describe('buildFileRows in list mode', () => {
  it('prints one row per file with the whole path', () => {
    const rows = buildFileRows([file('src/app/main.ts')], 'list', NONE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'file',
      label: 'src/app/main.ts',
      depth: 0,
    });
  });
});

describe('buildFileRows in tree mode', () => {
  it('puts a root-level file at depth zero with no folder row', () => {
    const rows = buildFileRows([file('README.md')], 'tree', NONE);
    expect(rows).toEqual([
      {
        kind: 'file',
        path: 'README.md',
        label: 'README.md',
        depth: 0,
        file: expect.anything(),
        fileCount: 0,
        collapsed: false,
        title: 'Modified: README.md\n+1 −0',
        statusStyle: FILE_STATUS_STYLE.modified,
      },
    ]);
  });

  it('merges a chain of single-child folders into one row', () => {
    const rows = buildFileRows([file('src/app/core/main.ts')], 'tree', NONE);
    expect(rows[0]).toMatchObject({
      kind: 'folder',
      path: 'src/app/core',
      label: 'src/app/core',
      depth: 0,
    });
    expect(rows[1]).toMatchObject({ kind: 'file', label: 'main.ts', depth: 1 });
  });

  it('stops merging where the tree branches', () => {
    const rows = buildFileRows(
      [file('src/a/one.ts'), file('src/b/two.ts')],
      'tree',
      NONE,
    );
    expect(rows.map((r) => r.label)).toEqual(['src', 'a', 'one.ts', 'b', 'two.ts']);
  });

  it('counts every file below a folder, at any depth', () => {
    const rows = buildFileRows(
      [file('src/a/one.ts'), file('src/b/two.ts')],
      'tree',
      NONE,
    );
    expect(rows[0]).toMatchObject({ label: 'src', fileCount: 2 });
    expect(rows[1]).toMatchObject({ label: 'a', fileCount: 1 });
  });

  it('lists folders before the files that sit beside them', () => {
    const rows = buildFileRows([file('root.ts'), file('src/deep.ts')], 'tree', NONE);
    expect(rows.map((r) => r.label)).toEqual(['src', 'deep.ts', 'root.ts']);
  });

  it('hides the children of a collapsed folder', () => {
    const rows = buildFileRows(
      [file('src/a/one.ts'), file('src/a/two.ts')],
      'tree',
      new Set(['src/a']),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'folder', collapsed: true, fileCount: 2 });
  });

  it('collapses on the merged path, not the first segment', () => {
    const rows = buildFileRows([file('src/app/main.ts')], 'tree', new Set(['src']));
    expect(rows[0]?.collapsed).toBe(false);
    expect(rows).toHaveLength(2);
  });
});

describe('buildFileRows precomputes what the row draws', () => {
  const rowFor = (patch: Partial<CommitFile>) => {
    const entry: CommitFile = { ...file('src/main.ts'), ...patch };
    const row = buildFileRows([entry], 'list', NONE)[0];
    if (row === undefined) throw new Error('no row');
    return row;
  };

  const cases: readonly [FileChangeStatus, string][] = [
    ['added', 'Added'],
    ['modified', 'Modified'],
    ['deleted', 'Deleted'],
    ['renamed', 'Renamed'],
    ['copied', 'Copied'],
    ['type_changed', 'Type changed'],
  ];

  for (const [status, label] of cases) {
    it(`titles and styles a ${status} file`, () => {
      const row = rowFor({ status, additions: 3, deletions: 2 });
      expect(row.title).toBe(`${label}: src/main.ts\n+3 −2`);
      expect(row.statusStyle).toBe(FILE_STATUS_STYLE[status]);
    });
  }

  it('names the path a rename came from', () => {
    const row = rowFor({ status: 'renamed', old_path: 'src/old.ts' });
    expect(row.title).toBe('Renamed: src/main.ts\nRenamed from src/old.ts\n+1 −0');
  });

  it('says binary instead of counting lines', () => {
    expect(rowFor({ binary: true }).title).toBe('Modified: src/main.ts\nBinary file');
  });

  it('leaves folder rows without a title or a status style', () => {
    const rows = buildFileRows([file('src/a/one.ts')], 'tree', NONE);
    expect(rows[0]).toMatchObject({ kind: 'folder', title: '', statusStyle: null });
  });
});
