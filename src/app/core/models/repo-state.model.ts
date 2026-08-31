/** Sequencer / merge state the repository is currently parked in. */
export type RepoStateKind =
  | 'clean'
  | 'merging'
  | 'rebasing'
  | 'cherry_picking'
  | 'reverting'
  | 'bisecting';

/** Output of `get_repo_state` — drives the repo-state banner and toolbars. */
export interface RepoStateInfo {
  state: RepoStateKind;
  head_detached: boolean;
  /** Commit HEAD points at; empty on an unborn branch. */
  head_sha: string;
  /** 1-based step of an in-progress rebase, when git reports one. */
  rebase_step: number | null;
  rebase_total: number | null;
  conflicted_files: string[];
}

/** Neutral value used before the first `get_repo_state` round-trip. */
export const CLEAN_REPO_STATE: RepoStateInfo = {
  state: 'clean',
  head_detached: false,
  head_sha: '',
  rebase_step: null,
  rebase_total: null,
  conflicted_files: [],
};
