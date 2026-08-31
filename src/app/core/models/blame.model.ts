/**
 * One annotated line returned by `git blame --porcelain`.
 *
 * Field names mirror the Rust serde JSON output (snake_case).
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
