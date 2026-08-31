/** Result shape returned by {@link groupByPrefix}. */
export interface GroupByPrefixResult<T> {
  /**
   * Items whose key contains a non-empty segment after the first delimiter.
   * Keyed by the prefix (the portion **before** the first delimiter).
   *
   * Max depth: 2 levels — `feat/auth/x` goes into folder `feat` with leaf
   * key `auth/x`.  Deeper nesting is deliberately NOT created.
   */
  readonly folders: Map<string, T[]>;

  /**
   * Items that do not belong to any folder:
   *  - key contains no delimiter, OR
   *  - key ends exactly on the delimiter (e.g. `feat/` with an empty rest).
   */
  readonly flat: T[];
}

/**
 * Groups `items` into prefix-based folders and a flat remainder.
 *
 * The split is performed at the **first** occurrence of `delimiter`, giving a
 * maximum of 2 display levels regardless of how many delimiters the key
 * contains.
 *
 * @param items      The items to group.
 * @param getKey     Extracts the grouping key from each item (e.g. branch name).
 * @param delimiter  Path separator — defaults to `'/'`.
 *
 * @example
 * // Local-branch prefix folders
 * const { folders, flat } = groupByPrefix(branches, (b) => b.name);
 * // 'feat/auth'   → folders.get('feat') includes the item
 * // 'feat/auth/x' → folders.get('feat') includes the item (leaf = 'auth/x')
 * // 'main'        → flat
 * // 'feat/'       → flat  (trailing slash, no rest)
 */
export function groupByPrefix<T>(
  items: readonly T[],
  getKey: (item: T) => string,
  delimiter = '/',
): GroupByPrefixResult<T> {
  const folders = new Map<string, T[]>();
  const flat: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    const idx = key.indexOf(delimiter);

    // No delimiter, or delimiter is the very last character (e.g. "feat/") → flat.
    if (idx === -1 || idx === key.length - 1) {
      flat.push(item);
      continue;
    }

    const prefix = key.slice(0, idx);
    const bucket = folders.get(prefix);
    if (bucket) {
      bucket.push(item);
    } else {
      folders.set(prefix, [item]);
    }
  }

  return { folders, flat };
}
