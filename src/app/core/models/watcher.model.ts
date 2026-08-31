/** Which part of the repository the file watcher saw change. */
export type RepoChangeKind = 'refs' | 'worktree' | 'index';

/** Payload of the backend `repo-changed` event. */
export interface RepoChangedPayload {
  path: string;
  kind: RepoChangeKind;
}
