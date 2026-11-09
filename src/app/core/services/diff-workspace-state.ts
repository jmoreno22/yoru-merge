/** What the diff workspace is showing: a commit's diff, or a working-tree side. */
export type DiffWorkspaceSource =
  | { kind: 'commit'; sha: string }
  | { kind: 'working-tree'; side: 'staged' | 'unstaged' };

/**
 * The full checklist of what the centre view must recover on close: the rail
 * view and repository tab it was opened from (so `shouldCloseFor` can detect
 * a change), the selection identity, the list scroll offset and the row to
 * refocus (sad §11 risk 3).
 */
export interface DiffWorkspaceSnapshot {
  railView: string;
  tabId: string;
  selectedCommitSha: string | null;
  side: 'staged' | 'unstaged' | null;
  listScrollTop: number;
  focusKey: string;
}

export type DiffWorkspaceState =
  | { open: false }
  | {
      open: true;
      source: DiffWorkspaceSource;
      file: string;
      files: string[];
      index: number;
      snapshot: DiffWorkspaceSnapshot;
      /** Set once `navigate` actually moves; tells `close` whose focus to restore. */
      navigated?: boolean;
    };

export interface OpenDiffWorkspaceInput {
  source: DiffWorkspaceSource;
  files: string[];
  index: number;
  snapshot: DiffWorkspaceSnapshot;
}

export type SetFilesEffect = 'keep' | 'advance' | 'close';

/** Whether a staging action of the app published the list, or anything else did. */
export type SetFilesOrigin = 'own' | 'external';

export interface DiffWorkspaceRestore {
  listScrollTop: number;
  selection: { selectedCommitSha: string | null; side: 'staged' | 'unstaged' | null };
  focusKey: string;
}

const CLOSED: DiffWorkspaceState = { open: false };

/**
 * `data-focus-key` of the row that shows `file`. A working-tree path can sit
 * in the staged and the unstaged list at once, so the side is part of the key.
 */
export function focusKeyFor(source: DiffWorkspaceSource, file: string): string {
  return source.kind === 'commit' ? file : `${source.side}:${file}`;
}

const COMMIT_ROW_PREFIX = 'commit:';
/** Typed from the source union so a renamed side fails to compile. */
type WorkingSide = Extract<DiffWorkspaceSource, { kind: 'working-tree' }>['side'];
const WORKING_SIDES: readonly WorkingSide[] = ['staged', 'unstaged'];

/** `data-focus-key` of the commit-list row for `sha` (AC-08). */
export function commitRowKey(sha: string): string {
  return `${COMMIT_ROW_PREFIX}${sha}`;
}

/** Which of the three lists writes a `data-focus-key`, hence restores it. */
export type FocusKeyOwner = 'commit-row' | 'working-tree' | 'commit-file';

/**
 * Lets each list claim a pending restore and expire it once its own row is
 * gone (AC-08). A commit file row keys itself with the bare path `focusKeyFor`
 * returns, so it owns every key the two prefixed shapes above do not.
 */
export function focusKeyOwner(key: string): FocusKeyOwner {
  if (key.startsWith(COMMIT_ROW_PREFIX)) return 'commit-row';
  if (WORKING_SIDES.some((side) => key.startsWith(`${side}:`))) return 'working-tree';
  return 'commit-file';
}

/** Always replaces any open workspace instead of stacking (AC-09). */
export function open(
  _state: DiffWorkspaceState,
  input: OpenDiffWorkspaceInput,
): DiffWorkspaceState {
  return {
    open: true,
    source: input.source,
    file: input.files[input.index],
    files: input.files,
    index: input.index,
    snapshot: input.snapshot,
  };
}

/** Clamped: an out-of-range index is a no-op (AC-11). */
export function navigate(state: DiffWorkspaceState, index: number): DiffWorkspaceState {
  if (!state.open || index < 0 || index >= state.files.length) return state;
  return { ...state, index, file: state.files[index], navigated: true };
}

/**
 * The shown file may have left the published list (staged/unstaged after a
 * refresh, or a rewritten commit). A commit workspace never closes: its files
 * only move when history is rewritten, and the commit itself still exists
 * (AC-07). A working-tree side walks on to the next file when the developer's
 * own staging action took the shown one away (AC-13), but closes when the
 * change came from outside: what is on screen is no longer what the developer
 * was working on, whatever else the side still holds (AC-16).
 */
export function setFiles(
  state: DiffWorkspaceState,
  files: string[],
  origin: SetFilesOrigin,
): { state: DiffWorkspaceState; effect: SetFilesEffect } {
  if (!state.open) return { state, effect: 'keep' };

  const stillThere = files.indexOf(state.file);
  if (stillThere >= 0) {
    return { state: { ...state, files, index: stillThere }, effect: 'keep' };
  }

  const isCommit = state.source.kind === 'commit';
  if (files.length === 0) {
    if (isCommit) return { state: { ...state, files }, effect: 'keep' };
    return { state: CLOSED, effect: 'close' };
  }
  if (!isCommit && origin === 'external') return { state: CLOSED, effect: 'close' };

  const index = Math.min(state.index, files.length - 1);
  return {
    state: { ...state, files, index, file: files[index], navigated: true },
    effect: 'advance',
  };
}

/**
 * Restores focus on the originating row, or on the row of the now-active file
 * if navigation moved (AC-08). Either way the restore names a row the way its
 * list keys it: the snapshot key verbatim, or `focusKeyFor` for the file
 * reached by navigation.
 */
export function close(state: DiffWorkspaceState): {
  state: DiffWorkspaceState;
  restore: DiffWorkspaceRestore | null;
} {
  if (!state.open) return { state: CLOSED, restore: null };

  const { snapshot, file, navigated } = state;
  return {
    state: CLOSED,
    restore: {
      listScrollTop: snapshot.listScrollTop,
      selection: { selectedCommitSha: snapshot.selectedCommitSha, side: snapshot.side },
      focusKey: navigated ? focusKeyFor(state.source, file) : snapshot.focusKey,
    },
  };
}

/** True when any of view, tab, commit or side has moved away from the snapshot (AC-17). */
export function shouldCloseFor(
  state: DiffWorkspaceState,
  current: {
    railView: string;
    tabId: string;
    selectedCommitSha: string | null;
    side: 'staged' | 'unstaged' | null;
  },
): boolean {
  if (!state.open) return false;
  const { snapshot } = state;
  return (
    current.railView !== snapshot.railView ||
    current.tabId !== snapshot.tabId ||
    current.selectedCommitSha !== snapshot.selectedCommitSha ||
    current.side !== snapshot.side
  );
}

export function canPrev(state: DiffWorkspaceState): boolean {
  return state.open && state.files.length > 0 && state.index > 0;
}

export function canNext(state: DiffWorkspaceState): boolean {
  return state.open && state.files.length > 0 && state.index < state.files.length - 1;
}
