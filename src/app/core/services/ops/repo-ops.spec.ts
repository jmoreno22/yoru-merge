// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  gitResponses,
  TEST_REPO,
  workingChanges,
} from '../../../../testing/repo-fixtures';
import {
  createTauriGitStub,
  type TauriGitStub,
} from '../../../../testing/tauri-git-stub';
import type { RepoChangeKind } from '../../models';
import { TauriGitService } from '../tauri-git.service';
import { RepoState } from '../workspace.store';
import { RepoOps } from './repo-ops';

describe('RepoOps refresh rounds', () => {
  let stub: TauriGitStub;
  let state: RepoState;
  let ops: RepoOps;

  const refresh = (...kinds: RepoChangeKind[]) =>
    ops.refreshFor(state, new Set(kinds), 'external');
  const called = (command: string) =>
    stub.calls.filter((call) => call.command === command).length;

  beforeEach(() => {
    stub = createTauriGitStub(gitResponses());
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    ops = TestBed.inject(RepoOps);
    state = new RepoState('repo-1', TEST_REPO.path);
    state.repo.set(TEST_REPO);
  });

  it('keeps the rows and skips the tags when the history comes back unchanged', async () => {
    const rows = state.commits();
    state.historyFingerprint.set('*all:1:2');
    stub.responses['get_history'] = {
      commits: [],
      graph: { commits: [], max_lanes: 0 },
      total: 0,
      has_more: false,
      fingerprint: '*all:1:2',
      unchanged: true,
    };

    await refresh('refs');

    const history = stub.calls.find((call) => call.command === 'get_history');
    expect(history?.args.at(-1)).toBe('*all:1:2');
    expect(state.commits()).toBe(rows);
    expect(called('list_tags')).toBe(0);
    expect(called('list_branches')).toBe(1);
  });

  it('keeps the changes when the status comes back unchanged', async () => {
    await refresh('worktree');
    const shown = state.changes();
    stub.responses['get_working_changes'] = {
      ...workingChanges([], []),
      unchanged: true,
    };

    await refresh('worktree');

    expect(state.changes()).toBe(shown);
  });

  it('asks for conflicts only while the status lists some', async () => {
    await refresh('worktree');
    expect(called('get_conflicts')).toBe(0);

    stub.responses['get_working_changes'] = {
      ...workingChanges(),
      conflicted: ['src/app/a.ts'],
    };
    await refresh('index');
    expect(called('get_conflicts')).toBe(1);
  });

  it('reloads stashes and remotes only for their own kinds', async () => {
    await refresh('refs');
    expect(called('stash_list')).toBe(0);
    expect(called('list_remotes')).toBe(0);

    await refresh('stash');
    expect(called('stash_list')).toBe(1);

    await refresh('config');
    expect(called('list_remotes')).toBe(1);
  });
});
