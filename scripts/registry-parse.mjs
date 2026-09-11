/**
 * The pure parsers behind `check-tasks.mjs`, in their own module so a spec can
 * reach them without running the validator's `process.exit`.
 *
 * WHY THEY LIVE HERE. Review round 19 found three silent passes in this gate,
 * and all three were parsing, not logic: a mermaid edge commented out with `%%`
 * was still counted as drawn, a frontmatter list written as a YAML block
 * sequence was skipped rather than read, and a field removed outright was
 * indistinguishable from a field that agreed. Each is a string in, a value out,
 * which is the shape a table of cases covers in a minute and a hand-run
 * reconstruction covers one at a time (owner decision D4, review round 19).
 *
 * Everything here is total: no reads, no `git`, no exits.
 */

/** The text between the first two `---` fences, or `''` when there is no frontmatter. */
export const frontmatter = (text) => text.split('---')[1] ?? '';

/**
 * A frontmatter list field, in either layout the repo writes.
 *
 * Returns `{ present, values }` rather than a bare array: «the field is absent»
 * and «the field is there and empty» are different registry states, and
 * collapsing them is what let a mismatch be resolved by deleting the field.
 */
export const listField = (text, field) => {
  const fm = frontmatter(text);
  const inline = fm.match(new RegExp(`^\\s*${field}:[ \\t]*\\[([\\s\\S]*?)\\]`, 'm'));
  if (inline) {
    return {
      present: true,
      values: inline[1]
        .split(',')
        .map((x) => x.trim().replace(/^["']|["']$/g, ''))
        .filter((x) => x.length > 0),
    };
  }

  const lines = fm.split('\n');
  const head = lines.findIndex((line) =>
    new RegExp(`^\\s*${field}:[ \\t]*$`).test(line),
  );
  if (head === -1) return { present: false, values: [] };

  const values = [];
  for (const line of lines.slice(head + 1)) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (!item) break;
    values.push(item[1].trim().replace(/^["']|["']$/g, ''));
  }
  return { present: true, values };
};

/** Mermaid's own comment syntax. A commented line is not part of the graph. */
export const stripMermaidComments = (block) =>
  block
    .split('\n')
    .filter((line) => !/^\s*%%/.test(line))
    .join('\n');

/**
 * The mermaid blocks of an epic, concatenated and stripped of comments.
 *
 * Only the block under `## Task map` is read when that heading exists: the file
 * carries prose around its graph, and a second fenced block elsewhere used to
 * contribute nodes and edges to the answer.
 */
export const graphBlock = (epic) => {
  const map = epic.split(/^##\s+Task map\s*$/m)[1];
  const scope = map ?? epic;
  const blocks = [...scope.matchAll(/```mermaid([\s\S]*?)```/g)].map((m) => m[1]);
  return stripMermaidComments(blocks.join('\n'));
};

/** Declared nodes, `T12[label]` at the start of a line. */
export const graphNodes = (block) =>
  new Set([...block.matchAll(/^\s*(T\d+)\[/gm)].map((m) => m[1]));

/** Drawn edges as `from->to` keys. */
export const graphEdges = (block) =>
  new Set([...block.matchAll(/(T\d+)\s*-->\s*(T\d+)/g)].map((m) => `${m[1]}->${m[2]}`));

/** Every id with a tracker row, in file order and **with duplicates kept**. */
export const trackerRows = (tracker) =>
  [...tracker.matchAll(/^\| (T\d+) \|/gm)].map((m) => m[1]);

/** The «Total: N tasks» a tracker states, or `null` when it states none. */
export const trackerTotal = (tracker) => {
  const total = tracker.match(/\*\*Total:\*\*\s*(\d+)\s*tasks/);
  return total ? Number(total[1]) : null;
};
