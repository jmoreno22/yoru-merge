import type { RebaseTodoEntry } from '../../core/models';

/** The verbs the backend whitelists in `apply_rebase`. */
export const REBASE_ACTIONS = [
  'pick',
  'reword',
  'squash',
  'fixup',
  'drop',
  'edit',
] as const;

export type RebaseAction = (typeof REBASE_ACTIONS)[number];

/** Actions whose message the user edits inline. */
export function editsMessage(action: string): boolean {
  return action === 'reword' || action === 'squash';
}

/** Actions that fold the commit into the one above it. */
export function foldsIntoPrevious(action: string): boolean {
  return action === 'squash' || action === 'fixup';
}

/** Moves one entry, clamping the target so a drag past the ends is harmless. */
export function moveTodoEntry(
  entries: readonly RebaseTodoEntry[],
  from: number,
  to: number,
): RebaseTodoEntry[] {
  const next = [...entries];
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(next.length - 1, Math.max(0, to));
  const [moved] = next.splice(from, 1);
  if (!moved) return next;
  next.splice(target, 0, moved);
  return next;
}

/** Replaces one entry, leaving the rest untouched. */
export function updateTodoEntry(
  entries: readonly RebaseTodoEntry[],
  index: number,
  patch: Partial<RebaseTodoEntry>,
): RebaseTodoEntry[] {
  return entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
}

/**
 * Why the todo cannot be applied, or `null` when it can.
 *
 * The rules mirror what git itself refuses, checked before the rebase starts so
 * the repository never ends up half-rewritten with a sequencer to abort.
 */
export function validateTodo(entries: readonly RebaseTodoEntry[]): string | null {
  if (entries.length === 0) {
    return 'There is nothing to rebase.';
  }
  const kept = entries.filter((entry) => entry.action !== 'drop');
  if (kept.length === 0) {
    return 'Every commit is dropped — nothing would be left.';
  }
  const first = kept[0];
  if (first && foldsIntoPrevious(first.action)) {
    return 'The first commit cannot be squashed: there is nothing above it.';
  }
  for (const entry of entries) {
    if (!REBASE_ACTIONS.includes(entry.action as RebaseAction)) {
      return `Unsupported action "${entry.action}".`;
    }
    if (
      entry.action !== 'drop' &&
      editsMessage(entry.action) &&
      entry.message.trim().length === 0
    ) {
      return 'A reworded or squashed commit needs a message.';
    }
  }
  return null;
}

/** One commit as it would exist after the rebase. */
export interface RebasePreviewCommit {
  /** Sha of the commit that starts this one; it is rewritten, so it changes. */
  readonly sha: string;
  readonly message: string;
  /** How many further commits are folded into this one. */
  readonly folded: number;
  /** True when the rebase stops here for an `edit`. */
  readonly stops: boolean;
}

/**
 * The commits the todo would produce, oldest first.
 *
 * `squash` takes over the resulting message because the backend replays it as
 * `fixup` plus an amend with the edited text; `fixup` keeps the message of the
 * commit it lands on.
 */
export function previewTodo(
  entries: readonly RebaseTodoEntry[],
): RebasePreviewCommit[] {
  const result: RebasePreviewCommit[] = [];
  for (const entry of entries) {
    if (entry.action === 'drop') continue;
    const previous = result[result.length - 1];
    if (foldsIntoPrevious(entry.action) && previous) {
      result[result.length - 1] = {
        ...previous,
        folded: previous.folded + 1,
        message: entry.action === 'squash' ? entry.message : previous.message,
      };
      continue;
    }
    result.push({
      sha: entry.sha,
      message: entry.message,
      folded: 0,
      stops: entry.action === 'edit',
    });
  }
  return result;
}
