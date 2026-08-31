/** What the viewer asks its host to do with a hunk or a line selection. */
export type DiffActionKind = 'stage' | 'unstage' | 'discard';

/** The working-tree file a patch can be staged against. */
export interface StageTarget {
  readonly file: string;
  /** The patch shown is the staged one, so the actions run in reverse. */
  readonly staged: boolean;
}

export interface DiffHunkAction {
  readonly kind: DiffActionKind;
  readonly file: string;
  /** Ordinal of the hunk inside `fileDiff`. */
  readonly hunkIndex: number;
  /** The single-file patch the hunk belongs to. */
  readonly fileDiff: string;
}

export interface DiffLineAction extends DiffHunkAction {
  /** Body positions of the selected lines, ascending. */
  readonly lines: readonly number[];
}

/** Layout of the two sides of a patch. */
export type DiffLayout = 'unified' | 'split';
