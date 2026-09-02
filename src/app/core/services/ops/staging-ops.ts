import { Injectable, inject } from '@angular/core';
import type { HunkRange, RepoChangeKind } from '../../models';
import type { PatchApplyFlags } from '../../utils/patch-builder';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';
import { RepoOps } from './repo-ops';

/**
 * A discard restores tracked paths from the index and removes untracked ones:
 * no ref moves, but `checkout -- <path>` does resolve a conflicted path, so
 * the conflict list has to come back with the changes.
 */
const WORKING_TREE: ReadonlySet<RepoChangeKind> = new Set<RepoChangeKind>([
  'index',
  'worktree',
]);

/** Options accepted by {@link StagingOps.commit}. */
export interface CommitOptions {
  amend?: boolean;
  signoff?: boolean;
  noVerify?: boolean;
}

/** Staging, discarding, ignoring and committing working-tree changes. */
@Injectable({ providedIn: 'root' })
export class StagingOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);

  async stageFiles(state: RepoState, files: readonly string[]): Promise<void> {
    const repo = state.repo();
    if (!repo || files.length === 0) return;
    await this.ops.run(
      async () => {
        await this.ops.git.stageFiles(repo.path, [...files]);
        await this.repoOps.refreshChanges(state);
        await this.repoOps.refreshActiveDiff(state);
      },
      undefined,
      { busy: [state.stagingBusy], failure: 'Could not stage' },
    );
  }

  async unstageFiles(state: RepoState, files: readonly string[]): Promise<void> {
    const repo = state.repo();
    if (!repo || files.length === 0) return;
    await this.ops.run(
      async () => {
        await this.ops.git.unstageFiles(repo.path, [...files]);
        await this.repoOps.refreshChanges(state);
        await this.repoOps.refreshActiveDiff(state);
      },
      undefined,
      { busy: [state.stagingBusy], failure: 'Could not unstage' },
    );
  }

  async stageHunks(
    state: RepoState,
    file: string,
    selection: readonly HunkRange[],
  ): Promise<void> {
    await this.applyHunks(state, file, selection, false);
  }

  async unstageHunks(
    state: RepoState,
    file: string,
    selection: readonly HunkRange[],
  ): Promise<void> {
    await this.applyHunks(state, file, selection, true);
  }

  /**
   * Applies a patch built by `buildLinePatch`, i.e. a line-level stage,
   * unstage or discard. An empty patch means "nothing was selected".
   */
  async applyPatch(
    state: RepoState,
    patch: string,
    flags: PatchApplyFlags,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo || patch.trim().length === 0) return false;
    return this.ops.run(
      async () => {
        await this.ops.git.applyPatch(repo.path, patch, flags.reverse, flags.cached);
        await this.repoOps.refreshChanges(state);
        await this.repoOps.refreshActiveDiff(state);
        return true;
      },
      false,
      { busy: [state.stagingBusy], failure: 'Could not apply the change' },
    );
  }

  async discard(state: RepoState, files: readonly string[]): Promise<string[]> {
    const repo = state.repo();
    if (!repo || files.length === 0) return [];
    return this.ops.run(
      async () => {
        const discarded = await this.ops.git.discardChanges(repo.path, [...files]);
        await this.repoOps.refreshFor(state, WORKING_TREE);
        this.repoOps.clearDiff(state);
        return discarded;
      },
      [],
      { busy: [state.stagingBusy], failure: 'Discard failed' },
    );
  }

  /**
   * Creates a commit and returns its sha.
   *
   * An amend with an empty message is allowed: the backend keeps the existing
   * HEAD message, which is how "amend to add files" is expressed.
   */
  async commit(
    state: RepoState,
    message: string,
    options: CommitOptions = {},
  ): Promise<string | null> {
    const repo = state.repo();
    if (!repo) return null;
    const amend = options.amend ?? false;
    if (message.trim().length === 0 && !amend) return null;
    return this.ops.run(
      async () => {
        const sha = await this.ops.git.createCommit(
          repo.path,
          message,
          amend,
          options.signoff ?? false,
          options.noVerify ?? false,
        );
        await this.repoOps.refreshAll(state);
        return sha;
      },
      null,
      { busy: [state.stagingBusy], failure: 'Commit failed' },
    );
  }

  async headMessage(state: RepoState): Promise<string> {
    const repo = state.repo();
    if (!repo) return '';
    try {
      return await this.ops.git.getHeadCommitMessage(repo.path);
    } catch {
      // No commits yet, or HEAD is unborn — an empty composer is correct here.
      return '';
    }
  }

  /** Appends `pattern` to `.gitignore`, untracking the file when needed. */
  async ignorePath(state: RepoState, pattern: string): Promise<void> {
    const repo = state.repo();
    if (!repo || pattern.trim().length === 0) return;
    await this.ops.run(
      async () => {
        await this.ops.git.ignorePath(repo.path, pattern.trim());
        await this.repoOps.refreshChanges(state);
      },
      undefined,
      {
        busy: [state.stagingBusy],
        failure: 'Could not update .gitignore',
        success: `Ignored ${pattern.trim()}`,
      },
    );
  }

  async setAssumeUnchanged(
    state: RepoState,
    file: string,
    flag: boolean,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    await this.ops.run(
      async () => {
        await this.ops.git.setAssumeUnchanged(repo.path, file, flag);
        await this.repoOps.refreshChanges(state);
      },
      undefined,
      {
        busy: [state.stagingBusy],
        failure: 'Could not change the assume-unchanged flag',
      },
    );
  }

  private async applyHunks(
    state: RepoState,
    file: string,
    selection: readonly HunkRange[],
    unstage: boolean,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo || selection.length === 0) return;
    await this.ops.run(
      async () => {
        if (unstage) {
          await this.ops.git.unstageHunks(repo.path, file, selection);
        } else {
          await this.ops.git.stageHunks(repo.path, file, selection);
        }
        await this.repoOps.refreshChanges(state);
        await this.repoOps.refreshActiveDiff(state);
      },
      undefined,
      {
        busy: [state.stagingBusy],
        failure: unstage ? 'Could not unstage the hunk' : 'Could not stage the hunk',
      },
    );
  }
}
