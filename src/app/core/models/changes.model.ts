export type FileChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'type_changed';

export interface FileChange {
  path: string;
  /** Source path for renames/copies; `null` for every other status. */
  old_path: string | null;
  status: FileChangeStatus;
  /** Gitlink entry: the "content" is a submodule pointer, not a blob. */
  is_submodule: boolean;
}

export interface WorkingChanges {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicted: string[];
}

/** Which copy of a file to read — work tree, index, or a revision. */
export type FileSource =
  | { kind: 'workdir' }
  | { kind: 'index' }
  | { kind: 'rev'; rev: string };
