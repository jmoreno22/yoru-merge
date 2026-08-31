export type EdgeType = 'straight' | 'merge' | 'fork';

export interface GraphEdge {
  from_lane: number;
  to_lane: number;
  /** Absolute row index in the full history, not relative to the page. */
  from_row: number;
  to_row: number;
  edge_type: EdgeType;
}

export interface GraphCommit {
  sha: string;
  lane: number;
  parent_shas: string[];
  edges: GraphEdge[];
}

export interface GraphData {
  commits: GraphCommit[];
  max_lanes: number;
}
