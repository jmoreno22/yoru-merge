//! Lane/edge layout for the commit graph.

use crate::commands::commits::validate_log_args;
use crate::commands::git::blocking;
use crate::commands::history::{history_page, HistoryCache};
use crate::models::GraphData;

/// Graph layout for the same window of history `git_log` returns.
///
/// Lanes are assigned over the whole scope once and cached, then sliced to the
/// requested page, so a commit keeps the same lane no matter which page it is
/// read on.
#[tauri::command]
pub async fn get_graph_data(
    path: String,
    limit: u32,
    skip: u32,
    cache: tauri::State<'_, HistoryCache>,
) -> Result<GraphData, String> {
    validate_log_args(&path, None)?;
    let cache = cache.inner().clone();
    blocking(move || history_page(&cache, &path, limit, skip, None, true).map(|page| page.graph))
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::git::test_support::{git_ok, init_repo, write_file};

    fn graph(path: &str, limit: u32, skip: u32) -> GraphData {
        history_page(&HistoryCache::default(), path, limit, skip, None, true)
            .expect("history page")
            .graph
    }

    #[test]
    fn a_linear_history_stays_on_lane_zero() {
        let (_dir, path) = init_repo();
        for i in 0..3 {
            write_file(&path, &format!("f{i}.txt"), "x\n");
            git_ok(&path, &["add", "."]);
            git_ok(&path, &["commit", "-m", &format!("c{i}")]);
        }

        let graph = graph(&path, 10, 0);

        assert_eq!(graph.commits.len(), 4);
        assert!(graph.commits.iter().all(|c| c.lane == 0));
        assert_eq!(graph.max_lanes, 1);
    }

    #[test]
    fn a_merge_opens_a_second_lane() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "b\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "feature"]);
        git_ok(&path, &["checkout", "main"]);
        write_file(&path, "c.txt", "c\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "main"]);
        git_ok(&path, &["merge", "--no-ff", "--no-edit", "feature"]);

        let graph = graph(&path, 20, 0);

        assert!(graph.max_lanes >= 2, "got {}", graph.max_lanes);
        // Every edge knows both of its rows, so the renderer never has to scan
        // backwards to find where a line started.
        assert!(graph
            .commits
            .iter()
            .enumerate()
            .all(|(row, c)| c.edges.iter().all(|e| e.from_row as usize == row)));
    }

    #[test]
    fn lanes_are_stable_across_pages() {
        let (_dir, path) = init_repo();
        git_ok(&path, &["checkout", "-b", "feature"]);
        write_file(&path, "b.txt", "b\n");
        git_ok(&path, &["add", "."]);
        git_ok(&path, &["commit", "-m", "feature"]);
        git_ok(&path, &["checkout", "main"]);
        for i in 0..4 {
            write_file(&path, &format!("m{i}.txt"), "x\n");
            git_ok(&path, &["add", "."]);
            git_ok(&path, &["commit", "-m", &format!("m{i}")]);
        }
        git_ok(&path, &["merge", "--no-ff", "--no-edit", "feature"]);

        let cache = HistoryCache::default();
        let whole = history_page(&cache, &path, 100, 0, None, true).expect("history page");
        let second_page = history_page(&cache, &path, 3, 3, None, true).expect("history page");

        assert_eq!(second_page.graph.commits.len(), 3);
        assert_eq!(second_page.graph.max_lanes, whole.graph.max_lanes);
        // The rows have no sha; the commits of the page say which window it is.
        for (offset, commit) in second_page.commits.iter().enumerate() {
            assert_eq!(commit.sha, whole.commits[3 + offset].sha);
            assert_eq!(
                second_page.graph.commits[offset].lane,
                whole.graph.commits[3 + offset].lane,
                "lane drifted between pages"
            );
        }
    }
}
