export interface FuzzyMatch {
  /** Higher is better; only comparable between candidates for the same query. */
  score: number;
  /** Indices in the target that the query matched, ascending. */
  indices: number[];
}

const CONSECUTIVE_BONUS = 12;
const WORD_START_BONUS = 10;
const FIRST_CHAR_BONUS = 12;
const GAP_PENALTY = 1;
/** Long names should not beat short ones purely by having more to match. */
const LENGTH_PENALTY = 0.1;

/**
 * Subsequence match with the usual quality bonuses: consecutive runs, matches
 * right after a separator, and a match on the very first character.
 *
 * A literal substring wins over the greedy subsequence alignment: searching
 * `auth` in `feat/auth` must land on the real `auth`, not on the `a` inside
 * `feat`. Everything else falls back to a leftmost subsequence scan.
 *
 * Returns `null` when the query is not a subsequence of the target, so callers
 * can filter and rank in a single pass. An empty query matches everything with
 * score 0, which keeps an unfiltered list in its original order.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { score: 0, indices: [] };

  const haystack = target.toLowerCase();
  const direct = haystack.indexOf(needle);
  const indices =
    direct >= 0
      ? Array.from({ length: needle.length }, (_, i) => direct + i)
      : subsequenceIndices(needle, haystack);
  if (indices === null) return null;

  return { score: scoreAlignment(target, indices), indices };
}

/** Convenience wrapper: score only, `-Infinity` when there is no match. */
export function fuzzyScore(query: string, target: string): number {
  return fuzzyMatch(query, target)?.score ?? Number.NEGATIVE_INFINITY;
}

/** Filters and sorts `items` by how well they match `query`. */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (query.trim().length === 0) return [...items];
  return items
    .map((item) => ({ item, match: fuzzyMatch(query, getText(item)) }))
    .filter((entry): entry is { item: T; match: FuzzyMatch } => entry.match !== null)
    .sort((a, b) => b.match.score - a.match.score)
    .map((entry) => entry.item);
}

/** Leftmost positions where `needle` appears as a subsequence of `haystack`. */
function subsequenceIndices(needle: string, haystack: string): number[] | null {
  const indices: number[] = [];
  let cursor = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return null;
    indices.push(found);
    cursor = found + 1;
  }
  return indices;
}

function scoreAlignment(target: string, indices: readonly number[]): number {
  let score = 0;
  let previous = -1;
  for (const index of indices) {
    if (index === 0) {
      score += FIRST_CHAR_BONUS;
    } else if (index === previous + 1) {
      score += CONSECUTIVE_BONUS;
    } else if (isWordBoundary(target, index)) {
      score += WORD_START_BONUS;
    }
    if (previous >= 0) score -= (index - previous - 1) * GAP_PENALTY;
    previous = index;
  }
  return score - target.length * LENGTH_PENALTY;
}

function isWordBoundary(target: string, index: number): boolean {
  const previous = target[index - 1];
  if (previous === undefined) return true;
  if (/[\s/\-_.]/.test(previous)) return true;
  // camelCase hump: a capital preceded by a lowercase letter.
  const current = target[index];
  return (
    current !== undefined &&
    current === current.toUpperCase() &&
    previous === previous.toLowerCase() &&
    /[a-z]/.test(previous)
  );
}
