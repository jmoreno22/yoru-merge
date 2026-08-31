/** A search box query split into free text and an optional path filter. */
export interface ParsedSearchQuery {
  /** What is left to match against the commit message. */
  readonly text: string;
  /** Path the commit must touch, or `null` when the query names none. */
  readonly path: string | null;
}

/** `path:src/app`, or `path:"my docs"` when the path has spaces. */
const PATH_TOKEN = /(?:^|\s)path:(?:"([^"]*)"|(\S*))/;

/**
 * Pulls the `path:` filter out of what the user typed.
 *
 * Only the first token counts: the backend takes a single path, and a second
 * one is far more likely to be a typo than a request nobody can honour. It
 * stays in the text, where the user can see it did nothing.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const match = PATH_TOKEN.exec(raw);
  if (!match) return { text: raw.trim(), path: null };

  const path = (match[1] ?? match[2] ?? '').trim();
  const text = (
    raw.slice(0, match.index) + raw.slice(match.index + match[0].length)
  ).trim();
  return { text, path: path === '' ? null : path };
}
