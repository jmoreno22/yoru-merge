/** Output of `compare_refs` — divergence between two refs. */
export interface CompareResult {
  /** Commits in `head` that are missing from `base`. */
  ahead: number;
  /** Commits in `base` that are missing from `head`. */
  behind: number;
  merge_base: string | null;
}
