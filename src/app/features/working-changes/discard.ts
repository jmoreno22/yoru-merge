/** Copy for the discard confirmation, which never says "discard" for a delete. */
export interface DiscardSummary {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

function plural(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

/**
 * Discarding a tracked file reverts it; discarding an untracked one deletes it
 * from disk with nothing in git to bring it back. The two are one git command
 * but two very different promises, so the dialog spells out which is happening.
 */
export function discardSummary(
  paths: readonly string[],
  untrackedPaths: ReadonlySet<string>,
): DiscardSummary {
  const untracked = paths.filter((path) => untrackedPaths.has(path));
  const tracked = paths.filter((path) => !untrackedPaths.has(path));

  if (tracked.length === 0) {
    return {
      title: untracked.length === 1 ? 'Delete file?' : 'Delete files?',
      body: `${plural(untracked.length, 'untracked file')} will be deleted permanently. This cannot be undone.`,
      confirmLabel: 'Delete',
    };
  }

  if (untracked.length === 0) {
    return {
      title: 'Discard changes?',
      body: `Changes in ${plural(tracked.length, 'file')} will be reverted to the index. This cannot be undone.`,
      confirmLabel: 'Discard',
    };
  }

  return {
    title: 'Discard changes and delete files?',
    body:
      `Changes in ${plural(tracked.length, 'file')} will be reverted to the index and ` +
      `${plural(untracked.length, 'untracked file')} will be deleted permanently. ` +
      'This cannot be undone.',
    confirmLabel: 'Discard and delete',
  };
}
