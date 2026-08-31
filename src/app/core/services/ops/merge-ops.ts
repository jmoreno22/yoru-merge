import { Injectable, inject } from '@angular/core';
import type { MergeContent, MergeResult, SequencerResult } from '../../models';
import type { ConflictSide } from '../tauri-git.service';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';
import { describeFiles } from './remote-ops';
import { RepoOps } from './repo-ops';

export interface MergeOptions {
  /** Stage the merge result without creating a commit. */
  squash?: boolean;
  /** Always create a merge commit, even when a fast-forward is possible. */
  noFf?: boolean;
}

/** Merging branches and resolving the conflicts that follow. */
@Injectable({ providedIn: 'root' })
export class MergeOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);

  async merge(
    state: RepoState,
    branch: string,
    options: MergeOptions = {},
  ): Promise<MergeResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () =>
        this.ops.git.mergeBranch(
          repo.path,
          branch,
          options.squash ?? false,
          options.noFf ?? false,
        ),
      null,
      {
        busy: [state.loading, state.mergeBusy],
        failure: 'Merge failed',
        errorSignal: state.mergeError,
      },
    );
    if (!result) return null;
    switch (result.kind) {
      case 'up_to_date':
        this.ops.toast.info(`${branch} is already merged.`);
        break;
      case 'fast_forward':
        this.ops.toast.success(`Fast-forwarded to ${branch}.`);
        break;
      case 'success':
        this.ops.toast.success(`Merged ${branch}.`);
        break;
      case 'squashed':
        this.ops.toast.success(`Squashed ${branch} into the index.`);
        break;
      case 'conflicts':
        this.ops.toast.warning(
          `Merge stopped with conflicts in ${describeFiles(result.files)}.`,
          8000,
        );
        break;
    }
    await this.repoOps.refreshAll(state);
    return result;
  }

  async refreshConflicts(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    try {
      state.conflicts.set(await this.ops.git.getConflicts(repo.path));
      state.mergeError.set(null);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not list conflicts', state.mergeError);
    }
  }

  async mergeContent(state: RepoState, file: string): Promise<MergeContent | null> {
    const repo = state.repo();
    if (!repo) return null;
    return this.ops.run(() => this.ops.git.getMergeContent(repo.path, file), null, {
      failure: 'Could not read the conflict',
      errorSignal: state.mergeError,
    });
  }

  /** Writes the resolved text to disk and stages the file. */
  async resolve(
    state: RepoState,
    file: string,
    resolvedContent: string,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    await this.ops.run(
      async () => {
        await this.ops.git.resolveConflict(repo.path, file, resolvedContent);
        await this.afterResolve(state);
      },
      undefined,
      {
        busy: [state.mergeBusy],
        failure: 'Could not save the resolution',
        errorSignal: state.mergeError,
      },
    );
  }

  /** Resolves by keeping one side whole (`--ours` / `--theirs`), then staging. */
  async take(state: RepoState, file: string, side: ConflictSide): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    await this.ops.run(
      async () => {
        await this.ops.git.resolveConflictTake(repo.path, file, side);
        await this.afterResolve(state);
      },
      undefined,
      {
        busy: [state.mergeBusy],
        failure: 'Could not resolve the conflict',
        errorSignal: state.mergeError,
        success: `Kept ${side === 'ours' ? 'our' : 'their'} version of ${file}.`,
      },
    );
  }

  /** Resolves a delete/modify conflict by removing the file. */
  async removeConflicted(state: RepoState, file: string): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    await this.ops.run(
      async () => {
        await this.ops.git.resolveConflictDelete(repo.path, file);
        await this.afterResolve(state);
      },
      undefined,
      {
        busy: [state.mergeBusy],
        failure: 'Could not delete the file',
        errorSignal: state.mergeError,
        success: `Deleted ${file}.`,
      },
    );
  }

  /** Creates the merge commit once every conflict is resolved and staged. */
  async continueMerge(state: RepoState): Promise<SequencerResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.mergeContinue(repo.path),
      null,
      {
        busy: [state.loading, state.mergeBusy],
        failure: 'Could not finish the merge',
        errorSignal: state.mergeError,
      },
    );
    if (!result) return null;
    if (result.kind === 'completed') {
      this.ops.toast.success('Merge committed.');
    } else if (result.kind === 'conflicts') {
      this.ops.toast.warning(`Still unresolved: ${describeFiles(result.files)}.`, 8000);
    } else {
      this.ops.toast.error(result.message);
      state.mergeError.set(result.message);
    }
    await this.repoOps.refreshAll(state);
    return result;
  }

  async abort(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    await this.ops.run(
      async () => {
        await this.ops.git.abortMerge(repo.path);
        state.conflicts.set([]);
        await this.repoOps.refreshAll(state);
      },
      undefined,
      {
        busy: [state.loading, state.mergeBusy],
        failure: 'Could not abort the merge',
        errorSignal: state.mergeError,
        success: 'Merge aborted.',
      },
    );
  }

  /**
   * After a single file is resolved: re-read the conflict list, and only pay
   * for a full refresh once the last conflict is gone.
   */
  private async afterResolve(state: RepoState): Promise<void> {
    await this.refreshConflicts(state);
    if (state.conflicts().length === 0) {
      await this.repoOps.refreshAll(state);
    } else {
      await this.repoOps.refreshChanges(state);
    }
  }
}
