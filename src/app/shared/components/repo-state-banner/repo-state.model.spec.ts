import { describe, expect, it } from 'vitest';
import { CLEAN_REPO_STATE, type RepoStateInfo } from '../../../core/models';
import { repoStateBanner } from './repo-state.model';

const state = (patch: Partial<RepoStateInfo>): RepoStateInfo => ({
  ...CLEAN_REPO_STATE,
  ...patch,
});

describe('repoStateBanner', () => {
  it('returns null on a clean tree', () => {
    expect(repoStateBanner(CLEAN_REPO_STATE, 0)).toBeNull();
  });

  it('drives a merge through the merge actions', () => {
    const banner = repoStateBanner(state({ state: 'merging' }), 2);
    expect(banner?.title).toBe('Merging');
    expect(banner?.driver).toBe('merge');
    expect(banner?.canSkip).toBe(false);
  });

  it('drives the other sequences through the sequencer', () => {
    for (const kind of ['rebasing', 'cherry_picking', 'reverting'] as const) {
      expect(repoStateBanner(state({ state: kind }), 0)?.driver).toBe('sequencer');
    }
  });

  it('numbers a rebase only when git reported both step and total', () => {
    expect(
      repoStateBanner(state({ state: 'rebasing', rebase_step: 3, rebase_total: 7 }), 0)
        ?.title,
    ).toBe('Rebasing 3 of 7');
    expect(
      repoStateBanner(state({ state: 'rebasing', rebase_step: 3 }), 0)?.title,
    ).toBe('Rebasing');
  });

  it('offers Skip for every sequence that has a commit to step over', () => {
    for (const kind of ['rebasing', 'cherry_picking', 'reverting'] as const) {
      expect(repoStateBanner(state({ state: kind }), 0)?.canSkip).toBe(true);
    }
    expect(repoStateBanner(state({ state: 'merging' }), 0)?.canSkip).toBe(false);
  });

  it('blocks Continue while files are conflicted and says why', () => {
    const banner = repoStateBanner(state({ state: 'cherry_picking' }), 1);
    expect(banner?.canContinue).toBe(false);
    expect(banner?.continueBlockedReason).toBe('Resolve 1 file first');
    expect(banner?.canResolve).toBe(true);
    expect(banner?.hint).toBe('1 file still conflicted.');
  });

  it('unblocks Continue once nothing conflicts', () => {
    const banner = repoStateBanner(state({ state: 'merging' }), 0);
    expect(banner?.canContinue).toBe(true);
    expect(banner?.continueBlockedReason).toBeNull();
    expect(banner?.canResolve).toBe(false);
  });

  it('offers no buttons for a bisect and points at the terminal', () => {
    const banner = repoStateBanner(state({ state: 'bisecting' }), 0);
    expect(banner?.driver).toBe('none');
    expect(banner?.canAbort).toBe(false);
    expect(banner?.hint).toContain('git bisect reset');
  });
});
