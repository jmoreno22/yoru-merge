import { describe, expect, it } from 'vitest';
import {
  canNext,
  canPrev,
  close,
  commitRowKey,
  type DiffWorkspaceSnapshot,
  type DiffWorkspaceState,
  focusKeyFor,
  focusKeyOwner,
  navigate,
  type OpenDiffWorkspaceInput,
  open,
  setFiles,
  shouldCloseFor,
} from './diff-workspace-state';

const CLOSED: DiffWorkspaceState = { open: false };

function commitSnapshot(
  overrides: Partial<DiffWorkspaceSnapshot> = {},
): DiffWorkspaceSnapshot {
  return {
    railView: 'history',
    tabId: 'tab-1',
    selectedCommitSha: 'abc123',
    side: null,
    listScrollTop: 240,
    focusKey: 'src/a.ts',
    ...overrides,
  };
}

function workingTreeSnapshot(
  overrides: Partial<DiffWorkspaceSnapshot> = {},
): DiffWorkspaceSnapshot {
  return {
    railView: 'changes',
    tabId: 'tab-1',
    selectedCommitSha: null,
    side: 'unstaged',
    listScrollTop: 0,
    focusKey: 'unstaged:src/a.ts',
    ...overrides,
  };
}

function openCommitInput(
  overrides: Partial<OpenDiffWorkspaceInput> = {},
): OpenDiffWorkspaceInput {
  return {
    source: { kind: 'commit', sha: 'abc123' },
    files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts'],
    index: 1,
    snapshot: commitSnapshot(),
    ...overrides,
  };
}

function openWorkingTreeInput(
  overrides: Partial<OpenDiffWorkspaceInput> = {},
): OpenDiffWorkspaceInput {
  return {
    source: { kind: 'working-tree', side: 'unstaged' },
    files: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    index: 0,
    snapshot: workingTreeSnapshot(),
    ...overrides,
  };
}

describe('open', () => {
  it('opens a closed workspace on the requested file', () => {
    const input = openCommitInput();
    const state = open(CLOSED, input);

    expect(state).toEqual({
      open: true,
      source: input.source,
      file: 'src/b.ts',
      files: input.files,
      index: 1,
      snapshot: input.snapshot,
    });
  });

  it('replaces an already open workspace instead of stacking (AC-09)', () => {
    const first = open(CLOSED, openCommitInput());
    const secondInput = openWorkingTreeInput();

    const second = open(first, secondInput);

    expect(second).toEqual({
      open: true,
      source: secondInput.source,
      file: 'src/a.ts',
      files: secondInput.files,
      index: 0,
      snapshot: secondInput.snapshot,
    });
  });
});

describe('navigate', () => {
  it('moves to the requested file within range', () => {
    const opened = open(CLOSED, openCommitInput({ index: 1 }));

    const state = navigate(opened, 2);

    expect(state).toMatchObject({ open: true, index: 2, file: 'src/c.ts' });
  });

  it('is a no-op before the first file and canPrev is false there', () => {
    const opened = open(CLOSED, openCommitInput({ index: 0 }));

    const state = navigate(opened, -1);

    expect(state).toEqual(opened);
    expect(canPrev(state)).toBe(false);
    expect(canNext(state)).toBe(true);
  });

  it('is a no-op past the last file and canNext is false there', () => {
    const opened = open(CLOSED, openCommitInput({ index: 4 }));

    const state = navigate(opened, 5);

    expect(state).toEqual(opened);
    expect(canPrev(state)).toBe(true);
    expect(canNext(state)).toBe(false);
  });

  it('reports both edges disabled on a closed workspace', () => {
    expect(canPrev(CLOSED)).toBe(false);
    expect(canNext(CLOSED)).toBe(false);
  });
});

describe('setFiles', () => {
  it('keeps the workspace on the same file when it is still published', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 1 }));

    const result = setFiles(opened, ['src/z.ts', 'src/b.ts', 'src/a.ts'], 'own');

    expect(result.effect).toBe('keep');
    expect(result.state).toMatchObject({ open: true, file: 'src/b.ts', index: 1 });
  });

  it('keeps the workspace on the same file even when the change came from outside the app (external-still-there)', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 1 }));

    const result = setFiles(opened, ['src/z.ts', 'src/b.ts', 'src/a.ts'], 'external');

    expect(result.effect).toBe('keep');
    expect(result.state).toMatchObject({ open: true, file: 'src/b.ts', index: 1 });
  });

  it("advances to the next file on the same side when the app's own action removed it, and marks the move as navigated (AC-13, F-12)", () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 1 }));

    const result = setFiles(opened, ['src/a.ts', 'src/c.ts'], 'own');

    expect(result.effect).toBe('advance');
    expect(result.state).toMatchObject({
      open: true,
      file: 'src/c.ts',
      index: 1,
      navigated: true,
    });
  });

  it('closes a working-tree workspace when an external change removed the shown file, even though others remain (AC-16, F-5)', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 1 }));

    const result = setFiles(opened, ['src/a.ts', 'src/c.ts'], 'external');

    expect(result.effect).toBe('close');
    expect(result.state).toEqual(CLOSED);
  });

  it('advances a commit workspace when the shown file left regardless of origin, and marks the move as navigated (F-12)', () => {
    const opened = open(CLOSED, openCommitInput({ index: 1 }));

    const result = setFiles(
      opened,
      ['src/a.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts'],
      'external',
    );

    expect(result.effect).toBe('advance');
    expect(result.state).toMatchObject({
      open: true,
      file: 'src/c.ts',
      navigated: true,
    });
  });

  it("closes a working-tree workspace when no file remains on that side and the change is the app's own (AC-13)", () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 2 }));

    const result = setFiles(opened, [], 'own');

    expect(result.effect).toBe('close');
    expect(result.state).toEqual(CLOSED);
  });

  it('closes a working-tree workspace when no file remains on that side and the change is external (AC-16)', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 2 }));

    const result = setFiles(opened, [], 'external');

    expect(result.effect).toBe('close');
    expect(result.state).toEqual(CLOSED);
  });

  it('keeps a commit workspace open on an empty published list, both edges disabled (AC-07)', () => {
    const opened = open(CLOSED, openCommitInput({ index: 1 }));

    const result = setFiles(opened, [], 'own');

    expect(result.effect).toBe('keep');
    expect(result.state).toMatchObject({ open: true, file: 'src/b.ts', files: [] });
    expect(canPrev(result.state)).toBe(false);
    expect(canNext(result.state)).toBe(false);
  });
});

describe('close', () => {
  it('restores the snapshot scroll offset, selection and originating focus (AC-08)', () => {
    const opened = open(CLOSED, openCommitInput({ index: 1 }));

    const { state, restore } = close(opened);

    expect(state).toEqual(CLOSED);
    expect(restore).toEqual({
      listScrollTop: 240,
      selection: { selectedCommitSha: 'abc123', side: null },
      focusKey: 'src/a.ts',
    });
  });

  it('restores focus on the now-active file, keyed as a bare path, when navigation changed it on a commit source (AC-08)', () => {
    const opened = open(CLOSED, openCommitInput({ index: 1 }));
    const navigated = navigate(opened, 2);

    const { restore } = close(navigated);

    expect(restore).toEqual({
      listScrollTop: 240,
      selection: { selectedCommitSha: 'abc123', side: null },
      focusKey: 'src/c.ts',
    });
  });

  it('carries the working-tree side identity instead of a commit sha', () => {
    const opened = open(CLOSED, openWorkingTreeInput());

    const { restore } = close(opened);

    expect(restore?.selection).toEqual({ selectedCommitSha: null, side: 'unstaged' });
  });

  it('restores focus keyed with the side, not the bare path, when navigation changed it on a working-tree source (AC-08, T20 contract)', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 0 }));
    const navigated = navigate(opened, 2);

    const { restore } = close(navigated);

    expect(restore).toEqual({
      listScrollTop: 0,
      selection: { selectedCommitSha: null, side: 'unstaged' },
      focusKey: 'unstaged:src/c.ts',
    });
  });

  it('focuses the now-active file under its side-qualified key after setFiles advances it for the own action (AC-08, F-12, T20 contract — the restore key must be a real row key, not the bare path the previous fixtures invented)', () => {
    const opened = open(CLOSED, openWorkingTreeInput({ index: 1 }));

    const { state } = setFiles(opened, ['src/a.ts', 'src/c.ts'], 'own');
    const { restore } = close(state);

    expect(restore).toEqual({
      listScrollTop: 0,
      selection: { selectedCommitSha: null, side: 'unstaged' },
      focusKey: 'unstaged:src/c.ts',
    });
  });

  it('restores the commit-row focus verbatim when the workspace was opened by shortcut from the commit list and never navigated (AC-08)', () => {
    const opened = open(
      CLOSED,
      openCommitInput({ snapshot: commitSnapshot({ focusKey: 'commit:abc123' }) }),
    );

    const { restore } = close(opened);

    expect(restore?.focusKey).toBe('commit:abc123');
  });

  it('keys every row shape a list can own so no list expires a key of another (AC-08, T29 — R1)', () => {
    // The three shapes in the app, as the rows render them: the commit row
    // carries a `commit:` prefix, a commit file row the bare path, a
    // working-tree row its side. Each list can then claim its own key with a
    // prefix test instead of guessing from the shape of a path.
    // The shape comes from the module the three owners import, so changing it
    // in one place is what this row catches (T30 — Q4).
    const commitRow = commitRowKey('abc123');
    const commitFileKey = focusKeyFor({ kind: 'commit', sha: 'abc123' }, 'src/a.ts');
    const workingTreeKey = focusKeyFor(
      { kind: 'working-tree', side: 'unstaged' },
      'src/a.ts',
    );

    expect({ commitRow, commitFileKey, workingTreeKey }).toEqual({
      commitRow: 'commit:abc123',
      commitFileKey: 'src/a.ts',
      workingTreeKey: 'unstaged:src/a.ts',
    });
    // No shape is claimable by more than one owner.
    for (const foreign of [commitFileKey, workingTreeKey]) {
      expect(foreign.startsWith('commit:')).toBe(false);
    }
    expect(commitRow.startsWith('unstaged:')).toBe(false);
    expect(commitRow.startsWith('staged:')).toBe(false);
  });

  it('names one owner for each of the three row-key shapes so the working-tree arm cannot be folded into the bare-path fallback (AC-08, T31 — V1)', () => {
    // The `working-tree` arm is what keeps the inspector's `commit-file` guard
    // from expiring a `side:` key whose «path» the loaded commit lacks, so
    // each arm is pinned here rather than through a component row.
    expect({
      commitRow: focusKeyOwner(commitRowKey('abc123')),
      unstaged: focusKeyOwner(
        focusKeyFor({ kind: 'working-tree', side: 'unstaged' }, 'src/a.ts'),
      ),
      staged: focusKeyOwner(
        focusKeyFor({ kind: 'working-tree', side: 'staged' }, 'src/a.ts'),
      ),
      commitFile: focusKeyOwner(
        focusKeyFor({ kind: 'commit', sha: 'abc123' }, 'src/a.ts'),
      ),
    }).toEqual({
      commitRow: 'commit-row',
      unstaged: 'working-tree',
      staged: 'working-tree',
      commitFile: 'commit-file',
    });
  });

  it('restores focus on the now-active file instead of the commit-row sha once navigation moved away from it (AC-08)', () => {
    const opened = open(
      CLOSED,
      openCommitInput({ snapshot: commitSnapshot({ focusKey: 'abc123' }), index: 1 }),
    );
    const navigated = navigate(opened, 2);

    const { restore } = close(navigated);

    expect(restore?.focusKey).toBe('src/c.ts');
  });
});

describe('shouldCloseFor', () => {
  const opened = open(CLOSED, openCommitInput());
  const matching = {
    railView: 'history',
    tabId: 'tab-1',
    selectedCommitSha: 'abc123',
    side: null,
  };

  it('is false when the current selection still matches the snapshot', () => {
    expect(shouldCloseFor(opened, matching)).toBe(false);
  });

  it('is true when the rail view changed (AC-17)', () => {
    expect(shouldCloseFor(opened, { ...matching, railView: 'changes' })).toBe(true);
  });

  it('is true when the repository tab changed (AC-17)', () => {
    expect(shouldCloseFor(opened, { ...matching, tabId: 'tab-2' })).toBe(true);
  });

  it('is true when the selected commit changed (AC-17)', () => {
    expect(shouldCloseFor(opened, { ...matching, selectedCommitSha: 'def456' })).toBe(
      true,
    );
  });

  it('is true when the working-tree side changed (AC-17)', () => {
    const workingTreeOpen = open(CLOSED, openWorkingTreeInput());

    expect(
      shouldCloseFor(workingTreeOpen, {
        railView: 'changes',
        tabId: 'tab-1',
        selectedCommitSha: null,
        side: 'staged',
      }),
    ).toBe(true);
  });
});
