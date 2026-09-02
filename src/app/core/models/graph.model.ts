export type EdgeType = 'straight' | 'merge' | 'fork';

export interface GraphEdge {
  from_lane: number;
  to_lane: number;
  /** Absolute row index in the full history, not relative to the page. */
  from_row: number;
  to_row: number;
  edge_type: EdgeType;
}

/**
 * One row of the graph. It carries no sha: rows are sliced from the same walk
 * as the page's commits, so row `k` belongs to `HistoryPage.commits[k]`.
 */
export interface GraphCommit {
  lane: number;
  edges: GraphEdge[];
}

export interface GraphData {
  commits: GraphCommit[];
  max_lanes: number;
}
