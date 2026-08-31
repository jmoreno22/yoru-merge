/**
 * One entry from `git stash list`.
 *
 * `sha` here actually carries the stash *reference* string (e.g. `stash@{0}`)
 * — the Rust backend serializes it as `sha` to keep one struct shape across
 * stash and commit payloads. Use `index` to address the stash in subsequent
 * apply/pop/drop calls.
 */
export interface StashEntry {
  index: number;
  message: string;
  sha: string;
  date: string;
}
