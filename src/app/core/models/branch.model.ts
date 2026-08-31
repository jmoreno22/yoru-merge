export type CheckoutResult =
  | { kind: 'success' }
  /** Local modifications would be lost; `files` lists them. */
  | { kind: 'would_overwrite'; files: string[] }
  | { kind: 'detached_head' }
  | { kind: 'error'; message: string };

export type FastForwardResult =
  | { kind: 'fast_forwarded' }
  | { kind: 'already_up_to_date' }
  | { kind: 'no_upstream' }
  | { kind: 'not_fast_forwardable' }
  | { kind: 'network_error'; message: string }
  | { kind: 'auth_required'; message: string };

export interface BranchInfo {
  name: string;
  sha: string;
  is_remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface TagInfo {
  name: string;
  /** Peeled commit sha — for annotated tags this is not the tag object id. */
  sha: string;
  message: string | null;
  is_annotated: boolean;
}

export interface BranchList {
  local: BranchInfo[];
  remote: BranchInfo[];
  current: string | null;
}
