/**
 * The commit list's optional columns.
 *
 * Visibility only, no ordering: the row is a CSS grid with fixed tracks, so the
 * stored order has no effect on what is painted. Reordering would mean building
 * the grid template from the preference, which is a bigger change than the
 * feature is worth — the preference stays an array because that is the shape
 * already on disk.
 */
export interface CommitColumnDef {
  readonly id: string;
  readonly label: string;
}

/**
 * `message` is absent because it is not optional — a commit list with no
 * subject is not a commit list. `graph` is absent because the branch graph is
 * a separate column with its own toggle (`showGraph`).
 */
export const COMMIT_COLUMNS: readonly CommitColumnDef[] = [
  { id: 'author', label: 'Author' },
  { id: 'date', label: 'Date' },
  { id: 'sha', label: 'SHA' },
];

/** Columns that are always present, and so never leave the stored list. */
const REQUIRED_COLUMNS: readonly string[] = ['graph', 'message'];

/**
 * Adds or removes one column, keeping the required ids and returning the
 * result in a stable order so the stored value does not churn.
 *
 * An unknown id is returned untouched rather than dropped: a value written by
 * a newer version of the app must survive a downgrade.
 */
export function toggleColumn(current: readonly string[], id: string): string[] {
  const present = new Set(current);
  if (present.has(id)) {
    present.delete(id);
  } else {
    present.add(id);
  }
  for (const required of REQUIRED_COLUMNS) present.add(required);

  const ordered = [...REQUIRED_COLUMNS, ...COMMIT_COLUMNS.map((c) => c.id)];
  const known = ordered.filter((columnId) => present.has(columnId));
  const unknown = [...present].filter((columnId) => !ordered.includes(columnId));
  return [...known, ...unknown];
}
