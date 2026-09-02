use std::collections::HashMap;

use git2::Oid;

use crate::models::{EdgeType, GraphCommit, GraphData, GraphEdge};

/// Assign a lane and outgoing edges to every commit of a walk.
///
/// `oids` MUST be in reverse-chronological / topological order:
/// the first commit is the youngest, every parent appears AFTER its
/// children (or is missing entirely — outside the visible window).
/// `parents[row]` holds the parents of `oids[row]`.
///
/// The algorithm is single-pass O(N · L) where L is the maximum number
/// of concurrently active lanes (typically small, ≤ 20).
pub fn assign_lanes(oids: &[Oid], parents: &[Vec<Oid>]) -> GraphData {
    if oids.is_empty() {
        return GraphData {
            commits: vec![],
            max_lanes: 0,
        };
    }

    let commit_to_row: HashMap<Oid, usize> = oids
        .iter()
        .enumerate()
        .map(|(row, oid)| (*oid, row))
        .collect();
    let mut graph_commits: Vec<GraphCommit> = oids
        .iter()
        .map(|_| GraphCommit {
            lane: 0,
            edges: Vec::new(),
        })
        .collect();

    let mut active_lanes: Vec<Option<Oid>> = Vec::new();
    let mut max_lanes = 0usize;

    for (row, (oid, parent_oids)) in oids.iter().zip(parents).enumerate() {
        let chosen_lane = match find_expected_lane(&active_lanes, *oid) {
            Some(lane) => lane,
            None => leftmost_free_lane(&mut active_lanes),
        };
        max_lanes = max_lanes.max(active_lanes.len());
        graph_commits[row].lane = chosen_lane as u32;

        let mut extra_lane = 0;
        while extra_lane < active_lanes.len() {
            if extra_lane != chosen_lane && active_lanes[extra_lane] == Some(*oid) {
                active_lanes[extra_lane] = None;
                graph_commits[row].edges.push(GraphEdge {
                    from_lane: extra_lane as u32,
                    to_lane: chosen_lane as u32,
                    from_row: row as u32,
                    to_row: row as u32,
                    edge_type: EdgeType::Merge,
                });
            }
            extra_lane += 1;
        }

        active_lanes[chosen_lane] = None;

        for (parent_index, parent) in parent_oids.iter().enumerate() {
            let parent_lane = if parent_index == 0 && active_lanes[chosen_lane].is_none() {
                chosen_lane
            } else {
                leftmost_free_lane(&mut active_lanes)
            };
            max_lanes = max_lanes.max(active_lanes.len());

            let edge_type = if parent_index == 0 && parent_lane == chosen_lane {
                EdgeType::Straight
            } else {
                EdgeType::Fork
            };

            graph_commits[row].edges.push(GraphEdge {
                from_lane: chosen_lane as u32,
                to_lane: parent_lane as u32,
                from_row: row as u32,
                to_row: resolve_parent_row(&commit_to_row, *parent, oids.len()),
                edge_type,
            });
            active_lanes[parent_lane] = Some(*parent);
        }
    }

    GraphData {
        commits: graph_commits,
        max_lanes: max_lanes as u32,
    }
}

fn find_expected_lane(active_lanes: &[Option<Oid>], oid: Oid) -> Option<usize> {
    active_lanes
        .iter()
        .position(|expected| *expected == Some(oid))
}

fn leftmost_free_lane(active_lanes: &mut Vec<Option<Oid>>) -> usize {
    if let Some(lane) = active_lanes.iter().position(Option::is_none) {
        return lane;
    }

    active_lanes.push(None);
    active_lanes.len() - 1
}

fn resolve_parent_row(
    commit_to_row: &HashMap<Oid, usize>,
    parent: Oid,
    offscreen_row: usize,
) -> u32 {
    match commit_to_row.get(&parent) {
        Some(row) => *row as u32,
        None => offscreen_row as u32,
    }
}

#[cfg(test)]
mod tests {
    use std::mem::discriminant;
    use std::time::{Duration, Instant};

    use super::*;

    /// A distinct, stable oid per label, so the fixtures keep reading as shas.
    fn oid(label: &str) -> Oid {
        Oid::hash_object(git2::ObjectType::Blob, label.as_bytes()).expect("hash the label")
    }

    fn graph_of(rows: &[(&str, &[&str])]) -> GraphData {
        let oids: Vec<Oid> = rows.iter().map(|(sha, _)| oid(sha)).collect();
        let parents: Vec<Vec<Oid>> = rows
            .iter()
            .map(|(_, parents)| parents.iter().copied().map(oid).collect())
            .collect();
        assign_lanes(&oids, &parents)
    }

    fn assert_edge(
        edge: &GraphEdge,
        from_lane: u32,
        to_lane: u32,
        to_row: u32,
        edge_type: EdgeType,
    ) {
        assert_eq!(edge.from_lane, from_lane);
        assert_eq!(edge.to_lane, to_lane);
        assert_eq!(edge.to_row, to_row);
        assert_eq!(discriminant(&edge.edge_type), discriminant(&edge_type));
    }

    #[test]
    fn assigns_zero_lane_for_linear_chain() {
        let rows: &[(&str, &[&str])] = &[
            ("c0", &["c1"]),
            ("c1", &["c2"]),
            ("c2", &["c3"]),
            ("c3", &["c4"]),
            ("c4", &["c5"]),
        ];

        let graph = graph_of(rows);

        assert_eq!(graph.max_lanes, 1);
        assert_eq!(graph.commits.len(), rows.len());
        for (row, graph_commit) in graph.commits.iter().enumerate() {
            assert_eq!(graph_commit.lane, 0);
            assert_eq!(graph_commit.edges.len(), 1);
            assert_edge(
                &graph_commit.edges[0],
                0,
                0,
                (row + 1) as u32,
                EdgeType::Straight,
            );
        }
    }

    #[test]
    fn assigns_two_lanes_for_simple_branch_and_merge() {
        // First parent is mainline B2, second parent is feature A1.
        // A1 later reserves B2 on lane 1; B2 absorbs that lane with a Merge edge.
        let rows: &[(&str, &[&str])] = &[
            ("M0", &["B2", "A1"]),
            ("A1", &["B2"]),
            ("B2", &["C3"]),
            ("C3", &[]),
        ];

        let graph = graph_of(rows);
        let lanes: Vec<u32> = graph.commits.iter().map(|commit| commit.lane).collect();

        assert_eq!(lanes, vec![0, 1, 0, 0]);
        assert_eq!(graph.max_lanes, 2);

        assert_eq!(graph.commits[0].edges.len(), 2);
        assert_edge(&graph.commits[0].edges[0], 0, 0, 2, EdgeType::Straight);
        assert_edge(&graph.commits[0].edges[1], 0, 1, 1, EdgeType::Fork);

        assert_eq!(graph.commits[1].edges.len(), 1);
        assert_edge(&graph.commits[1].edges[0], 1, 1, 2, EdgeType::Straight);

        assert_eq!(graph.commits[2].edges.len(), 2);
        assert_edge(&graph.commits[2].edges[0], 1, 0, 2, EdgeType::Merge);
        assert_edge(&graph.commits[2].edges[1], 0, 0, 3, EdgeType::Straight);

        assert!(graph.commits[3].edges.is_empty());
    }

    #[test]
    fn convergence_records_merge_edges_on_target() {
        let graph = graph_of(&[("A", &["P"]), ("B", &["P"]), ("P", &[])]);

        assert_eq!(graph.max_lanes, 2);
        assert_eq!(graph.commits[0].lane, 0);
        assert_eq!(graph.commits[1].lane, 1);
        assert_eq!(graph.commits[2].lane, 0);
        assert_edge(&graph.commits[0].edges[0], 0, 0, 2, EdgeType::Straight);
        assert_edge(&graph.commits[1].edges[0], 1, 1, 2, EdgeType::Straight);
        assert_eq!(graph.commits[2].edges.len(), 1);
        assert_edge(&graph.commits[2].edges[0], 1, 0, 2, EdgeType::Merge);
    }

    #[test]
    fn extra_parents_always_fork_to_fresh_lane() {
        let graph = graph_of(&[
            ("M", &["P1", "P2", "P3"]),
            ("P1", &[]),
            ("P2", &[]),
            ("P3", &[]),
        ]);
        let lanes: Vec<u32> = graph.commits.iter().map(|commit| commit.lane).collect();

        assert_eq!(lanes, vec![0, 0, 1, 2]);
        assert_eq!(graph.max_lanes, 3);
        assert_eq!(graph.commits[0].edges.len(), 3);
        assert_edge(&graph.commits[0].edges[0], 0, 0, 1, EdgeType::Straight);
        assert_edge(&graph.commits[0].edges[1], 0, 1, 2, EdgeType::Fork);
        assert_edge(&graph.commits[0].edges[2], 0, 2, 3, EdgeType::Fork);
    }

    #[test]
    fn parent_outside_window_uses_sentinel_row() {
        let graph = graph_of(&[("A", &["outside"])]);

        assert_eq!(graph.max_lanes, 1);
        assert_eq!(graph.commits[0].lane, 0);
        assert_eq!(graph.commits[0].edges.len(), 1);
        assert_edge(&graph.commits[0].edges[0], 0, 0, 1, EdgeType::Straight);
    }

    #[test]
    fn empty_input_returns_empty_graph_data() {
        let graph = assign_lanes(&[], &[]);

        assert!(graph.commits.is_empty());
        assert_eq!(graph.max_lanes, 0);
    }

    #[test]
    fn max_lanes_is_the_peak_active_lane_count() {
        let graph = graph_of(&[
            ("M", &["P1", "P2", "P3"]),
            ("P1", &[]),
            ("P2", &[]),
            ("P3", &[]),
        ]);

        assert_eq!(graph.max_lanes, 3);
    }

    #[test]
    fn performance_smoke_handles_1000_commits_under_100ms() {
        let oids: Vec<Oid> = (0..1000).map(|row| oid(&format!("c{row:04}"))).collect();
        let mut parents: Vec<Vec<Oid>> = Vec::new();
        for row in 0..1000 {
            let mut of_row = Vec::new();
            if row + 1 < 1000 {
                of_row.push(oids[row + 1]);
            }
            if row % 50 == 0 && row + 2 < 1000 {
                of_row.push(oids[row + 2]);
            }
            parents.push(of_row);
        }

        let start = Instant::now();
        let graph = assign_lanes(&oids, &parents);
        let elapsed = start.elapsed();

        println!("performance_smoke_1000_commits elapsed: {elapsed:?}");
        assert_eq!(graph.commits.len(), 1000);
        assert!(
            elapsed < Duration::from_millis(100),
            "lane assignment took {elapsed:?}"
        );
    }
}
