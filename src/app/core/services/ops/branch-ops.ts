import { Injectable, inject } from '@angular/core';
import type { CheckoutResult, CompareResult, FastForwardResult } from '../../models';
import { AUTH_REQUIRED_TOAST } from '../git-auth-error';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';
import { RepoOps } from './repo-ops';

export interface CheckoutOptions {
  /** Create a local branch tracking the given remote branch. */
  createTracking?: boolean;
  /** Overwrite conflicting tracked files; untracked files are never removed. */
  force?: boolean;
}

export interface CreateBranchOptions {
  /** Commit, branch or tag to branch from; defaults to HEAD. */
  startPoint?: string | null;
  checkout?: boolean;
}

/** Branch and tag lifecycle, plus ref comparison. */
@Injectable({ providedIn: 'root' })
export class BranchOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);

  /**
   * Switches to `name`.
   *
   * Structured outcomes (`WouldOverwrite`, `DetachedHead`) are returned for the
   * caller to act on and are deliberately not toasted — the UI turns them into
   * a dialog with the right next step.
   */
  async checkout(
    state: RepoState,
    name: string,
    options: CheckoutOptions = {},
  ): Promise<CheckoutResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () =>
        this.ops.git.checkoutBranch(
          repo.path,
          name,
          options.createTracking ?? false,
          options.force ?? false,
        ),
      null,
      { busy: [state.loading, state.branchBusy], failure: 'Checkout failed' },
    );
    if (!result) return null;
    if (result.kind === 'success' || result.kind === 'detached_head') {
      await this.repoOps.refreshAll(state);
      this.ops.toast.success(`Switched to ${name}.`);
    } else if (result.kind === 'error') {
      this.ops.toast.error(result.message);
    }
    return result;
  }

  /** Checks out a commit, tag or ref, leaving HEAD detached. */
  async checkoutCommit(state: RepoState, rev: string): Promise<CheckoutResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.checkoutCommit(repo.path, rev),
      null,
      { busy: [state.loading, state.branchBusy], failure: 'Checkout failed' },
    );
    if (!result) return null;
    if (result.kind === 'success' || result.kind === 'detached_head') {
      await this.repoOps.refreshAll(state);
      this.ops.toast.info(`HEAD detached at ${rev}.`);
    } else if (result.kind === 'error') {
      this.ops.toast.error(result.message);
    }
    return result;
  }

  async create(
    state: RepoState,
    name: string,
    options: CreateBranchOptions = {},
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo || name.trim().length === 0) return false;
    return this.mutate(
      state,
      async () => {
        await this.ops.git.createBranch(
          repo.path,
          name,
          options.startPoint ?? null,
          options.checkout ?? false,
        );
      },
      options.checkout ? `Created and checked out ${name}.` : `Created ${name}.`,
      'Could not create the branch',
      options.checkout,
    );
  }

  async remove(state: RepoState, name: string, force = false): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.deleteBranch(repo.path, name, force),
      `Deleted ${name}.`,
      'Could not delete the branch',
    );
  }

  async rename(state: RepoState, oldName: string, newName: string): Promise<boolean> {
    const repo = state.repo();
    if (!repo || newName.trim().length === 0) return false;
    return this.mutate(
      state,
      () => this.ops.git.renameBranch(repo.path, oldName, newName),
      `Renamed ${oldName} to ${newName}.`,
      'Could not rename the branch',
    );
  }

  /** `upstream = null` removes the tracking relationship. */
  async setUpstream(
    state: RepoState,
    branch: string,
    upstream: string | null,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.setUpstream(repo.path, branch, upstream),
      upstream
        ? `${branch} now tracks ${upstream}.`
        : `${branch} no longer tracks an upstream.`,
      'Could not set the upstream',
    );
  }

  async deleteRemoteBranch(
    state: RepoState,
    remote: string,
    branch: string,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.deleteRemoteBranch(repo.path, remote, branch),
      `Deleted ${remote}/${branch}.`,
      'Could not delete the remote branch',
    );
  }

  async fastForward(
    state: RepoState,
    branch: string,
  ): Promise<FastForwardResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const result = await this.ops.run(
      () => this.ops.git.fastForward(repo.path, branch),
      null,
      { busy: [state.loading, state.branchBusy], failure: 'Fast-forward failed' },
    );
    if (!result) return null;
    switch (result.kind) {
      case 'fast_forwarded':
        this.ops.toast.success(`Fast-forwarded ${branch}.`);
        await this.repoOps.refreshAll(state);
        break;
      case 'already_up_to_date':
        this.ops.toast.info(`${branch} is already up to date.`);
        break;
      case 'no_upstream':
        this.ops.toast.warning(`${branch} has no upstream to fast-forward to.`);
        break;
      case 'not_fast_forwardable':
        this.ops.toast.warning(
          `${branch} has diverged from its upstream — pull or rebase instead.`,
        );
        break;
      case 'network_error':
        this.ops.toast.error(result.message);
        break;
      case 'auth_required':
        this.ops.toast.show({
          kind: 'error',
          message: AUTH_REQUIRED_TOAST,
          key: 'git-auth',
          timeoutMs: 10000,
        });
        break;
    }
    return result;
  }

  /** Ahead/behind counts between two refs, for the compare view. */
  async compare(
    state: RepoState,
    base: string,
    head: string,
  ): Promise<CompareResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    return this.ops.run(() => this.ops.git.compareRefs(repo.path, base, head), null, {
      failure: 'Could not compare the refs',
    });
  }

  // ── Tags ────────────────────────────────────────────────────────────────

  /** A non-empty `message` creates an annotated tag. */
  async createTag(
    state: RepoState,
    name: string,
    target: string | null = null,
    message: string | null = null,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo || name.trim().length === 0) return false;
    return this.mutate(
      state,
      () => this.ops.git.createTag(repo.path, name, target, message),
      `Tagged ${name}.`,
      'Could not create the tag',
    );
  }

  async deleteTag(state: RepoState, name: string): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.deleteTag(repo.path, name),
      `Deleted tag ${name}.`,
      'Could not delete the tag',
    );
  }

  async pushTag(state: RepoState, remote: string, name: string): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.pushTag(repo.path, remote, name),
      `Pushed tag ${name} to ${remote}.`,
      'Could not push the tag',
      false,
    );
  }

  async deleteRemoteTag(
    state: RepoState,
    remote: string,
    name: string,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!repo) return false;
    return this.mutate(
      state,
      () => this.ops.git.deleteRemoteTag(repo.path, remote, name),
      `Deleted tag ${name} on ${remote}.`,
      'Could not delete the remote tag',
      false,
    );
  }

  /**
   * Runs a ref mutation, then reloads what it can have changed: the ref list
   * always, and the whole workbench when HEAD may have moved.
   */
  private async mutate(
    state: RepoState,
    action: () => Promise<void>,
    success: string,
    failure: string,
    headMayMove = false,
  ): Promise<boolean> {
    const result = await this.ops.run(
      async () => {
        await action();
        if (headMayMove) {
          await this.repoOps.refreshAll(state);
        } else {
          await this.repoOps.refreshRefs(state);
        }
        return true;
      },
      false,
      { busy: [state.branchBusy], failure, success },
    );
    return result;
  }
}
