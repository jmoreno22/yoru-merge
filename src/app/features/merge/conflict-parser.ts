import type { ParsedConflict } from '../../core/models';

const OURS_MARKER = '<<<<<<<';
const BASE_MARKER = '|||||||';
const SEPARATOR = '=======';
const THEIRS_MARKER = '>>>>>>>';

/**
 * Extracts every conflict block from a working-tree file.
 *
 * Handles both the default two-way markers and `diff3` output, where a
 * `||||||| base` section sits between ours and the separator — without the
 * `|||||||` branch the ancestor text would be pasted into "ours" and silently
 * accepted as a resolution.
 */
export function parseConflicts(text: string): ParsedConflict[] {
  const lines = text.split('\n');
  const conflicts: ParsedConflict[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]?.startsWith(OURS_MARKER)) continue;

    const startLine = i;
    const oursLines: string[] = [];
    const theirsLines: string[] = [];
    i++;

    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (line.startsWith(SEPARATOR) || line.startsWith(BASE_MARKER)) break;
      oursLines.push(line);
      i++;
    }
    // diff3: skip the whole ancestor section, it is context and not a choice.
    if (lines[i]?.startsWith(BASE_MARKER)) {
      while (i < lines.length && !lines[i]?.startsWith(SEPARATOR)) i++;
    }
    if (i < lines.length) i++;

    while (i < lines.length && !lines[i]?.startsWith(THEIRS_MARKER)) {
      theirsLines.push(lines[i] ?? '');
      i++;
    }

    conflicts.push({
      index: index++,
      oursLines,
      theirsLines,
      startLine,
      endLine: Math.min(i, lines.length - 1),
    });
  }

  return conflicts;
}

/** Replaces one block (markers included) with `replacement`, returning the new text. */
export function replaceConflict(
  text: string,
  conflict: ParsedConflict,
  replacement: readonly string[],
): string {
  const lines = text.split('\n');
  lines.splice(
    conflict.startLine,
    conflict.endLine - conflict.startLine + 1,
    ...replacement,
  );
  return lines.join('\n');
}

/** True while any marker is still in the buffer — the file cannot be saved yet. */
export function hasConflictMarkers(text: string): boolean {
  return (
    text.includes(OURS_MARKER) ||
    text.includes(SEPARATOR) ||
    text.includes(THEIRS_MARKER)
  );
}

/**
 * First index where `needle` appears as a contiguous run inside `haystack`,
 * or `-1`. Used to point the side panes at the region a block came from.
 */
export function findSequence(
  haystack: readonly string[],
  needle: readonly string[],
): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  const first = needle[0];
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (haystack[i] !== first) continue;
    let matched = true;
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}
