import { describe, expect, it } from 'vitest';
import type { BranchInfo, BranchList, StashEntry, TagInfo } from '../../../core/models';
import {
  buildRefsTree,
  type RefsNode,
  type RefsTreeInput,
  remoteOf,
  shortRemoteName,
  stashLabel,
} from './refs-tree';

function branch(name: string, isRemote = false): BranchInfo {
  return {
    name,
    sha: 'a'.repeat(40),
    is_remote: isRemote,
    upstream: null,
    ahead: 0,
    behind: 0,
  };
}

function tag(name: string): TagInfo {
  return { name, sha: 'b'.repeat(40), message: null, is_annotated: false };
}

function stash(index: number, message: string): StashEntry {
  return { index, message, sha: 'c'.repeat(40), date: '2026-08-29' };
}

function tree(overrides: Partial<RefsTreeInput> = {}): RefsNode[] {
  const branches: BranchList = {
    local: [branch('main'), branch('feat/auth'), branch('feat/graph')],
    remote: [branch('origin/main', true), branch('upstream/main', true)],
    current: 'main',
  };
  return buildRefsTree({
    branches,
    tags: [tag('v1.0.0')],
    stashes: [stash(0, 'WIP on main: 1234567 subject')],
    filter: '',
    collapsed: {},
    perRemoteFolders: true,
    ...overrides,
  });
}

function ids(nodes: readonly RefsNode[]): string[] {
  return nodes.map((node) => node.id);
}

describe('buildRefsTree', () => {
  it('opens only the local section on a first run', () => {
    expect(ids(tree())).toEqual([
      'section:local',
      'folder:local:feat',
      'branch:local:feat/auth',
      'branch:local:feat/graph',
      'branch:local:main',
      'section:remote',
      'section:tags',
      'section:stashes',
    ]);
  });

  it('counts leaves, not folders, on the section row', () => {
    const section = tree().find((node) => node.id === 'section:local');
    expect(section).toMatchObject({ kind: 'section', count: 3 });
  });

  it('indents a branch inside a prefix folder one level deeper', () => {
    const nodes = tree();
    expect(nodes.find((node) => node.id === 'folder:local:feat')?.level).toBe(1);
    expect(nodes.find((node) => node.id === 'branch:local:feat/auth')?.level).toBe(2);
    expect(nodes.find((node) => node.id === 'branch:local:main')?.level).toBe(1);
  });

  it('strips the folder prefix from the row label', () => {
    const node = tree().find((n) => n.id === 'branch:local:feat/auth');
    expect(node).toMatchObject({ kind: 'branch', label: 'auth' });
  });

  it('marks the current branch', () => {
    const nodes = tree();
    const current = nodes.find((node) => node.id === 'branch:local:main');
    expect(current).toMatchObject({ current: true });
    expect(nodes.find((n) => n.id === 'branch:local:feat/auth')).toMatchObject({
      current: false,
    });
  });

  it('hides the children of a collapsed folder but keeps the folder', () => {
    const nodes = tree({ collapsed: { 'folder:local:feat': true } });
    expect(ids(nodes)).toContain('folder:local:feat');
    expect(ids(nodes)).not.toContain('branch:local:feat/auth');
  });

  it('honours a collapsed section', () => {
    const nodes = tree({ collapsed: { local: true } });
    expect(ids(nodes)).toContain('section:local');
    expect(ids(nodes)).not.toContain('branch:local:main');
  });

  it('groups remote branches per remote when the preference is on', () => {
    const nodes = tree({ collapsed: { local: true, remote: false } });
    expect(ids(nodes)).toContain('folder:remote:origin');
    expect(ids(nodes)).toContain('folder:remote:upstream');
    expect(nodes.find((n) => n.id === 'branch:remote:origin/main')).toMatchObject({
      label: 'main',
      remote: 'origin',
    });
  });

  it('lists remote branches flat when the preference is off', () => {
    const nodes = tree({
      collapsed: { local: true, remote: false },
      perRemoteFolders: false,
    });
    expect(ids(nodes)).not.toContain('folder:remote:origin');
    expect(nodes.find((n) => n.id === 'branch:remote:origin/main')).toMatchObject({
      label: 'origin/main',
      level: 1,
    });
  });

  it('force-expands everything that survives a filter', () => {
    const nodes = tree({ filter: 'graph' });
    expect(ids(nodes)).toEqual([
      'section:local',
      'folder:local:feat',
      'branch:local:feat/graph',
    ]);
  });

  it('drops sections the filter emptied', () => {
    expect(ids(tree({ filter: 'v1.0' }))).toEqual(['section:tags', 'tag:v1.0.0']);
  });

  it('returns nothing when the filter matches no ref', () => {
    expect(tree({ filter: 'zzz' })).toEqual([]);
  });

  it('numbers siblings for aria-posinset / aria-setsize', () => {
    const nodes = tree();
    const folder = nodes.find((node) => node.id === 'folder:local:feat');
    expect(folder).toMatchObject({ posInSet: 1, setSize: 2 });
    expect(nodes.find((n) => n.id === 'branch:local:main')).toMatchObject({
      posInSet: 2,
      setSize: 2,
    });
  });

  it('indents by 18px per level and leaves the section padding to its class', () => {
    const nodes = tree();
    expect(nodes.find((n) => n.id === 'section:local')?.indent).toBe(0);
    expect(nodes.find((n) => n.id === 'folder:local:feat')?.indent).toBe(26);
    expect(nodes.find((n) => n.id === 'branch:local:feat/auth')?.indent).toBe(44);
  });

  it('gives every row the fixed height the virtual list needs', () => {
    for (const node of tree()) {
      expect(node.rowClass).toContain('h-[var(--ref-row-h)]');
    }
  });

  it('marks the current branch by weight, not by colour alone', () => {
    const nodes = tree();
    expect(nodes.find((n) => n.id === 'branch:local:main')?.rowClass).toContain(
      'font-semibold',
    );
    expect(
      nodes.find((n) => n.id === 'branch:local:feat/auth')?.rowClass,
    ).not.toContain('font-semibold');
  });

  it('spells the upstream out in the row title', () => {
    const tracked = branch('main');
    const nodes = buildRefsTree({
      branches: {
        local: [{ ...tracked, upstream: 'origin/main' }],
        remote: [],
        current: 'main',
      },
      tags: [tag('v1.0.0')],
      stashes: [stash(0, 'WIP on main: 1234567 subject')],
      filter: '',
      collapsed: { tags: false, stashes: false },
      perRemoteFolders: true,
    });
    expect(nodes.find((n) => n.id === 'branch:local:main')?.title).toBe(
      'main tracks origin/main',
    );
    expect(nodes.find((n) => n.id === 'tag:v1.0.0')?.title).toBe('v1.0.0');
    expect(nodes.find((n) => n.id === 'stash:0')?.title).toBe(
      'WIP on main: 1234567 subject · 2026-08-29',
    );
    expect(nodes.find((n) => n.id === 'section:local')?.title).toBe('Local');
  });

  it('carries a drag payload on branches and nothing else', () => {
    const nodes = tree({ collapsed: { tags: false, stashes: false } });
    expect(nodes.find((n) => n.id === 'branch:local:main')?.payload).toEqual({
      type: 'branch',
      name: 'main',
      isRemote: false,
      isCurrent: true,
    });
    expect(nodes.find((n) => n.id === 'section:local')?.payload).toBeNull();
    expect(nodes.find((n) => n.id === 'folder:local:feat')?.payload).toBeNull();
    expect(nodes.find((n) => n.id === 'tag:v1.0.0')?.payload).toBeNull();
    expect(nodes.find((n) => n.id === 'stash:0')?.payload).toBeNull();
  });

  it('keeps the drag payload identical across rebuilds of the same branches', () => {
    const branches: BranchList = {
      local: [branch('main')],
      remote: [],
      current: 'main',
    };
    const input: RefsTreeInput = {
      branches,
      tags: [],
      stashes: [],
      filter: '',
      collapsed: {},
      perRemoteFolders: true,
    };
    const first = buildRefsTree(input).find((n) => n.id === 'branch:local:main');
    // A rebuild caused by an unrelated change must not hand `[appDragDrop]` a
    // new object, or the directive input changes on every collapse or filter.
    const second = buildRefsTree({ ...input, collapsed: { tags: true } }).find(
      (n) => n.id === 'branch:local:main',
    );
    expect(first?.payload).not.toBeNull();
    expect(second?.payload).toBe(first?.payload);
  });

  it('marks sections and folders expandable and leaves the rest closed', () => {
    const nodes = tree();
    expect(nodes.find((n) => n.id === 'section:local')).toMatchObject({
      expandable: true,
      expanded: true,
    });
    expect(nodes.find((n) => n.id === 'section:tags')).toMatchObject({
      expandable: true,
      expanded: false,
    });
    expect(nodes.find((n) => n.id === 'folder:local:feat')).toMatchObject({
      expandable: true,
      expanded: true,
    });
    expect(nodes.find((n) => n.id === 'branch:local:main')).toMatchObject({
      expandable: false,
      expanded: false,
    });
  });

  it('survives a repository whose refs have not loaded yet', () => {
    const nodes = buildRefsTree({
      branches: null,
      tags: [],
      stashes: [],
      filter: '',
      collapsed: {},
      perRemoteFolders: true,
    });
    expect(ids(nodes)).toEqual([
      'section:local',
      'section:remote',
      'section:tags',
      'section:stashes',
    ]);
  });
});

describe('remoteOf', () => {
  it('takes the segment before the first slash', () => {
    expect(remoteOf('origin/feat/x')).toBe('origin');
  });

  it('falls back to origin for a ref with no remote segment', () => {
    expect(remoteOf('HEAD')).toBe('origin');
  });
});

describe('shortRemoteName', () => {
  it('drops the remote segment', () => {
    expect(shortRemoteName('origin/feat/x')).toBe('feat/x');
  });

  it('leaves a name without a slash alone', () => {
    expect(shortRemoteName('HEAD')).toBe('HEAD');
  });
});

describe('stashLabel', () => {
  it('drops the "WIP on branch:" preamble', () => {
    expect(stashLabel('WIP on main: 1234567 subject')).toBe('1234567 subject');
  });

  it('keeps a message that has no preamble', () => {
    expect(stashLabel('before refactor')).toBe('before refactor');
  });
});
