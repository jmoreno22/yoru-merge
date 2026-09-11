#!/usr/bin/env node
/**
 * Validates the SDD task registry of `docs/features/<slug>/` against itself: `tasks.json`, the task
 * files' frontmatter, `tracker.md` and the epic's mermaid graph must agree.
 *
 * WHY THIS EXISTS. Every wave on this branch registers its tasks in three places by hand, and every
 * round a reviewer re-derives the same checks from scratch. Two of them have already been written
 * down as rules and then not run:
 *
 *   - round 16 registered T63–T66 in the table and in `tracker.md` and never reached the mermaid
 *     graph, while T63's own DoD claimed the edges agreed. Two clean-context reviewers and the lead
 *     all verified the ROWS and none looked at the graph (R18-F5, first half).
 *   - round 17 then wrote the stronger check — «every id in `tasks.json` appears as a mermaid node»
 *     — into a comment beside the graph, and left it failing at 7 ids of 71, because a check that
 *     lives in prose is a check nobody executes (R18-F5, second half).
 *
 * So the check is a command. What it asserts:
 *   - `tasks.json` parses, ids are unique and contiguous `T1…TN`;
 *   - no dangling dependency and no cycle (DFS);
 *   - every id has exactly one task file and every task file's id is in `tasks.json`;
 *   - `deps`, `files_hint` and `acs` agree between `tasks.json` and each task file's frontmatter,
 *     in either list layout, and a field the registry populates may not simply be absent;
 *   - `tracker.md` has a row per id and no id twice, and its stated total matches the count;
 *   - **every id is a node in the epic's mermaid graph, and every `deps` edge is drawn there.**
 *
 * The graph is read through `registry-parse.mjs`, which drops mermaid `%%` comments and, when the
 * epic has a `## Task map` heading, reads only the block under it: a commented-out edge is not drawn,
 * and a second fenced block elsewhere in the file is not part of the answer (review round 19, R19-F3).
 *
 * What it does NOT assert: that a task file's prose is true, that a `files_hint` lists what the task
 * really touched, that `tracker.md`'s status or its own `deps` column reflect reality, or that a node
 * carries the right label. Those need a reader.
 *
 * Exit 0 when everything agrees; exit 1 listing every disagreement.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  graphBlock,
  graphEdges,
  graphNodes,
  listField,
  trackerRows,
  trackerTotal,
} from './registry-parse.mjs';

// Overridable so the spec can point the validator at a fixture registry; CI never sets it.
const BASE = process.env.SDD_TASKS_BASE ?? 'docs/features/inspector-diff-workspace';
const TASKS_JSON = join(BASE, 'tasks.json');
const TASKS_DIR = join(BASE, 'tasks');
const EPIC = join(TASKS_DIR, '_epic.md');
const TRACKER = join(TASKS_DIR, 'tracker.md');

const failures = [];
const fail = (m) => failures.push(m);

if (!existsSync(TASKS_JSON)) {
  console.error(`${TASKS_JSON} does not exist — nothing to validate`);
  process.exit(1);
}

let tasks;
try {
  tasks = JSON.parse(readFileSync(TASKS_JSON, 'utf8')).tasks;
} catch (err) {
  console.error(`${TASKS_JSON} does not parse: ${err.message}`);
  process.exit(1);
}

const ids = tasks.map((t) => t.id);
const expected = tasks.map((_, i) => `T${i + 1}`);
if (ids.join(',') !== expected.join(',')) {
  const missing = expected.filter((i) => !ids.includes(i));
  const extra = ids.filter((i) => !expected.includes(i));
  fail(
    `ids are not exactly T1…T${tasks.length}: ${missing.length} missing (${missing.join(', ') || '—'}), ${extra.length} unexpected (${extra.join(', ') || '—'})`,
  );
}
for (const id of new Set(ids)) {
  const n = ids.filter((x) => x === id).length;
  if (n > 1) fail(`duplicate id ${id} appears ${n} times in tasks.json`);
}

const deps = Object.fromEntries(tasks.map((t) => [t.id, t.deps ?? []]));
for (const [id, list] of Object.entries(deps)) {
  for (const d of list)
    if (!(d in deps)) fail(`${id} depends on ${d}, which is not a task`);
}
const seen = new Set();
const onStack = new Set();
const walk = (n) => {
  if (onStack.has(n)) {
    fail(`dependency cycle reaches ${n}`);
    return;
  }
  if (seen.has(n)) return;
  seen.add(n);
  onStack.add(n);
  for (const d of deps[n] ?? []) walk(d);
  onStack.delete(n);
};
for (const id of ids) walk(id);

/** id -> the task files whose frontmatter claims it. */
const byId = new Map();
for (const name of readdirSync(TASKS_DIR)) {
  if (!name.endsWith('.md') || name === '_epic.md' || name === 'tracker.md') continue;
  const text = readFileSync(join(TASKS_DIR, name), 'utf8');
  const m = text.match(/^id:\s*(\S+)\s*$/m);
  if (!m) {
    fail(`${name} has no \`id:\` in its frontmatter`);
    continue;
  }
  if (!byId.has(m[1])) byId.set(m[1], []);
  byId.get(m[1]).push({ name, text });
}
for (const id of ids) {
  const files = byId.get(id) ?? [];
  if (files.length === 0) fail(`${id} is in tasks.json and has no task file`);
  if (files.length > 1)
    fail(
      `${id} has ${files.length} task files: ${files.map((f) => f.name).join(', ')}`,
    );
}
for (const id of byId.keys()) {
  if (!ids.includes(id)) fail(`a task file claims ${id}, which is not in tasks.json`);
}

for (const t of tasks) {
  const file = (byId.get(t.id) ?? [])[0];
  if (!file) continue;
  for (const field of ['deps', 'files_hint', 'acs']) {
    const got = listField(file.text, field);
    const want = t[field] ?? [];
    // Absent and agreed used to look the same, so deleting a field was the
    // silent way to resolve a mismatch (review round 19, R19-F4).
    if (!got.present) {
      if (want.length > 0)
        fail(
          `${t.id} ${field} is absent from ${file.name}, where tasks.json has [${want.join(', ')}]`,
        );
      continue;
    }
    if (got.values.join('|') !== want.join('|')) {
      fail(
        `${t.id} ${field} disagrees \u2014 tasks.json has [${want.join(', ')}], ${file.name} has [${got.values.join(', ')}]`,
      );
    }
  }
}

const tracker = existsSync(TRACKER) ? readFileSync(TRACKER, 'utf8') : '';
const trackerIds = trackerRows(tracker);
for (const id of new Set(trackerIds)) {
  const n = trackerIds.filter((x) => x === id).length;
  if (n > 1) fail(`tracker.md has ${n} rows for ${id}`);
}
for (const id of ids)
  if (!trackerIds.includes(id)) fail(`${id} has no row in tracker.md`);
for (const id of trackerIds)
  if (!ids.includes(id)) fail(`tracker.md has a row for ${id}, which is not a task`);
const total = trackerTotal(tracker);
if (total === null) fail('tracker.md states no \u00abTotal: N tasks\u00bb');
else if (total !== tasks.length) {
  fail(
    `tracker.md says \u00abTotal: ${total} tasks\u00bb where tasks.json has ${tasks.length}`,
  );
}

// The check round 17 wrote into a comment and did not run (R18-F5).
const epic = existsSync(EPIC) ? readFileSync(EPIC, 'utf8') : '';
const block = graphBlock(epic);
const nodes = graphNodes(block);
const edges = graphEdges(block);
const missingNodes = ids.filter((id) => !nodes.has(id));
if (missingNodes.length > 0) {
  fail(
    `${missingNodes.length} id(s) in tasks.json are not a node in the epic's mermaid graph: ${missingNodes.join(', ')}`,
  );
}
for (const node of nodes) {
  if (!ids.includes(node))
    fail(`the epic graph draws ${node}, which is not in tasks.json`);
}
for (const [id, list] of Object.entries(deps)) {
  for (const d of list) {
    if (!edges.has(`${d}->${id}`))
      fail(`the epic graph is missing the edge ${d} --> ${id}`);
  }
}
for (const edge of edges) {
  const [from, to] = edge.split('->');
  if (!(deps[to] ?? []).includes(from)) {
    fail(
      `the epic graph draws ${from} --> ${to}, which is not a dependency in tasks.json`,
    );
  }
}

console.log(
  `tasks: ${tasks.length} · ids T1…T${tasks.length} · ${byId.size} task file(s) · ${trackerIds.length} tracker row(s) · ${nodes.size} graph node(s) · ${edges.size} graph edge(s)`,
);
if (failures.length > 0) {
  console.error(`\n${failures.length} registration check(s) failed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    '\nRegister the task everywhere, or remove it everywhere, but do not leave them disagreeing.',
  );
  process.exit(1);
}
console.log(
  'OK — tasks.json, the task files, tracker.md and the epic graph all agree.',
);
