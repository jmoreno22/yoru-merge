/**
 * Shapes mirror the Rust types in `src-tauri/src/models/merge.rs` and
 * `src-tauri/src/models/conflict.rs`.
 */

/** Tagged union returned by the `merge_branch` command. */
export type MergeResult =
  | { kind: 'up_to_date' }
  | { kind: 'fast_forward' }
  | { kind: 'success' }
  | { kind: 'squashed' }
  | { kind: 'conflicts'; files: string[] };

/** Which side to keep when resolving a conflict without opening the editor. */
export type ConflictSide = 'ours' | 'theirs';

/** One file currently in conflict (output of `get_conflicts`). */
export interface ConflictFile {
  path: string;
  /** Number of `<<<<<<<` markers found in the file. */
  conflict_count: number;
}

/** The four views of a conflicted file (output of `get_merge_content`). */
export interface MergeContent {
  /** Common ancestor (stage 1); may be empty for add/add conflicts. */
  base: string;
  /** Our (HEAD, stage 2) version. */
  ours: string;
  /** Incoming (theirs, stage 3) version. */
  theirs: string;
  /** Current on-disk content, with `<<<<<<<`, `=======`, `>>>>>>>` markers. */
  current: string;
}

/** A single conflict block parsed out of a `MergeContent.current` string. */
export interface ParsedConflict {
  /** 0-based ordinal of this conflict within the file. */
  index: number;
  /** Lines belonging to the "ours" side (between `<<<<<<<` and `=======`). */
  oursLines: string[];
  /** Lines belonging to the "theirs" side (between `=======` and `>>>>>>>`). */
  theirsLines: string[];
  /** Index (in the source string's `.split('\n')`) where `<<<<<<<` starts. */
  startLine: number;
  /** Index (in the source string's `.split('\n')`) where `>>>>>>>` ends. */
  endLine: number;
}
