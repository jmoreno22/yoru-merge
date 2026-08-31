import type { FileChangeStatus } from './changes.model';
import type { RefInfo } from './commit.model';

/** GPG/SSH signature verdict reported by `get_commit_details`. */
export type SignatureStatus = 'none' | 'good' | 'bad' | 'unknown';

/** One file touched by a commit, with its per-file line counts. */
export interface CommitFile {
  path: string;
  /** Previous path for renames/copies; `null` otherwise. */
  old_path: string | null;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  binary: boolean;
}

/** Full metadata for one commit (output of `get_commit_details`). */
export interface CommitDetails {
  sha: string;
  short_sha: string;
  parents: string[];
  author_name: string;
  author_email: string;
  author_date: string;
  committer_name: string;
  committer_email: string;
  committer_date: string;
  subject: string;
  body: string;
  refs: RefInfo[];
  signature: SignatureStatus;
  files: CommitFile[];
  additions: number;
  deletions: number;
}
