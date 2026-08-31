import { Injectable, inject } from '@angular/core';
import type {
  PatchApplyResult,
  RebaseResult,
  RebaseTodoEntry,
  ResetMode,
  ResetResult,
  SequencerResult,
} from '../../models';
import { shortSha } from '../../utils/short-sha';
import type { RepoState } from '../workspace.store';
import { BranchOps } from './branch-ops';
import { OpsRunner } from './ops-runner';
import { describeFiles } from './remote-ops';
import { RepoOps } from './repo-ops';

/** Every outcome shape the sequencer commands share. */
type StepResult = SequencerResult | PatchApplyResult;

/** Cherry-pick, revert, rebase and reset — everything that replays commits. */
@Injectable({ providedIn: 'root' })
export class SequencerOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);
  private readonly branchOps = inject(BranchOps);

  async cherryPick(state: RepoState, sha: string): Promise<PatchApplyResult | null> {
    return this.runStep<PatchApplyResult>(
      state,
      (path) => this.ops.git.cherryPick(path, sha),
      `Cherry-picked ${shortSha(sha)}.`,
      'Cherry-pick failed',
    );
  }

  /**
   * Cherry-picks `sha` onto `targetBranch`, checking it out first when needed.
   * The working tree is left on `targetBranch`.
   */
  async cherryPickOnto(
    state: RepoState,
    sha: string,
    targetBranch: string,
  ): Promise<PatchApplyResult | null> {
    if (state.currentBranch() === targetBranch) {
      return this.cherryPick(state, sha);
    }
    const checkout = await this.branchOps.checkout(state, targetBranch);
    if (checkout?.kind !== 'success' && checkout?.kind !== 'detached_head') {
      return null;
    }
    return this.cherryPick(state, sha);
  }

  async revert(state: RepoState, sha: string): Promise<PatchApplyResult | null> {
    return this.runStep<PatchApplyResult>(
      state,
      (path) => this.ops.git.revertCommit(path, sha),
      `Reverted ${shortSha(sha)}.`,
      'Revert failed',
    );
  }

  async rebase(
    state: RepoState,
    branch: string,
    onto: string,
  ): Promise<RebaseResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.rebaseBranch(repo.path, branch, onto),
      null,
      {
        busy: [state.loading, state.sequencerBusy],
        failure: 'Rebase failed',
        errorSignal: state.advancedOpError,
      },
    );
    if (!result) return null;
    this.reportRebase(result, `${branch} onto ${onto}`, state);
    await this.repoOps.refreshAll(state);
    return result;
  }

  async rebaseTodo(state: RepoState, base: string): Promise<RebaseTodoEntry[]> {
    const repo = state.repo();
    if (!repo) return [];
    return this.ops.run(() => this.ops.git.getRebaseTodo(repo.path, base), [], {
      failure: 'Could not read the rebase plan',
    });
  }

  /** Runs an edited interactive-rebase todo list. */
  async applyRebase(
    state: RepoState,
    base: string,
    entries: RebaseTodoEntry[],
  ): Promise<RebaseResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.applyRebase(repo.path, base, entries),
      null,
      {
        busy: [state.loading, state.sequencerBusy],
        failure: 'Rebase failed',
        errorSignal: state.advancedOpError,
      },
    );
    if (!result) return null;
    this.reportRebase(result, 'the branch', state);
    await this.repoOps.refreshAll(state);
    return result;
  }

  async reset(
    state: RepoState,
    sha: string,
    mode: ResetMode,
  ): Promise<ResetResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.resetToCommit(repo.path, sha, mode),
      null,
      {
        busy: [state.loading, state.sequencerBusy],
        failure: 'Reset failed',
        errorSignal: state.advancedOpError,
      },
    );
    if (!result) return null;
    if (result.kind === 'reset') {
      this.ops.toast.success(`Reset to ${shortSha(sha)} (${result.mode}).`);
      await this.repoOps.refreshAll(state);
    } else {
      state.advancedOpError.set(result.message);
      this.ops.toast.error(result.message);
    }
    return result;
  }

  // ── Continue / abort / skip ─────────────────────────────────────────────

  async rebaseContinue(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.rebaseContinue(path),
      'Rebase finished.',
      'Could not continue the rebase',
    );
  }

  async rebaseSkip(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.rebaseSkip(path),
      'Commit skipped.',
      'Could not skip the commit',
    );
  }

  async rebaseAbort(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.rebaseAbort(path),
      'Rebase aborted.',
      'Could not abort the rebase',
    );
  }

  async cherryPickContinue(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.cherryPickContinue(path),
      'Cherry-pick finished.',
      'Could not continue the cherry-pick',
    );
  }

  async cherryPickAbort(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.cherryPickAbort(path),
      'Cherry-pick aborted.',
      'Could not abort the cherry-pick',
    );
  }

  async cherryPickSkip(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.cherryPickSkip(path),
      'Commit skipped.',
      'Could not skip the commit',
    );
  }

  async revertContinue(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.revertContinue(path),
      'Revert finished.',
      'Could not continue the revert',
    );
  }

  async revertAbort(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.revertAbort(path),
      'Revert aborted.',
      'Could not abort the revert',
    );
  }

  async revertSkip(state: RepoState): Promise<SequencerResult | null> {
    return this.runStep<SequencerResult>(
      state,
      (path) => this.ops.git.revertSkip(path),
      'Commit skipped.',
      'Could not skip the commit',
    );
  }

  /**
   * Continues whichever sequence git is parked in. Lets the repo-state banner
   * expose one "Continue" button instead of four.
   */
  async continueCurrent(state: RepoState): Promise<SequencerResult | null> {
    switch (state.repoState().state) {
      case 'rebasing':
        return this.rebaseContinue(state);
      case 'cherry_picking':
        return this.cherryPickContinue(state);
      case 'reverting':
        return this.revertContinue(state);
      default:
        return null;
    }
  }

  /** Aborts whichever sequence git is parked in. */
  async abortCurrent(state: RepoState): Promise<SequencerResult | null> {
    switch (state.repoState().state) {
      case 'rebasing':
        return this.rebaseAbort(state);
      case 'cherry_picking':
        return this.cherryPickAbort(state);
      case 'reverting':
        return this.revertAbort(state);
      default:
        return null;
    }
  }

  /**
   * Skips the current commit of whichever sequence git is parked in.
   *
   * A merge has nothing to skip — and `git rebase --skip` inside a cherry-pick
   * fails outright, which is why this routes rather than always rebasing.
   */
  async skipCurrent(state: RepoState): Promise<SequencerResult | null> {
    switch (state.repoState().state) {
      case 'rebasing':
        return this.rebaseSkip(state);
      case 'cherry_picking':
        return this.cherryPickSkip(state);
      case 'reverting':
        return this.revertSkip(state);
      default:
        return null;
    }
  }

  /** Shared shape for every sequencer command: run, report, refresh. */
  private async runStep<T extends StepResult>(
    state: RepoState,
    action: (path: string) => Promise<T>,
    success: string,
    failure: string,
  ): Promise<T | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run<T | null>(() => action(repo.path), null, {
      busy: [state.loading, state.sequencerBusy],
      failure,
      errorSignal: state.advancedOpError,
    });
    if (!result) return null;
    this.reportOutcome(result, success, state);
    await this.repoOps.refreshAll(state);
    return result;
  }

  private reportOutcome(result: StepResult, success: string, state: RepoState): void {
    switch (result.kind) {
      case 'completed':
      case 'applied':
        this.ops.toast.success(success);
        break;
      case 'conflicts':
        state.advancedOpError.set(`Conflicts in ${describeFiles(result.files)}`);
        this.ops.toast.warning(
          `Stopped with conflicts in ${describeFiles(result.files)}.`,
          8000,
        );
        break;
      case 'error':
        state.advancedOpError.set(result.message);
        this.ops.toast.error(result.message);
        break;
    }
  }

  private reportRebase(result: RebaseResult, label: string, state: RepoState): void {
    switch (result.kind) {
      case 'rebased':
        this.ops.toast.success(`Rebased ${label}.`);
        break;
      case 'up_to_date':
        this.ops.toast.info(`${label} is already up to date.`);
        break;
      case 'conflicts':
        state.advancedOpError.set(`Rebase conflicts in ${describeFiles(result.files)}`);
        this.ops.toast.warning(
          `Rebase stopped with conflicts in ${describeFiles(result.files)}.`,
          8000,
        );
        break;
      case 'paused':
        this.ops.toast.info(result.message, 8000);
        break;
      case 'not_possible':
        state.advancedOpError.set(`Rebase of ${label} is not possible.`);
        this.ops.toast.error(`Rebase of ${label} is not possible.`);
        break;
      case 'error':
        state.advancedOpError.set(result.message);
        this.ops.toast.error(result.message);
        break;
    }
  }
}
