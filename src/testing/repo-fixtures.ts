import {
  CLEAN_REPO_STATE,
  type CommitDetails,
  type FileChange,
  type GraphData,
  type RepoConfig,
  type RepoInfo,
  type WorkingChanges,
} from '../app/core/models';

/**
 * The canned repository of the component tier: no path on disk is ever read,
 * but every code path that refuses to run without an open repository needs a
 * `RepoInfo` to exist (test-plan §Test data, component).
 */
export const TEST_REPO: RepoInfo = {
  path: '/repo',
  name: 'repo',
  current_branch: 'main',
  is_bare: false,
};

/** The three unstaged paths of the fixture working tree, in display order. */
export const UNSTAGED_PATHS = ['src/app/a.ts', 'src/app/b.ts', 'src/app/c.ts'];

/** The two staged paths of the fixture working tree, in display order. */
export const STAGED_PATHS = ['src/lib/x.ts', 'src/lib/y.ts'];

function modified(path: string): FileChange {
  return { path, old_path: null, status: 'modified', is_submodule: false };
}

/**
 * Three unstaged and two staged files. Pass the paths to publish a smaller
 * tree — that is how a spec plays a stage or an external edit, since nothing
 * in the component tier writes to a real index.
 */
export function workingChanges(
  unstaged: readonly string[] = UNSTAGED_PATHS,
  staged: readonly string[] = STAGED_PATHS,
): WorkingChanges {
  return {
    staged: staged.map(modified),
    unstaged: unstaged.map(modified),
    untracked: [],
    conflicted: [],
  };
}

const EMPTY_GRAPH: GraphData = { commits: [], max_lanes: 0 };

/** A plain repository config: no signing, no AI opt-out. */
const TEST_CONFIG: RepoConfig = {
  user_name: 'Jhoan Moreno',
  user_email: 'jmoreno@example.com',
  global_user_name: 'Jhoan Moreno',
  global_user_email: 'jmoreno@example.com',
  pull_rebase: null,
  gpg_sign: false,
  signing_format: null,
  default_branch: 'main',
  autocrlf: null,
  ai_enabled: null,
};

export const COMMIT_SHA = 'c0ffee1babe2cafe3dead4beef5f00d6ba7ba71c';
export const COMMIT_SUBJECT = 'feat(core): teach the workspace to walk files';

/** The commit's two files: one text, one binary (test-plan §Test data). */
export const COMMIT_TEXT_FILE = 'src/app/app.ts';
export const COMMIT_BINARY_FILE = 'assets/data.bin';

/**
 * The fixture commit. `overrides` is what a row varies about it — a long
 * `body`, a different `subject`, the `refs` a header has to badge — so every
 * spec reads the same author, dates and sha for everything it does not.
 */
export function commitDetails(
  files: readonly string[] = [COMMIT_TEXT_FILE, COMMIT_BINARY_FILE],
  overrides: Partial<CommitDetails> = {},
): CommitDetails {
  return {
    sha: COMMIT_SHA,
    short_sha: COMMIT_SHA.slice(0, 7),
    parents: ['a4848bd'],
    author_name: 'Jhoan Moreno',
    author_email: 'jmoreno@example.com',
    author_date: '2026-09-02T14:10:00Z',
    committer_name: 'Jhoan Moreno',
    committer_email: 'jmoreno@example.com',
    committer_date: '2026-09-02T14:10:00Z',
    subject: COMMIT_SUBJECT,
    body: '',
    refs: [],
    signature: 'none',
    files: files.map((path) => ({
      path,
      old_path: null,
      status: 'modified',
      additions: path === COMMIT_BINARY_FILE ? 0 : 1,
      deletions: path === COMMIT_BINARY_FILE ? 0 : 1,
      binary: path === COMMIT_BINARY_FILE,
    })),
    additions: 1,
    deletions: 1,
    ...overrides,
  };
}

/** A one-hunk patch for `path`, small enough to render expanded. */
export function textDiff(path: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,3 +1,3 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    '',
  ].join('\n');
}

/** What git sends for a binary file: no hunk, so the viewer explains instead. */
export function binaryDiff(path: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `Binary files a/${path} and b/${path} differ`,
    '',
  ].join('\n');
}

/**
 * Canned answers for every command a workbench render reaches for, so a spec
 * only names the ones whose value it asserts on.
 */
export function gitResponses(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    open_repo: TEST_REPO,
    add_recent_repo: undefined,
    get_working_changes: workingChanges(),
    get_conflicts: [],
    get_repo_state: CLEAN_REPO_STATE,
    // Never `null`: the composer reloads the config for as long as it is
    // missing, and a stub that keeps answering `null` never lets Angular
    // stabilise (NG0103).
    get_repo_config: TEST_CONFIG,
    get_diff: textDiff(UNSTAGED_PATHS[0]),
    get_commit_file_diff: textDiff(COMMIT_TEXT_FILE),
    get_commit_details: commitDetails(),
    // A full refresh reloads every panel, so every loader it fans out to needs
    // an answer or its failure toast lands in the middle of an assertion.
    get_history: { commits: [], graph: EMPTY_GRAPH, total: 0, has_more: false },
    get_graph_data: EMPTY_GRAPH,
    list_branches: { local: [], remote: [], current: 'main' },
    list_tags: [],
    list_remotes: [],
    stash_list: [],
    ...overrides,
  };
}
