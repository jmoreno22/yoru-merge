import { Injectable, inject } from '@angular/core';
import type { FetchProgress, RepoChangeKind, RepoEntry, RepoInfo } from '../../models';
import { isRepoMissingMessage, messageFromUnknown } from '../git-auth-error';
import type { CloneOptions } from '../tauri-git.service';
import type { RepoState } from '../workspace.store';
import { HistoryOps } from './history-ops';
import { OpsRunner } from './ops-runner';

/** How a clone ended. `canceled` is a user action, so nothing is reported. */
export type CloneOutcome = 'cloned' | 'canceled' | 'failed';

/** Substring the backend puts in the error of a clone the user cancelled. */
const CLONE_CANCELED = 'clone canceled';

/** True while the diff on screen is still the one this file asked for. */
function isSelectedFile(state: RepoState, file: string, staged: boolean): boolean {
  const source = state.diffSource();
  return (
    source.kind === 'workingFile' && source.file === file && source.staged === staged
  );
}

/** Opening a repository and keeping its aggregate state fresh. */
@Injectable({ providedIn: 'root' })
export class RepoOps {
  private readonly ops = inject(OpsRunner);
  private readonly history = inject(HistoryOps);

  /**
   * Opens `state.path` and loads everything the workbench needs.
   * Returns false when the path is not a usable repository.
   */
  async open(state: RepoState): Promise<boolean> {
    if (state.repo() !== null) return true;
    if (state.loading()) return false;

    state.loading.set(true);
    state.error.set(null);
    // Clear any stale "missing" flag so an explicit retry works.
    state.notFound.set(false);
    try {
      // `open_repo` resolves the work-tree root, which may differ from the
      // directory the user picked; everything downstream keys off that.
      const repo = await this.ops.git.openRepo(state.path);
      state.repo.set(repo);
      // Bookkeeping the workbench never reads back, so it does not delay the
      // first paint; the catch is what keeps it from becoming an unhandled
      // rejection in a zoneless app.
      void this.ops.git.addRecentRepo(repo.path).catch(() => {
        // A missing recent entry is not worth interrupting the open for.
      });
      return true;
    } catch (error: unknown) {
      const message = messageFromUnknown(error);
      state.error.set(message);
      state.repo.set(null);
      // Flagged rather than toasted: the tab itself renders the failure, and
      // the lazy-open effect must not retry in a loop.
      if (isRepoMissingMessage(message)) state.notFound.set(true);
      return false;
    } finally {
      state.loading.set(false);
    }
  }

  /** Reloads every panel. Individual failures do not abort the others. */
  async refreshAll(state: RepoState): Promise<void> {
    state.clearRefreshTimer();
    const repo = state.repo();
    if (!repo) return;
    state.loading.set(true);
    try {
      const results = await Promise.allSettled([
        this.history.load(state),
        this.loadChanges(state),
        this.loadRefs(state),
        this.loadConflicts(state),
        this.loadStashes(state),
        this.loadRepoState(state),
      ]);
      this.reportFailures(results, state);
    } finally {
      state.loading.set(false);
      state.lastRefreshAt = Date.now();
    }
  }

  /**
   * Reloads what the watcher says changed. `refs` covers commits, branches,
   * tags and stashes; `index`/`worktree` cover the working tree; both refresh
   * the repo state so the sequencer banner keeps up.
   *
   * Takes a set rather than one kind because a single git command usually
   * touches both sides — a checkout moves HEAD *and* rewrites the work tree —
   * and the debounce that batches those events would otherwise leave half of
   * the screen stale.
   */
  async refreshFor(
    state: RepoState,
    kinds: ReadonlySet<RepoChangeKind>,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    const tasks: Promise<unknown>[] = [this.loadRepoState(state)];
    if (kinds.has('refs')) {
      tasks.push(
        this.history.load(state),
        this.loadRefs(state),
        this.loadStashes(state),
      );
    }
    if (kinds.has('worktree') || kinds.has('index')) {
      tasks.push(this.loadChanges(state), this.loadConflicts(state));
    }
    const results = await Promise.allSettled(tasks);
    this.reportFailures(results, state);
    state.lastRefreshAt = Date.now();
  }

  async refreshChanges(state: RepoState): Promise<void> {
    try {
      await this.loadChanges(state);
      state.lastRefreshAt = Date.now();
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not read the working tree');
    }
  }

  async refreshRepoState(state: RepoState): Promise<void> {
    try {
      await this.loadRepoState(state);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not read the repository state');
    }
  }

  async refreshRefs(state: RepoState): Promise<void> {
    try {
      await this.loadRefs(state);
      state.lastRefreshAt = Date.now();
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not list branches');
    }
  }

  // ── Diff selection ──────────────────────────────────────────────────────

  /** Selects a commit: loads its diff and its metadata in parallel. */
  async selectCommit(state: RepoState, sha: string): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.selectedCommitSha.set(sha);
    state.diffSource.set({ kind: 'commit', sha });
    const [diff] = await Promise.allSettled([
      this.ops.git.getCommitDiff(repo.path, sha),
      this.history.loadCommitDetails(state, sha),
    ]);
    // Arrowing down the list leaves several of these in flight; a slow answer
    // for an earlier row must not land on the row now selected.
    if (state.selectedCommitSha() !== sha) return;
    if (diff.status === 'fulfilled') {
      state.diffText.set(diff.value);
    } else {
      state.diffText.set('');
      this.ops.reportError(diff.reason, 'Could not load the diff');
    }
  }

  async selectWorkingFile(
    state: RepoState,
    file: string,
    staged: boolean,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.diffSource.set({ kind: 'workingFile', file, staged });
    try {
      const diff = await this.ops.git.getDiff(repo.path, file, staged);
      if (!isSelectedFile(state, file, staged)) return;
      state.diffText.set(diff);
    } catch (error: unknown) {
      if (!isSelectedFile(state, file, staged)) return;
      state.diffText.set('');
      this.ops.reportError(error, 'Could not load the diff');
    }
  }

  /** Re-fetches the diff on screen; used after staging changes it. */
  async refreshActiveDiff(state: RepoState): Promise<void> {
    const repo = state.repo();
    const source = state.diffSource();
    if (!repo || source.kind !== 'workingFile') return;
    try {
      state.diffText.set(
        await this.ops.git.getDiff(repo.path, source.file, source.staged),
      );
    } catch {
      // The diff legitimately disappears once a file is fully staged.
      state.diffText.set('');
    }
  }

  clearDiff(state: RepoState): void {
    state.diffSource.set({ kind: 'none' });
    state.diffText.set('');
    state.selectedCommitSha.set(null);
    this.history.clearCommitDetails(state);
  }

  // ── Repository-level commands ───────────────────────────────────────────

  async init(path: string, defaultBranch: string | null): Promise<RepoInfo | null> {
    return this.ops.run(() => this.ops.git.initRepo(path, defaultBranch), null, {
      failure: 'Could not create the repository',
      success: 'Repository created.',
    });
  }

  async clone(
    url: string,
    dest: string,
    options: CloneOptions = {},
    onProgress?: (p: FetchProgress) => void,
  ): Promise<CloneOutcome> {
    try {
      await this.ops.git.cloneRepo(url, dest, options, onProgress);
      return 'cloned';
    } catch (error: unknown) {
      const message = messageFromUnknown(error);
      if (message.toLowerCase().includes(CLONE_CANCELED)) return 'canceled';
      this.ops.reportError(error, 'Clone failed');
      return 'failed';
    }
  }

  /** Aborts the clone registered under `cloneId`. */
  async cancelClone(cloneId: string): Promise<void> {
    try {
      await this.ops.git.cancelClone(cloneId);
    } catch {
      // The clone finished between the click and the call; nothing to abort.
    }
  }

  async recentRepos(): Promise<RepoEntry[]> {
    return this.ops.run(() => this.ops.git.getRecentRepos(), [], {
      failure: 'Could not read recent repositories',
    });
  }

  async removeRecent(path: string): Promise<void> {
    await this.ops.run(() => this.ops.git.removeRecentRepo(path), undefined, {
      failure: 'Could not remove the entry',
    });
  }

  async gitVersion(): Promise<string> {
    return this.ops.run(() => this.ops.git.getGitVersion(), '');
  }

  // ── Private loaders (throw; callers aggregate) ──────────────────────────

  private async loadChanges(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.changes.set(await this.ops.git.getWorkingChanges(repo.path));
  }

  /**
   * Remotes ride along with branches and tags: the toolbar disables its whole
   * remote cluster when there are none, so the list has to be loaded whether
   * or not anyone opened the remotes manager.
   */
  private async loadRefs(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    const [branches, tags, remotes] = await Promise.all([
      this.ops.git.listBranches(repo.path),
      this.ops.git.listTags(repo.path),
      this.ops.git.listRemotes(repo.path),
    ]);
    state.branches.set(branches);
    state.tags.set(tags);
    state.remotes.set(remotes);
  }

  private async loadConflicts(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.conflicts.set(await this.ops.git.getConflicts(repo.path));
  }

  private async loadStashes(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.stashes.set(await this.ops.git.stashList(repo.path));
  }

  private async loadRepoState(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.repoState.set(await this.ops.git.getRepoState(repo.path));
  }

  /**
   * One toast for a batch of parallel loads: a broken repo would otherwise
   * stack six identical errors on top of each other.
   */
  private reportFailures(
    results: readonly PromiseSettledResult<unknown>[],
    state: RepoState,
  ): void {
    const failure = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (!failure) {
      state.error.set(null);
      return;
    }
    const message = messageFromUnknown(failure.reason);
    state.error.set(message);
    this.ops.toast.show({ kind: 'error', message, key: 'repo-refresh' });
  }
}
