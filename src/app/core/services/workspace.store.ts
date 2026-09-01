import {
  computed,
  effect,
  Injectable,
  inject,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type BlameLine,
  type BranchList,
  CLEAN_REPO_STATE,
  type CommitDetails,
  type CommitInfo,
  type ConflictFile,
  type FetchProgress,
  type GraphData,
  type ReflogEntry,
  type RemoteInfo,
  type RepoConfig,
  type RepoInfo,
  type RepoStateInfo,
  type StashEntry,
  type TagInfo,
  type WorkingChanges,
} from '../models';
import { PreferencesService } from './preferences.service';
import { TauriGitService } from './tauri-git.service';

export type WorkspaceTabId = string;

export type DiffSource =
  | { kind: 'none' }
  | { kind: 'workingFile'; file: string; staged: boolean }
  | { kind: 'commit'; sha: string };

/**
 * Every mutable field of a repo tab, with its initial value.
 *
 * `RepoState` builds one signal per entry and `reset()` walks this factory
 * again — adding a field here is the only step needed to have it cleared.
 */
function repoStateDefaults() {
  return {
    repo: null as RepoInfo | null,
    commits: [] as CommitInfo[],
    changes: null as WorkingChanges | null,
    branches: null as BranchList | null,
    tags: [] as TagInfo[],
    graphData: null as GraphData | null,
    repoState: CLEAN_REPO_STATE as RepoStateInfo,

    /** Shared scroll position between commit list and branch graph. */
    listScrollTop: 0,

    selectedCommitSha: null as string | null,
    commitDetails: null as CommitDetails | null,
    commitDetailsLoading: false,
    diffSource: { kind: 'none' } as DiffSource,
    diffText: '',

    loading: false,
    /** Open/refresh failures only; per-action errors surface as toasts. */
    error: null as string | null,

    /**
     * True when this tab's path no longer exists on disk (or is not a git
     * repository). Lets the tab bar flag it and stops the lazy-open effect
     * from retrying forever.
     */
    notFound: false,

    // ── history pagination ────────────────────────────────────────────
    historyLoading: false,
    historyHasMore: false,
    historyTotal: null as number | null,

    // ── remote operations ─────────────────────────────────────────────
    fetchProgress: null as FetchProgress | null,
    isFetching: false,
    remoteBusy: false,
    remotes: [] as RemoteInfo[],
    remotesError: null as string | null,

    // ── merge / conflict resolution ───────────────────────────────────
    conflicts: [] as ConflictFile[],
    mergeBusy: false,
    mergeError: null as string | null,

    // ── staging ───────────────────────────────────────────────────────
    stagingBusy: false,

    // ── branches / tags ───────────────────────────────────────────────
    branchBusy: false,

    // ── sequencer (rebase, cherry-pick, revert) ───────────────────────
    sequencerBusy: false,
    advancedOpError: null as string | null,

    // ── stash ─────────────────────────────────────────────────────────
    stashes: [] as StashEntry[],
    stashBusy: false,
    stashError: null as string | null,

    // ── blame ─────────────────────────────────────────────────────────
    blameLines: [] as BlameLine[],
    blameFile: null as string | null,
    /** Revision the blame was taken at; `null` means the work tree. */
    blameRev: null as string | null,
    blameError: null as string | null,

    // ── single-file history ───────────────────────────────────────────
    fileHistoryEntries: [] as CommitInfo[],
    fileHistoryFile: null as string | null,
    fileHistoryError: null as string | null,

    // ── commit search ─────────────────────────────────────────────────
    searchQuery: '',
    /** Path filter applied alongside the query; `null` searches everything. */
    searchPath: null as string | null,
    searchResults: [] as CommitInfo[],
    isSearching: false,

    // ── reflog & config ───────────────────────────────────────────────
    reflog: [] as ReflogEntry[],
    config: null as RepoConfig | null,
    configBusy: false,

    /**
     * True while an AI provider is drafting a commit message.
     *
     * Deliberately outside the `busy` computed below: drafting reads the diff
     * and writes nothing, so there is no reason for it to disable half the UI
     * for the seconds a provider takes to answer.
     */
    aiBusy: false,
  };
}

type RepoStateValues = ReturnType<typeof repoStateDefaults>;

type RepoStateSignals = {
  readonly [K in keyof RepoStateValues]: WritableSignal<RepoStateValues[K]>;
};

function createRepoStateSignals(): RepoStateSignals {
  const out: Record<string, WritableSignal<unknown>> = {};
  for (const [key, value] of Object.entries(repoStateDefaults())) {
    out[key] = signal(value);
  }
  return out as RepoStateSignals;
}

/**
 * Repo-scoped signal bundle for one open workspace tab.
 *
 * The IPC bridge stays shared at the service layer; this object only owns the
 * per-repository state. The signals come from {@link repoStateDefaults}, which
 * is also what `reset()` replays — adding a field there and aliasing it below
 * is all it takes.
 */
export class RepoState {
  private readonly fields = createRepoStateSignals();

  // ── repo data ─────────────────────────────────────────────────────────
  readonly repo = this.fields.repo;
  readonly commits = this.fields.commits;
  readonly changes = this.fields.changes;
  readonly branches = this.fields.branches;
  readonly tags = this.fields.tags;
  readonly graphData = this.fields.graphData;
  readonly repoState = this.fields.repoState;

  // ── selection & diff ──────────────────────────────────────────────────
  readonly listScrollTop = this.fields.listScrollTop;
  readonly selectedCommitSha = this.fields.selectedCommitSha;
  readonly commitDetails = this.fields.commitDetails;
  readonly commitDetailsLoading = this.fields.commitDetailsLoading;
  readonly diffSource = this.fields.diffSource;
  readonly diffText = this.fields.diffText;

  // ── lifecycle ─────────────────────────────────────────────────────────
  readonly loading = this.fields.loading;
  readonly error = this.fields.error;
  readonly notFound = this.fields.notFound;

  // ── history pagination ────────────────────────────────────────────────
  readonly historyLoading = this.fields.historyLoading;
  readonly historyHasMore = this.fields.historyHasMore;
  readonly historyTotal = this.fields.historyTotal;

  // ── remote operations ─────────────────────────────────────────────────
  readonly fetchProgress = this.fields.fetchProgress;
  readonly isFetching = this.fields.isFetching;
  readonly remoteBusy = this.fields.remoteBusy;
  readonly remotes = this.fields.remotes;
  readonly remotesError = this.fields.remotesError;

  // ── merge / conflicts ─────────────────────────────────────────────────
  readonly conflicts = this.fields.conflicts;
  readonly mergeBusy = this.fields.mergeBusy;
  readonly mergeError = this.fields.mergeError;

  // ── staging / branches / sequencer ────────────────────────────────────
  readonly stagingBusy = this.fields.stagingBusy;
  readonly branchBusy = this.fields.branchBusy;
  readonly sequencerBusy = this.fields.sequencerBusy;
  readonly advancedOpError = this.fields.advancedOpError;

  // ── stash ─────────────────────────────────────────────────────────────
  readonly stashes = this.fields.stashes;
  readonly stashBusy = this.fields.stashBusy;
  readonly stashError = this.fields.stashError;

  // ── blame & file history ──────────────────────────────────────────────
  readonly blameLines = this.fields.blameLines;
  readonly blameFile = this.fields.blameFile;
  readonly blameRev = this.fields.blameRev;
  readonly blameError = this.fields.blameError;
  readonly fileHistoryEntries = this.fields.fileHistoryEntries;
  readonly fileHistoryFile = this.fields.fileHistoryFile;
  readonly fileHistoryError = this.fields.fileHistoryError;

  // ── commit search ─────────────────────────────────────────────────────
  readonly searchQuery = this.fields.searchQuery;
  readonly searchPath = this.fields.searchPath;
  readonly searchResults = this.fields.searchResults;
  readonly isSearching = this.fields.isSearching;

  // ── reflog & config ───────────────────────────────────────────────────
  readonly reflog = this.fields.reflog;
  readonly config = this.fields.config;
  readonly configBusy = this.fields.configBusy;
  readonly aiBusy = this.fields.aiBusy;

  // ── derived ────────────────────────────────────────────────────────────
  readonly isOpen = computed(() => this.repo() !== null);
  readonly currentBranch = computed(() => this.branches()?.current ?? null);
  readonly stagedCount = computed(() => this.changes()?.staged.length ?? 0);
  readonly unstagedCount = computed(
    () =>
      (this.changes()?.unstaged.length ?? 0) + (this.changes()?.untracked.length ?? 0),
  );
  /** Number of files with unresolved merge conflicts. */
  readonly conflictCount = computed(() => this.conflicts().length);
  /** True while a merge is in progress (i.e. any conflicts are pending). */
  readonly mergeInProgress = computed(() => this.conflicts().length > 0);
  /** True iff the search bar is non-empty (UI uses this to swap the list). */
  readonly isSearchActive = computed(() => this.searchQuery().trim().length > 0);
  /** True while git is mid-merge/rebase/cherry-pick/revert/bisect. */
  readonly sequencerActive = computed(() => this.repoState().state !== 'clean');
  readonly aheadBehind = computed(() => {
    const list = this.branches();
    const current = list?.current;
    if (!list || !current) return { ahead: 0, behind: 0 };
    const local = list.local.find((b) => b.name === current);
    return { ahead: local?.ahead ?? 0, behind: local?.behind ?? 0 };
  });
  /** True while any repo-scoped operation is running. */
  readonly busy = computed(
    () =>
      this.loading() ||
      this.stagingBusy() ||
      this.remoteBusy() ||
      this.branchBusy() ||
      this.mergeBusy() ||
      this.stashBusy() ||
      this.sequencerBusy() ||
      this.configBusy(),
  );

  /**
   * Timestamp of the last refresh we ran ourselves. Watcher events that
   * arrive right after are our own writes echoing back, so they are dropped.
   */
  lastRefreshAt = 0;

  private fetchProgressTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly tabId: WorkspaceTabId,
    readonly path: string,
  ) {}

  clearFetchProgressTimer(): void {
    if (this.fetchProgressTimer === undefined) return;
    clearTimeout(this.fetchProgressTimer);
    this.fetchProgressTimer = undefined;
  }

  setFetchProgressTimer(callback: () => void, delay: number): void {
    this.clearFetchProgressTimer();
    this.fetchProgressTimer = setTimeout(() => {
      this.fetchProgressTimer = undefined;
      callback();
    }, delay);
  }

  clearRefreshTimer(): void {
    if (this.refreshTimer === undefined) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  setRefreshTimer(callback: () => void, delay: number): void {
    this.clearRefreshTimer();
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      callback();
    }, delay);
  }

  clearSearchTimer(): void {
    if (this.searchTimer === undefined) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
  }

  setSearchTimer(callback: () => void, delay: number): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      callback();
    }, delay);
  }

  clearTimers(): void {
    this.clearFetchProgressTimer();
    this.clearRefreshTimer();
    this.clearSearchTimer();
  }

  reset(): void {
    this.clearTimers();
    this.lastRefreshAt = 0;
    const fields = this.fields as Record<string, WritableSignal<unknown>>;
    for (const [key, value] of Object.entries(repoStateDefaults())) {
      fields[key]?.set(value);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly prefs = inject(PreferencesService);
  private readonly git = inject(TauriGitService);
  private readonly repoStates = signal(new Map<WorkspaceTabId, RepoState>());
  private nextTabNumber = 1;

  /** Paths already handed to the backend watcher; keeps `watchPath` idempotent. */
  private readonly watched = signal<ReadonlySet<string>>(new Set());

  /** Prevents `restoreFromPreferences` from running more than once. */
  private _restored = false;

  readonly activeTabId = signal<WorkspaceTabId | null>(null);

  readonly workspaces = computed(() => Array.from(this.repoStates().values()));

  readonly activeRepoState = computed(() => {
    const id = this.activeTabId();
    if (id === null) return null;
    return this.repoStates().get(id) ?? null;
  });

  /**
   * Whether the backend fs watcher is running for the active tab. False while
   * a tab is still opening and after `watch_repo` failed, which is exactly
   * when the status bar must stop claiming the view is live.
   */
  readonly watcherActive = computed(() => {
    const state = this.activeRepoState();
    if (state === null) return false;
    const watched = this.watched();
    return watched.has(state.repo()?.path ?? state.path);
  });

  constructor() {
    // Once the Tauri plugin-store is ready, restore the previously persisted
    // tab list and lazy-open only the active tab.
    effect(() => {
      if (!this.prefs.storeReady()) return;
      if (this._restored) return;
      this._restored = true;
      untracked(() => this.restoreFromPreferences());
    });
  }

  /**
   * Focuses the tab for `path`, creating it when it is not open yet.
   *
   * Synchronous on purpose: the watcher subscription is started later by
   * `CurrentRepoService.openRepo`, once the path is known to be a repo.
   */
  openWorkspace(path: string): RepoState {
    const normalizedPath = path.trim();
    const existing = this.findByPath(normalizedPath);
    if (existing) {
      this.activeTabId.set(existing.tabId);
      this.persistTabs();
      return existing;
    }

    const state = this.addState(normalizedPath);
    this.activeTabId.set(state.tabId);
    this.persistTabs();
    return state;
  }

  async closeWorkspace(tabId: WorkspaceTabId): Promise<void> {
    const state = this.repoStates().get(tabId);
    if (!state) return;
    const path = state.path;
    const wasActive = this.activeTabId() === tabId;
    const neighbourId = wasActive ? this.neighbourOf(tabId) : null;

    state.reset();
    this.repoStates.update((states) => {
      const next = new Map(states);
      next.delete(tabId);
      return next;
    });

    if (wasActive) {
      this.activeTabId.set(neighbourId);
    }
    this.persistTabs();
    await this.unwatchPath(path);
  }

  setActive(tabId: WorkspaceTabId): void {
    if (!this.repoStates().has(tabId)) return;
    this.activeTabId.set(tabId);
    this.persistTabs();
  }

  findByPath(path: string): RepoState | null {
    for (const state of this.repoStates().values()) {
      const repoPath = state.repo()?.path;
      if (state.path === path || repoPath === path) return state;
    }
    return null;
  }

  /** Starts the backend watcher for `path`. Safe to call repeatedly. */
  async watchPath(path: string): Promise<void> {
    if (this.watched().has(path)) return;
    this.addWatched(path);
    try {
      await this.git.watchRepo(path);
    } catch {
      // Non-fatal: users can still inspect the repo without live refresh.
      this.removeWatched(path);
    }
  }

  /**
   * Writes the current tab list and active path to PreferencesService so they
   * survive an app restart. Persists the work-tree root once a repo is open,
   * so a restart reopens the canonical path rather than whatever
   * subdirectory the user happened to pick. The prefs service debounces the
   * underlying plugin-store write, so calling this on every mutation is safe.
   */
  persistTabs(): void {
    const tabs = Array.from(this.repoStates().values()).map(
      (s) => s.repo()?.path ?? s.path,
    );
    const active = this.activeRepoState();
    const activePath = active?.repo()?.path ?? active?.path ?? '';
    this.prefs.setWorkspaceTabs(tabs);
    this.prefs.setActiveTabPath(activePath);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Tab to activate when the active one is closed: the next tab, or the
   * previous one when closing the last tab.
   */
  private neighbourOf(tabId: WorkspaceTabId): WorkspaceTabId | null {
    const ids = Array.from(this.repoStates().keys());
    const index = ids.indexOf(tabId);
    if (index === -1) return null;
    return ids[index + 1] ?? ids[index - 1] ?? null;
  }

  private addState(path: string): RepoState {
    const tabId = this.createTabId();
    const state = new RepoState(tabId, path);
    this.repoStates.update((states) => {
      const next = new Map(states);
      next.set(tabId, state);
      return next;
    });
    return state;
  }

  /**
   * On cold start, reconstructs the tab list from PreferencesService.
   *
   * All restored tabs are added in a "pending" state (repo=null). Only the
   * active tab is loaded immediately, by the lazy-open effect in
   * CurrentRepoService; the others load when the user clicks them.
   */
  private restoreFromPreferences(): void {
    const tabs = this.prefs.workspaceTabs();
    const activePath = this.prefs.activeTabPath();

    if (tabs.length === 0) return;

    // Don't clobber any tabs the user already opened before prefs loaded.
    if (this.repoStates().size > 0) return;

    for (const path of tabs) {
      if (this.findByPath(path)) continue;
      this.addState(path);
    }

    const activeState = activePath ? this.findByPath(activePath) : null;
    this.activeTabId.set(activeState?.tabId ?? this.firstTabId());
  }

  private firstTabId(): WorkspaceTabId | null {
    const [id] = this.repoStates().keys();
    return id ?? null;
  }

  private createTabId(): WorkspaceTabId {
    let tabId: WorkspaceTabId;
    do {
      tabId = `repo-${this.nextTabNumber}`;
      this.nextTabNumber += 1;
    } while (this.repoStates().has(tabId));
    return tabId;
  }

  private async unwatchPath(path: string): Promise<void> {
    if (!this.watched().has(path)) return;
    this.removeWatched(path);
    try {
      await this.git.unwatchRepo(path);
    } catch {
      // Backend already gone or path unknown — the tab is closed either way.
    }
  }

  private addWatched(path: string): void {
    this.watched.update((paths) => new Set(paths).add(path));
  }

  private removeWatched(path: string): void {
    this.watched.update((paths) => {
      const next = new Set(paths);
      next.delete(path);
      return next;
    });
  }
}
