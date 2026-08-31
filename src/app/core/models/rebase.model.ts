/**
 * One entry in an interactive rebase todo list.
 *
 * `action` is one of the standard git rebase verbs:
 *   `pick`, `squash`, `fixup`, `reword`, `drop`, `edit`.
 */
export interface RebaseTodoEntry {
  action: string;
  sha: string;
  message: string;
}

/** Tagged union returned by `rebase_branch` and `apply_rebase`. */
export type RebaseResult =
  | { kind: 'rebased' }
  | { kind: 'up_to_date' }
  | { kind: 'conflicts'; files: string[] }
  /** An `edit` step stopped the rebase; `message` is git's guidance text. */
  | { kind: 'paused'; message: string }
  | { kind: 'not_possible' }
  | { kind: 'error'; message: string };

/** Outcome of replaying a single patch: `cherry_pick` and `revert_commit`. */
export type PatchApplyResult =
  | { kind: 'applied' }
  | { kind: 'conflicts'; files: string[] }
  | { kind: 'error'; message: string };

/** `git reset` mode. */
export type ResetMode = 'soft' | 'mixed' | 'hard';

/** Tagged union returned by the `reset_to_commit` command. */
export type ResetResult =
  | { kind: 'reset'; mode: string }
  | { kind: 'error'; message: string };
