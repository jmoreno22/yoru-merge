import { describe, expect, it } from 'vitest';
import type { GraphCommit, GraphData } from '../models';
import { appendGraphPage, isDanglingEdge } from './graph-page';

function commit(lane: number, row: number): GraphCommit {
  return {
    lane,
    edges: [
      {
        from_lane: lane,
        to_lane: lane,
        from_row: row,
        to_row: row + 1,
        edge_type: 'straight',
      },
    ],
  };
}

function page(commits: GraphCommit[], maxLanes: number): GraphData {
  return { commits, max_lanes: maxLanes };
}

describe('appendGraphPage', () => {
  it('returns the page as-is when there is nothing loaded yet', () => {
    const first = page([commit(0, 0)], 1);
    expect(appendGraphPage(null, first)).toBe(first);
  });

  it('concatenates in order', () => {
    const merged = appendGraphPage(
      page([commit(0, 0), commit(0, 1)], 2),
      page([commit(1, 2)], 2),
    );
    expect(merged.commits.map((c) => c.edges[0]?.from_row)).toEqual([0, 1, 2]);
  });

  it('keeps the row indices untouched — the backend numbers them absolutely', () => {
    const merged = appendGraphPage(page([commit(0, 0)], 2), page([commit(1, 7)], 2));
    expect(merged.commits[1]?.edges[0]?.from_row).toBe(7);
    expect(merged.commits[1]?.edges[0]?.to_row).toBe(8);
  });

  it('takes the lane count from the incoming page', () => {
    const merged = appendGraphPage(page([commit(0, 0)], 4), page([commit(0, 1)], 4));
    expect(merged.max_lanes).toBe(4);
  });

  it('does not mutate the pages it merges', () => {
    const first = page([commit(0, 0)], 1);
    const second = page([commit(0, 1)], 1);
    appendGraphPage(first, second);
    expect(first.commits).toHaveLength(1);
    expect(second.commits).toHaveLength(1);
  });
});

describe('isDanglingEdge', () => {
  const edge = (toRow: number) => ({
    from_lane: 0,
    to_lane: 0,
    from_row: 0,
    to_row: toRow,
    edge_type: 'straight' as const,
  });

  it('flags an edge pointing past the end of the full history', () => {
    expect(isDanglingEdge(edge(500), 500)).toBe(true);
  });

  it('accepts an edge pointing at a real row', () => {
    expect(isDanglingEdge(edge(499), 500)).toBe(false);
  });

  it('never flags anything when the total is unknown', () => {
    // Rows are absolute, so a page-sized comparison would be wrong here.
    expect(isDanglingEdge(edge(500), null)).toBe(false);
  });
});
