/**
 * What the caller wants to do with the selected lines.
 *
 * `stage` applies the patch forwards to the index; `unstage` and `discard`
 * apply it in reverse — to the index and to the working tree respectively.
 * The two reverse modes produce an identical patch and differ only in the
 * flags passed to `git apply`.
 */
export type LinePatchMode = 'stage' | 'unstage' | 'discard';

/** Flags `apply_patch` needs for a given mode. */
export interface PatchApplyFlags {
  reverse: boolean;
  cached: boolean;
}

/**
 * Maps a mode to the `git apply` flags. Use it instead of passing the flags by
 * hand: `discard` and `unstage` differ only in `cached`, and getting that wrong
 * throws away work instead of unstaging it.
 */
export function patchApplyFlags(mode: LinePatchMode): PatchApplyFlags {
  switch (mode) {
    case 'stage':
      return { reverse: false, cached: true };
    case 'unstage':
      return { reverse: true, cached: true };
    case 'discard':
      return { reverse: true, cached: false };
  }
}

interface HunkHeader {
  oldStart: number;
  newStart: number;
  /** Anything after the closing `@@`, e.g. the enclosing function name. */
  section: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/**
 * Builds a one-hunk unified patch containing only the selected lines.
 *
 * `selectedLineIndexes` are positions in the hunk body: index 0 is the first
 * line after the `@@` header. Selecting a context line is a no-op.
 *
 * The unselected changes have to be neutralised in the direction the patch
 * will be applied, because the lines the patch calls "context" must exist in
 * the pre-image:
 *
 * - forwards (`stage`), the pre-image is the index: an unselected `-` line is
 *   still there, so it becomes context; an unselected `+` line is not, so it
 *   is dropped.
 * - in reverse (`unstage`, `discard`), the pre-image is the worktree or the
 *   staged content: the roles swap — unselected `+` becomes context and
 *   unselected `-` is dropped.
 *
 * Returns `''` when the selection produces no actual change, which callers
 * should treat as "nothing to do" rather than as an error.
 */
export function buildLinePatch(
  fileDiff: string,
  hunkIndex: number,
  selectedLineIndexes: readonly number[],
  mode: LinePatchMode,
): string {
  const lines = fileDiff.replace(/\r\n/g, '\n').split('\n');
  // `split` leaves an empty tail for the diff's own trailing newline.
  if (lines[lines.length - 1] === '') lines.pop();

  const hunkStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith('@@')) hunkStarts.push(i);
  }

  const start = hunkStarts[hunkIndex];
  const firstHunk = hunkStarts[0];
  if (start === undefined || firstHunk === undefined) return '';

  const header = parseHunkHeader(lines[start] ?? '');
  if (!header) return '';

  const end = hunkStarts[hunkIndex + 1] ?? lines.length;
  const body = lines.slice(start + 1, end);
  const selected = new Set(selectedLineIndexes);
  const reverse = mode !== 'stage';

  const out: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  let changes = 0;
  let previousKept = false;

  for (let i = 0; i < body.length; i++) {
    const line = body[i] ?? '';

    // "\ No newline at end of file" belongs to the line above it.
    if (line.startsWith('\\')) {
      if (previousKept) out.push(line);
      continue;
    }

    const marker = line[0] ?? ' ';
    const content = line.slice(1);

    if (marker === '+' || marker === '-') {
      const isSelected = selected.has(i);
      if (isSelected) {
        out.push(line);
        if (marker === '+') newCount++;
        else oldCount++;
        changes++;
        previousKept = true;
      } else if (marker === '+' ? reverse : !reverse) {
        // Unselected change that survives in the pre-image: keep as context.
        out.push(` ${content}`);
        oldCount++;
        newCount++;
        previousKept = true;
      } else {
        previousKept = false;
      }
      continue;
    }

    out.push(line);
    oldCount++;
    newCount++;
    previousKept = true;
  }

  if (changes === 0) return '';

  const rebuiltHeader = `@@ -${header.oldStart},${oldCount} +${header.newStart},${newCount} @@${header.section}`;
  const fileHeader = lines.slice(0, firstHunk);
  return `${[...fileHeader, rebuiltHeader, ...out].join('\n')}\n`;
}

/**
 * Line ranges the caller can pre-select, e.g. "the whole hunk".
 * Indexes are hunk-body positions, matching {@link buildLinePatch}.
 */
export function changedLineIndexes(fileDiff: string, hunkIndex: number): number[] {
  const lines = fileDiff.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  const hunkStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith('@@')) hunkStarts.push(i);
  }
  const start = hunkStarts[hunkIndex];
  if (start === undefined) return [];
  const end = hunkStarts[hunkIndex + 1] ?? lines.length;

  const out: number[] = [];
  const body = lines.slice(start + 1, end);
  for (let i = 0; i < body.length; i++) {
    const marker = body[i]?.[0];
    if (marker === '+' || marker === '-') out.push(i);
  }
  return out;
}

function parseHunkHeader(line: string): HunkHeader | null {
  const match = HUNK_HEADER.exec(line);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    newStart: Number(match[2]),
    section: match[3] ?? '',
  };
}
