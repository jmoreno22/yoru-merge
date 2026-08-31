import type { DiffLine } from './diff-parse';

/**
 * Turns parsed hunks into the rows the template paints.
 *
 * Two options are applied here rather than server-side, because `get_diff` has
 * no flags for them: ignoring whitespace, and shrinking the context around a
 * change. Both only ever HIDE information git already sent — nothing is
 * invented, so a line the user stages is still the line git produced.
 */

/** One line of a unified (single column) render. */
export interface UnifiedRow {
  readonly line: DiffLine;
}

/** One row of a split render; a side is `null` when it has no counterpart. */
export interface SplitRow {
  readonly left: DiffLine | null;
  readonly right: DiffLine | null;
}

export type ViewRow<T> =
  | { readonly kind: 'row'; readonly row: T }
  | { readonly kind: 'gap'; readonly count: number; readonly rows: readonly T[] };

/** `Infinity` means "every line git sent", which is the default view. */
export const UNLIMITED_CONTEXT = Number.POSITIVE_INFINITY;

/**
 * Collapses a change to nothing but its markers — the whitespace git's `-w`
 * ignores.
 */
function withoutWhitespace(text: string): string {
  return text.replace(/\s+/g, '');
}

function isChange(line: DiffLine | null): boolean {
  return line !== null && line.kind !== 'context';
}

/**
 * Demotes whitespace-only edits to context.
 *
 * Deletions and insertions are paired in order inside each run: the k-th
 * removed line against the k-th added one, which is how a re-indent or a
 * line-ending change lines up. A matching pair becomes a single context line
 * keeping the OLD line's number on the left and the NEW line's number on the
 * right, exactly as an untouched line would.
 *
 * Surviving changes are emitted after the demoted ones inside their run.
 */
export function ignoreWhitespace(lines: readonly DiffLine[]): DiffLine[] {
  const out: DiffLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) break;
    if (line.kind === 'context') {
      out.push(line);
      i++;
      continue;
    }

    const deletions: DiffLine[] = [];
    while (lines[i]?.kind === 'delete') {
      deletions.push(lines[i] as DiffLine);
      i++;
    }
    const insertions: DiffLine[] = [];
    while (lines[i]?.kind === 'insert') {
      insertions.push(lines[i] as DiffLine);
      i++;
    }

    const keptDeletions: DiffLine[] = [];
    const keptInsertions: DiffLine[] = [];
    const pairs = Math.min(deletions.length, insertions.length);

    for (let k = 0; k < pairs; k++) {
      const removed = deletions[k] as DiffLine;
      const added = insertions[k] as DiffLine;
      if (withoutWhitespace(removed.text) === withoutWhitespace(added.text)) {
        out.push({
          ...added,
          kind: 'context',
          oldNumber: removed.oldNumber,
        });
      } else {
        keptDeletions.push(removed);
        keptInsertions.push(added);
      }
    }
    out.push(...keptDeletions, ...deletions.slice(pairs));
    out.push(...keptInsertions, ...insertions.slice(pairs));
  }

  return out;
}

/** Unified rows for a hunk, one per line. */
export function toUnifiedRows(lines: readonly DiffLine[]): UnifiedRow[] {
  return lines.map((line) => ({ line }));
}

/**
 * Split rows for a hunk.
 *
 * A run of removals is zipped with the run of additions that follows it so a
 * rewritten line sits opposite its replacement; whatever is left over gets a
 * row with an empty counterpart.
 */
export function toSplitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) break;
    if (line.kind === 'context') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }

    const deletions: DiffLine[] = [];
    while (lines[i]?.kind === 'delete') {
      deletions.push(lines[i] as DiffLine);
      i++;
    }
    const insertions: DiffLine[] = [];
    while (lines[i]?.kind === 'insert') {
      insertions.push(lines[i] as DiffLine);
      i++;
    }

    const height = Math.max(deletions.length, insertions.length);
    for (let k = 0; k < height; k++) {
      rows.push({ left: deletions[k] ?? null, right: insertions[k] ?? null });
    }
  }

  return rows;
}

/**
 * Hides runs of unchanged rows longer than `2 * context`, keeping `context`
 * rows on each side of every change.
 *
 * `context` is a display budget, not git's `-U`: it can only take context away.
 * Asking for more than the patch carries needs a server-side flag.
 */
export function collapseContext<T>(
  rows: readonly T[],
  changed: (row: T) => boolean,
  context: number,
): ViewRow<T>[] {
  if (!Number.isFinite(context)) return rows.map((row) => ({ kind: 'row', row }));

  const limit = Math.max(0, Math.trunc(context));
  const out: ViewRow<T>[] = [];
  let i = 0;

  while (i < rows.length) {
    if (changed(rows[i] as T)) {
      out.push({ kind: 'row', row: rows[i] as T });
      i++;
      continue;
    }

    let end = i;
    while (end < rows.length && !changed(rows[end] as T)) end++;

    // A leading or trailing run only borders a change on one side, so it only
    // spends one budget; a run between two changes spends two.
    const leading = i === 0 ? 0 : limit;
    const trailing = end === rows.length ? 0 : limit;
    const run = rows.slice(i, end);

    if (run.length <= leading + trailing) {
      for (const row of run) out.push({ kind: 'row', row });
    } else {
      for (let k = 0; k < leading; k++) {
        out.push({ kind: 'row', row: run[k] as T });
      }
      out.push({
        kind: 'gap',
        count: run.length - leading - trailing,
        rows: run.slice(leading, run.length - trailing),
      });
      for (let k = run.length - trailing; k < run.length; k++) {
        out.push({ kind: 'row', row: run[k] as T });
      }
    }
    i = end;
  }

  return out;
}

/** True when a unified row shows an insertion or a deletion. */
export function unifiedRowChanged(row: UnifiedRow): boolean {
  return isChange(row.line);
}

/** True when either side of a split row shows an insertion or a deletion. */
export function splitRowChanged(row: SplitRow): boolean {
  return isChange(row.left) || isChange(row.right);
}
