/**
 * What `blame_file` sends: each commit's metadata once, and per line the
 * index of its commit. `tauri-git.service.ts` expands it into {@link BlameLine}s.
 */
export interface BlameResult {
  commits: BlameCommit[];
  lines: BlameRow[];
}

export interface BlameCommit {
  sha: string;
  author: string;
  time: number;
  message: string;
}

export interface BlameRow {
  /** Index into {@link BlameResult.commits}. */
  commit: number;
  line_no: number;
  content: string;
}

/**
 * One annotated line returned by `git blame --porcelain`, as the UI uses it.
 *
 *   - `sha`     — commit SHA that last touched this line
 *   - `author`  — committer display name
 *   - `time`    — author time as a Unix timestamp (seconds)
 *   - `message` — commit summary line (first line of the commit message)
 *   - `line_no` — 1-based line number in the current file
 *   - `content` — raw text of the line, no trailing newline
 */
export interface BlameLine {
  sha: string;
  author: string;
  time: number;
  message: string;
  line_no: number;
  content: string;
}
