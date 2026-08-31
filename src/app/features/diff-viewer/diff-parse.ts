/**
 * Unified-diff parser.
 *
 * The viewer parses the patch itself instead of leaning on a rendering library
 * because two consumers need to agree on the SAME indexes:
 *
 *  - `stage_hunks` / `unstage_hunks` address a hunk by its ordinal inside the
 *    file's diff (`HunkRange { index }`).
 *  - `buildLinePatch(fileDiff, hunkIndex, selectedLineIndexes, mode)` addresses
 *    a line by its position in the hunk BODY, counting every line after the
 *    `@@` header — including `\ No newline at end of file`.
 *
 * Both are reproduced here exactly, so what the user clicks is what git stages.
 */

/** The literal `get_diff` returns instead of a >10 MB patch. */
export const OVERSIZED_DIFF_SENTINEL = '[binary or too large to display]';

export type DiffLineKind = 'context' | 'insert' | 'delete';

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'copied';

export interface DiffLine {
  readonly kind: DiffLineKind;
  /** Position in the hunk body; 0 is the first line after the `@@` header. */
  readonly bodyIndex: number;
  readonly oldNumber: number | null;
  readonly newNumber: number | null;
  /** Line content without the `+`/`-`/space marker. */
  readonly text: string;
  /** The patch says this line has no trailing newline. */
  readonly noNewline: boolean;
}

export interface DiffHunk {
  /** 0-based ordinal inside the file — what `HunkRange.index` means. */
  readonly index: number;
  /** The `@@ -a,b +c,d @@ section` line, verbatim. */
  readonly header: string;
  /** Whatever follows the closing `@@`, usually the enclosing function. */
  readonly section: string;
  readonly lines: readonly DiffLine[];
  readonly additions: number;
  readonly deletions: number;
}

export interface DiffFileModel {
  readonly index: number;
  /** Path to show: the new path, or the old one for deletions. */
  readonly path: string;
  /** Source path of a rename or copy; `null` otherwise. */
  readonly oldPath: string | null;
  readonly status: DiffFileStatus;
  readonly binary: boolean;
  readonly hunks: readonly DiffHunk[];
  readonly additions: number;
  readonly deletions: number;
  /**
   * This file's slice of the patch, headers included. It is what
   * `buildLinePatch` must be given: it counts hunks from the start of the
   * string it receives.
   */
  readonly raw: string;
  /** Body lines across every hunk, for the "collapse big files" threshold. */
  readonly lineCount: number;
}

const FILE_HEADER = /^diff --git /;
const HUNK_HEADER = /^@@+ (.+?) @@+(.*)$/;
const RANGES = /-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))?/;

/**
 * Paths git uses for "this side does not exist". `NUL` shows up because
 * `get_diff` runs `diff --no-index` against the platform null device to give
 * untracked files a patch, and Windows' `NUL` is a real (empty) file to git.
 */
const NULL_PATHS = new Set(['/dev/null', 'dev/null', 'NUL', 'nul']);

/** Splits a patch into files and hunks. Never throws on malformed input. */
export function parseUnifiedDiff(text: string): DiffFileModel[] {
  if (text.length === 0 || text === OVERSIZED_DIFF_SENTINEL) return [];

  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (FILE_HEADER.test(lines[i] ?? '')) starts.push(i);
  }
  // A patch body without a `diff --git` header (a hand-made hunk, a stash
  // entry from an older git) is still one file.
  if (starts.length === 0 || (starts[0] ?? 0) > 0) starts.unshift(0);

  const files: DiffFileModel[] = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i] ?? 0;
    const to = starts[i + 1] ?? lines.length;
    const file = parseFile(lines.slice(from, to), files.length);
    if (file) files.push(file);
  }
  return files;
}

function parseFile(lines: string[], index: number): DiffFileModel | null {
  if (lines.length === 0) return null;

  let oldName: string | null = null;
  let newName: string | null = null;
  let renamedFrom: string | null = null;
  let isNew = false;
  let isDeleted = false;
  let isCopy = false;
  let isRename = false;
  let binary = false;
  let firstHunk = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (HUNK_HEADER.test(line)) {
      firstHunk = i;
      break;
    }
    if (line.startsWith('--- ')) oldName = headerPath(line.slice(4));
    else if (line.startsWith('+++ ')) newName = headerPath(line.slice(4));
    else if (line.startsWith('new file mode')) isNew = true;
    else if (line.startsWith('deleted file mode')) isDeleted = true;
    else if (line.startsWith('rename from ')) {
      isRename = true;
      renamedFrom = line.slice('rename from '.length);
    } else if (line.startsWith('copy from ')) {
      isCopy = true;
      renamedFrom = line.slice('copy from '.length);
    } else if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      binary = true;
    }
  }

  // `diff --git a/x b/y` is the only source of names for a binary file or a
  // pure rename, and it is ambiguous when a path contains a space. Prefer the
  // unambiguous `---`/`+++` lines and fall back to it only when they are absent.
  const fallback = namesFromGitHeader(lines[0] ?? '');
  const oldPath = oldName ?? fallback.old;
  const newPath = newName ?? fallback.new;

  const path = newPath ?? oldPath ?? '';
  if (path === '') return null;

  const hunks = parseHunks(lines, firstHunk);
  let additions = 0;
  let deletions = 0;
  let lineCount = 0;
  for (const hunk of hunks) {
    additions += hunk.additions;
    deletions += hunk.deletions;
    lineCount += hunk.lines.length;
  }

  const status: DiffFileStatus =
    isNew || oldPath === null
      ? 'added'
      : isDeleted || newPath === null
        ? 'deleted'
        : isCopy
          ? 'copied'
          : isRename
            ? 'renamed'
            : 'modified';

  return {
    index,
    path: status === 'deleted' ? (oldPath ?? path) : path,
    oldPath: renamedFrom ?? (status === 'renamed' ? oldPath : null),
    status,
    binary,
    hunks,
    additions,
    deletions,
    raw: `${lines.join('\n')}\n`,
    lineCount,
  };
}

function parseHunks(lines: string[], firstHunk: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let cursor = firstHunk;

  while (cursor < lines.length) {
    const match = HUNK_HEADER.exec(lines[cursor] ?? '');
    if (!match) {
      cursor++;
      continue;
    }
    let end = cursor + 1;
    while (end < lines.length && !HUNK_HEADER.test(lines[end] ?? '')) end++;

    hunks.push(
      buildHunk(
        hunks.length,
        lines[cursor] ?? '',
        match[1] ?? '',
        match[2] ?? '',
        lines.slice(cursor + 1, end),
      ),
    );
    cursor = end;
  }
  return hunks;
}

function buildHunk(
  index: number,
  header: string,
  ranges: string,
  section: string,
  body: string[],
): DiffHunk {
  const parsed = RANGES.exec(ranges);
  let oldNumber = Number(parsed?.[1] ?? 1);
  let newNumber = Number(parsed?.[3] ?? 1);

  const lines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  for (let i = 0; i < body.length; i++) {
    const raw = body[i] ?? '';
    // "\ No newline at end of file" annotates the line above it.
    if (raw.startsWith('\\')) {
      const previous = lines[lines.length - 1];
      if (previous) {
        lines[lines.length - 1] = { ...previous, noNewline: true };
      }
      continue;
    }

    const marker = raw[0] ?? ' ';
    const text = raw.length > 0 ? raw.slice(1) : '';

    if (marker === '+') {
      lines.push({
        kind: 'insert',
        bodyIndex: i,
        oldNumber: null,
        newNumber: newNumber++,
        text,
        noNewline: false,
      });
      additions++;
    } else if (marker === '-') {
      lines.push({
        kind: 'delete',
        bodyIndex: i,
        oldNumber: oldNumber++,
        newNumber: null,
        text,
        noNewline: false,
      });
      deletions++;
    } else {
      lines.push({
        kind: 'context',
        bodyIndex: i,
        oldNumber: oldNumber++,
        newNumber: newNumber++,
        text,
        noNewline: false,
      });
    }
  }

  return { index, header, section: section.trim(), lines, additions, deletions };
}

const LFS_VERSION = /^[+\- ]version https:\/\/git-lfs\.github\.com\/spec\/v\d+$/m;
const LFS_OID = /^[+\- ]oid sha256:[0-9a-f]{64}$/m;

/**
 * True when the patch changes a git-lfs pointer rather than a real file.
 *
 * Without the badge this reads as a three-line text file: the diff shows the
 * pointer's own contents, so a 2 GB video looks like a one-line change.
 */
export function isLfsPointer(patch: string): boolean {
  return LFS_VERSION.test(patch) && LFS_OID.test(patch);
}

/** `a/src/foo.ts` → `src/foo.ts`; the null device → `null`. */
function headerPath(value: string): string | null {
  // `diff --no-index` appends a tab and a timestamp to the `---`/`+++` lines.
  const raw = (value.split('\t')[0] ?? '').trim();
  if (raw === '' || NULL_PATHS.has(raw)) return null;
  const stripped = raw.startsWith('a/') || raw.startsWith('b/') ? raw.slice(2) : raw;
  return NULL_PATHS.has(stripped) ? null : stripped;
}

/**
 * Last-resort names from `diff --git a/<old> b/<new>`.
 *
 * Git does not quote paths containing spaces here, so the split is a guess:
 * assume both sides are equal (the overwhelmingly common case) and take the
 * halves around the midpoint when they are not.
 */
function namesFromGitHeader(line: string): {
  old: string | null;
  new: string | null;
} {
  if (!FILE_HEADER.test(line)) return { old: null, new: null };
  const rest = line.slice('diff --git '.length);
  const middle = rest.indexOf(' b/');
  if (middle < 0) return { old: null, new: null };
  return {
    old: headerPath(rest.slice(0, middle)),
    new: headerPath(rest.slice(middle + 1)),
  };
}
