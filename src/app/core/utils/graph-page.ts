import type { GraphData, GraphEdge } from '../models';

/**
 * Concatenates a history page's graph rows onto the ones already loaded.
 *
 * Lanes and row indices are computed over the full commit list on the backend
 * and each page is a plain slice of it, so the rows already line up with the
 * accumulated commit array as long as pages arrive in order. `max_lanes` is
 * likewise the width of the whole history, not of the page.
 */
export function appendGraphPage(
  previous: GraphData | null,
  page: GraphData,
): GraphData {
  if (!previous) return page;
  return {
    commits: [...previous.commits, ...page.commits],
    max_lanes: page.max_lanes,
  };
}

/**
 * True when an edge points past the end of history instead of at a real row.
 *
 * Lane assignment marks "parent not in the walk" by pointing `to_row` at the
 * length of the FULL commit list, which is `HistoryPage.total` — not the
 * length of the loaded page. Comparing against the loaded array would flag
 * every edge on the last page. Only shallow clones hit this in practice.
 */
export function isDanglingEdge(edge: GraphEdge, total: number | null): boolean {
  return total !== null && edge.to_row >= total;
}
