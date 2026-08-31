import { DestroyRef, Injectable, inject } from '@angular/core';
import type { PullResult, PushResult } from '../../models';
import { AUTH_REQUIRED_TOAST } from '../git-auth-error';
import { PreferencesService } from '../preferences.service';
import type { PullMode } from '../tauri-git.service';
import { type RepoState, WorkspaceStore } from '../workspace.store';
import { OpsRunner } from './ops-runner';
import { RepoOps } from './repo-ops';

export interface FetchOptions {
  /** `null` fetches every remote. */
  remote?: string | null;
  prune?: boolean;
  tags?: boolean;
  /** Suppresses the success toast (used by the auto-fetch timer). */
  silent?: boolean;
}

export interface PullOptions {
  remote?: string;
  branch?: string;
  mode?: PullMode;
  autostash?: boolean;
}

export interface PushActionOptions {
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
  tags?: boolean;
}

/** How long the progress bar lingers after a fetch finishes. */
const PROGRESS_GRACE_MS = 2000;

/** Auto-fetch is evaluated on this cadence, not on the interval itself. */
const AUTO_FETCH_TICK_MS = 60_000;

/** Fetch, pull, push and remote CRUD, plus the background auto-fetch timer. */
@Injectable({ providedIn: 'root' })
export class RemoteOps {
  private readonly ops = inject(OpsRunner);
  private readonly repoOps = inject(RepoOps);
  private readonly prefs = inject(PreferencesService);
  private readonly workspace = inject(WorkspaceStore);

  /** Last auto-fetch per repo path, so tab switches don't re-trigger one. */
  private readonly lastAutoFetch = new Map<string, number>();

  constructor() {
    const timer = setInterval(() => void this.autoFetchTick(), AUTO_FETCH_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async fetch(state: RepoState, options: FetchOptions = {}): Promise<boolean> {
    const repo = state.repo();
    if (!repo || state.isFetching()) return false;
    state.clearFetchProgressTimer();
    state.isFetching.set(true);
    state.fetchProgress.set(null);
    try {
      await this.ops.git.fetchRemote(
        repo.path,
        options.remote ?? 'origin',
        options.prune ?? false,
        options.tags ?? false,
        (progress) => state.fetchProgress.set(progress),
      );
      await this.repoOps.refreshAll(state);
      if (!options.silent) {
        this.ops.toast.success(
          options.remote === null ? 'Fetched all remotes.' : 'Fetch complete.',
        );
      }
      return true;
    } catch (error: unknown) {
      this.ops.reportError(error, 'Fetch failed');
      return false;
    } finally {
      state.isFetching.set(false);
      // Let the terminal "done" state show before the bar disappears.
      state.setFetchProgressTimer(
        () => state.fetchProgress.set(null),
        PROGRESS_GRACE_MS,
      );
    }
  }

  async pull(state: RepoState, options: PullOptions = {}): Promise<PullResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const branch = options.branch ?? state.currentBranch();
    if (!branch) {
      this.ops.toast.warning('Detached HEAD — check out a branch to pull.');
      return null;
    }
    const result = await this.ops.run(
      () =>
        this.ops.git.pull(
          repo.path,
          options.remote ?? 'origin',
          branch,
          options.mode ?? this.prefs.pullMode(),
          options.autostash ?? false,
        ),
      null,
      { busy: [state.loading, state.remoteBusy], failure: 'Pull failed' },
    );
    if (!result) return null;
    this.reportPull(result, branch);
    if (result.kind !== 'auth_required') await this.repoOps.refreshAll(state);
    return result;
  }

  async push(
    state: RepoState,
    options: PushActionOptions = {},
  ): Promise<PushResult | null> {
    const repo = state.repo();
    if (!repo) return null;
    const branch = options.branch ?? state.currentBranch();
    if (!branch) {
      this.ops.toast.warning('Detached HEAD — check out a branch to push.');
      return null;
    }
    const remote = options.remote ?? 'origin';
    const result = await this.ops.run(
      () =>
        this.ops.git.push(repo.path, remote, branch, {
          force: options.force ?? false,
          setUpstream: options.setUpstream ?? false,
          tags: options.tags ?? false,
        }),
      null,
      { busy: [state.loading, state.remoteBusy], failure: 'Push failed' },
    );
    if (!result) return null;
    this.reportPush(result, branch, remote);
    if (result.kind !== 'auth_required') await this.repoOps.refreshAll(state);
    return result;
  }

  // ── Remote CRUD ─────────────────────────────────────────────────────────

  async listRemotes(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    try {
      state.remotes.set(await this.ops.git.listRemotes(repo.path));
      state.remotesError.set(null);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not list remotes', state.remotesError);
    }
  }

  async addRemote(state: RepoState, name: string, url: string): Promise<void> {
    await this.mutateRemote(
      state,
      () => this.ops.git.addRemote(state.repo()?.path ?? '', name, url),
      `Remote ${name} added.`,
      'Could not add the remote',
    );
  }

  async removeRemote(state: RepoState, name: string): Promise<void> {
    await this.mutateRemote(
      state,
      () => this.ops.git.removeRemote(state.repo()?.path ?? '', name),
      `Remote ${name} removed.`,
      'Could not remove the remote',
    );
  }

  async renameRemote(
    state: RepoState,
    oldName: string,
    newName: string,
  ): Promise<void> {
    await this.mutateRemote(
      state,
      () => this.ops.git.renameRemote(state.repo()?.path ?? '', oldName, newName),
      `Remote renamed to ${newName}.`,
      'Could not rename the remote',
    );
  }

  async setRemoteUrl(state: RepoState, name: string, url: string): Promise<void> {
    await this.mutateRemote(
      state,
      () => this.ops.git.setRemoteUrl(state.repo()?.path ?? '', name, url),
      `URL of ${name} updated.`,
      'Could not change the remote URL',
    );
  }

  // ── Auto-fetch ──────────────────────────────────────────────────────────

  /**
   * Fetches the active repo in the background when it has gone stale.
   *
   * Skipped while the window is hidden: a minimised app has no reason to hold
   * a network connection open, and the fetch runs on the next visible tick.
   */
  private async autoFetchTick(): Promise<void> {
    const minutes = this.prefs.autoFetchMinutes();
    if (minutes <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const state = this.workspace.activeRepoState();
    const repo = state?.repo();
    if (!state || !repo) return;
    if (state.busy() || state.isFetching()) return;

    const last = this.lastAutoFetch.get(repo.path) ?? 0;
    if (Date.now() - last < minutes * 60_000) return;
    this.lastAutoFetch.set(repo.path, Date.now());
    await this.fetch(state, { silent: true });
  }

  private async mutateRemote(
    state: RepoState,
    action: () => Promise<void>,
    success: string,
    failure: string,
  ): Promise<void> {
    if (!state.repo()) return;
    await this.ops.run(
      async () => {
        await action();
        await this.listRemotes(state);
        // New or renamed remotes change the ref namespace.
        await this.repoOps.refreshRefs(state);
      },
      undefined,
      {
        busy: [state.remoteBusy],
        failure,
        success,
        errorSignal: state.remotesError,
      },
    );
  }

  private reportPull(result: PullResult, branch: string): void {
    switch (result.kind) {
      case 'up_to_date':
        this.ops.toast.info(`${branch} is already up to date.`);
        break;
      case 'fast_forward':
        this.ops.toast.success(`Fast-forwarded ${branch}.`);
        break;
      case 'merged':
        this.ops.toast.success(`Merged into ${branch}.`);
        break;
      case 'rebased':
        this.ops.toast.success(`Rebased ${branch} onto its upstream.`);
        break;
      case 'conflicts':
        this.ops.toast.warning(
          `Pull stopped with conflicts in ${describeFiles(result.files)}.`,
          8000,
        );
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
  }

  private reportPush(result: PushResult, branch: string, remote: string): void {
    switch (result.kind) {
      case 'success':
        this.ops.toast.success(`Pushed ${branch} to ${remote}.`);
        break;
      case 'up_to_date':
        this.ops.toast.info(`${remote}/${branch} is already up to date.`);
        break;
      case 'rejected':
        this.ops.toast.error(`Push rejected: ${result.reason}`, 8000);
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
  }
}

/** `a, b and 3 more` — keeps conflict toasts readable on wide merges. */
export function describeFiles(files: readonly string[], max = 3): string {
  if (files.length === 0) return 'no files';
  if (files.length <= max) return files.join(', ');
  return `${files.slice(0, max).join(', ')} and ${files.length - max} more`;
}
