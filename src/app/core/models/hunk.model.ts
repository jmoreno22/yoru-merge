/**
 * Selector for one `@@` hunk inside a unified diff.
 *
 * The backend identifies hunks by ordinal, not by byte offsets: the same
 * diff re-rendered with different context settings keeps hunk ordinals
 * stable while byte offsets shift.
 */
export interface HunkRange {
  /** 0-based position of the hunk within the file's diff, top to bottom. */
  index: number;
}
