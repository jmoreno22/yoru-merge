import { describe, expect, it } from 'vitest';
import type { DiffLine } from './diff-parse';
import {
  collapseContext,
  ignoreWhitespace,
  splitRowChanged,
  toSplitRows,
  UNLIMITED_CONTEXT,
  unifiedRowChanged,
} from './diff-view-model';

let body = 0;

function line(
  kind: DiffLine['kind'],
  text: string,
  oldNumber: number | null = 1,
  newNumber: number | null = 1,
): DiffLine {
  return { kind, bodyIndex: body++, oldNumber, newNumber, text, noNewline: false };
}

function reset(): void {
  body = 0;
}

describe('ignoreWhitespace', () => {
  it('demotes a re-indent to a context line', () => {
    reset();
    const lines = [
      line('context', 'const a = 1;', 1, 1),
      line('delete', 'return a;', 2, null),
      line('insert', '  return a;', null, 2),
    ];
    const out = ignoreWhitespace(lines);
    expect(out.map((l) => l.kind)).toEqual(['context', 'context']);
    expect(out[1]?.text).toBe('  return a;');
    expect(out[1]?.oldNumber).toBe(2);
    expect(out[1]?.newNumber).toBe(2);
  });

  it('keeps a change that is not only whitespace', () => {
    reset();
    const lines = [
      line('delete', 'const a = 1;', 1, null),
      line('insert', 'const a = 2;', null, 1),
    ];
    expect(ignoreWhitespace(lines).map((l) => l.kind)).toEqual(['delete', 'insert']);
  });

  it('pairs a run in order and keeps the survivors', () => {
    reset();
    const lines = [
      line('delete', 'a', 1, null),
      line('delete', 'b', 2, null),
      line('insert', '  a', null, 1),
      line('insert', 'B', null, 2),
    ];
    const out = ignoreWhitespace(lines);
    expect(out.map((l) => [l.kind, l.text])).toEqual([
      ['context', '  a'],
      ['delete', 'b'],
      ['insert', 'B'],
    ]);
  });

  it('leaves unpaired removals alone', () => {
    reset();
    const lines = [line('delete', 'a', 1, null), line('delete', 'b', 2, null)];
    expect(ignoreWhitespace(lines)).toHaveLength(2);
  });

  it('treats a line-ending change as whitespace only', () => {
    reset();
    const lines = [
      line('delete', 'value\r', 1, null),
      line('insert', 'value', null, 1),
    ];
    expect(ignoreWhitespace(lines).map((l) => l.kind)).toEqual(['context']);
  });
});

describe('toSplitRows', () => {
  it('puts a context line on both sides', () => {
    reset();
    expect(toSplitRows([line('context', 'a', 3, 3)])).toEqual([
      { left: expect.objectContaining({ text: 'a' }), right: expect.anything() },
    ]);
  });

  it('faces a removal with its replacement', () => {
    reset();
    const rows = toSplitRows([
      line('delete', 'old', 1, null),
      line('insert', 'new', null, 1),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.left?.text).toBe('old');
    expect(rows[0]?.right?.text).toBe('new');
  });

  it('pads the shorter side of an uneven run', () => {
    reset();
    const rows = toSplitRows([
      line('delete', 'a', 1, null),
      line('insert', 'A', null, 1),
      line('insert', 'B', null, 2),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.left).toBeNull();
    expect(rows[1]?.right?.text).toBe('B');
  });

  it('marks a row as changed when either side changed', () => {
    reset();
    expect(splitRowChanged({ left: line('delete', 'a'), right: null })).toBe(true);
    const context = line('context', 'a');
    expect(splitRowChanged({ left: context, right: context })).toBe(false);
  });
});

describe('collapseContext', () => {
  const rows = (kinds: readonly DiffLine['kind'][]) => {
    reset();
    return kinds.map((kind) => ({ line: line(kind, kind) }));
  };

  it('keeps every row when the budget is unlimited', () => {
    const input = rows(['context', 'context', 'insert', 'context']);
    const out = collapseContext(input, unifiedRowChanged, UNLIMITED_CONTEXT);
    expect(out.every((row) => row.kind === 'row')).toBe(true);
    expect(out).toHaveLength(4);
  });

  it('hides a long run between two changes', () => {
    const input = rows([
      'insert',
      'context',
      'context',
      'context',
      'context',
      'context',
      'context',
      'delete',
    ]);
    const out = collapseContext(input, unifiedRowChanged, 2);
    expect(out.map((row) => row.kind)).toEqual([
      'row',
      'row',
      'row',
      'gap',
      'row',
      'row',
      'row',
    ]);
    const gap = out[3];
    expect(gap?.kind === 'gap' && gap.count).toBe(2);
  });

  it('spends only one side of the budget on a leading run', () => {
    const input = rows(['context', 'context', 'context', 'context', 'insert']);
    const out = collapseContext(input, unifiedRowChanged, 1);
    expect(out.map((row) => row.kind)).toEqual(['gap', 'row', 'row']);
    const gap = out[0];
    expect(gap?.kind === 'gap' && gap.count).toBe(3);
  });

  it('leaves a run that already fits the budget', () => {
    const input = rows(['insert', 'context', 'context', 'delete']);
    const out = collapseContext(input, unifiedRowChanged, 3);
    expect(out.every((row) => row.kind === 'row')).toBe(true);
  });

  it('hides every unchanged row at a budget of zero', () => {
    const input = rows(['context', 'insert', 'context']);
    const out = collapseContext(input, unifiedRowChanged, 0);
    expect(out.map((row) => row.kind)).toEqual(['gap', 'row', 'gap']);
  });

  it('carries the hidden rows so a gap can be expanded', () => {
    const input = rows(['insert', 'context', 'context', 'context', 'delete']);
    const out = collapseContext(input, unifiedRowChanged, 0);
    const gap = out[1];
    expect(gap?.kind === 'gap' && gap.rows).toHaveLength(3);
  });
});
