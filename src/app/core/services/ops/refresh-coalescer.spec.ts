import { describe, expect, it } from 'vitest';
import type { RepoChangeKind } from '../../models';
import { RefreshCoalescer } from './refresh-coalescer';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('RefreshCoalescer', () => {
  it('runs the first request immediately', async () => {
    const rounds: RepoChangeKind[][] = [];
    const coalescer = new RefreshCoalescer(async (kinds) => {
      rounds.push([...kinds]);
    });

    await coalescer.run(['refs']);

    expect(rounds).toEqual([['refs']]);
  });

  it('collapses three requests made during a refresh into one follow-up', async () => {
    const rounds: RepoChangeKind[][] = [];
    const gate = deferred();
    const coalescer = new RefreshCoalescer(async (kinds) => {
      rounds.push([...kinds]);
      if (rounds.length === 1) await gate.promise;
    });

    const first = coalescer.run(['refs']);
    void coalescer.run(['worktree']);
    void coalescer.run(['index']);
    void coalescer.run(['refs']);
    gate.resolve();
    await first;

    expect(rounds).toEqual([['refs'], ['worktree', 'index', 'refs']]);
  });

  it('keeps a request that arrives as the queued round starts', async () => {
    const rounds: RepoChangeKind[][] = [];
    const gate = deferred();
    const coalescer: RefreshCoalescer = new RefreshCoalescer(async (kinds) => {
      rounds.push([...kinds]);
      if (rounds.length === 1) await gate.promise;
      if (rounds.length === 2) void coalescer.run(['index']);
    });

    const first = coalescer.run(['refs']);
    void coalescer.run(['worktree']);
    gate.resolve();
    await first;

    expect(rounds).toEqual([['refs'], ['worktree'], ['index']]);
  });

  it('starts a fresh round once the queue has drained', async () => {
    const rounds: RepoChangeKind[][] = [];
    const coalescer = new RefreshCoalescer(async (kinds) => {
      rounds.push([...kinds]);
    });

    await coalescer.run(['refs']);
    await coalescer.run(['worktree']);

    expect(rounds).toEqual([['refs'], ['worktree']]);
  });
});
