import { describe, expect, it } from 'vitest';
import type { BranchInfo } from '../../../core/models';
import { catchUpBlocker, type RefsMenuContext, remoteBranchMenu } from './refs-menus';

function branch(name: string, overrides: Partial<BranchInfo> = {}): BranchInfo {
  return {
    name,
    sha: 'a'.repeat(40),
    is_remote: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    ...overrides,
  };
}

const REMOTE_DEVELOP = branch('origin/develop', { is_remote: true });

/** `develop` tracking `origin/develop`, two commits behind and none ahead. */
const BEHIND = branch('develop', { upstream: 'origin/develop', behind: 2 });

function context(localBranches: readonly BranchInfo[]): RefsMenuContext {
  return {
    currentBranch: 'feat/x',
    remotes: ['origin'],
    hasWebUrl: false,
    canOpenPullRequest: false,
    localBranches,
  };
}

describe('catchUpBlocker', () => {
  it('lets a tracking branch that is only behind catch up', () => {
    expect(catchUpBlocker(REMOTE_DEVELOP, 'develop', [BEHIND])).toBeNull();
  });

  it('blocks when there is no local branch to move', () => {
    expect(catchUpBlocker(REMOTE_DEVELOP, 'develop', [])).toBe(
      'There is no local develop yet',
    );
  });

  it('blocks when the local branch tracks something else', () => {
    const other = { ...BEHIND, upstream: 'upstream/develop' };
    expect(catchUpBlocker(REMOTE_DEVELOP, 'develop', [other])).toBe(
      'develop does not track origin/develop',
    );
  });

  it('blocks when the local branch has commits of its own', () => {
    const diverged = { ...BEHIND, ahead: 1 };
    expect(catchUpBlocker(REMOTE_DEVELOP, 'develop', [diverged])).toBe(
      'develop has commits origin/develop lacks',
    );
  });

  it('blocks when there is nothing to catch up on', () => {
    const level = { ...BEHIND, behind: 0 };
    expect(catchUpBlocker(REMOTE_DEVELOP, 'develop', [level])).toBe(
      'develop is already up to date',
    );
  });
});

describe('remoteBranchMenu', () => {
  function item(menu: ReturnType<typeof remoteBranchMenu>, id: string) {
    const found = menu.find((entry) => entry.id === id);
    if (!found) throw new Error(`No ${id} item.`);
    return found;
  }

  it('makes checkout-and-fast-forward the primary item when it can run', () => {
    const menu = remoteBranchMenu(REMOTE_DEVELOP, 'origin', context([BEHIND]));
    expect(item(menu, 'checkout-fast-forward')).toMatchObject({
      label: 'Checkout develop and fast-forward',
      tone: 'primary',
      disabled: false,
    });
    expect(item(menu, 'checkout-tracking').tone).toBe('default');
  });

  it('disables it with the reason, leaving plain checkout primary', () => {
    const menu = remoteBranchMenu(REMOTE_DEVELOP, 'origin', context([]));
    expect(item(menu, 'checkout-fast-forward')).toMatchObject({
      disabled: true,
      disabledReason: 'There is no local develop yet',
    });
    expect(item(menu, 'checkout-tracking').tone).toBe('primary');
  });
});
