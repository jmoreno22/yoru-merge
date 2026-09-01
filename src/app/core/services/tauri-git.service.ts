import { Injectable } from '@angular/core';
import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  BlameLine,
  BranchList,
  CheckoutResult,
  CommitDetails,
  CommitInfo,
  CompareResult,
  ConflictFile,
  ConflictSide,
  FastForwardResult,
  FetchProgress,
  FileSource,
  GraphData,
  HistoryPage,
  HunkRange,
  MergeContent,
  MergeResult,
  PatchApplyResult,
  PullMode,
  PullResult,
  PushResult,
  RebaseResult,
  RebaseTodoEntry,
  ReflogEntry,
  RemoteInfo,
  RepoConfig,
  RepoEntry,
  RepoInfo,
  RepoStateInfo,
  ResetMode,
  ResetResult,
  SequencerResult,
  StashEntry,
  TagInfo,
  WorkingChanges,
  WritableConfigKey,
} from '../models';

export type { ConflictSide, FileSource, PullMode, ResetMode } from '../models';

/** Options accepted by {@link TauriGitService.push}. */
export interface PushOptions {
  force?: boolean;
  setUpstream?: boolean;
  tags?: boolean;
}

/** Options accepted by {@link TauriGitService.cloneRepo}. */
export interface CloneOptions {
  depth?: number | null;
  branch?: string | null;
  recursive?: boolean;
  /** Handle for {@link TauriGitService.cancelClone}; the caller mints it. */
  cloneId?: string | null;
}

/** Options accepted by {@link TauriGitService.generateCommitMessage}. */
export interface AiProviderOptions {
  /** The user's own prompt layer; the backend caps and cleans it. */
  instructions?: string;
  /** Kilobytes of staged diff to send; the backend clamps it to 1-256. */
  maxDiffKb?: number;
  /** Seconds before the provider is killed; the backend clamps it to 5-300. */
  timeoutSecs?: number;
}

/** Options accepted by {@link TauriGitService.stashSave}. */
export interface StashSaveOptions {
  message?: string | null;
  includeUntracked?: boolean;
  keepIndex?: boolean;
  /** Restrict the stash to these paths; empty means the whole worktree. */
  paths?: string[];
}

/**
 * One method per Tauri command. No state, no error handling: callers own
 * both. Argument keys are camelCase because Tauri converts the Rust
 * `snake_case` parameter names; payload *fields* stay snake_case.
 */
@Injectable({ providedIn: 'root' })
export class TauriGitService {
  // ── Repository lifecycle ────────────────────────────────────────────────

  openRepo(path: string): Promise<RepoInfo> {
    return invoke<RepoInfo>('open_repo', { path });
  }

  initRepo(path: string, defaultBranch: string | null = null): Promise<RepoInfo> {
    return invoke<RepoInfo>('init_repo', { path, defaultBranch });
  }

  cloneRepo(
    url: string,
    dest: string,
    options: CloneOptions = {},
    onProgress?: (p: FetchProgress) => void,
  ): Promise<void> {
    return invoke<void>('clone_repo', {
      url,
      dest,
      depth: options.depth ?? null,
      branch: options.branch ?? null,
      recursive: options.recursive ?? false,
      cloneId: options.cloneId ?? null,
      onProgress: progressChannel(onProgress),
    });
  }

  /**
   * Aborts the clone running under `cloneId`. Returns false when no clone is
   * registered under that id (it already finished, or never started).
   *
   * The cancelled `cloneRepo` rejects with a message containing
   * "clone canceled" — callers treat that as a user action, not a failure.
   */
  cancelClone(cloneId: string): Promise<boolean> {
    return invoke<boolean>('cancel_clone', { cloneId });
  }

  getRecentRepos(): Promise<RepoEntry[]> {
    return invoke<RepoEntry[]>('get_recent_repos');
  }

  addRecentRepo(path: string): Promise<void> {
    return invoke<void>('add_recent_repo', { path });
  }

  removeRecentRepo(path: string): Promise<void> {
    return invoke<void>('remove_recent_repo', { path });
  }

  getRepoState(path: string): Promise<RepoStateInfo> {
    return invoke<RepoStateInfo>('get_repo_state', { path });
  }

  getGitVersion(): Promise<string> {
    return invoke<string>('get_git_version');
  }

  // ── History ─────────────────────────────────────────────────────────────

  /**
   * Paged history plus the graph rows for the same page. Prefer this over
   * `gitLog` + `getGraphData`: it is one round-trip and the lane assignment
   * stays stable across pages.
   */
  getHistory(
    path: string,
    limit: number,
    skip: number,
    branch: string | null = null,
    all = true,
  ): Promise<HistoryPage> {
    return invoke<HistoryPage>('get_history', {
      path,
      limit,
      skip,
      branch,
      all,
    });
  }

  gitLog(
    path: string,
    limit: number,
    skip: number,
    branch?: string,
  ): Promise<CommitInfo[]> {
    return invoke<CommitInfo[]>('git_log', { path, limit, skip, branch });
  }

  getGraphData(path: string, limit: number, skip: number): Promise<GraphData> {
    return invoke<GraphData>('get_graph_data', { path, limit, skip });
  }

  /** `touchingPath` restricts the search to commits that touched that path. */
  searchCommits(
    path: string,
    query: string,
    author = '',
    limit = 200,
    touchingPath: string | null = null,
  ): Promise<CommitInfo[]> {
    return invoke<CommitInfo[]>('search_commits', {
      path,
      query,
      author,
      limit,
      touchingPath,
    });
  }

  getReflog(path: string, limit = 100): Promise<ReflogEntry[]> {
    return invoke<ReflogEntry[]>('get_reflog', { path, limit });
  }

  // ── Commits ─────────────────────────────────────────────────────────────

  getCommitDetails(path: string, sha: string): Promise<CommitDetails> {
    return invoke<CommitDetails>('get_commit_details', { path, sha });
  }

  getCommitDiff(path: string, sha: string): Promise<string> {
    return invoke<string>('get_commit_diff', { path, sha });
  }

  getCommitFileDiff(path: string, sha: string, file: string): Promise<string> {
    return invoke<string>('get_commit_file_diff', { path, sha, file });
  }

  getFileAtRevision(path: string, rev: string, file: string): Promise<string> {
    return invoke<string>('get_file_at_revision', { path, rev, file });
  }

  /** `rev = null` blames the work tree; a revision blames the file as of it. */
  blameFile(
    path: string,
    file: string,
    rev: string | null = null,
  ): Promise<BlameLine[]> {
    return invoke<BlameLine[]>('blame_file', { path, file, rev });
  }

  /**
   * Raw bytes of `file`, base64-encoded, for content the diff viewer cannot
   * render as text (images and other binaries).
   */
  getFileBase64(path: string, file: string, source: FileSource): Promise<string> {
    return invoke<string>('get_file_base64', { path, file, source });
  }

  fileHistory(path: string, file: string): Promise<CommitInfo[]> {
    return invoke<CommitInfo[]>('file_history', { path, file });
  }

  // ── Working tree ────────────────────────────────────────────────────────

  getWorkingChanges(path: string): Promise<WorkingChanges> {
    return invoke<WorkingChanges>('get_working_changes', { path });
  }

  getDiff(path: string, file: string | null, staged: boolean): Promise<string> {
    return invoke<string>('get_diff', { path, file, staged });
  }

  stageFiles(path: string, files: string[]): Promise<void> {
    return invoke<void>('stage_files', { path, files });
  }

  unstageFiles(path: string, files: string[]): Promise<void> {
    return invoke<void>('unstage_files', { path, files });
  }

  stageHunks(
    path: string,
    file: string,
    selection: readonly HunkRange[],
  ): Promise<void> {
    return invoke<void>('stage_hunks', { path, file, selection });
  }

  unstageHunks(
    path: string,
    file: string,
    selection: readonly HunkRange[],
  ): Promise<void> {
    return invoke<void>('unstage_hunks', { path, file, selection });
  }

  discardChanges(path: string, files: string[]): Promise<string[]> {
    return invoke<string[]>('discard_changes', { path, files });
  }

  /**
   * Applies a unified patch. `cached` targets the index, `reverse` undoes the
   * patch instead of applying it — together they express stage / unstage /
   * discard of an arbitrary line selection.
   */
  applyPatch(
    path: string,
    patch: string,
    reverse: boolean,
    cached: boolean,
  ): Promise<void> {
    return invoke<void>('apply_patch', { path, patch, reverse, cached });
  }

  /** Appends `pattern` to `.gitignore` and untracks the file if it was tracked. */
  ignorePath(path: string, pattern: string): Promise<void> {
    return invoke<void>('ignore_path', { path, pattern });
  }

  setAssumeUnchanged(path: string, file: string, flag: boolean): Promise<void> {
    return invoke<void>('set_assume_unchanged', { path, file, flag });
  }

  createCommit(
    path: string,
    message: string,
    amend = false,
    signoff = false,
    noVerify = false,
  ): Promise<string> {
    return invoke<string>('create_commit', {
      path,
      message,
      amend,
      signoff,
      noVerify,
    });
  }

  getHeadCommitMessage(path: string): Promise<string> {
    return invoke<string>('get_head_commit_message', { path });
  }

  // ── Branches, tags, refs ────────────────────────────────────────────────

  listBranches(path: string): Promise<BranchList> {
    return invoke<BranchList>('list_branches', { path });
  }

  checkoutBranch(
    path: string,
    name: string,
    createTracking = false,
    force = false,
  ): Promise<CheckoutResult> {
    return invoke<CheckoutResult>('checkout_branch', {
      path,
      name,
      createTracking,
      force,
    });
  }

  /** Checks out `rev` (sha, tag or ref), detaching HEAD. */
  checkoutCommit(path: string, rev: string): Promise<CheckoutResult> {
    return invoke<CheckoutResult>('checkout_commit', { path, rev });
  }

  createBranch(
    path: string,
    name: string,
    startPoint: string | null = null,
    checkout = false,
  ): Promise<void> {
    return invoke<void>('create_branch', { path, name, startPoint, checkout });
  }

  deleteBranch(path: string, name: string, force = false): Promise<void> {
    return invoke<void>('delete_branch', { path, name, force });
  }

  renameBranch(path: string, oldName: string, newName: string): Promise<void> {
    return invoke<void>('rename_branch', { path, oldName, newName });
  }

  /** `upstream = null` unsets the tracking branch. */
  setUpstream(path: string, branch: string, upstream: string | null): Promise<void> {
    return invoke<void>('set_upstream', { path, branch, upstream });
  }

  deleteRemoteBranch(path: string, remote: string, branch: string): Promise<void> {
    return invoke<void>('delete_remote_branch', { path, remote, branch });
  }

  fastForward(path: string, branch: string): Promise<FastForwardResult> {
    return invoke<FastForwardResult>('fast_forward', { path, branch });
  }

  compareRefs(path: string, base: string, head: string): Promise<CompareResult> {
    return invoke<CompareResult>('compare_refs', { path, base, head });
  }

  listTags(path: string): Promise<TagInfo[]> {
    return invoke<TagInfo[]>('list_tags', { path });
  }

  /** A non-null `message` creates an annotated tag. */
  createTag(
    path: string,
    name: string,
    target: string | null = null,
    message: string | null = null,
  ): Promise<void> {
    return invoke<void>('create_tag', { path, name, target, message });
  }

  deleteTag(path: string, name: string): Promise<void> {
    return invoke<void>('delete_tag', { path, name });
  }

  pushTag(path: string, remote: string, name: string): Promise<void> {
    return invoke<void>('push_tag', { path, remote, name });
  }

  deleteRemoteTag(path: string, remote: string, name: string): Promise<void> {
    return invoke<void>('delete_remote_tag', { path, remote, name });
  }

  // ── Remotes ─────────────────────────────────────────────────────────────

  /** `remote = null` fetches every remote (`--all`). */
  fetchRemote(
    path: string,
    remote: string | null,
    prune = false,
    tags = false,
    onProgress?: (p: FetchProgress) => void,
  ): Promise<void> {
    return invoke<void>('fetch_remote', {
      path,
      remote,
      prune,
      tags,
      onProgress: progressChannel(onProgress),
    });
  }

  pull(
    path: string,
    remote: string,
    branch: string,
    mode: PullMode = 'merge',
    autostash = false,
  ): Promise<PullResult> {
    return invoke<PullResult>('pull', {
      path,
      remote,
      branch,
      mode,
      autostash,
    });
  }

  push(
    path: string,
    remote: string,
    branch: string,
    options: PushOptions = {},
  ): Promise<PushResult> {
    return invoke<PushResult>('push', {
      path,
      remote,
      branch,
      force: options.force ?? false,
      setUpstream: options.setUpstream ?? false,
      tags: options.tags ?? false,
    });
  }

  listRemotes(path: string): Promise<RemoteInfo[]> {
    return invoke<RemoteInfo[]>('list_remotes', { path });
  }

  addRemote(path: string, name: string, url: string): Promise<void> {
    return invoke<void>('add_remote', { path, name, url });
  }

  removeRemote(path: string, name: string): Promise<void> {
    return invoke<void>('remove_remote', { path, name });
  }

  renameRemote(path: string, oldName: string, newName: string): Promise<void> {
    return invoke<void>('rename_remote', { path, oldName, newName });
  }

  /** Repoints an existing remote at `url` (both fetch and push). */
  setRemoteUrl(path: string, name: string, url: string): Promise<void> {
    return invoke<void>('set_remote_url', { path, name, url });
  }

  // ── Merge & conflicts ───────────────────────────────────────────────────

  mergeBranch(
    path: string,
    branch: string,
    squash = false,
    noFf = false,
  ): Promise<MergeResult> {
    return invoke<MergeResult>('merge_branch', { path, branch, squash, noFf });
  }

  getConflicts(path: string): Promise<ConflictFile[]> {
    return invoke<ConflictFile[]>('get_conflicts', { path });
  }

  getMergeContent(path: string, file: string): Promise<MergeContent> {
    return invoke<MergeContent>('get_merge_content', { path, file });
  }

  resolveConflict(path: string, file: string, resolvedContent: string): Promise<void> {
    return invoke<void>('resolve_conflict', { path, file, resolvedContent });
  }

  /** Resolves by taking one whole side, then staging the file. */
  resolveConflictTake(path: string, file: string, side: ConflictSide): Promise<void> {
    return invoke<void>('resolve_conflict_take', { path, file, side });
  }

  /** Resolves a delete/modify conflict by removing the file. */
  resolveConflictDelete(path: string, file: string): Promise<void> {
    return invoke<void>('resolve_conflict_delete', { path, file });
  }

  abortMerge(path: string): Promise<void> {
    return invoke<void>('abort_merge', { path });
  }

  /** Commits a merge whose conflicts are fully resolved and staged. */
  mergeContinue(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('merge_continue', { path });
  }

  // ── Sequencer (rebase / cherry-pick / revert) ───────────────────────────

  rebaseBranch(path: string, branch: string, onto: string): Promise<RebaseResult> {
    return invoke<RebaseResult>('rebase_branch', { path, branch, onto });
  }

  getRebaseTodo(path: string, base: string): Promise<RebaseTodoEntry[]> {
    return invoke<RebaseTodoEntry[]>('get_rebase_todo', { path, base });
  }

  applyRebase(
    path: string,
    base: string,
    entries: RebaseTodoEntry[],
  ): Promise<RebaseResult> {
    return invoke<RebaseResult>('apply_rebase', { path, base, entries });
  }

  rebaseContinue(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('rebase_continue', { path });
  }

  rebaseAbort(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('rebase_abort', { path });
  }

  rebaseSkip(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('rebase_skip', { path });
  }

  cherryPick(path: string, sha: string): Promise<PatchApplyResult> {
    return invoke<PatchApplyResult>('cherry_pick', { path, sha });
  }

  cherryPickContinue(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('cherry_pick_continue', { path });
  }

  cherryPickAbort(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('cherry_pick_abort', { path });
  }

  cherryPickSkip(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('cherry_pick_skip', { path });
  }

  revertCommit(path: string, sha: string): Promise<PatchApplyResult> {
    return invoke<PatchApplyResult>('revert_commit', { path, sha });
  }

  revertContinue(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('revert_continue', { path });
  }

  revertAbort(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('revert_abort', { path });
  }

  revertSkip(path: string): Promise<SequencerResult> {
    return invoke<SequencerResult>('revert_skip', { path });
  }

  resetToCommit(path: string, sha: string, mode: ResetMode): Promise<ResetResult> {
    return invoke<ResetResult>('reset_to_commit', { path, sha, mode });
  }

  // ── Stash ───────────────────────────────────────────────────────────────

  stashSave(path: string, options: StashSaveOptions = {}): Promise<void> {
    return invoke<void>('stash_save', {
      path,
      message: options.message ?? null,
      includeUntracked: options.includeUntracked ?? false,
      keepIndex: options.keepIndex ?? false,
      paths: options.paths ?? [],
    });
  }

  stashList(path: string): Promise<StashEntry[]> {
    return invoke<StashEntry[]>('stash_list', { path });
  }

  stashApply(path: string, index: number, pop: boolean): Promise<void> {
    return invoke<void>('stash_apply', { path, index, pop });
  }

  stashDrop(path: string, index: number): Promise<void> {
    return invoke<void>('stash_drop', { path, index });
  }

  stashShow(path: string, index: number): Promise<string> {
    return invoke<string>('stash_show', { path, index });
  }

  stashBranch(path: string, index: number, branchName: string): Promise<void> {
    return invoke<void>('stash_branch', { path, index, branchName });
  }

  // ── Config ──────────────────────────────────────────────────────────────

  /**
   * Without `path` this reads the global config only, so Settings works with
   * no repository open. The key is omitted rather than sent as null, which is
   * what the backend's `Option<String>` expects.
   */
  getRepoConfig(path?: string | null): Promise<RepoConfig> {
    return invoke<RepoConfig>('get_repo_config', path == null ? {} : { path });
  }

  /** `path = null` writes the global config; `value = null` unsets the key. */
  setConfigValue(
    path: string | null,
    key: WritableConfigKey,
    value: string | null,
  ): Promise<void> {
    return invoke<void>('set_config_value', { path, key, value });
  }

  // ── OS integration ──────────────────────────────────────────────────────

  /** Reveals a file in the OS file manager, or opens a directory. */
  openInFileManager(target: string): Promise<void> {
    return invoke<void>('open_in_file_manager', { target });
  }

  /** `terminal` is the user's preferred command; `null` uses the OS default. */
  // ── AI commit messages ──────────────────────────────────────────────────

  /**
   * A commit message for what is staged, drafted by the CLI named in
   * `command`.
   *
   * The command is the whole configuration: no key, token or account of any
   * kind crosses this boundary, because the CLI is already authenticated on
   * the user's machine with the user's own subscription.
   */
  generateCommitMessage(
    path: string,
    command: string,
    options: AiProviderOptions = {},
  ): Promise<string> {
    return invoke<string>('generate_commit_message', {
      path,
      command,
      instructions: options.instructions ?? null,
      maxDiffKb: options.maxDiffKb ?? null,
      timeoutSecs: options.timeoutSecs ?? null,
    });
  }

  /**
   * The exact prompt {@link generateCommitMessage} would send, without sending
   * it — what Settings shows behind "See what gets sent".
   */
  previewAiPrompt(
    path: string,
    command: string,
    options: AiProviderOptions = {},
  ): Promise<string> {
    return invoke<string>('preview_ai_prompt', {
      path,
      command,
      instructions: options.instructions ?? null,
      maxDiffKb: options.maxDiffKb ?? null,
    });
  }

  /** Runs the provider against a fixed one-line diff, for the Test button. */
  testAiProvider(command: string, timeoutSecs?: number): Promise<string> {
    return invoke<string>('test_ai_provider', {
      command,
      timeoutSecs: timeoutSecs ?? null,
    });
  }

  openInTerminal(dir: string, terminal: string | null = null): Promise<void> {
    return invoke<void>('open_in_terminal', { dir, terminal });
  }

  openInEditor(target: string, editor: string | null = null): Promise<void> {
    return invoke<void>('open_in_editor', { target, editor });
  }

  /**
   * Opens a web URL in the default browser. Only `http`/`https` are accepted;
   * anything else is rejected by the backend with a user-readable message.
   */
  openUrl(url: string): Promise<void> {
    return invoke<void>('open_url', { url });
  }

  // ── File watcher ────────────────────────────────────────────────────────

  /**
   * Subscribes the backend watcher to `path`; it then emits `repo-changed`
   * events. Idempotent — watching the same path twice is a no-op.
   */
  watchRepo(path: string): Promise<void> {
    return invoke<void>('watch_repo', { path });
  }

  /** Tears down the watcher for `path`. Safe if it was never watched. */
  unwatchRepo(path: string): Promise<void> {
    return invoke<void>('unwatch_repo', { path });
  }
}

/**
 * Wraps a progress callback in a Tauri Channel.
 *
 * A channel is always created — the backend argument is not optional — but
 * without a callback the messages are simply dropped.
 */
function progressChannel(
  onProgress?: (p: FetchProgress) => void,
): Channel<FetchProgress> {
  const channel = new Channel<FetchProgress>();
  if (onProgress) channel.onmessage = onProgress;
  return channel;
}
