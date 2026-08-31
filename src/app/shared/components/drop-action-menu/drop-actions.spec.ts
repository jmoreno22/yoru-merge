import { describe, expect, it } from 'vitest';
import type { DragPayload } from '../../../core/services/drag-payload.service';
import { canDrop, dropMenuItems } from './drop-actions';

const SHA = '1234567890abcdef1234567890abcdef12345678';

function localBranch(name: string, isCurrent = false): DragPayload {
  return { type: 'branch', name, isRemote: false, isCurrent };
}

function remoteBranch(name: string): DragPayload {
  return { type: 'branch', name, isRemote: true, isCurrent: false };
}

function commit(sha = SHA): DragPayload {
  return { type: 'commit', sha };
}

function labels(items: readonly { label: string }[]): string[] {
  return items.map((item) => item.label);
}

describe('canDrop', () => {
  it('refuses a remote-tracking branch as a target', () => {
    expect(canDrop(localBranch('main'), remoteBranch('origin/main'))).toBe(false);
    expect(canDrop(commit(), remoteBranch('origin/main'))).toBe(false);
  });

  it('only lets the current branch move to a commit', () => {
    expect(canDrop(localBranch('main', true), commit())).toBe(true);
    expect(canDrop(localBranch('feat/x'), commit())).toBe(false);
  });

  it('accepts the branch and commit pairs that lead somewhere', () => {
    expect(canDrop(localBranch('feat/x'), localBranch('main'))).toBe(true);
    expect(canDrop(commit(), localBranch('main'))).toBe(true);
    expect(canDrop(commit('a'), commit('b'))).toBe(true);
  });
});

describe('dropMenuItems: branch onto branch', () => {
  it('says it will switch branches when the target is not checked out', () => {
    const items = dropMenuItems(localBranch('feat/x'), localBranch('release'), {
      currentBranch: 'main',
    });
    expect(items[0]).toMatchObject({
      id: 'merge',
      label: 'Switch to release, then merge feat/x',
    });
  });

  it('drops the switch from the label when the target is already current', () => {
    const items = dropMenuItems(localBranch('feat/x'), localBranch('main'), {
      currentBranch: 'main',
    });
    expect(items[0]).toMatchObject({
      id: 'merge',
      label: 'Merge feat/x into main',
    });
  });

  it('names the branch being rebased, not HEAD', () => {
    const items = dropMenuItems(localBranch('feat/x'), localBranch('main'), {
      currentBranch: 'main',
    });
    expect(items[1]).toMatchObject({
      id: 'rebase',
      label: 'Rebase feat/x onto main',
      disabled: false,
    });
  });

  it('cannot rebase a remote-tracking branch', () => {
    const items = dropMenuItems(remoteBranch('origin/feat/x'), localBranch('main'), {
      currentBranch: 'main',
    });
    expect(items[1]).toMatchObject({ id: 'rebase', disabled: true });
  });
});

describe('dropMenuItems: branch onto commit', () => {
  it('offers reset and interactive rebase for the branch being moved', () => {
    const items = dropMenuItems(localBranch('main', true), commit(), {
      currentBranch: 'main',
    });
    expect(labels(items)).toEqual([
      'Reset main to 1234567',
      'Interactive rebase from 1234567…',
    ]);
    expect(items[0]?.children?.map((child) => child.id)).toEqual([
      'reset-soft',
      'reset-mixed',
      'reset-hard',
    ]);
  });
});

describe('dropMenuItems: commit onto branch', () => {
  it('cherry-picks onto the branch that received the drop', () => {
    const items = dropMenuItems(commit(), localBranch('release'), {
      currentBranch: 'main',
    });
    expect(labels(items)).toEqual(['Cherry-pick 1234567 onto release']);
  });

  it('adds reset only when that branch is the current one', () => {
    const items = dropMenuItems(commit(), localBranch('main', true), {
      currentBranch: 'main',
    });
    expect(labels(items)).toEqual([
      'Cherry-pick 1234567 onto main',
      'Reset main to 1234567',
      'Interactive rebase from 1234567…',
    ]);
  });
});

describe('dropMenuItems: commit onto commit', () => {
  it('cherry-picks onto the current branch', () => {
    const items = dropMenuItems(commit(), commit('f'.repeat(40)), {
      currentBranch: 'main',
    });
    expect(items).toMatchObject([
      { id: 'cherry-pick', label: 'Cherry-pick 1234567 onto main', disabled: false },
    ]);
  });

  it('explains why it cannot run with a detached HEAD', () => {
    const items = dropMenuItems(commit(), commit('f'.repeat(40)), {
      currentBranch: null,
    });
    expect(items[0]).toMatchObject({ disabled: true });
  });
});
