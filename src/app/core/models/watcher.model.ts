/** Which part of the repository the file watcher saw change. */
export type RepoChangeKind = 'refs' | 'worktree' | 'index' | 'stash' | 'config';

/** Payload of the backend `repo-changed` event. */
export interface RepoChangedPayload {
  path: string;
  kind: RepoChangeKind;
}

/** Payload of the backend `repo-watch-error` event. */
export interface RepoWatchErrorPayload {
  path: string;
  message: string;
}
