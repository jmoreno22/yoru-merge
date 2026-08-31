import type { MenuItem } from '../../shared/ui';
import type { FileEntry } from './changes-tree';

/** One entry of the `Ignore ▸` submenu. */
export interface IgnoreCandidate {
  /** Line appended to `.gitignore`; also used as a pathspec by the backend. */
  readonly pattern: string;
  readonly label: string;
}

export interface FileMenuContext {
  /** The row the menu was opened on. */
  readonly entry: FileEntry;
  /** Paths a bulk action runs on: the selection, or just this row. */
  readonly targets: readonly string[];
}

/** Menu ids that carry data are prefixed with this. */
export const IGNORE_PREFIX = 'ignore:';

/**
 * Gitignore patterns offered for a path.
 *
 * The pattern doubles as a pathspec on the backend (a tracked file has to
 * leave the index for the rule to bite), so none of them may start with `/`:
 * git would read that as an absolute path and match nothing.
 */
export function ignoreCandidates(path: string): IgnoreCandidate[] {
  const candidates: IgnoreCandidate[] = [{ pattern: path, label: path }];

  const cut = path.lastIndexOf('/');
  const name = cut < 0 ? path : path.slice(cut + 1);
  const dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    const extension = `*${name.slice(dot)}`;
    candidates.push({ pattern: extension, label: extension });
  }

  if (cut > 0) {
    const folder = `${path.slice(0, cut)}/`;
    candidates.push({ pattern: folder, label: folder });
  }

  return candidates;
}

/** Repo-relative path → absolute, keeping the separator the repo path uses. */
export function absolutePath(repoPath: string, relative: string): string {
  const separator = repoPath.includes('\\') && !repoPath.includes('/') ? '\\' : '/';
  const root = repoPath.replace(/[\\/]+$/, '');
  const tail = separator === '\\' ? relative.replace(/\//g, '\\') : relative;
  return `${root}${separator}${tail}`;
}

/** Directory holding `path`, in whatever separator the path already uses. */
export function parentDirectory(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : path;
}

/** "Stage" for one file, "Stage 4 files" for a selection. */
function bulkLabel(verb: string, count: number, suffix = ''): string {
  return count > 1 ? `${verb} ${count} files${suffix}` : `${verb}${suffix}`;
}

/**
 * The per-file context menu.
 *
 * Bulk items act on `targets`; everything below them acts on the row the menu
 * was opened on, which is what a right-click inside a selection is expected to
 * do for "Blame" or "Copy path". Items that cannot work on this row are kept
 * visible with the reason instead of being dropped, so the inventory does not
 * change shape between rows.
 */
export function fileMenuItems(context: FileMenuContext): MenuItem[] {
  const { entry } = context;
  const count = context.targets.length;

  return entry.section === 'conflicts'
    ? [...conflictItems(count), ...fileToolItems(entry)]
    : [...stagingItems(entry, count), ...fileToolItems(entry)];
}

function conflictItems(count: number): MenuItem[] {
  return [
    {
      id: 'resolve',
      label: 'Resolve…',
      icon: 'lucideGitMerge',
      tone: 'primary',
    },
    { id: 'take-ours', label: 'Take ours', icon: 'lucideCircleDot' },
    { id: 'take-theirs', label: 'Take theirs', icon: 'lucideGitBranch' },
    {
      id: 'mark-resolved',
      label: bulkLabel('Mark resolved', count),
      icon: 'lucideCircleCheck',
    },
    {
      id: 'delete-conflicted',
      label: 'Delete',
      icon: 'lucideTrash2',
      tone: 'danger',
      separatorBefore: true,
    },
  ];
}

function stagingItems(entry: FileEntry, count: number): MenuItem[] {
  const staged = entry.section === 'staged';
  const untracked = entry.status === 'untracked';

  const items: MenuItem[] = [
    staged
      ? {
          id: 'unstage',
          label: bulkLabel('Unstage', count),
          icon: 'lucideMinus',
          tone: 'primary',
        }
      : {
          id: 'stage',
          label: bulkLabel('Stage', count),
          icon: 'lucidePlus',
          tone: 'primary',
        },
  ];

  // Discarding a staged row would restore the work tree from the index, which
  // is exactly what is already there: unstage first, then discard.
  if (!staged) {
    items.push({
      id: 'discard',
      label: untracked
        ? bulkLabel('Delete', count, '…')
        : bulkLabel('Discard', count, '…'),
      icon: untracked ? 'lucideTrash2' : 'lucideUndo2',
      tone: 'danger',
    });
  }

  items.push(
    {
      id: 'stash',
      label: bulkLabel('Stash', count),
      icon: 'lucideArchive',
      separatorBefore: true,
    },
    {
      id: 'ignore',
      label: 'Ignore',
      icon: 'lucideEyeOff',
      children: ignoreCandidates(entry.path).map((candidate) => ({
        id: `${IGNORE_PREFIX}${candidate.pattern}`,
        label: candidate.label,
      })),
    },
    {
      id: 'assume-unchanged',
      label: 'Assume unchanged',
      icon: 'lucideEyeOff',
      disabled: untracked,
      disabledReason: 'The file is not tracked by git yet',
    },
  );

  return items;
}

/** History, editor, terminal and clipboard: identical for every row. */
function fileToolItems(entry: FileEntry): MenuItem[] {
  const untracked = entry.status === 'untracked';
  const gone = entry.status === 'deleted';

  return [
    {
      id: 'history',
      label: 'File history',
      icon: 'lucideHistory',
      separatorBefore: true,
      disabled: untracked,
      disabledReason: 'The file is not tracked by git yet',
    },
    {
      id: 'blame',
      label: 'Blame',
      icon: 'lucideUser',
      disabled: untracked,
      disabledReason: 'The file is not tracked by git yet',
    },
    {
      id: 'editor',
      label: 'Open in editor',
      icon: 'lucideExternalLink',
      separatorBefore: true,
      disabled: gone,
      disabledReason: 'The file is no longer on disk',
    },
    {
      id: 'reveal',
      label: 'Reveal in file manager',
      icon: 'lucideFolderOpen',
      disabled: gone,
      disabledReason: 'The file is no longer on disk',
    },
    { id: 'terminal', label: 'Open terminal here', icon: 'lucideTerminal' },
    {
      id: 'copy-path',
      label: 'Copy path',
      icon: 'lucideCopy',
      separatorBefore: true,
    },
    { id: 'copy-relative', label: 'Copy relative path', icon: 'lucideClipboard' },
  ];
}
