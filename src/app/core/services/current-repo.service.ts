import {
  computed,
  effect,
  Injectable,
  inject,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  CheckoutResult,
  CompareResult,
  FastForwardResult,
  FetchProgress,
  FileChange,
  FileSource,
  HunkRange,
  MergeContent,
  MergeResult,
  PatchApplyResult,
  PullResult,
  PushResult,
  RebaseResult,
  RebaseTodoEntry,
  RepoChangedPayload,
  RepoChangeKind,
  RepoEntry,
  RepoInfo,
  ResetResult,
  SequencerResult,
  WritableConfigKey,
} from '../models';
import type { PatchApplyFlags } from '../utils/patch-builder';
import {
  BranchOps,
  type CheckoutOptions,
  type CloneOutcome,
  type CommitOptions,
  ConfigOps,
  type CreateBranchOptions,
  type FetchOptions,
  HistoryOps,
  MergeOps,
  type MergeOptions,
  type PullOptions,
  type PushActionOptions,
  RemoteOps,
  RepoOps,
  SequencerOps,
  StagingOps,
  StashOps,
  SystemOps,
} from './ops';
import type {
  CloneOptions,
  ConflictSide,
  ResetMode,
  StashSaveOptions,
} from './tauri-git.service';
import { RepoState, WorkspaceStore } from './workspace.store';

export type { DiffSource } from './workspace.store';

/**
 * How long after our own refresh a watcher event is treated as our own echo.
 * Long enough to cover the `.git` writes a refresh itself provokes.
 */
const OWN_WRITE_WINDOW_MS = 1000;

/** Debounce for watcher-driven refreshes; absorbs bursts from an IDE save. */
const WATCHER_DEBOUNCE_MS = 400;

/**
 * Facade over the active repository tab.
 *
 * All state lives in `WorkspaceStore`/`RepoState`; all behaviour lives in the
 * domain services under `ops/`. This class only routes: it captures the active
 * `RepoState` once per action — never after an `await`, which is what used to
 * let a tab switch mid-operation write into the wrong repo.
 */
@Injectable({ providedIn: 'root' })
export class CurrentRepoService {
  private readonly workspace = inject(WorkspaceStore);
  private readonly repoOps = inject(RepoOps);
  private readonly historyOps = inject(HistoryOps);
  private readonly stagingOps = inject(StagingOps);
  private readonly remoteOps = inject(RemoteOps);
  private readonly branchOps = inject(BranchOps);
  private readonly mergeOps = inject(MergeOps);
  private readonly stashOps = inject(StashOps);
  private readonly sequencerOps = inject(SequencerOps);
  private readonly systemOps = inject(SystemOps);
  private readonly configOps = inject(ConfigOps);

  /** Stands in for the active tab so every signal stays readable with none. */
  private readonly fallbackState = new RepoState('__fallback__', '');

  private readonly activeOrFallback = computed(
    () => this.workspace.activeRepoState() ?? this.fallbackState,
  );

  /**
   * Loads a tab that was restored from preferences but never opened.
   *
   * `untracked` breaks the reactive chain around the async call so the signal
   * writes inside `openRepo` don't re-trigger this effect while it runs.
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: effect keeps the lazy-open subscription alive.
  private readonly _lazyOpenEffect = effect(() => {
    const active = this.workspace.activeRepoState();
    if (!active) return;
    if (active.repo() !== null) return;
    if (active.loading()) return;
    if (active.notFound()) return;
    if (active.error() !== null) return;
    const path = active.path;
    if (!path) return;
    untracked(() => void this.openRepo(path));
  });

  // ── state ──────────────────────────────────────────────────────────────
  readonly repo = this.proxyWritable((state) => state.repo);
  readonly commits = this.proxyWritable((state) => state.commits);
  readonly changes = this.proxyWritable((state) => state.changes);
  readonly branches = this.proxyWritable((state) => state.branches);
  readonly tags = this.proxyWritable((state) => state.tags);
  readonly graphData = this.proxyWritable((state) => state.graphData);
  /** Merge/rebase/cherry-pick/revert/bisect state reported by git. */
  readonly repoState = this.proxyWritable((state) => state.repoState);

  /** Shared scroll position between commit list and branch graph. */
  readonly listScrollTop = this.proxyWritable((state) => state.listScrollTop);

  /** Bumped on every request so the same sha can be revealed twice. */
  private _scrollRevealId = 0;
  /**
   * Set by `navigateToSha()` to ask the commit list to scroll to a sha.
   * Not proxied through WorkspaceStore — purely a UI coordination signal.
   */
  readonly scrollReveal = signal<{ sha: string; id: number } | null>(null);

  readonly selectedCommitSha = this.proxyWritable((state) => state.selectedCommitSha);
  readonly commitDetails = this.proxyWritable((state) => state.commitDetails);
  readonly commitDetailsLoading = this.proxyWritable(
    (state) => state.commitDetailsLoading,
  );
  readonly diffSource = this.proxyWritable((state) => state.diffSource);
  readonly diffText = this.proxyWritable((state) => state.diffText);

  readonly loading = this.proxyWritable((state) => state.loading);
  readonly error = this.proxyWritable((state) => state.error);

  // ── history pagination ─────────────────────────────────────────────────
  readonly historyLoading = this.proxyWritable((state) => state.historyLoading);
  readonly historyHasMore = this.proxyWritable((state) => state.historyHasMore);
  readonly historyTotal = this.proxyWritable((state) => state.historyTotal);

  // ── remote operations ──────────────────────────────────────────────────
  readonly fetchProgress = this.proxyWritable((state) => state.fetchProgress);
  readonly isFetching = this.proxyWritable((state) => state.isFetching);
  readonly remoteBusy = this.proxyWritable((state) => state.remoteBusy);
  readonly remotes = this.proxyWritable((state) => state.remotes);
  readonly remotesError = this.proxyWritable((state) => state.remotesError);

  // ── merge / conflicts ──────────────────────────────────────────────────
  readonly conflicts = this.proxyWritable((state) => state.conflicts);
  readonly mergeBusy = this.proxyWritable((state) => state.mergeBusy);
  readonly mergeError = this.proxyWritable((state) => state.mergeError);

  // ── staging / branches / sequencer ─────────────────────────────────────
  readonly stagingBusy = this.proxyWritable((state) => state.stagingBusy);
  readonly branchBusy = this.proxyWritable((state) => state.branchBusy);
  readonly sequencerBusy = this.proxyWritable((state) => state.sequencerBusy);
  /** Last cherry-pick / revert / rebase failure, for inline surfaces. */
  readonly advancedOpError = this.proxyWritable((state) => state.advancedOpError);

  // ── stash ──────────────────────────────────────────────────────────────
  readonly stashes = this.proxyWritable((state) => state.stashes);
  readonly stashBusy = this.proxyWritable((state) => state.stashBusy);
  readonly stashError = this.proxyWritable((state) => state.stashError);

  // ── blame / file history ───────────────────────────────────────────────
  readonly blameLines = this.proxyWritable((state) => state.blameLines);
  readonly blameFile = this.proxyWritable((state) => state.blameFile);
  /** Revision the blame on screen was taken at; `null` is the work tree. */
  readonly blameRev = this.proxyWritable((state) => state.blameRev);
  readonly blameError = this.proxyWritable((state) => state.blameError);
  readonly fileHistoryEntries = this.proxyWritable((state) => state.fileHistoryEntries);
  readonly fileHistoryFile = this.proxyWritable((state) => state.fileHistoryFile);
  readonly fileHistoryError = this.proxyWritable((state) => state.fileHistoryError);

  /** True when the active tab's path is gone or is not a repository. */
  readonly notFound = this.proxyWritable((state) => state.notFound);

  /** True while the backend fs watcher is running for the active tab. */
  readonly watcherActive = this.workspace.watcherActive;

  // ── search ─────────────────────────────────────────────────────────────
  readonly searchQuery = this.proxyWritable((state) => state.searchQuery);
  /** Path filter in force alongside the query; `null` searches everything. */
  readonly searchPath = this.proxyWritable((state) => state.searchPath);
  readonly searchResults = this.proxyWritable((state) => state.searchResults);
  readonly isSearching = this.proxyWritable((state) => state.isSearching);
  readonly isSearchActive = this.proxySignal((state) => state.isSearchActive);

  // ── reflog / config ────────────────────────────────────────────────────
  readonly reflog = this.proxyWritable((state) => state.reflog);
  readonly config = this.proxyWritable((state) => state.config);
  readonly configBusy = this.proxyWritable((state) => state.configBusy);
  /** Global git config; readable with no repository open. */
  readonly globalConfig = this.configOps.globalConfig;
  readonly globalConfigBusy = this.configOps.globalBusy;

  // ── derived ────────────────────────────────────────────────────────────
  readonly isOpen = this.proxySignal((state) => state.isOpen);
  readonly currentBranch = this.proxySignal((state) => state.currentBranch);
  readonly stagedCount = this.proxySignal((state) => state.stagedCount);
  readonly unstagedCount = this.proxySignal((state) => state.unstagedCount);
  readonly conflictCount = this.proxySignal((state) => state.conflictCount);
  readonly mergeInProgress = this.proxySignal((state) => state.mergeInProgress);
  readonly aheadBehind = this.proxySignal((state) => state.aheadBehind);
  /** True while git is parked in a merge/rebase/cherry-pick/revert/bisect. */
  readonly sequencerActive = this.proxySignal((state) => state.sequencerActive);
  /** True while any repo-scoped operation is running. */
  readonly busy = this.proxySignal((state) => state.busy);

  /** Unlisten handle for the single `repo-changed` subscription. */
  private repoUnlisten?: UnlistenFn;

  // ── lifecycle ──────────────────────────────────────────────────────────

  async openRepo(path: string): Promise<void> {
    await this.ensureRepoChangeListener();

    const state = this.workspace.openWorkspace(path);
    if (state.repo() !== null) return;

    const opened = await this.repoOps.open(state);
    if (!opened) return;

    // The watcher and the persisted tab list both follow the canonical
    // toplevel git reports, which may differ from the path the user picked.
    this.workspace.persistTabs();
    void this.workspace.watchPath(state.repo()?.path ?? state.path);
    await this.repoOps.refreshAll(state);
  }

  async close(): Promise<void> {
    const activeTabId = this.workspace.activeTabId();
    if (activeTabId === null) {
      this.fallbackState.reset();
      return;
    }
    await this.workspace.closeWorkspace(activeTabId);
    if (this.workspace.activeTabId() === null) {
      this.fallbackState.reset();
    }
  }

  async refreshAll(): Promise<void> {
    await this.repoOps.refreshAll(this.activeOrFallback());
  }

  async refreshChanges(): Promise<void> {
    await this.repoOps.refreshChanges(this.activeOrFallback());
  }

  async refreshRepoState(): Promise<void> {
    await this.repoOps.refreshRepoState(this.activeOrFallback());
  }

  // ── repository management ──────────────────────────────────────────────

  async initRepoAction(
    path: string,
    defaultBranch: string | null = null,
  ): Promise<RepoInfo | null> {
    const repo = await this.repoOps.init(path, defaultBranch);
    if (repo) await this.openRepo(repo.path);
    return repo;
  }

  /** Clones into `dest` and opens it on success. */
  async cloneRepoAction(
    url: string,
    dest: string,
    options: CloneOptions = {},
    onProgress?: (p: FetchProgress) => void,
  ): Promise<CloneOutcome> {
    const outcome = await this.repoOps.clone(url, dest, options, onProgress);
    if (outcome === 'cloned') await this.openRepo(dest);
    return outcome;
  }

  /** Aborts the clone started with the same `cloneId`. */
  cancelCloneAction(cloneId: string): Promise<void> {
    return this.repoOps.cancelClone(cloneId);
  }

  recentReposAction(): Promise<RepoEntry[]> {
    return this.repoOps.recentRepos();
  }

  removeRecentRepoAction(path: string): Promise<void> {
    return this.repoOps.removeRecent(path);
  }

  gitVersionAction(): Promise<string> {
    return this.repoOps.gitVersion();
  }

  // ── history & selection ────────────────────────────────────────────────

  async loadHistory(): Promise<void> {
    await this.historyOps.load(this.activeOrFallback());
  }

  /** Appends the next page of commits and graph rows. */
  async loadMoreHistory(): Promise<void> {
    await this.historyOps.loadMore(this.activeOrFallback());
  }

  async selectCommit(sha: string): Promise<void> {
    await this.repoOps.selectCommit(this.activeOrFallback(), sha);
  }

  /**
   * Selects `sha` and scrolls the commit list to it, pulling more pages first
   * when the commit is below the loaded window.
   */
  async navigateToSha(sha: string): Promise<void> {
    const state = this.activeOrFallback();
    await this.repoOps.selectCommit(state, sha);
    const found = await this.historyOps.ensureLoaded(state, sha);
    if (found) {
      this.scrollReveal.set({ sha, id: ++this._scrollRevealId });
    }
  }

  async selectWorkingFile(file: FileChange | string, staged: boolean): Promise<void> {
    const path = typeof file === 'string' ? file : file.path;
    await this.repoOps.selectWorkingFile(this.activeOrFallback(), path, staged);
  }

  clearDiff(): void {
    this.repoOps.clearDiff(this.activeOrFallback());
  }

  loadCommitDetails(sha: string): Promise<void> {
    return this.historyOps.loadCommitDetails(this.activeOrFallback(), sha);
  }

  /** Diff of one file inside a commit. */
  commitFileDiff(sha: string, file: string): Promise<string> {
    return this.historyOps.commitFileDiff(this.activeOrFallback(), sha, file);
  }

  /** Contents of a file as of a revision. */
  fileAtRevision(rev: string, file: string): Promise<string> {
    return this.historyOps.fileAtRevision(this.activeOrFallback(), rev, file);
  }

  /**
   * Base64 bytes of a file, for binary previews.
   *
   * Unlike its neighbours this one rejects instead of reporting: the caller
   * reads several sources per file and has to see the failure to pick its
   * fallback (a conflicted path has no index entry) or to recognise the
   * backend's "file too large to preview".
   */
  getFileBase64(file: string, source: FileSource): Promise<string> {
    return this.historyOps.fileBase64(this.activeOrFallback(), file, source);
  }

  loadReflog(limit = 100): Promise<void> {
    return this.historyOps.loadReflog(this.activeOrFallback(), limit);
  }

  // ── search ─────────────────────────────────────────────────────────────

  /** Takes the query exactly as typed; the `path:` token is split off inside. */
  searchCommitsAction(query: string): void {
    this.historyOps.search(this.activeOrFallback(), query);
  }

  clearSearch(): void {
    this.historyOps.clearSearch(this.activeOrFallback());
  }

  // ── staging ────────────────────────────────────────────────────────────

  stageFiles(files: string[]): Promise<void> {
    return this.stagingOps.stageFiles(this.activeOrFallback(), files);
  }

  unstageFiles(files: string[]): Promise<void> {
    return this.stagingOps.unstageFiles(this.activeOrFallback(), files);
  }

  stageHunks(file: string, selection: readonly HunkRange[]): Promise<void> {
    return this.stagingOps.stageHunks(this.activeOrFallback(), file, selection);
  }

  unstageHunks(file: string, selection: readonly HunkRange[]): Promise<void> {
    return this.stagingOps.unstageHunks(this.activeOrFallback(), file, selection);
  }

  /**
   * Applies a line-level patch built with `buildLinePatch`; pair it with
   * `patchApplyFlags(mode)` so stage / unstage / discard cannot be mixed up.
   */
  applyPatchAction(patch: string, flags: PatchApplyFlags): Promise<boolean> {
    return this.stagingOps.applyPatch(this.activeOrFallback(), patch, flags);
  }

  discardChanges(files: string[]): Promise<string[]> {
    return this.stagingOps.discard(this.activeOrFallback(), files);
  }

  createCommit(
    message: string,
    amend = false,
    options: Omit<CommitOptions, 'amend'> = {},
  ): Promise<string | null> {
    return this.stagingOps.commit(this.activeOrFallback(), message, {
      ...options,
      amend,
    });
  }

  getHeadMessage(): Promise<string> {
    return this.stagingOps.headMessage(this.activeOrFallback());
  }

  ignorePathAction(pattern: string): Promise<void> {
    return this.stagingOps.ignorePath(this.activeOrFallback(), pattern);
  }

  setAssumeUnchangedAction(file: string, flag: boolean): Promise<void> {
    return this.stagingOps.setAssumeUnchanged(this.activeOrFallback(), file, flag);
  }

  // ── remotes ────────────────────────────────────────────────────────────

  fetchAction(options: FetchOptions = {}): Promise<boolean> {
    return this.remoteOps.fetch(this.activeOrFallback(), options);
  }

  pullAction(options: PullOptions = {}): Promise<PullResult | null> {
    return this.remoteOps.pull(this.activeOrFallback(), options);
  }

  pushAction(force?: boolean, remote?: string): Promise<PushResult | null>;
  pushAction(options: PushActionOptions): Promise<PushResult | null>;
  pushAction(
    forceOrOptions: boolean | PushActionOptions = false,
    remote = 'origin',
  ): Promise<PushResult | null> {
    const options: PushActionOptions =
      typeof forceOrOptions === 'boolean'
        ? { force: forceOrOptions, remote }
        : forceOrOptions;
    return this.remoteOps.push(this.activeOrFallback(), options);
  }

  listRemotesAction(): Promise<void> {
    return this.remoteOps.listRemotes(this.activeOrFallback());
  }

  addRemoteAction(name: string, url: string): Promise<void> {
    return this.remoteOps.addRemote(this.activeOrFallback(), name, url);
  }

  removeRemoteAction(name: string): Promise<void> {
    return this.remoteOps.removeRemote(this.activeOrFallback(), name);
  }

  renameRemoteAction(oldName: string, newName: string): Promise<void> {
    return this.remoteOps.renameRemote(this.activeOrFallback(), oldName, newName);
  }

  setRemoteUrlAction(name: string, url: string): Promise<void> {
    return this.remoteOps.setRemoteUrl(this.activeOrFallback(), name, url);
  }

  // ── branches & tags ────────────────────────────────────────────────────

  checkoutBranchAction(
    branch: string,
    createTracking = false,
    force = false,
  ): Promise<CheckoutResult | null> {
    const options: CheckoutOptions = { createTracking, force };
    return this.branchOps.checkout(this.activeOrFallback(), branch, options);
  }

  checkoutCommitAction(rev: string): Promise<CheckoutResult | null> {
    return this.branchOps.checkoutCommit(this.activeOrFallback(), rev);
  }

  createBranchAction(
    name: string,
    options: CreateBranchOptions = {},
  ): Promise<boolean> {
    return this.branchOps.create(this.activeOrFallback(), name, options);
  }

  deleteBranchAction(name: string, force = false): Promise<boolean> {
    return this.branchOps.remove(this.activeOrFallback(), name, force);
  }

  renameBranchAction(oldName: string, newName: string): Promise<boolean> {
    return this.branchOps.rename(this.activeOrFallback(), oldName, newName);
  }

  setUpstreamAction(branch: string, upstream: string | null): Promise<boolean> {
    return this.branchOps.setUpstream(this.activeOrFallback(), branch, upstream);
  }

  deleteRemoteBranchAction(remote: string, branch: string): Promise<boolean> {
    return this.branchOps.deleteRemoteBranch(this.activeOrFallback(), remote, branch);
  }

  fastForwardAction(branch: string): Promise<FastForwardResult | null> {
    return this.branchOps.fastForward(this.activeOrFallback(), branch);
  }

  compareRefsAction(base: string, head: string): Promise<CompareResult | null> {
    return this.branchOps.compare(this.activeOrFallback(), base, head);
  }

  createTagAction(
    name: string,
    target: string | null = null,
    message: string | null = null,
  ): Promise<boolean> {
    return this.branchOps.createTag(this.activeOrFallback(), name, target, message);
  }

  deleteTagAction(name: string): Promise<boolean> {
    return this.branchOps.deleteTag(this.activeOrFallback(), name);
  }

  pushTagAction(remote: string, name: string): Promise<boolean> {
    return this.branchOps.pushTag(this.activeOrFallback(), remote, name);
  }

  deleteRemoteTagAction(remote: string, name: string): Promise<boolean> {
    return this.branchOps.deleteRemoteTag(this.activeOrFallback(), remote, name);
  }

  // ── merge & conflicts ──────────────────────────────────────────────────

  mergeBranchAction(
    branch: string,
    squash = false,
    noFf = false,
  ): Promise<MergeResult | null> {
    const options: MergeOptions = { squash, noFf };
    return this.mergeOps.merge(this.activeOrFallback(), branch, options);
  }

  refreshConflictsAction(): Promise<void> {
    return this.mergeOps.refreshConflicts(this.activeOrFallback());
  }

  getMergeContentAction(file: string): Promise<MergeContent | null> {
    return this.mergeOps.mergeContent(this.activeOrFallback(), file);
  }

  resolveConflictAction(file: string, resolvedContent: string): Promise<void> {
    return this.mergeOps.resolve(this.activeOrFallback(), file, resolvedContent);
  }

  /** Resolves by keeping one whole side of the conflict. */
  takeConflictSideAction(file: string, side: ConflictSide): Promise<void> {
    return this.mergeOps.take(this.activeOrFallback(), file, side);
  }

  deleteConflictedFileAction(file: string): Promise<void> {
    return this.mergeOps.removeConflicted(this.activeOrFallback(), file);
  }

  mergeContinueAction(): Promise<SequencerResult | null> {
    return this.mergeOps.continueMerge(this.activeOrFallback());
  }

  abortMergeAction(): Promise<void> {
    return this.mergeOps.abort(this.activeOrFallback());
  }

  // ── stash ──────────────────────────────────────────────────────────────

  refreshStashes(): Promise<void> {
    return this.stashOps.refresh(this.activeOrFallback());
  }

  stashSaveAction(
    message: string,
    options: Omit<StashSaveOptions, 'message'> = {},
  ): Promise<boolean> {
    return this.stashOps.save(this.activeOrFallback(), {
      ...options,
      message: message.length > 0 ? message : null,
    });
  }

  stashApplyAction(index: number, pop: boolean): Promise<boolean> {
    return this.stashOps.apply(this.activeOrFallback(), index, pop);
  }

  stashDropAction(index: number): Promise<boolean> {
    return this.stashOps.drop(this.activeOrFallback(), index);
  }

  stashShowAction(index: number): Promise<string> {
    return this.stashOps.show(this.activeOrFallback(), index);
  }

  stashBranchAction(index: number, branchName: string): Promise<boolean> {
    return this.stashOps.toBranch(this.activeOrFallback(), index, branchName);
  }

  // ── sequencer ──────────────────────────────────────────────────────────

  cherryPickAction(sha: string): Promise<PatchApplyResult | null> {
    return this.sequencerOps.cherryPick(this.activeOrFallback(), sha);
  }

  cherryPickOntoAction(
    sha: string,
    targetBranch: string,
  ): Promise<PatchApplyResult | null> {
    return this.sequencerOps.cherryPickOnto(this.activeOrFallback(), sha, targetBranch);
  }

  revertAction(sha: string): Promise<PatchApplyResult | null> {
    return this.sequencerOps.revert(this.activeOrFallback(), sha);
  }

  rebaseBranchAction(branch: string, onto: string): Promise<RebaseResult | null> {
    return this.sequencerOps.rebase(this.activeOrFallback(), branch, onto);
  }

  rebaseTodoAction(base: string): Promise<RebaseTodoEntry[]> {
    return this.sequencerOps.rebaseTodo(this.activeOrFallback(), base);
  }

  applyRebaseAction(
    base: string,
    entries: RebaseTodoEntry[],
  ): Promise<RebaseResult | null> {
    return this.sequencerOps.applyRebase(this.activeOrFallback(), base, entries);
  }

  resetToCommitAction(sha: string, mode: ResetMode): Promise<ResetResult | null> {
    return this.sequencerOps.reset(this.activeOrFallback(), sha, mode);
  }

  rebaseContinueAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.rebaseContinue(this.activeOrFallback());
  }

  rebaseSkipAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.rebaseSkip(this.activeOrFallback());
  }

  rebaseAbortAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.rebaseAbort(this.activeOrFallback());
  }

  cherryPickContinueAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.cherryPickContinue(this.activeOrFallback());
  }

  cherryPickAbortAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.cherryPickAbort(this.activeOrFallback());
  }

  cherryPickSkipAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.cherryPickSkip(this.activeOrFallback());
  }

  revertContinueAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.revertContinue(this.activeOrFallback());
  }

  revertAbortAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.revertAbort(this.activeOrFallback());
  }

  revertSkipAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.revertSkip(this.activeOrFallback());
  }

  /** Continues whichever sequence git is parked in. */
  continueSequencerAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.continueCurrent(this.activeOrFallback());
  }

  /** Aborts whichever sequence git is parked in. */
  abortSequencerAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.abortCurrent(this.activeOrFallback());
  }

  /**
   * Skips the current commit of whichever sequence git is parked in. Prefer
   * this over `rebaseSkipAction`, which is wrong inside a cherry-pick.
   */
  skipSequencerAction(): Promise<SequencerResult | null> {
    return this.sequencerOps.skipCurrent(this.activeOrFallback());
  }

  // ── blame & file history ───────────────────────────────────────────────

  /** `rev = null` blames the work tree; a revision blames the file as of it. */
  loadBlame(file: string, rev: string | null = null): Promise<void> {
    return this.historyOps.loadBlame(this.activeOrFallback(), file, rev);
  }

  clearBlame(): void {
    this.historyOps.clearBlame(this.activeOrFallback());
  }

  loadFileHistory(file: string): Promise<void> {
    return this.historyOps.loadFileHistory(this.activeOrFallback(), file);
  }

  clearFileHistory(): void {
    this.historyOps.clearFileHistory(this.activeOrFallback());
  }

  // ── config ─────────────────────────────────────────────────────────────

  loadConfigAction(): Promise<void> {
    return this.configOps.load(this.activeOrFallback());
  }

  /** Loads the global config; works with no repository open. */
  loadGlobalConfigAction(): Promise<void> {
    return this.configOps.loadGlobal();
  }

  setGlobalConfigAction(
    key: WritableConfigKey,
    value: string | null,
  ): Promise<boolean> {
    return this.configOps.setGlobal(key, value);
  }

  setConfigAction(
    key: WritableConfigKey,
    value: string | null,
    global = false,
  ): Promise<boolean> {
    return this.configOps.set(this.activeOrFallback(), key, value, global);
  }

  // ── OS integration ─────────────────────────────────────────────────────

  /** Reveals a repo-relative path (or the repo root) in the file manager. */
  revealInFileManager(relativePath?: string): Promise<void> {
    return this.systemOps.reveal(this.resolveTarget(relativePath));
  }

  openInTerminal(): Promise<void> {
    const repo = this.repo();
    if (!repo) return Promise.resolve();
    return this.systemOps.openTerminal(repo.path);
  }

  openInEditor(relativePath?: string): Promise<void> {
    return this.systemOps.openEditor(this.resolveTarget(relativePath));
  }

  /** Opens an http/https URL in the default browser. */
  openUrl(url: string): Promise<void> {
    return this.systemOps.openUrl(url);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private resolveTarget(relativePath?: string): string {
    const repo = this.repo();
    if (!repo) return relativePath ?? '';
    if (!relativePath) return repo.path;
    return `${repo.path}/${relativePath}`;
  }

  private proxyWritable<T>(
    select: (state: RepoState) => WritableSignal<T>,
  ): WritableSignal<T> {
    const value = computed(() => select(this.activeOrFallback())());
    const proxy = (() => value()) as unknown as WritableSignal<T>;
    proxy.set = (next: T) => select(this.activeOrFallback()).set(next);
    proxy.update = (updater: (current: T) => T) =>
      select(this.activeOrFallback()).update(updater);
    proxy.asReadonly = () => proxy as Signal<T>;
    return proxy;
  }

  private proxySignal<T>(select: (state: RepoState) => Signal<T>): Signal<T> {
    return computed(() => select(this.activeOrFallback())());
  }

  /**
   * Subscribes once to the backend `repo-changed` event and routes each event
   * to the matching tab.
   *
   * Events are dropped while an operation is running or right after our own
   * refresh: git writes to `.git` on every command, so echoing them back
   * would loop (refresh → fs event → refresh → …).
   */
  /** Kinds seen since the last debounced refresh, per tab. */
  private readonly pendingKinds = new WeakMap<RepoState, Set<RepoChangeKind>>();

  private async ensureRepoChangeListener(): Promise<void> {
    if (this.repoUnlisten) return;
    try {
      this.repoUnlisten = await listen<RepoChangedPayload>('repo-changed', (event) => {
        const state = this.workspace.findByPath(event.payload.path);
        if (!state) return;
        if (this.shouldIgnoreWatcherEvent(state)) return;

        // The backend emits one event per kind, so a checkout arrives as two.
        // The debounce collapses them into a single refresh, which has to
        // cover every kind it swallowed.
        const pending = this.pendingKinds.get(state) ?? new Set<RepoChangeKind>();
        pending.add(event.payload.kind);
        this.pendingKinds.set(state, pending);

        state.setRefreshTimer(() => {
          const kinds = this.pendingKinds.get(state);
          this.pendingKinds.delete(state);
          if (!kinds || this.shouldIgnoreWatcherEvent(state)) return;
          void this.repoOps.refreshFor(state, kinds);
        }, WATCHER_DEBOUNCE_MS);
      });
    } catch {
      this.repoUnlisten = undefined;
    }
  }

  private shouldIgnoreWatcherEvent(state: RepoState): boolean {
    if (state.busy() || state.isFetching()) return true;
    return Date.now() - state.lastRefreshAt < OWN_WRITE_WINDOW_MS;
  }
}
