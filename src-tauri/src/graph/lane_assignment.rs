use std::collections::HashMap;

use crate::models::{CommitInfo, EdgeType, GraphCommit, GraphData, GraphEdge};

/// Assign a lane and outgoing edges to every commit in `commits`.
///
/// `commits` MUST be in reverse-chronological / topological order:
/// the first commit is the youngest, every parent appears AFTER its
/// children (or is missing entirely — outside the visible window).
///
/// The algorithm is single-pass O(N · L) where L is the maximum number
/// of concurrently active lanes (typically small, ≤ 20).
pub fn assign_lanes(commits: &[CommitInfo]) -> GraphData {
    if commits.is_empty() {
        return GraphData {
            commits: vec![],
            max_lanes: 0,
        };
    }

    let commit_to_row: HashMap<&str, usize> = commits
        .iter()
        .enumerate()
        .map(|(row, commit)| (commit.sha.as_str(), row))
        .collect();
    let mut graph_commits: Vec<GraphCommit> = commits
        .iter()
        .map(|commit| GraphCommit {
            sha: commit.sha.clone(),
            lane: 0,
            parent_shas: commit.parent_shas.clone(),
            edges: Vec::new(),
        })
        .collect();

    let mut active_lanes: Vec<Option<String>> = Vec::new();
    let mut max_lanes = 0usize;

    for (row, commit) in commits.iter().enumerate() {
        let chosen_lane = match find_expected_lane(&active_lanes, commit.sha.as_str()) {
            Some(lane) => lane,
            None => leftmost_free_lane(&mut active_lanes),
        };
        max_lanes = max_lanes.max(active_lanes.len());
        graph_commits[row].lane = chosen_lane as u32;

        let mut extra_lane = 0;
        while extra_lane < active_lanes.len() {
            if extra_lane != chosen_lane
                && active_lanes[extra_lane].as_deref() == Some(commit.sha.as_str())
            {
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

        for (parent_index, parent_sha) in commit.parent_shas.iter().enumerate() {
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
                to_row: resolve_parent_row(&commit_to_row, parent_sha, commits.len()),
                edge_type,
            });
            active_lanes[parent_lane] = Some(parent_sha.to_owned());
        }
    }

    GraphData {
        commits: graph_commits,
        max_lanes: max_lanes as u32,
    }
}

fn find_expected_lane(active_lanes: &[Option<String>], sha: &str) -> Option<usize> {
    active_lanes
        .iter()
        .position(|expected_sha| expected_sha.as_deref() == Some(sha))
}

fn leftmost_free_lane(active_lanes: &mut Vec<Option<String>>) -> usize {
    if let Some(lane) = active_lanes.iter().position(Option::is_none) {
        return lane;
    }

    active_lanes.push(None);
    active_lanes.len() - 1
}

fn resolve_parent_row(
    commit_to_row: &HashMap<&str, usize>,
    parent_sha: &str,
    offscreen_row: usize,
) -> u32 {
    match commit_to_row.get(parent_sha) {
        Some(row) => *row as u32,
        None => offscreen_row as u32,
    }
}

#[cfg(test)]
mod tests {
    use std::mem::discriminant;
    use std::time::{Duration, Instant};

    use super::*;
    use crate::models::RefInfo;

    fn commit(sha: &str, parents: &[&str]) -> CommitInfo {
        commit_with_parents(
            sha.to_string(),
            parents.iter().map(|parent| parent.to_string()).collect(),
        )
    }

    fn commit_with_parents(sha: String, parent_shas: Vec<String>) -> CommitInfo {
        CommitInfo {
            short_sha: sha.chars().take(7).collect(),
            sha,
            message: "message".to_string(),
            author_name: "author".to_string(),
            author_email: "author@example.com".to_string(),
            date: "2026-01-01T00:00:00Z".to_string(),
            parent_shas,
            refs: Vec::<RefInfo>::new(),
            on_current_branch: true,
        }
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
        let commits = vec![
            commit("c0", &["c1"]),
            commit("c1", &["c2"]),
            commit("c2", &["c3"]),
            commit("c3", &["c4"]),
            commit("c4", &["c5"]),
        ];

        let graph = assign_lanes(&commits);

        assert_eq!(graph.max_lanes, 1);
        assert_eq!(graph.commits.len(), commits.len());
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
        let commits = vec![
            // First parent is mainline B2, second parent is feature A1.
            // A1 later reserves B2 on lane 1; B2 absorbs that lane with a Merge edge.
            commit("M0", &["B2", "A1"]),
            commit("A1", &["B2"]),
            commit("B2", &["C3"]),
            commit("C3", &[]),
        ];

        let graph = assign_lanes(&commits);
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
        let commits = vec![commit("A", &["P"]), commit("B", &["P"]), commit("P", &[])];

        let graph = assign_lanes(&commits);

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
        let commits = vec![
            commit("M", &["P1", "P2", "P3"]),
            commit("P1", &[]),
            commit("P2", &[]),
            commit("P3", &[]),
        ];

        let graph = assign_lanes(&commits);
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
        let commits = vec![commit("A", &["outside"])];

        let graph = assign_lanes(&commits);

        assert_eq!(graph.max_lanes, 1);
        assert_eq!(graph.commits[0].lane, 0);
        assert_eq!(graph.commits[0].edges.len(), 1);
        assert_edge(&graph.commits[0].edges[0], 0, 0, 1, EdgeType::Straight);
    }

    #[test]
    fn empty_input_returns_empty_graph_data() {
        let graph = assign_lanes(&[]);

        assert!(graph.commits.is_empty());
        assert_eq!(graph.max_lanes, 0);
    }

    #[test]
    fn max_lanes_is_the_peak_active_lane_count() {
        let commits = vec![
            commit("M", &["P1", "P2", "P3"]),
            commit("P1", &[]),
            commit("P2", &[]),
            commit("P3", &[]),
        ];

        let graph = assign_lanes(&commits);

        assert_eq!(graph.max_lanes, 3);
    }

    #[test]
    fn performance_smoke_handles_1000_commits_under_100ms() {
        let mut commits = Vec::new();
        for row in 0..1000 {
            let sha = format!("c{row:04}");
            let mut parents = Vec::new();
            if row + 1 < 1000 {
                parents.push(format!("c{:04}", row + 1));
            }
            if row % 50 == 0 && row + 2 < 1000 {
                parents.push(format!("c{:04}", row + 2));
            }
            commits.push(commit_with_parents(sha, parents));
        }

        let start = Instant::now();
        let graph = assign_lanes(&commits);
        let elapsed = start.elapsed();

        println!("performance_smoke_1000_commits elapsed: {elapsed:?}");
        assert_eq!(graph.commits.len(), 1000);
        assert!(
            elapsed < Duration::from_millis(100),
            "lane assignment took {elapsed:?}"
        );
    }
}
