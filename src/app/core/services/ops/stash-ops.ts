import { Injectable, inject } from '@angular/core';
import type { StashSaveOptions } from '../tauri-git.service';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';
import { RepoOps } from './repo-ops';

/** Stash list and lifecycle. */
@Injectable({ providedIn: 'root' })
export class StashOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);

  async refresh(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    try {
      state.stashes.set(await this.ops.git.stashList(repo.path));
      state.stashError.set(null);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not list stashes', state.stashError);
    }
  }

  /**
   * `git stash push`. Reverts the working tree to HEAD, so the whole workbench
   * is refreshed afterwards.
   */
  async save(state: RepoState, options: StashSaveOptions = {}): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.ops.run(
      async () => {
        await this.ops.git.stashSave(repo.path, options);
        await this.repoOps.refreshAll(state);
        return true;
      },
      false,
      {
        busy: [state.stashBusy],
        failure: 'Could not stash',
        errorSignal: state.stashError,
        success: 'Changes stashed.',
      },
    );
  }

  /** `pop = true` drops the entry after applying it. */
  async apply(state: RepoState, index: number, pop: boolean): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.ops.run(
      async () => {
        await this.ops.git.stashApply(repo.path, index, pop);
        await this.repoOps.refreshAll(state);
        return true;
      },
      false,
      {
        busy: [state.stashBusy],
        failure: pop ? 'Could not pop the stash' : 'Could not apply the stash',
        errorSignal: state.stashError,
        success: pop ? 'Stash popped.' : 'Stash applied.',
      },
    );
  }

  async drop(state: RepoState, index: number): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.ops.run(
      async () => {
        await this.ops.git.stashDrop(repo.path, index);
        await this.refresh(state);
        return true;
      },
      false,
      {
        busy: [state.stashBusy],
        failure: 'Could not drop the stash',
        errorSignal: state.stashError,
        success: 'Stash dropped.',
      },
    );
  }

  /** Full diff of one stash entry, for the diff viewer. */
  async show(state: RepoState, index: number): Promise<string> {
    const repo = state.repo();
    if (!repo) return '';
    return this.ops.run(() => this.ops.git.stashShow(repo.path, index), '', {
      failure: 'Could not read the stash',
      errorSignal: state.stashError,
    });
  }

  /** Creates `branchName` from the stash's parent commit and applies it there. */
  async toBranch(
    state: RepoState,
    index: number,
    branchName: string,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo || branchName.trim().length === 0) return false;
    return this.ops.run(
      async () => {
        await this.ops.git.stashBranch(repo.path, index, branchName);
        await this.repoOps.refreshAll(state);
        return true;
      },
      false,
      {
        busy: [state.stashBusy],
        failure: 'Could not create the branch from the stash',
        errorSignal: state.stashError,
        success: `Stash applied on ${branchName}.`,
      },
    );
  }
}
