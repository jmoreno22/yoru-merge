import type { CommitInfo } from './commit.model';
import type { GraphData } from './graph.model';

/**
 * One page of history (output of `get_history`).
 *
 * `graph` carries only the rows for this page; lanes are computed over the
 * full topo-ordered oid list on the backend so they stay stable across pages.
 */
export interface HistoryPage {
  commits: CommitInfo[];
  graph: GraphData;
  /** Total reachable commits when the backend could count them cheaply. */
  total: number | null;
  has_more: boolean;
}
