/**
 * Outcome of every sequencer step (`rebase_continue`, `cherry_pick_abort`,
 * `merge_continue`, …) and of `cherry_pick` / `revert_commit`.
 */
export type SequencerResult =
  | { kind: 'completed' }
  | { kind: 'conflicts'; files: string[] }
  | { kind: 'error'; message: string };
