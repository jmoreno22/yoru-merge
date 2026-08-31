/**
 * Shapes mirror the Rust enums emitted by the Tauri commands
 * `fetch_remote`, `pull`, `push`, and `list_remotes`.
 */

/** How `pull` reconciles the fetched upstream with the local branch. */
export type PullMode = 'merge' | 'rebase' | 'ff_only';

/** Progress event streamed by `fetch_remote` / `clone_repo` over a Tauri Channel. */
export interface FetchProgress {
  phase: 'counting' | 'receiving' | 'resolving' | 'info' | 'done';
  current?: number;
  total?: number;
  done: boolean;
  message?: string;
}

/** Tagged union returned by the `pull` command. */
export type PullResult =
  | { kind: 'up_to_date' }
  | { kind: 'fast_forward' }
  | { kind: 'merged' }
  | { kind: 'rebased' }
  | { kind: 'conflicts'; files: string[] }
  | { kind: 'auth_required' };

/** Tagged union returned by the `push` command. */
export type PushResult =
  | { kind: 'success' }
  | { kind: 'up_to_date' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'auth_required' };

/** One configured remote (output of `list_remotes`). */
export interface RemoteInfo {
  name: string;
  fetch_url: string;
  push_url: string;
}
