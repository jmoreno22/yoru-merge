import { describe, expect, it } from 'vitest';
import type { RebaseTodoEntry } from '../../core/models';
import {
  editsMessage,
  foldsIntoPrevious,
  moveTodoEntry,
  previewTodo,
  updateTodoEntry,
  validateTodo,
} from './rebase-todo';

const entry = (sha: string, action = 'pick', message = sha): RebaseTodoEntry => ({
  sha,
  action,
  message,
});

const TODO = [entry('a'), entry('b'), entry('c')];

describe('editsMessage / foldsIntoPrevious', () => {
  it('classifies the verbs that open a message editor', () => {
    expect(editsMessage('reword')).toBe(true);
    expect(editsMessage('squash')).toBe(true);
    expect(editsMessage('fixup')).toBe(false);
    expect(editsMessage('pick')).toBe(false);
  });

  it('classifies the verbs that fold into the commit above', () => {
    expect(foldsIntoPrevious('squash')).toBe(true);
    expect(foldsIntoPrevious('fixup')).toBe(true);
    expect(foldsIntoPrevious('pick')).toBe(false);
  });
});

describe('moveTodoEntry', () => {
  it('moves an entry down', () => {
    expect(moveTodoEntry(TODO, 0, 2).map((e) => e.sha)).toEqual(['b', 'c', 'a']);
  });

  it('moves an entry up', () => {
    expect(moveTodoEntry(TODO, 2, 0).map((e) => e.sha)).toEqual(['c', 'a', 'b']);
  });

  it('clamps a target past the end instead of dropping the entry', () => {
    expect(moveTodoEntry(TODO, 0, 99).map((e) => e.sha)).toEqual(['b', 'c', 'a']);
  });

  it('clamps a negative target', () => {
    expect(moveTodoEntry(TODO, 2, -5).map((e) => e.sha)).toEqual(['c', 'a', 'b']);
  });

  it('ignores a source index that does not exist', () => {
    expect(moveTodoEntry(TODO, 7, 0).map((e) => e.sha)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    moveTodoEntry(TODO, 0, 2);
    expect(TODO.map((e) => e.sha)).toEqual(['a', 'b', 'c']);
  });
});

describe('updateTodoEntry', () => {
  it('patches a single entry', () => {
    const next = updateTodoEntry(TODO, 1, { action: 'squash' });
    expect(next[1]?.action).toBe('squash');
    expect(next[0]).toEqual(TODO[0]);
  });

  it('returns an equal list when the index is out of range', () => {
    expect(updateTodoEntry(TODO, 9, { action: 'drop' })).toEqual(TODO);
  });
});

describe('validateTodo', () => {
  it('accepts a plain pick list', () => {
    expect(validateTodo(TODO)).toBeNull();
  });

  it('rejects an empty plan', () => {
    expect(validateTodo([])).toMatch(/nothing to rebase/i);
  });

  it('rejects a plan where every commit is dropped', () => {
    const dropped = TODO.map((e) => ({ ...e, action: 'drop' }));
    expect(validateTodo(dropped)).toMatch(/nothing would be left/i);
  });

  it('rejects a squash in first position', () => {
    expect(validateTodo([entry('a', 'squash'), entry('b')])).toMatch(
      /first commit cannot be squashed/i,
    );
  });

  it('looks past dropped commits when checking the first position', () => {
    expect(validateTodo([entry('a', 'drop'), entry('b', 'fixup')])).toMatch(
      /first commit cannot be squashed/i,
    );
  });

  it('rejects an action the backend does not whitelist', () => {
    expect(validateTodo([entry('a', 'exec')])).toMatch(/Unsupported action/);
  });

  it('rejects a reword with an empty message', () => {
    expect(validateTodo([entry('a', 'reword', '   ')])).toMatch(/needs a message/i);
  });

  it('allows a dropped commit to have no message', () => {
    expect(validateTodo([entry('a'), entry('b', 'drop', '')])).toBeNull();
  });
});

describe('previewTodo', () => {
  it('leaves a plain pick list alone', () => {
    expect(previewTodo(TODO).map((c) => c.sha)).toEqual(['a', 'b', 'c']);
  });

  it('removes dropped commits', () => {
    const plan = [entry('a'), entry('b', 'drop'), entry('c')];
    expect(previewTodo(plan).map((c) => c.sha)).toEqual(['a', 'c']);
  });

  it('folds a fixup into the commit above and keeps its message', () => {
    const plan = [entry('a', 'pick', 'first'), entry('b', 'fixup', 'second')];
    const [only] = previewTodo(plan);
    expect(only?.folded).toBe(1);
    expect(only?.message).toBe('first');
  });

  it('lets a squash take over the resulting message', () => {
    const plan = [entry('a', 'pick', 'first'), entry('b', 'squash', 'merged')];
    expect(previewTodo(plan)[0]?.message).toBe('merged');
  });

  it('counts several folds onto the same commit', () => {
    const plan = [entry('a'), entry('b', 'fixup'), entry('c', 'fixup')];
    expect(previewTodo(plan)[0]?.folded).toBe(2);
  });

  it('marks the commits the rebase stops at', () => {
    const plan = [entry('a'), entry('b', 'edit')];
    expect(previewTodo(plan).map((c) => c.stops)).toEqual([false, true]);
  });
});
