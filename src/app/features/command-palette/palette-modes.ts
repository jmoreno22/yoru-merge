import { fuzzyScore } from '../../core/utils';

/** What the palette lists. Chosen by the first character of the query. */
export type PaletteMode = 'commands' | 'branches' | 'files' | 'commits' | 'settings';

export interface PaletteQuery {
  readonly mode: PaletteMode;
  /** The query with the mode prefix stripped. */
  readonly term: string;
}

const PREFIXES: Readonly<Record<string, PaletteMode>> = {
  '>': 'branches',
  '@': 'files',
  '#': 'commits',
  ':': 'settings',
};

/** Prefix that selects `mode`, `''` for the default command list. */
export function prefixForMode(mode: PaletteMode): string {
  for (const [prefix, value] of Object.entries(PREFIXES)) {
    if (value === mode) return prefix;
  }
  return '';
}

export function parsePaletteQuery(raw: string): PaletteQuery {
  const mode = PREFIXES[raw.charAt(0)];
  if (!mode) return { mode: 'commands', term: raw.trim() };
  return { mode, term: raw.slice(1).trim() };
}

/** Placeholder text describing what the current mode searches. */
export function paletteHint(mode: PaletteMode): string {
  switch (mode) {
    case 'branches':
      return 'Search branches';
    case 'files':
      return 'Search changed files';
    case 'commits':
      return 'Search commits by message or sha';
    case 'settings':
      return 'Jump to a settings section';
    case 'commands':
      return 'Type a command, or > branches, @ files, # commits, : settings';
  }
}

/** A recent entry beats a cold one, and a more recent entry beats an older one. */
const RECENT_BONUS = 40;

/**
 * Fuzzy score plus a recency bonus.
 *
 * `recentIndex` is the position in the most-recent-first list, or `-1`. With an
 * empty query every candidate scores 0, so recents surface first and everything
 * else keeps its declared order.
 */
export function paletteScore(query: string, text: string, recentIndex = -1): number {
  const base = fuzzyScore(query, text);
  if (base === Number.NEGATIVE_INFINITY) return base;
  if (recentIndex < 0) return base;
  return base + Math.max(1, RECENT_BONUS - recentIndex);
}

/** Most-recent-first list with `id` moved to the front, capped at `max`. */
export function pushRecent(recents: readonly string[], id: string, max = 12): string[] {
  return [id, ...recents.filter((entry) => entry !== id)].slice(0, max);
}

export interface RankOptions<T> {
  readonly getText: (item: T) => string;
  /** Ids of the most recently used items, most recent first. */
  readonly recents?: readonly string[];
  readonly getId?: (item: T) => string;
  readonly limit?: number;
}

/** Filters out non-matches and sorts by {@link paletteScore}, stably. */
export function rankPaletteItems<T>(
  items: readonly T[],
  query: string,
  options: RankOptions<T>,
): T[] {
  const { getText, recents = [], getId, limit } = options;
  const scored = items
    .map((item, order) => {
      const id = getId ? getId(item) : getText(item);
      return {
        item,
        order,
        score: paletteScore(query, getText(item), recents.indexOf(id)),
      };
    })
    .filter((entry) => entry.score !== Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.item);
  return limit === undefined ? scored : scored.slice(0, limit);
}
