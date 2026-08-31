import type { CommitFile, FileChangeStatus } from '../../core/models';
import type { YoruIconName } from '../../shared/icons';

export type FileViewMode = 'tree' | 'list';

/** One rendered line of the file panel, tree and list mode alike. */
export interface FileRow {
  readonly kind: 'folder' | 'file';
  /** Full path for a file, directory path for a folder — also the track key. */
  readonly path: string;
  /** What the row prints: the last segment, or the whole path in list mode. */
  readonly label: string;
  readonly depth: number;
  readonly file: CommitFile | null;
  /** Files under this folder, at any depth. Zero for file rows. */
  readonly fileCount: number;
  readonly collapsed: boolean;
}

/** How one status is drawn: an icon, a letter, and the token that tints both. */
export interface FileStatusStyle {
  readonly icon: YoruIconName;
  readonly letter: string;
  readonly color: string;
}

/** Icon and short letter per status; the letter is what colour-blind eyes read. */
export const FILE_STATUS_STYLE: Readonly<Record<FileChangeStatus, FileStatusStyle>> = {
  added: { icon: 'lucideFilePlus', letter: 'A', color: 'var(--color-git-added)' },
  modified: {
    icon: 'lucideFileDiff',
    letter: 'M',
    color: 'var(--color-git-modified)',
  },
  deleted: {
    icon: 'lucideFileMinus',
    letter: 'D',
    color: 'var(--color-git-deleted)',
  },
  renamed: { icon: 'lucideFile', letter: 'R', color: 'var(--color-git-renamed)' },
  copied: { icon: 'lucideFile', letter: 'C', color: 'var(--color-git-renamed)' },
  type_changed: {
    icon: 'lucideFileDiff',
    letter: 'T',
    color: 'var(--color-git-modified)',
  },
};

/** Human label for the status chip's tooltip and accessible name. */
export const FILE_STATUS_LABEL: Readonly<Record<FileChangeStatus, string>> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  copied: 'Copied',
  type_changed: 'Type changed',
};

/** Case-insensitive substring match over the path and the pre-rename path. */
export function filterFiles(
  files: readonly CommitFile[],
  query: string,
): readonly CommitFile[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return files;
  return files.filter(
    (file) =>
      file.path.toLowerCase().includes(needle) ||
      (file.old_path?.toLowerCase().includes(needle) ?? false),
  );
}

interface TreeNode {
  readonly name: string;
  readonly path: string;
  readonly folders: Map<string, TreeNode>;
  readonly files: CommitFile[];
  fileCount: number;
}

/**
 * The rows to render, flattened depth-first.
 *
 * Folders with a single child folder and no files of their own are merged into
 * one row (`src/app/features`), which is what keeps a deeply nested project
 * from spending six rows and six indents before the first real file.
 */
export function buildFileRows(
  files: readonly CommitFile[],
  mode: FileViewMode,
  collapsed: ReadonlySet<string>,
): FileRow[] {
  if (mode === 'list') {
    return files.map((file) => ({
      kind: 'file' as const,
      path: file.path,
      label: file.path,
      depth: 0,
      file,
      fileCount: 0,
      collapsed: false,
    }));
  }

  const root = newNode('', '');
  for (const file of files) {
    const segments = file.path.split('/');
    segments.pop();
    let node = root;
    node.fileCount++;
    for (const segment of segments) {
      let child = node.folders.get(segment);
      if (!child) {
        child = newNode(segment, node.path ? `${node.path}/${segment}` : segment);
        node.folders.set(segment, child);
      }
      child.fileCount++;
      node = child;
    }
    node.files.push(file);
  }

  const rows: FileRow[] = [];
  emit(root, 0, rows, collapsed);
  return rows;
}

function newNode(name: string, path: string): TreeNode {
  return { name, path, folders: new Map(), files: [], fileCount: 0 };
}

function emit(
  node: TreeNode,
  depth: number,
  rows: FileRow[],
  collapsed: ReadonlySet<string>,
): void {
  for (const folder of node.folders.values()) {
    let current = folder;
    let label = folder.name;
    while (current.files.length === 0 && current.folders.size === 1) {
      const only = current.folders.values().next().value;
      if (!only) break;
      current = only;
      label = `${label}/${current.name}`;
    }
    const isCollapsed = collapsed.has(current.path);
    rows.push({
      kind: 'folder',
      path: current.path,
      label,
      depth,
      file: null,
      fileCount: current.fileCount,
      collapsed: isCollapsed,
    });
    if (!isCollapsed) emit(current, depth + 1, rows, collapsed);
  }

  for (const file of node.files) {
    rows.push({
      kind: 'file',
      path: file.path,
      label: file.path.slice(file.path.lastIndexOf('/') + 1),
      depth,
      file,
      fileCount: 0,
      collapsed: false,
    });
  }
}
