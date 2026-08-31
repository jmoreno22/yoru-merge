import type { EdgeType, GraphData } from '../../core/models';
import { isDanglingEdge } from '../../core/utils';

/** One edge with its rows resolved to absolute history positions. */
export interface IndexedEdge {
  readonly fromRow: number;
  readonly toRow: number;
  readonly fromLane: number;
  readonly toLane: number;
  readonly type: EdgeType;
  /** True when the parent is outside the walk (shallow clone grafts). */
  readonly dangling: boolean;
  /** Last row the edge can touch; a dangling edge fades out right below. */
  readonly spanEnd: number;
}

export interface GraphEdgeIndex {
  /** Every edge, ordered by `fromRow` — the order the rows arrive in. */
  readonly edges: readonly IndexedEdge[];
  /** Longest `spanEnd - fromRow`, the look-back the window query needs. */
  readonly maxSpan: number;
}

export const EMPTY_EDGE_INDEX: GraphEdgeIndex = { edges: [], maxSpan: 0 };

/**
 * Flattens the per-commit edges of a graph into one row-ordered array.
 *
 * `from_row` / `to_row` are absolute positions in the full history, so pages
 * concatenate without reindexing and an edge can be drawn without knowing
 * which page its endpoints came from. Because rows arrive in order and every
 * edge is owned by the commit at `from_row`, the flattened array is already
 * sorted — no sort pass, which matters at a hundred thousand commits.
 */
export function buildEdgeIndex(
  data: GraphData | null,
  historyTotal: number | null,
): GraphEdgeIndex {
  if (!data || data.commits.length === 0) return EMPTY_EDGE_INDEX;

  const edges: IndexedEdge[] = [];
  let maxSpan = 0;
  for (const commit of data.commits) {
    for (const edge of commit.edges) {
      const dangling = isDanglingEdge(edge, historyTotal);
      const spanEnd = dangling ? edge.from_row + 1 : edge.to_row;
      edges.push({
        fromRow: edge.from_row,
        toRow: edge.to_row,
        fromLane: edge.from_lane,
        toLane: edge.to_lane,
        type: edge.edge_type,
        dangling,
        spanEnd,
      });
      maxSpan = Math.max(maxSpan, spanEnd - edge.from_row);
    }
  }
  return { edges, maxSpan };
}

/**
 * The edges that touch rows `[firstRow, lastRow]`, both inclusive.
 *
 * An edge starting above the window still crosses it when it reaches far
 * enough down, which is what makes a merge line from a long-lived branch
 * visible. `maxSpan` bounds how far back that can be, so the scan starts at a
 * binary-searched offset instead of at row zero.
 */
export function edgesInRange(
  index: GraphEdgeIndex,
  firstRow: number,
  lastRow: number,
): IndexedEdge[] {
  const { edges, maxSpan } = index;
  if (edges.length === 0 || lastRow < firstRow) return [];

  const start = lowerBoundByFromRow(edges, firstRow - maxSpan);
  const result: IndexedEdge[] = [];
  for (let i = start; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || edge.fromRow > lastRow) break;
    if (edge.spanEnd >= firstRow) result.push(edge);
  }
  return result;
}

/** Index of the first edge whose `fromRow` is at least `row`. */
export function lowerBoundByFromRow(
  edges: readonly IndexedEdge[],
  row: number,
): number {
  let lo = 0;
  let hi = edges.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((edges[mid]?.fromRow ?? 0) < row) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
