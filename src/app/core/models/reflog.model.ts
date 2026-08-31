/** One entry of `git reflog` (output of `get_reflog`). */
export interface ReflogEntry {
  sha: string;
  short_sha: string;
  /** Reflog selector, e.g. `HEAD@{3}`. */
  selector: string;
  /** Verb git recorded, e.g. `commit`, `checkout`, `rebase (finish)`. */
  action: string;
  message: string;
  date: string;
}
