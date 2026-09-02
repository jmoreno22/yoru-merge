import type { FileChangeStatus } from '../../core/models';

/** Status buckets a row can carry, including the two git does not model. */
export type ChipKind = FileChangeStatus | 'untracked' | 'conflicted';

/** The three lists the panel renders. */
export type SectionId = 'conflicts' | 'staged' | 'changes';

/** One working-tree file, normalised across staged / unstaged / untracked. */
export interface FileEntry {
  readonly path: string;
  /** Rename or copy source; `null` for every other status. */
  readonly oldPath: string | null;
  readonly status: ChipKind;
  readonly section: SectionId;
  /** Gitlink: staging it records a commit pointer, not the file's contents. */
  readonly isSubmodule: boolean;
}

export interface FileRow {
  readonly kind: 'file';
  readonly path: string;
  readonly depth: number;
  /** Leading directories, already suffixed with `/`; empty in tree mode. */
  readonly dir: string;
  readonly name: string;
  readonly entry: FileEntry;
}

export interface FolderRow {
  readonly kind: 'folder';
  readonly path: string;
  readonly depth: number;
  /** May span several segments when a single-child chain was compacted. */
  readonly name: string;
  readonly count: number;
  readonly collapsed: boolean;
}

export type ChangeRow = FileRow | FolderRow;

/** Spoken form of the status: the icon alone means nothing out of context. */
export function chipLabel(status: ChipKind): string {
  switch (status) {
    case 'type_changed':
      return 'type changed';
    default:
      return status;
  }
}

/** Case-insensitive substring match over the path and its rename source. */
export function filterEntries(
  entries: readonly FileEntry[],
  query: string,
): FileEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...entries];
  return entries.filter(
    (entry) =>
      entry.path.toLowerCase().includes(needle) ||
      (entry.oldPath?.toLowerCase().includes(needle) ?? false),
  );
}

/** Flat rows: every file at depth 0, directories shown as a faint prefix. */
export function listRows(entries: readonly FileEntry[]): FileRow[] {
  return [...entries]
    .sort((a, b) => comparePaths(a.path, b.path))
    .map((entry) => {
      const cut = entry.path.lastIndexOf('/');
      return {
        kind: 'file' as const,
        path: entry.path,
        depth: 0,
        dir: cut < 0 ? '' : entry.path.slice(0, cut + 1),
        name: cut < 0 ? entry.path : entry.path.slice(cut + 1),
        entry,
      };
    });
}

interface TreeNode {
  readonly name: string;
  readonly children: Map<string, TreeNode>;
  readonly files: FileEntry[];
}

/**
 * Directory tree, depth-first, folders before files at every level.
 *
 * A folder whose only content is one other folder is merged into its child
 * (`src/app/core`), which keeps deep monorepo paths from eating the panel in
 * one-file-per-level indentation. `collapsed` holds the folder paths the user
 * closed; their subtree is not emitted.
 */
export function treeRows(
  entries: readonly FileEntry[],
  collapsed: ReadonlySet<string>,
): ChangeRow[] {
  const root: TreeNode = { name: '', children: new Map(), files: [] };

  for (const entry of entries) {
    const segments = entry.path.split('/');
    segments.pop();
    let node = root;
    for (const segment of segments) {
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, children: new Map(), files: [] };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.files.push(entry);
  }

  const rows: ChangeRow[] = [];
  emit(root, '', 0, collapsed, rows);
  return rows;
}

function emit(
  node: TreeNode,
  prefix: string,
  depth: number,
  collapsed: ReadonlySet<string>,
  out: ChangeRow[],
): void {
  const folders = [...node.children.values()].sort((a, b) =>
    comparePaths(a.name, b.name),
  );

  for (const folder of folders) {
    let current = folder;
    let name = folder.name;
    let path = prefix.length > 0 ? `${prefix}/${folder.name}` : folder.name;

    while (current.files.length === 0 && current.children.size === 1) {
      const only = [...current.children.values()][0];
      if (!only) break;
      name = `${name}/${only.name}`;
      path = `${path}/${only.name}`;
      current = only;
    }

    const isCollapsed = collapsed.has(path);
    out.push({
      kind: 'folder',
      path,
      depth,
      name,
      count: countFiles(current),
      collapsed: isCollapsed,
    });
    if (!isCollapsed) emit(current, path, depth + 1, collapsed, out);
  }

  for (const entry of [...node.files].sort((a, b) => comparePaths(a.path, b.path))) {
    const cut = entry.path.lastIndexOf('/');
    out.push({
      kind: 'file',
      path: entry.path,
      depth,
      dir: '',
      name: cut < 0 ? entry.path : entry.path.slice(cut + 1),
      entry,
    });
  }
}

function countFiles(node: TreeNode): number {
  let total = node.files.length;
  for (const child of node.children.values()) total += countFiles(child);
  return total;
}

/** Every folder path present in a set of entries, for "expand/collapse all". */
export function folderPaths(entries: readonly FileEntry[]): string[] {
  const paths = new Set<string>();
  for (const entry of entries) {
    const segments = entry.path.split('/');
    segments.pop();
    let prefix = '';
    for (const segment of segments) {
      prefix = prefix.length > 0 ? `${prefix}/${segment}` : segment;
      paths.add(prefix);
    }
  }
  return [...paths];
}

/** Built once: `localeCompare` with options builds a collator per comparison. */
const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

/** Case-insensitive, locale-aware, stable for equal keys. */
function comparePaths(a: string, b: string): number {
  return collator.compare(a, b);
}
