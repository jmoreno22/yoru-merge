import { describe, expect, it } from 'vitest';
import type { EdgeType, GraphCommit, GraphData, GraphEdge } from '../../core/models';
import { buildEdgeIndex, edgesInRange, lowerBoundByFromRow } from './graph-edges';

const edge = (
  fromRow: number,
  toRow: number,
  lane = 0,
  edge_type: EdgeType = 'straight',
): GraphEdge => ({
  from_lane: lane,
  to_lane: lane,
  from_row: fromRow,
  to_row: toRow,
  edge_type,
});

const row = (edges: GraphEdge[], lane = 0): GraphCommit => ({
  lane,
  edges,
});

const graph = (commits: GraphCommit[], max_lanes = 1): GraphData => ({
  commits,
  max_lanes,
});

describe('buildEdgeIndex', () => {
  it('returns an empty index for a missing or empty graph', () => {
    expect(buildEdgeIndex(null, 10).edges).toEqual([]);
    expect(buildEdgeIndex(graph([]), 10).edges).toEqual([]);
  });

  it('flattens edges in row order without sorting', () => {
    const data = graph([
      row([edge(0, 1)]),
      row([edge(1, 3), edge(1, 2)]),
      row([edge(2, 3)]),
    ]);
    expect(buildEdgeIndex(data, 4).edges.map((e) => e.fromRow)).toEqual([0, 1, 1, 2]);
  });

  it('keeps the absolute rows the backend sent', () => {
    const data = graph([row([edge(200, 512)])]);
    const [only] = buildEdgeIndex(data, 1000).edges;
    expect(only?.fromRow).toBe(200);
    expect(only?.toRow).toBe(512);
  });

  it('records the longest span so the window query knows how far to look back', () => {
    const data = graph([row([edge(0, 3)]), row([edge(1, 40)])]);
    expect(buildEdgeIndex(data, 100).maxSpan).toBe(39);
  });

  it('flags an edge whose target is the sentinel at the end of history', () => {
    // `assign_lanes` marks "parent not in the walk" with the length of the
    // FULL list, which is HistoryPage.total — not the loaded page length.
    const data = graph([row([edge(0, 5000)])]);
    const [only] = buildEdgeIndex(data, 5000).edges;
    expect(only?.dangling).toBe(true);
    expect(only?.spanEnd).toBe(1);
  });

  it('does not flag a normal edge on the last loaded page', () => {
    const data = graph([row([edge(0, 199)])]);
    const [only] = buildEdgeIndex(data, 5000).edges;
    expect(only?.dangling).toBe(false);
  });

  it('never flags anything when the total is unknown', () => {
    const data = graph([row([edge(0, 5000)])]);
    expect(buildEdgeIndex(data, null).edges[0]?.dangling).toBe(false);
  });
});

describe('lowerBoundByFromRow', () => {
  it('finds the first edge at or after a row', () => {
    const { edges } = buildEdgeIndex(
      graph([row([edge(0, 1)]), row([edge(1, 2)]), row([edge(2, 3)])]),
      10,
    );
    expect(lowerBoundByFromRow(edges, 0)).toBe(0);
    expect(lowerBoundByFromRow(edges, 2)).toBe(2);
    expect(lowerBoundByFromRow(edges, 9)).toBe(3);
    expect(lowerBoundByFromRow(edges, -5)).toBe(0);
  });
});

describe('edgesInRange', () => {
  const index = buildEdgeIndex(
    graph([
      row([edge(0, 1)]),
      row([edge(1, 2)]),
      row([edge(2, 90)]),
      row([edge(50, 51)]),
      row([edge(95, 96)]),
    ]),
    500,
  );

  it('returns the edges that start inside the window', () => {
    expect(edgesInRange(index, 0, 2).map((e) => e.fromRow)).toEqual([0, 1, 2]);
  });

  it('keeps a long edge that starts far above but crosses the window', () => {
    expect(edgesInRange(index, 60, 70).map((e) => e.fromRow)).toEqual([2]);
  });

  it('drops edges that end before the window starts', () => {
    expect(edgesInRange(index, 95, 99).map((e) => e.fromRow)).toEqual([95]);
  });

  it('is empty for an inverted window', () => {
    expect(edgesInRange(index, 10, 5)).toEqual([]);
  });

  it('is empty for an empty index', () => {
    expect(edgesInRange(buildEdgeIndex(null, 0), 0, 10)).toEqual([]);
  });

  it('stops a dangling edge one row below its source', () => {
    const dangling = buildEdgeIndex(graph([row([edge(0, 300)])]), 300);
    expect(edgesInRange(dangling, 0, 5)).toHaveLength(1);
    expect(edgesInRange(dangling, 40, 60)).toEqual([]);
  });
});
