export interface RepoInfo {
  path: string;
  name: string;
  current_branch: string | null;
  is_bare: boolean;
}

export interface RepoEntry {
  path: string;
  name: string;
  last_opened: string;
}
