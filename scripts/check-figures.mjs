#!/usr/bin/env node
/**
 * Recomputes every figure the branch's artefacts quote through a `figure:` marker comment, from the
 * shipped modules, and fails when one has drifted.
 *
 * WHY THIS EXISTS. Nine review rounds in a row found an artefact quoting a number derived from code
 * that the code had since moved past — R10-S1-F10's «144 configurations», round-11 O9, round-13's
 * «126 px figure», R15-S1-F2's unreachable «30 px / 30 px at compact», R15-S1-F1's fixture-derived
 * band, R16-S1-F3's «192 / 384 / 32» (written correctly by one task and falsified by another task in
 * the SAME wave), and then — round 17 — the false figure appeared inside the two instruments built to
 * stop it: T64's closed form (R17-F1) and this script's own coverage claim (R17-F8).
 *
 * WHAT IT CHECKS, EXACTLY. For every marker in scope it recomputes the marker's own `expect=` from
 * `computeMetrics` / `computeInspectorLayout` and compares. It also fails when:
 *   - marker-shaped text is present that the strict parser did not match — a mis-typed prefix
 *     (`<!--figure:`, `<!-- Figure:`) or a marker reflowed across two lines (R17-F6);
 *   - the marker inventory differs from the one pinned in the generated reference table, which is how
 *     a DELETED marker becomes loud (R17-F6);
 *   - a marker carries a key its kind does not use, the same key twice, an unparseable value, or an
 *     unknown density inside `expect=` (R17-F9, round-17 O7);
 *   - the checked-in reference table is stale against a fresh generation (owner decision D3);
 *   - the scope it declares is not the scope it executed (owner decision D4).
 *
 * WHAT IT DOES NOT CHECK. Read this before quoting its output as coverage.
 *   1. IT NEVER READS THE PROSE BESIDE A MARKER. `expect=` is compared against the recomputed value;
 *      nothing binds a marker to the figure in the sentence next to it, so a wrong figure written
 *      into a row that already carries a correct marker passes. That binding needs a prose parser
 *      and is deferred with an owner and a due in `spec.md` §8 (R17-F5).
 *   2. THE COVERAGE NUMBER IS A LINE-LEVEL UPPER BOUND, not a binding. For each line it reports
 *      `max(0, figures the heuristic sees − markers on that line)`; both sides are occurrences, so
 *      they are comparable, but a line with one marker and eight figures reports seven unbound
 *      without knowing WHICH seven. Until (1) exists, «0 unbound» means «no line carries more
 *      visible figures than markers», never «every figure is verified».
 *   3. THE FIGURE HEURISTIC IS PARTIALLY BLIND. It sees a `0.ddd`–`0.dddddd` decimal and a 20–49 px
 *      `a / b` pair. It does NOT see `68 / 60`, `136 / 120`, `192 / 384 / 32`, `288`, `cap 50`,
 *      `43 + 2 × 37 = 117`, a bare `34 px`, a percentage or a count in words — several of which are
 *      exactly the historical instances (R15-S1-F1, R16-S1-F3, R10-S1-F10). The script prints this
 *      limit on every run so the number cannot be read as more than it is.
 *   4. THE SCOPE CHECK BINDS THE RULE TO THE SET THE SWEEP ITERATES, and nothing more. It fails when
 *      `ARTEFACTS` is not what the declared rule yields — an enumerated list written at the point of
 *      use, which is the structure round 16 had and R17-F4 punished. It does NOT adjudicate whether a
 *      DECLARED exclusion is legitimate: D4 allows exclusions and only requires each to carry a
 *      reason, so an exclusion that drops `adr/` passes and is printed. It also does not verify the
 *      derivation itself — if `git` reports the wrong files, this check agrees with it.
 *   5. THE CI STEP IS ONLY AS GOOD AS ITS PLACEMENT. What this file guarantees is the exit code, and
 *      that it HAS one in any checkout: the base is resolved by degradation (local `main` →
 *      `origin/main` → `HEAD~` → no base, sweep `docs/` and the root), because the single
 *      `merge-base HEAD main` this replaced exited 1 under this project's own `actions/checkout`
 *      defaults (R18-F1). The rung used is printed on every run.
 *
 * It imports `computeMetrics` and `computeInspectorLayout` rather than reimplementing them: a
 * verifier that reimplements the thing it verifies certifies itself. The same rule now covers the
 * sweep counts — the loop's SHAPE is read out of the spec file (its nested `for` levels and the
 * iterables they walk) instead of being modelled here as `× 2` and `× 4` (R17-F7). Node strips the
 * TypeScript types natively (24.x), so there is no build step.
 *
 * MARKER SCHEMA — density values are always NAMED, never positional. An order-free schema is
 * deliberate: a positional triple is the same ambiguity that produced the figures this script exists
 * to catch. An unknown key is an error, not a silent skip.
 *
 *   <!-- figure: share density=<d> font=<n> remainder=<n> collapsed=<bool> [fileCount=<n>] expect=<float> -->
 *   <!-- figure: cap remainder=<n> collapsed=<bool> fileCount=<n> [font=<n>] expect=compact:<n>,comfortable:<n>,relaxed:<n> -->
 *   <!-- figure: token font=<n> metric=<row-h|file-row-h|panel-head-h> expect=compact:<n>,comfortable:<n>,relaxed:<n> -->
 *   <!-- figure: sweep-counts spec=<path> expect=share:<n>,cap:<n>,zerofile:<n> -->
 *
 * The two bracketed arguments have defaults (`fileCount=30`, `font=13`) and the run reports how many
 * markers relied on each, because until round 17 those two arguments were accepted and then
 * discarded in silence.
 *
 * CONVENTION, now enforced: fenced blocks and inline code spans are blanked before the scan, so an
 * artefact may quote the marker delimiters inside backticks as an example — which is how the task
 * records and the review records carry them — and neither the parser nor the coverage counter sees
 * it. Prose OUTSIDE code is scanned, so a real marker still cannot hide.
 *
 * `--write` regenerates the reference table instead of checking it (`pnpm figures:write`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { computeMetrics } from '../src/app/core/services/appearance-metrics.ts';
import { computeInspectorLayout } from '../src/app/core/services/inspector-layout.ts';

const WRITE = process.argv.includes('--write');
const REFERENCE_TABLE = 'docs/features/inspector-diff-workspace/reference-figures.md';
const POLICY_SOURCE = 'src/app/core/services/inspector-layout.ts';
const SWEEP_SOURCE = 'src/app/core/services/inspector-layout.spec.ts';
const SCHEMA_SOURCE = 'src/app/core/services/preferences-schema.ts';

const failures = [];
const fail = (message) => failures.push(message);

/* ------------------------------------------------------------------ scope (owner decision D4) */

/**
 * The scope is DERIVED from the branch, never enumerated. Round 15 replaced enumerated file lists
 * with this rule; round 16 declared the rule and then gave this script an eight-file list, which is
 * how `adr/0003` stayed outside the only mechanical sweep on the branch (R17-F4).
 */
const DECLARED_SCOPE = {
  rule: 'every markdown file the branch touches: `git diff --name-only <base>..HEAD` for the base named above, plus the unstaged working tree and the untracked files — or, when no base resolves, every markdown file under `docs/` and the repo root',
  exclusions: [
    {
      applies: (file) => !file.endsWith('.md'),
      reason:
        'not markdown: the marker is a markdown-artefact convention, and the only non-markdown carriers are this script’s own docblock (which quotes the schema) and the spec files, whose figures are their assertions',
    },
    {
      applies: (file) => !existsSync(file),
      reason: 'deleted on the branch: no longer on disk to sweep',
    },
  ],
  // The coverage heuristic — and only the heuristic — skips these. Markers in them are still parsed
  // and still checked, so an orphan marker anywhere on the branch fails.
  coverageExclusions: [
    {
      applies: (file) => file.includes('/_review/'),
      reason:
        'dated review records: evidence of what was true on their date, not live claims, and they quote historical figures on purpose',
    },
    {
      applies: (file) => file.includes('/tasks/'),
      reason:
        'dated task records: same — a record states what a task measured when it ran',
    },
    {
      applies: (file) => file === 'CHANGELOG.md',
      reason: 'released history, dated by its own headings',
    },
    {
      applies: (file) => file === REFERENCE_TABLE,
      reason:
        'generated from the shipped modules on every run, so every figure in it is derived by construction and is byte-compared below',
    },
  ],
};

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });
/**
 * `git` where a missing ref is an expected answer, not an error. `stderr: 'ignore'` matters: without
 * it a probe for a ref that is simply absent prints `fatal: Not a valid object name main` into the
 * CI log, and three of those above an `OK` read as a broken step.
 */
const gitOrNull = (args) => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

/**
 * The base the branch diff is taken against, resolved by DEGRADATION rather than by one call that
 * can fail. `git merge-base HEAD main` needs a LOCAL `main`, and `actions/checkout`'s default
 * `fetch-depth: 1` creates none, so the single call exited 1 under this project's own CI — with a
 * message about git, on a step placed before the unit tests (review round 18, R18-F1). `merge-base`
 * does not fall back to `refs/remotes/origin/main` on its own.
 *
 * Each rung is NAMED in the output, because a sweep whose scope silently changed shape is the
 * failure D4 exists to prevent. The last rung has no base at all and sweeps every markdown file
 * under `docs/` and the repo root that the checkout contains — so it is scoped by the CHECKOUT
 * rather than by the diff. In a full checkout that is a superset of the branch diff; in a shallow
 * one it is whatever was fetched, which is why `ci.yml` pins `fetch-depth: 0` and rung 1 is what CI
 * actually uses. The fallbacks exist so the step has an exit code anywhere, not so the scope can be
 * taken for granted: read the `scope base:` line before quoting the file count.
 */
const SCOPE_BASES = [
  { ref: 'main', label: 'merge-base with main' },
  { ref: 'origin/main', label: 'merge-base with origin/main (no local main ref)' },
  { ref: 'HEAD~', label: 'HEAD~ (no main ref reachable — shallow checkout)' },
];

const scopeBase = () => {
  for (const { ref, label } of SCOPE_BASES) {
    const base = gitOrNull(['merge-base', 'HEAD', ref]);
    if (base) return { base, label };
  }
  return {
    base: null,
    label: 'none — sweeping every markdown file under docs/ and the repo root',
  };
};

/** The widest rung: every tracked-or-untracked markdown file under `docs/` or at the repo root. */
const wholeTree = () => {
  const listed = [
    gitOrNull(['ls-files', '--', 'docs', '*.md']) ?? '',
    gitOrNull(['ls-files', '--others', '--exclude-standard', '--', 'docs', '*.md']) ??
      '',
  ]
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(listed)].sort();
};

const branchFiles = () => {
  const { base, label } = scopeBase();
  if (base === null) return { files: wholeTree(), label };
  const seen = [
    git(['diff', '--name-only', `${base}..HEAD`]),
    git(['diff', '--name-only', 'HEAD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ]
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const files = [...new Set(seen)].sort();
  // A base that IS `HEAD` — a clean checkout of the push branch, which is what `push: [main]` gives
  // this workflow — yields an empty diff. That is not a broken derivation, it is a branch with
  // nothing on it, so it falls to the widest rung instead of refusing to pass (R18-F1, second path).
  if (files.length < 2)
    return {
      files: wholeTree(),
      label: `${label}, empty diff — widened to docs/ and the repo root`,
    };
  return { files, label };
};

const scopeFrom = (all) => {
  const skipped = [];
  const swept = [];
  for (const file of all) {
    const excluded = DECLARED_SCOPE.exclusions.find((rule) => rule.applies(file));
    if (excluded) skipped.push({ file, reason: excluded.reason });
    else swept.push(file);
  }
  return { swept, skipped };
};

let all;
let scopeLabel;
try {
  const derived = branchFiles();
  all = derived.files;
  scopeLabel = derived.label;
} catch (err) {
  console.error(`the scope could not be derived from the branch: ${err.message}`);
  console.error(
    'this check is scoped by `git`, not by a file list, so it cannot run without it.',
  );
  process.exit(1);
}
// Every rung above returns a real scope, so reaching zero here means the derivation itself is
// broken — not a git ref missing and not an empty diff. Kept as the floor it was always meant to be.
if (all.length < 2) {
  console.error(
    `the derived scope is ${all.length} file(s) — that cannot be right; refusing to pass`,
  );
  process.exit(1);
}

// `declared` is the scope the RULE yields. `ARTEFACTS` is the set the sweep below actually
// iterates. They are separate bindings on purpose: the previous version compared two calls of the
// same function to each other and could not differ, so replacing the sweep's set with an enumerated
// list — the exact structure round 16 had and R17-F4 punished — exited 0 (review round 18, R18-F4).
const declaredScope = scopeFrom(all);
const declared = declaredScope.swept;
const ARTEFACTS = declared;

// The D4 mechanical check, at the POINT OF USE: whatever the sweep iterates must be what the rule
// declares. This is the direction that matters — the sweep reading LESS than the rule.
const missing = declared.filter((file) => !ARTEFACTS.includes(file));
const extra = ARTEFACTS.filter((file) => !declared.includes(file));
if (missing.length > 0) {
  const sample = missing.slice(0, 3).join(', ');
  fail(
    `scope: the sweep iterates ${ARTEFACTS.length} file(s) where the declared scope has ${declared.length} — a hand-narrowed sweep at the point of use is exactly the narrowing R17-F4 exposed; the ${missing.length} missing include ${sample}`,
  );
}
for (const file of extra) {
  fail(`scope: the sweep read ${file}, which the declared scope does not cover`);
}
for (const rule of DECLARED_SCOPE.exclusions.concat(
  DECLARED_SCOPE.coverageExclusions,
)) {
  if (!rule.reason || rule.reason.trim().length === 0) {
    fail(
      'scope: an exclusion carries no reason — D4 requires every exclusion to be named with one',
    );
  }
}

/* ------------------------------------------------------------------ the shipped arithmetic */

const DENSITIES = ['compact', 'comfortable', 'relaxed'];
const TOKEN_FIELD = {
  'row-h': 'rowHeight',
  'file-row-h': 'fileRowHeight',
  'panel-head-h': 'panelHeadHeight',
};
const DEFAULT_FONT = 13;
const DEFAULT_FILE_COUNT = 30;

/**
 * `lineH` and `headerFixedH` are measured off the rendered header, not shipped tokens, so they are
 * stand-ins here exactly as they are in the spec fixtures. Neither reaches `headerMaxH`, which is
 * what every `share` and `cap` marker is about.
 */
const tokensFor = (density, font) => {
  const m = computeMetrics({ uiFontSize: font, monoFontSize: font, density });
  return {
    fileRowH: m.fileRowHeight,
    panelHeadH: m.panelHeadHeight,
    lineH: 18,
    headerFixedH: 112,
  };
};

const capFor = (density, font, remainder, collapsed, fileCount) =>
  computeInspectorLayout({
    availableHeight: remainder,
    fileCount,
    bodyLines: 12,
    headerCollapsed: collapsed,
    fileListCollapsed: false,
    stackedPanelsHeight: 0,
    tokens: tokensFor(density, font),
  }).headerMaxH;

/** The share spec §6 defines: the height the header may not cross, over the remainder. */
const shareFor = (density, font, remainder, collapsed, fileCount) =>
  (remainder - capFor(density, font, remainder, collapsed, fileCount)) / remainder;

const close = (a, b) => Math.abs(a - b) < 5e-6;

/** Reads a shipped constant out of the policy source rather than restating its value here. */
const policySource = readFileSync(POLICY_SOURCE, 'utf8');
const policyConstant = (name) => {
  const m = policySource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  if (!m) {
    fail(
      `${POLICY_SOURCE}: the constant ${name} is gone — this check reads it rather than restating it`,
    );
    return null;
  }
  return Number(m[1]);
};

/**
 * The app's SHIPPED default for a preference, read out of the schema source. Same rule as
 * `policyConstant` and for the same reason — and by source text rather than by `import`, because
 * `preferences-schema.ts` imports `./color-palettes` with no extension, which Node's ESM resolver
 * cannot follow. It matters for the density-token table: the app ships `monoFontSize: 12`, so
 * generating that table at 13 would print a code line of 22 where the app renders 20.
 */
const schemaSource = readFileSync(SCHEMA_SOURCE, 'utf8');
const schemaDefault = (name) => {
  const m = schemaSource.match(new RegExp(`^\\s*${name}:\\s*([0-9.]+),`, 'm'));
  if (!m) {
    fail(
      `${SCHEMA_SOURCE}: the default ${name} is gone — this check reads it rather than restating it`,
    );
    return null;
  }
  return Number(m[1]);
};
const SHIPPED_UI_FONT = schemaDefault('uiFontSize');
const SHIPPED_MONO_FONT = schemaDefault('monoFontSize');

/* ------------------------------------------------------------------ the sweep loops (R17-F7) */

/**
 * The two sweeps are identified by their `it()` titles and their configuration count is the PRODUCT
 * OF THE DIMENSIONS FOUND IN THE FILE — every nested `for (const x of y)` inside the block, with `y`
 * resolved to an inline array literal or to a `const` array in the same file. Nothing about the
 * loops' shape is written here: removing a dimension or adding one changes the product, which is the
 * defect R17-F7 named (the old code hardcoded `× 2` and `× 4` and the zero-file subset's
 * independence from `fileCounts`).
 */
const SWEEP_LOOPS = {
  share: 'keeps the list at or over its share',
  cap: 'reports a whole-pixel cap never under one panel head',
};
const FILE_COUNT_VARIABLE = 'fileCount';

const loopBlock = (src, anchor) => {
  const at = src.indexOf(anchor);
  if (at < 0) return null;
  // Slice from the `it(` that OWNS the title, not from the title text: the anchor sits inside a
  // string literal, so starting there puts the block's first quote character on the title's CLOSING
  // quote and offsets every quote pair after it by one. That made `blankJs` blank the wrong spans
  // and leave a `for (const … of …)` written inside a string exposed as a real dimension
  // (review round 18, O1 — found by the control mutation, not by the two it was written for).
  const start = src.lastIndexOf('it(', at);
  const from = start < 0 ? at : start;
  const rest = src.slice(from);
  const next = rest.slice(1).search(/\n\s*it\(/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

const iterableEntries = (src, expr) => {
  const text = expr.trim();
  if (text.startsWith('[')) {
    const inner = text.slice(1, text.lastIndexOf(']'));
    return inner
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const m = src.match(new RegExp(`const ${text} = \\[([^\\]]*)\\]`));
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

/**
 * Comments and string literals blanked, so a loop header that is only being TALKED about is not
 * counted as a dimension. Without this a commented-out `for (const … of …)` — what a maintainer
 * writes to bisect a failing row — reported 864 configurations for a loop that runs 288 and failed
 * CI, and the repair the message suggests (`pnpm figures:write`) would have baked the phantom
 * dimension into the generated table (review round 18, O1). Width is preserved so the `for…of`
 * offsets still line up with the source.
 */
const blankJs = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => ' '.repeat(m.length));

const loopShape = (src, key) => {
  const raw = loopBlock(src, SWEEP_LOOPS[key]);
  if (raw === null) return { error: `no test titled «${SWEEP_LOOPS[key]}…»` };
  const block = blankJs(raw);
  const cStyle = block.match(/for \(let [^)]*;[^)]*\)/);
  if (cStyle) {
    return {
      error: `the ${key} loop contains a counting loop this check cannot size: ${cStyle[0]}`,
    };
  }
  const dims = [];
  for (const m of block.matchAll(/for \(const (\w+) of ([^)]+)\)/g)) {
    const entries = iterableEntries(src, m[2]);
    if (entries === null)
      return {
        error: `the ${key} loop walks ${m[2].trim()}, which is not an array in that file`,
      };
    dims.push({ variable: m[1], entries });
  }
  if (dims.length === 0)
    return { error: `the ${key} loop has no \`for (const … of …)\` dimension` };
  return { dims, configurations: dims.reduce((n, d) => n * d.entries.length, 1) };
};

/** The zero-file subset of a loop: the same product with the `fileCount` dimension cut to its zeros. */
const zeroFileSubset = (shape) => {
  if (shape.error) return shape;
  const dim = shape.dims.find((d) => d.variable === FILE_COUNT_VARIABLE);
  if (!dim)
    return {
      error: `the share loop has no \`${FILE_COUNT_VARIABLE}\` dimension to take the zero subset of`,
    };
  const zeros = dim.entries.filter((e) => Number(e) === 0).length;
  return { configurations: (shape.configurations / dim.entries.length) * zeros };
};

const sweepCounts = (specPath) => {
  const src = readFileSync(specPath, 'utf8');
  const share = loopShape(src, 'share');
  const cap = loopShape(src, 'cap');
  return { share, cap, zerofile: zeroFileSubset(share) };
};

/* ------------------------------------------------------------------ marker parsing */

const MARKER = /<!-- figure:\s*(\S+)\s+([^>]*?)-->/g;
// Marker-SHAPED text: whatever the strict parser above must have matched. A line where the loose
// count exceeds the strict count is a lost check, which used to be a silent pass (R17-F6).
//
// It requires the colon, or the word `figure` followed by one of the four kind names, so it still
// catches `<!--figure:`, `<!-- Figure:` and a colon typed as `<!-- figure share …`. Without that
// anchor it matched any comment merely STARTING with the word — a dated marker opening «figures
// replaced by their forms» failed the gate for talking about markers rather than being one, which
// is a false failure in the one direction this check must never produce (review round 18, T73).
const LOOSE_MARKER = /<!--\s*figure\s*(?::|s?\s+(?:share|cap|token|sweep-counts)\b)/gi;

const SCHEMA = {
  share: {
    required: ['density', 'font', 'remainder', 'collapsed', 'expect'],
    optional: ['fileCount'],
  },
  cap: {
    required: ['remainder', 'collapsed', 'fileCount', 'expect'],
    optional: ['font'],
  },
  token: { required: ['font', 'metric', 'expect'], optional: [] },
  'sweep-counts': { required: ['spec', 'expect'], optional: [] },
};

const parseArgs = (at, kind, raw) => {
  const schema = SCHEMA[kind];
  const args = {};
  for (const token of raw.trim().split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq < 1) {
      fail(`${at}  ${kind}: «${token}» is not a key=value argument`);
      return null;
    }
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    if (key in args) {
      fail(
        `${at}  ${kind}: the argument ${key} is given twice — a marker must not be ambiguous`,
      );
      return null;
    }
    if (!schema.required.includes(key) && !schema.optional.includes(key)) {
      fail(
        `${at}  ${kind}: unknown argument ${key}= — the kind uses ${schema.required.concat(schema.optional).join(', ')}`,
      );
      return null;
    }
    args[key] = value;
  }
  for (const key of schema.required) {
    if (!(key in args)) {
      fail(`${at}  ${kind}: the argument ${key}= is missing`);
      return null;
    }
  }
  return args;
};

const numberArg = (at, kind, key, value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    fail(`${at}  ${kind}: ${key}=${value} is not a number`);
    return null;
  }
  return n;
};

const boolArg = (at, kind, key, value) => {
  if (value !== 'true' && value !== 'false') {
    fail(`${at}  ${kind}: ${key}=${value} must be true or false`);
    return null;
  }
  return value === 'true';
};

/** `expect=compact:26,comfortable:34,relaxed:43` — every key named, none unknown, none repeated. */
const namedExpect = (at, kind, raw, keys) => {
  const out = {};
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split(':');
    if (!keys.includes(key)) {
      fail(
        `${at}  ${kind}: expect= carries an unknown key ${key} (expected ${keys.join(', ')})`,
      );
      return null;
    }
    if (key in out) {
      fail(`${at}  ${kind}: expect= gives ${key} twice`);
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      fail(`${at}  ${kind}: expect= gives ${key}=${value}, which is not a number`);
      return null;
    }
    out[key] = n;
  }
  for (const key of keys) {
    if (!(key in out)) {
      fail(`${at}  ${kind}: expect= has no expectation for ${key}`);
      return null;
    }
  }
  return out;
};

/** Blanks fenced blocks and inline code spans, preserving every line's length and count. */
const blankCode = (text) => {
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return ' '.repeat(line.length);
      }
      if (fenced) return ' '.repeat(line.length);
      return line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    })
    .join('\n');
};

/** Blanks HTML comments — including multi-line ones — so the coverage heuristic reads prose only. */
const blankComments = (text) =>
  text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

// A figure the heuristic can see: a share-shaped decimal, or an `a / b` pixel pair. See limit 3.
const FIGURE = /0\.\d{3,6}|\b(?:2\d|3\d|4\d)\s*(?:px)?\s*\/\s*(?:2\d|3\d|4\d)\b/g;

let comparisons = 0;
let defaultedFileCount = 0;
let defaultedFont = 0;
const claims = new Set();
const inventory = [];
let figuresSeen = 0;
let unbound = 0;
const unboundWhere = [];

for (const file of ARTEFACTS) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    fail(`${file}: cannot be read`);
    continue;
  }
  const scanned = blankCode(text);
  const prose = blankComments(scanned);
  const lines = scanned.split('\n');
  const proseLines = prose.split('\n');
  let markersHere = 0;

  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    const found = [...line.matchAll(MARKER)];
    const loose = [...line.matchAll(LOOSE_MARKER)].length;
    if (loose > found.length) {
      fail(
        `${at}  ${loose - found.length} marker-shaped comment(s) the parser did not match — a mis-typed prefix or a marker reflowed across lines drops its check`,
      );
    }
    markersHere += found.length;

    for (const m of found) {
      const kind = m[1];
      if (!(kind in SCHEMA)) {
        fail(`${at}  unknown figure kind: ${kind}`);
        continue;
      }
      const args = parseArgs(at, kind, m[2]);
      if (!args) continue;
      claims.add(
        `${kind} ${Object.keys(args)
          .sort()
          .map((k) => `${k}=${args[k]}`)
          .join(' ')}`,
      );
      try {
        if (kind === 'share') {
          if (!DENSITIES.includes(args.density)) {
            fail(`${at}  share: density=${args.density} is not a shipped density`);
            continue;
          }
          const font = numberArg(at, kind, 'font', args.font);
          const remainder = numberArg(at, kind, 'remainder', args.remainder);
          const collapsed = boolArg(at, kind, 'collapsed', args.collapsed);
          const expect = numberArg(at, kind, 'expect', args.expect);
          if (
            font === null ||
            remainder === null ||
            collapsed === null ||
            expect === null
          )
            continue;
          let fileCount = DEFAULT_FILE_COUNT;
          if ('fileCount' in args) {
            fileCount = numberArg(at, kind, 'fileCount', args.fileCount);
            if (fileCount === null) continue;
          } else defaultedFileCount += 1;
          const got = shareFor(args.density, font, remainder, collapsed, fileCount);
          comparisons += 1;
          if (!close(got, expect)) {
            fail(
              `${at}  share ${args.density}/${font} r=${remainder} collapsed=${args.collapsed} files=${fileCount}: artefact says ${args.expect}, computed ${got.toFixed(6)}`,
            );
          }
        } else if (kind === 'cap') {
          const remainder = numberArg(at, kind, 'remainder', args.remainder);
          const collapsed = boolArg(at, kind, 'collapsed', args.collapsed);
          const fileCount = numberArg(at, kind, 'fileCount', args.fileCount);
          const want = namedExpect(at, kind, args.expect, DENSITIES);
          if (
            remainder === null ||
            collapsed === null ||
            fileCount === null ||
            want === null
          )
            continue;
          let font = DEFAULT_FONT;
          if ('font' in args) {
            font = numberArg(at, kind, 'font', args.font);
            if (font === null) continue;
          } else defaultedFont += 1;
          for (const d of DENSITIES) {
            const got = capFor(d, font, remainder, collapsed, fileCount);
            comparisons += 1;
            if (got !== want[d]) {
              fail(
                `${at}  cap ${d}/${font} r=${remainder} collapsed=${args.collapsed} files=${fileCount}: artefact says ${want[d]}, computed ${got}`,
              );
            }
          }
        } else if (kind === 'token') {
          const field = TOKEN_FIELD[args.metric];
          if (!field) {
            fail(`${at}  token: unknown metric ${args.metric}`);
            continue;
          }
          const font = numberArg(at, kind, 'font', args.font);
          const want = namedExpect(at, kind, args.expect, DENSITIES);
          if (font === null || want === null) continue;
          for (const d of DENSITIES) {
            const got = computeMetrics({
              uiFontSize: font,
              monoFontSize: font,
              density: d,
            })[field];
            comparisons += 1;
            if (got !== want[d]) {
              fail(
                `${at}  token ${args.metric} ${d}/${font}: artefact says ${want[d]}, computed ${got}`,
              );
            }
          }
        } else if (kind === 'sweep-counts') {
          const keys = ['share', 'cap', 'zerofile'];
          const want = namedExpect(at, kind, args.expect, keys);
          if (want === null) continue;
          const counts = sweepCounts(args.spec);
          for (const k of keys) {
            if (counts[k].error) {
              fail(`${at}  sweep-counts ${k}: ${counts[k].error} (${args.spec})`);
              continue;
            }
            comparisons += 1;
            if (counts[k].configurations !== want[k]) {
              const shape = counts[k].dims
                ? counts[k].dims
                    .map((d) => `${d.variable} ${d.entries.length}`)
                    .join(' x ')
                : 'the zero-file subset of the share loop';
              fail(
                `${at}  sweep-counts ${k}: artefact says ${want[k]}, the loop in ${args.spec} runs ${counts[k].configurations} (${shape})`,
              );
            }
          }
        }
      } catch (err) {
        fail(`${at}  ${kind}: ${err.message}`);
      }
    }

    // Coverage, counted as OCCURRENCES on both sides (R17-F8): a line with one marker and eight
    // visible figures reports seven unbound, where the old line-level exemption reported zero.
    if (DECLARED_SCOPE.coverageExclusions.some((rule) => rule.applies(file))) return;
    const figures = [...proseLines[i].matchAll(FIGURE)].length;
    figuresSeen += figures;
    const over = Math.max(0, figures - found.length);
    if (over > 0) {
      unbound += over;
      unboundWhere.push(`${at} (${figures} figure(s), ${found.length} marker(s))`);
    }
  });

  if (markersHere > 0) inventory.push({ file, markers: markersHere });
}

const markers = inventory.reduce((n, entry) => n + entry.markers, 0);

/* ------------------------------------------------------------------ the reference table (D3) */

const share6 = (n) => n.toFixed(6);
const REFERENCE_REMAINDERS = [110, 200, 420];

const carveOutTop = (density, collapsed, floor) => {
  let top = null;
  for (let r = 20; r <= 2000; r += 1) {
    if (
      shareFor(density, DEFAULT_FONT, r, collapsed, DEFAULT_FILE_COUNT) <
      floor - 5e-6
    )
      top = r;
  }
  return top;
};

const referenceTable = () => {
  const expandedFloor = policyConstant('LIST_SHARE_FLOOR');
  const collapsedFloor = policyConstant('COLLAPSED_LIST_SHARE_FLOOR');
  const counts = sweepCounts(SWEEP_SOURCE);
  const out = [];
  out.push('<!-- GENERATED FILE — do not edit by hand. Run `pnpm figures:write`. -->');
  out.push('');
  out.push('# Reference figures — inspector-diff-workspace');
  out.push('');
  out.push(
    'Generated from `computeMetrics` and `computeInspectorLayout` by `scripts/check-figures.mjs`, and',
  );
  out.push(
    'byte-compared on every `pnpm check:figures`: a stale copy fails the gate. Owner decision **D3**',
  );
  out.push(
    '(2026-09-10, review round 17) makes this the single home of concrete reference figures — no live',
  );
  out.push(
    'artefact writes a figure derived from the code; prose carries the closed form instead.',
  );
  out.push('');
  out.push(
    `The density-token table is at the SHIPPED defaults read out of \`preferences-schema.ts\` — \`uiFontSize\` ${SHIPPED_UI_FONT} px, \`monoFontSize\` ${SHIPPED_MONO_FONT} px. Everything below it is at \`uiFontSize\` = \`monoFontSize\` = ${DEFAULT_FONT} px (the marker schema's \`font=\` default; \`monoFontSize\` never reaches \`headerMaxH\`) with ${DEFAULT_FILE_COUNT} files, no stacked`,
  );
  out.push('panels and a 12-line body, unless the row says otherwise.');
  out.push('');
  // Every `computeMetrics` output, not only the three the layout policy reads: `DESIGN.md`'s
  // §Density table used to carry these as literals and eight of its nine compact cells were false
  // (review round 18, R18-F3). It now points here, so this table has to answer for all of them.
  out.push('## Density tokens — every value `computeMetrics` produces');
  out.push('');
  const TOKEN_ROWS = [
    ['`--row-h`', 'rowHeight'],
    ['`--file-row-h`', 'fileRowHeight'],
    ['`--ref-row-h`', 'refRowHeight'],
    ['history row', 'historyRowHeight'],
    ['code line', 'codeLineHeight'],
    ['`--panel-head-h`', 'panelHeadHeight'],
    ['`--titlebar-h`', 'titlebarHeight'],
    ['`--toolbar-h`', 'toolbarHeight'],
    ['`--rail-w`', 'railWidth'],
    ['`--statusbar-h`', 'statusbarHeight'],
    ['`--panel-pad`', 'panelPad'],
  ];
  // The SHIPPED defaults, read out of the schema, not `DEFAULT_FONT`. `DEFAULT_FONT` is the marker
  // schema's `font=` default and is 13 for both sizes, which is harmless for `headerMaxH` (mono
  // never reaches it) but wrong the moment this table carries `codeLineHeight`: the app ships
  // `monoFontSize: 12`, so mono 13 would print a code line of 22 where the app renders 20 — a figure
  // derived from the code that the code does not produce, inside the one artefact D3 makes the home
  // of such figures (review round 18, T73).
  const metrics = Object.fromEntries(
    DENSITIES.map((d) => [
      d,
      computeMetrics({
        uiFontSize: SHIPPED_UI_FONT,
        monoFontSize: SHIPPED_MONO_FONT,
        density: d,
      }),
    ]),
  );
  out.push(`| token | ${DENSITIES.join(' | ')} |`);
  out.push(`| --- | ${DENSITIES.map(() => '---').join(' | ')} |`);
  for (const [label, field] of TOKEN_ROWS) {
    out.push(`| ${label} | ${DENSITIES.map((d) => metrics[d][field]).join(' | ')} |`);
  }
  out.push('');
  out.push(
    '`code line` ignores density by design — its spacing *is* the code line height, and padding it on',
  );
  out.push('the density axis would slide the line numbers off the lines they number.');
  out.push('');
  out.push('## Header cap and list share, at the remainders the criteria measure');
  out.push('');
  out.push('| remainder | header | density | `headerMaxH` | list share |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const remainder of REFERENCE_REMAINDERS) {
    for (const collapsed of [false, true]) {
      for (const d of DENSITIES) {
        const cap = capFor(d, DEFAULT_FONT, remainder, collapsed, DEFAULT_FILE_COUNT);
        const share = shareFor(
          d,
          DEFAULT_FONT,
          remainder,
          collapsed,
          DEFAULT_FILE_COUNT,
        );
        out.push(
          `| ${remainder} | ${collapsed ? 'collapsed' : 'expanded'} | ${d} | ${cap} | ${share6(share)} |`,
        );
      }
    }
  }
  out.push('');
  out.push('## The header-cap carve-out, measured');
  out.push('');
  out.push(
    `The largest integer remainder at which the list share falls under the floor the spec guarantees`,
  );
  out.push(
    `(${expandedFloor} expanded, ${collapsedFloor} collapsed — both read out of \`${POLICY_SOURCE}\`), scanned over`,
  );
  out.push(
    '20…2000 px. Above it the ratio holds; at or below it the guard has lifted the cap.',
  );
  out.push('');
  out.push('| density | header | top of the band |');
  out.push('| --- | --- | --- |');
  for (const d of DENSITIES) {
    for (const collapsed of [false, true]) {
      const floor = collapsed ? collapsedFloor : expandedFloor;
      const top = floor === null ? null : carveOutTop(d, collapsed, floor);
      out.push(
        `| ${d} | ${collapsed ? 'collapsed' : 'expanded'} | ${top ?? 'never binds'} |`,
      );
    }
  }
  out.push('');
  out.push('## Sweep configuration counts');
  out.push('');
  out.push(
    `Read out of \`${SWEEP_SOURCE}\`: the product of the dimensions each loop walks.`,
  );
  out.push('');
  out.push('| loop | dimensions | configurations |');
  out.push('| --- | --- | --- |');
  for (const key of ['share', 'cap']) {
    const shape = counts[key];
    if (shape.error) {
      out.push(`| ${key} | — | ${shape.error} |`);
      continue;
    }
    out.push(
      `| ${key} | ${shape.dims.map((d) => `${d.variable} ${d.entries.length}`).join(' × ')} | ${shape.configurations} |`,
    );
  }
  out.push(
    `| share, \`${FILE_COUNT_VARIABLE}\` = 0 | the share loop's zero-file subset | ${counts.zerofile.error ?? counts.zerofile.configurations} |`,
  );
  out.push('');
  out.push('## Marker inventory');
  out.push('');
  out.push(
    'Pinned so that a DELETED marker is loud: the gate recounts the markers it finds and fails when',
  );
  out.push(
    'the inventory differs, so removing a check takes a deliberate `pnpm figures:write` that shows up',
  );
  out.push('in the diff (R17-F6).');
  out.push('');
  out.push('| file | markers |');
  out.push('| --- | --- |');
  for (const entry of inventory) out.push(`| \`${entry.file}\` | ${entry.markers} |`);
  out.push(`| **total** | **${markers}** |`);
  out.push('');
  return out.join('\n');
};

const generated = referenceTable();

if (WRITE) {
  writeFileSync(REFERENCE_TABLE, generated, 'utf8');
  console.log(
    `wrote ${REFERENCE_TABLE} — ${markers} markers, ${comparisons} values recomputed`,
  );
  process.exit(0);
}

let checkedIn = null;
try {
  checkedIn = readFileSync(REFERENCE_TABLE, 'utf8').replace(/\r\n/g, '\n');
} catch {
  fail(
    `${REFERENCE_TABLE}: the generated reference table is missing — run \`pnpm figures:write\``,
  );
}
if (checkedIn !== null && checkedIn !== generated) {
  // Name the first divergent line, and name the inventory and count divergences outright, because
  // «the file is stale» is the message that sends a reader back to a diff for no reason.
  const mine = generated.split('\n');
  const theirs = checkedIn.split('\n');
  const pinned = new Map();
  for (const m of checkedIn.matchAll(/^\| `([^`]+)` \| (\d+) \|$/gm))
    pinned.set(m[1], Number(m[2]));
  for (const entry of inventory) {
    if (!pinned.has(entry.file)) {
      fail(
        `${REFERENCE_TABLE}: ${entry.file} carries ${entry.markers} marker(s) and is not in the pinned inventory`,
      );
    } else if (pinned.get(entry.file) !== entry.markers) {
      fail(
        `${REFERENCE_TABLE}: ${entry.file} carries ${entry.markers} marker(s), the pinned inventory says ${pinned.get(entry.file)} — a check was added or lost`,
      );
    }
  }
  for (const [file, count] of pinned) {
    if (!inventory.some((entry) => entry.file === file)) {
      fail(
        `${REFERENCE_TABLE}: the pinned inventory expects ${count} marker(s) in ${file} and the sweep found none — a check was deleted`,
      );
    }
  }
  const firstDiff = mine.findIndex((line, i) => line !== theirs[i]);
  fail(
    `${REFERENCE_TABLE}:${firstDiff + 1} is stale against a fresh generation — expected «${mine[firstDiff]}», found «${theirs[firstDiff] ?? '(end of file)'}»; run \`pnpm figures:write\``,
  );
}

/* ------------------------------------------------------------------ report */

console.log(`scope base: ${scopeLabel}`);
console.log(
  `scope: ${ARTEFACTS.length} markdown file(s) derived from the branch — ${DECLARED_SCOPE.rule}`,
);
for (const rule of DECLARED_SCOPE.exclusions) {
  const hit = all.filter((file) => rule.applies(file)).length;
  if (hit > 0) console.log(`  − ${hit} excluded: ${rule.reason}`);
}
console.log(
  `figures: ${markers} markers in ${inventory.length} file(s), ${claims.size} distinct claims, ${comparisons} values recomputed`,
);
if (defaultedFileCount > 0 || defaultedFont > 0) {
  console.log(
    `  defaults applied: ${defaultedFileCount} share marker(s) checked at ${DEFAULT_FILE_COUNT} files, ${defaultedFont} cap marker(s) at ${DEFAULT_FONT} px`,
  );
}
console.log(
  `coverage: ${figuresSeen} figure(s) the heuristic can see in live prose, ${unbound} of them on a line carrying fewer markers than figures`,
);
if (unbound > 0) console.log(`  unbound at: ${unboundWhere.join(', ')}`);
console.log(
  '  this is a LINE-level bound, not a binding: nothing ties a marker to the figure beside it (spec §8),',
);
console.log(
  '  and the heuristic sees only a 0.ddd-0.dddddd decimal or a 20-49 px a/b pair — not 68/60, 192/384/32,',
);
console.log(
  '  288, «cap 50», «43 + 2 x 37 = 117», a bare «34 px», a percentage or a count in words.',
);
for (const rule of DECLARED_SCOPE.coverageExclusions) {
  const hit = ARTEFACTS.filter((file) => rule.applies(file)).length;
  if (hit > 0)
    console.log(`  − ${hit} file(s) outside the coverage count: ${rule.reason}`);
}
for (const entry of declaredScope.skipped.filter((s) => s.file.endsWith('.md'))) {
  console.log(`  − not swept: ${entry.file} — ${entry.reason}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} figure check(s) failed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error('\nFix the artefact, or the code, but do not leave them disagreeing.');
  process.exit(1);
}
console.log(
  'OK — every marked figure matches the shipped modules, and no check went missing.',
);
