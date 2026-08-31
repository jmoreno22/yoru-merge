import { describe, expect, it } from 'vitest';
import { discardSummary } from './discard';

const NONE: ReadonlySet<string> = new Set();

describe('discardSummary', () => {
  it('reverts tracked files', () => {
    const summary = discardSummary(['a.ts', 'b.ts'], NONE);
    expect(summary.title).toBe('Discard changes?');
    expect(summary.body).toContain('2 files');
    expect(summary.body).toContain('reverted to the index');
    expect(summary.confirmLabel).toBe('Discard');
  });

  it('deletes untracked files and says so', () => {
    const summary = discardSummary(['new.ts'], new Set(['new.ts']));
    expect(summary.title).toBe('Delete file?');
    expect(summary.body).toContain('1 untracked file');
    expect(summary.body).toContain('deleted permanently');
    expect(summary.confirmLabel).toBe('Delete');
  });

  it('spells out both halves of a mixed selection', () => {
    const summary = discardSummary(['a.ts', 'new.ts'], new Set(['new.ts']));
    expect(summary.body).toContain('1 file');
    expect(summary.body).toContain('1 untracked file');
    expect(summary.confirmLabel).toBe('Discard and delete');
  });

  it('pluralises', () => {
    expect(discardSummary(['a.ts'], NONE).body).toContain('1 file');
    expect(discardSummary(['a.ts', 'b.ts'], NONE).body).toContain('2 files');
  });
});
