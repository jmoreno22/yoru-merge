// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_REPO } from '../../../../testing/repo-fixtures';
import {
  createTauriGitStub,
  type TauriGitStub,
} from '../../../../testing/tauri-git-stub';
import { TauriGitService } from '../tauri-git.service';
import { RepoState } from '../workspace.store';
import { HistoryOps } from './history-ops';

describe('HistoryOps stacked panel reads', () => {
  let stub: TauriGitStub;
  let state: RepoState;
  let ops: HistoryOps;

  const called = (command: string) =>
    stub.calls.filter((call) => call.command === command).length;

  beforeEach(() => {
    stub = createTauriGitStub({
      file_history: [],
      blame_file: [],
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    ops = TestBed.inject(HistoryOps);
    state = new RepoState('repo-1', TEST_REPO.path);
    state.repo.set(TEST_REPO);
  });

  // Opening a panel loads it, and the panel mounting for that file asks again.
  it('reads the file history once when the panel asks while the open is in flight', async () => {
    await Promise.all([
      ops.loadFileHistory(state, 'a.ts'),
      ops.loadFileHistory(state, 'a.ts'),
    ]);

    expect(called('file_history')).toBe(1);
  });

  it('reads the blame once when the panel asks while the open is in flight', async () => {
    await Promise.all([
      ops.loadBlame(state, 'a.ts', null),
      ops.loadBlame(state, 'a.ts', null),
    ]);

    expect(called('blame_file')).toBe(1);
  });

  it('reads again for another file, another revision, or once the first read ended', async () => {
    await Promise.all([
      ops.loadFileHistory(state, 'a.ts'),
      ops.loadFileHistory(state, 'b.ts'),
      ops.loadBlame(state, 'a.ts', null),
      ops.loadBlame(state, 'a.ts', 'HEAD~1'),
    ]);
    await ops.loadFileHistory(state, 'a.ts');

    expect(called('file_history')).toBe(3);
    expect(called('blame_file')).toBe(2);
  });
});
