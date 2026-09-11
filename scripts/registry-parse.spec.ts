import { describe, expect, it } from 'vitest';
import {
  graphBlock,
  graphEdges,
  graphNodes,
  listField,
  trackerRows,
  trackerTotal,
} from './registry-parse.mjs';

/**
 * The parsers `check-tasks.mjs` is built on. Every case here is a defect review
 * round 19 measured as a silent pass, or the control that proves the fix did not
 * trade one hole for another.
 */

const fm = (body: string) => `---\n${body}\n---\n\n# body\n`;

describe('listField', () => {
  it('reads an inline list', () => {
    expect(listField(fm('deps: ["T1", "T2"]'), 'deps')).toEqual({
      present: true,
      values: ['T1', 'T2'],
    });
  });

  it('reads an inline list spread over several lines', () => {
    expect(listField(fm('files_hint: [\n  "a.ts",\n  "b.ts"\n]'), 'files_hint')).toEqual({
      present: true,
      values: ['a.ts', 'b.ts'],
    });
  });

  it('reads an inline empty list as present', () => {
    expect(listField(fm('deps: []'), 'deps')).toEqual({ present: true, values: [] });
  });

  // R19-F4: the block-sequence layout is the one the docblock claimed to
  // tolerate, and it was skipped rather than parsed, so a disagreement written
  // this way passed.
  it('reads a block sequence', () => {
    expect(listField(fm('deps:\n  - T1\n  - T2'), 'deps')).toEqual({
      present: true,
      values: ['T1', 'T2'],
    });
  });

  it('reads a quoted block sequence', () => {
    expect(listField(fm('deps:\n  - "T1"'), 'deps')).toEqual({ present: true, values: ['T1'] });
  });

  it('stops a block sequence at the next field', () => {
    expect(listField(fm('deps:\n  - T1\nstatus: "done"'), 'deps')).toEqual({
      present: true,
      values: ['T1'],
    });
  });

  // The distinction that matters: removing the field was the silent way to make
  // a mismatch go away, because absent and agreed looked the same.
  it('reports an absent field as absent, not as empty', () => {
    expect(listField(fm('status: "done"'), 'deps')).toEqual({ present: false, values: [] });
  });

  it('does not confuse a field whose name is a suffix of another', () => {
    expect(listField(fm('extra_deps: ["T9"]\ndeps: ["T1"]'), 'deps')).toEqual({
      present: true,
      values: ['T1'],
    });
  });

  it('reads nothing from the body when there is no frontmatter', () => {
    expect(listField('# just a heading\n\ndeps: ["T1"]\n', 'deps')).toEqual({
      present: false,
      values: [],
    });
  });
});

describe('graphBlock', () => {
  const epic = (graph: string) => `# Epic\n\nprose\n\n## Task map\n\n\`\`\`mermaid\n${graph}\n\`\`\`\n`;

  it('extracts the fenced graph', () => {
    expect(graphBlock(epic('graph TD\n    T1[one]'))).toContain('T1[one]');
  });

  // R19-F3: `%%` is how mermaid comments a line out. Read raw, a commented edge
  // was still counted as drawn and the gate printed «all agree».
  it('drops commented lines', () => {
    const block = graphBlock(epic('graph TD\n    T1[one]\n    %% T1 --> T2\n    T2[two]'));
    expect(block).not.toContain('T1 --> T2');
    expect(block).toContain('T2[two]');
  });

  it('drops a commented line whatever its indentation', () => {
    expect(graphBlock(epic('graph TD\n%% T1 --> T2\n        %% T2 --> T3'))).not.toContain('-->');
  });

  // A second fenced block elsewhere in the file used to contribute to the answer.
  it('reads only the block under the Task map heading', () => {
    const file = `# Epic\n\n\`\`\`mermaid\ngraph TD\n    T9[stray]\n\`\`\`\n\n## Task map\n\n\`\`\`mermaid\ngraph TD\n    T1[one]\n\`\`\`\n`;
    const block = graphBlock(file);
    expect(block).toContain('T1[one]');
    expect(block).not.toContain('T9[stray]');
  });

  it('falls back to every block when there is no Task map heading', () => {
    expect(graphBlock('\`\`\`mermaid\ngraph TD\n    T1[one]\n\`\`\`\n')).toContain('T1[one]');
  });
});

describe('graphNodes and graphEdges', () => {
  it('reads declared nodes', () => {
    expect([...graphNodes('    T1[one]\n    T2[two]')]).toEqual(['T1', 'T2']);
  });

  it('does not read a node from an edge reference alone', () => {
    expect([...graphNodes('    T1 --> T2')]).toEqual([]);
  });

  it('tells an id from another with the same prefix', () => {
    const nodes = graphNodes('    T7[seven]\n    T70[seventy]');
    expect(nodes.has('T7')).toBe(true);
    expect(nodes.has('T70')).toBe(true);
  });

  it('reads drawn edges in their direction', () => {
    expect([...graphEdges('    T1 --> T2\n    T2-->T3')]).toEqual(['T1->T2', 'T2->T3']);
  });
});

describe('trackerRows and trackerTotal', () => {
  const tracker = (rows: string) => `| id |\n|---|\n${rows}\n\n**Total:** 3 tasks\n`;

  it('reads one id per row', () => {
    expect(trackerRows(tracker('| T1 | a |\n| T2 | b |'))).toEqual(['T1', 'T2']);
  });

  // The summary line printed its own row count beside a different total and
  // still said «all agree».
  it('keeps a duplicated row, so the caller can see it', () => {
    expect(trackerRows(tracker('| T1 | a |\n| T1 | a |'))).toEqual(['T1', 'T1']);
  });

  it('reads the stated total', () => {
    expect(trackerTotal(tracker('| T1 | a |'))).toBe(3);
  });

  it('reports a missing total as null rather than zero', () => {
    expect(trackerTotal('| T1 | a |\n')).toBeNull();
  });
});
