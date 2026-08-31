export type RefType = 'branch' | 'tag' | 'remote' | 'head';

export interface RefInfo {
  name: string;
  ref_type: RefType;
}

export interface CommitInfo {
  sha: string;
  short_sha: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
  parent_shas: string[];
  refs: RefInfo[];
  on_current_branch: boolean;
}
