import { Injectable, inject } from '@angular/core';
import type { FileSource } from '../../models';
import { appendGraphPage } from '../../utils/graph-page';
import { parseSearchQuery } from '../../utils/search-query';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';

/** Commits fetched per history page. */
export const HISTORY_PAGE_SIZE = 200;

/** How many extra pages `ensureLoaded` will pull while hunting for a sha. */
const MAX_LOOKUP_PAGES = 5;

/** Debounce before a typed query reaches the backend. */
const SEARCH_DEBOUNCE_MS = 200;

/** Commits a single search returns; matches the backend's own default. */
const SEARCH_LIMIT = 200;

/** History paging, commit details, reflog and commit search. */
@Injectable({ providedIn: 'root' })
export class HistoryOps {
  private readonly ops = inject(OpsRunner);

  /** Loads the first page, replacing whatever is in `commits`/`graphData`. */
  async load(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.historyLoading.set(true);
    try {
      const page = await this.ops.git.getHistory(repo.path, HISTORY_PAGE_SIZE, 0);
      state.commits.set(page.commits);
      state.graphData.set(page.graph);
      state.historyHasMore.set(page.has_more);
      state.historyTotal.set(page.total);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not load history');
    } finally {
      state.historyLoading.set(false);
    }
  }

  /** Appends the next page; no-op when the tail is already loaded. */
  async loadMore(state: RepoState): Promise<boolean> {
    const repo = state.repo();
    if (!repo || state.historyLoading() || !state.historyHasMore()) return false;
    const skip = state.commits().length;
    state.historyLoading.set(true);
    try {
      const page = await this.ops.git.getHistory(repo.path, HISTORY_PAGE_SIZE, skip);
      if (page.commits.length === 0) {
        state.historyHasMore.set(false);
        return false;
      }
      state.commits.update((commits) => [...commits, ...page.commits]);
      state.graphData.update((graph) => appendGraphPage(graph, page.graph));
      state.historyHasMore.set(page.has_more);
      state.historyTotal.set(page.total);
      return true;
    } catch (error: unknown) {
      this.ops.reportError(error, 'Could not load more history');
      return false;
    } finally {
      state.historyLoading.set(false);
    }
  }

  /**
   * Makes sure `sha` is inside the loaded window, pulling up to
   * {@link MAX_LOOKUP_PAGES} extra pages. Returns false when it is not found —
   * the commit may live on a ref that the current history query excludes.
   */
  async ensureLoaded(state: RepoState, sha: string): Promise<boolean> {
    if (state.commits().some((c) => c.sha === sha)) return true;
    for (let page = 0; page < MAX_LOOKUP_PAGES; page++) {
      const loaded = await this.loadMore(state);
      if (!loaded) return false;
      if (state.commits().some((c) => c.sha === sha)) return true;
    }
    return false;
  }

  async loadCommitDetails(state: RepoState, sha: string): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.commitDetailsLoading.set(true);
    try {
      state.commitDetails.set(await this.ops.git.getCommitDetails(repo.path, sha));
    } catch (error: unknown) {
      state.commitDetails.set(null);
      this.ops.reportError(error, 'Could not read commit');
    } finally {
      state.commitDetailsLoading.set(false);
    }
  }

  /** Diff of a single file inside a commit, against its first parent. */
  async commitFileDiff(state: RepoState, sha: string, file: string): Promise<string> {
    const repo = state.repo();
    if (!repo) return '';
    return this.ops.run(
      () => this.ops.git.getCommitFileDiff(repo.path, sha, file),
      '',
      { failure: 'Could not load the file diff' },
    );
  }

  /** Full contents of `file` as of `rev`, for the blame and history views. */
  async fileAtRevision(state: RepoState, rev: string, file: string): Promise<string> {
    const repo = state.repo();
    if (!repo) return '';
    return this.ops.run(
      () => this.ops.git.getFileAtRevision(repo.path, rev, file),
      '',
      { failure: 'Could not read the file at that revision' },
    );
  }

  /**
   * Raw bytes of `file` as base64, for previews the diff viewer renders.
   *
   * Unlike everything else here it neither reports nor swallows the failure:
   * the caller reads several sources per file and needs the rejection to
   * choose its own fallback and to recognise "file too large to preview".
   */
  fileBase64(state: RepoState, file: string, source: FileSource): Promise<string> {
    return this.ops.git.getFileBase64(state.repo()?.path ?? '', file, source);
  }

  clearCommitDetails(state: RepoState): void {
    state.commitDetails.set(null);
    state.commitDetailsLoading.set(false);
  }

  async loadReflog(state: RepoState, limit = 100): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    const entries = await this.ops.run(
      () => this.ops.git.getReflog(repo.path, limit),
      [],
      { failure: 'Could not read reflog' },
    );
    state.reflog.set(entries);
  }

  /** `rev = null` blames the work tree; a revision blames the file as of it. */
  async loadBlame(
    state: RepoState,
    file: string,
    rev: string | null = null,
  ): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.blameError.set(null);
    state.blameLines.set([]);
    state.blameFile.set(file);
    state.blameRev.set(rev);
    try {
      state.blameLines.set(await this.ops.git.blameFile(repo.path, file, rev));
    } catch (error: unknown) {
      this.ops.reportError(error, 'Blame failed', state.blameError);
    }
  }

  clearBlame(state: RepoState): void {
    state.blameLines.set([]);
    state.blameFile.set(null);
    state.blameRev.set(null);
    state.blameError.set(null);
  }

  async loadFileHistory(state: RepoState, file: string): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    state.fileHistoryError.set(null);
    state.fileHistoryEntries.set([]);
    state.fileHistoryFile.set(file);
    try {
      state.fileHistoryEntries.set(await this.ops.git.fileHistory(repo.path, file));
    } catch (error: unknown) {
      this.ops.reportError(error, 'File history failed', state.fileHistoryError);
    }
  }

  clearFileHistory(state: RepoState): void {
    state.fileHistoryEntries.set([]);
    state.fileHistoryFile.set(null);
    state.fileHistoryError.set(null);
  }

  /**
   * Stores the query exactly as typed and schedules the debounced search.
   *
   * The `path:` token is split off here rather than by the search box, so
   * `searchQuery` keeps the literal string every surface should display and
   * only one place has to know the token's syntax.
   */
  search(state: RepoState, raw: string): void {
    state.searchQuery.set(raw);
    const { text, path } = parseSearchQuery(raw);
    state.searchPath.set(path);
    state.clearSearchTimer();
    if (text.length === 0 && path === null) {
      state.searchResults.set([]);
      state.isSearching.set(false);
      return;
    }
    state.setSearchTimer(() => void this.runSearch(state, raw), SEARCH_DEBOUNCE_MS);
  }

  clearSearch(state: RepoState): void {
    state.clearSearchTimer();
    state.searchQuery.set('');
    state.searchPath.set(null);
    state.searchResults.set([]);
    state.isSearching.set(false);
  }

  private async runSearch(state: RepoState, raw: string): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    const { text, path } = parseSearchQuery(raw);
    state.isSearching.set(true);
    try {
      const results = await this.ops.git.searchCommits(
        repo.path,
        text,
        '',
        SEARCH_LIMIT,
        path,
      );
      // Drop stale results: a newer keystroke already scheduled its own query.
      if (state.searchQuery() === raw) state.searchResults.set(results);
    } catch (error: unknown) {
      this.ops.reportError(error, 'Search failed');
      state.searchResults.set([]);
    } finally {
      state.isSearching.set(false);
    }
  }
}
