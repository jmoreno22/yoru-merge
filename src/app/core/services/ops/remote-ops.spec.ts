// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { gitResponses, TEST_REPO } from '../../../../testing/repo-fixtures';
import {
  createTauriGitStub,
  type TauriGitStub,
} from '../../../../testing/tauri-git-stub';
import { NeonSignService } from '../neon-sign.service';
import { TauriGitService } from '../tauri-git.service';
import { RepoState } from '../workspace.store';
import { RemoteOps } from './remote-ops';

describe('RemoteOps cues for the neon sign', () => {
  let stub: TauriGitStub;
  let state: RepoState;
  let ops: RemoteOps;
  let sign: NeonSignService;

  const cue = () => sign.cue()?.kind ?? null;

  beforeEach(() => {
    stub = createTauriGitStub(gitResponses());
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    ops = TestBed.inject(RemoteOps);
    sign = TestBed.inject(NeonSignService);
    state = new RepoState('repo-1', TEST_REPO.path);
    state.repo.set(TEST_REPO);
    // Push and pull refuse a detached HEAD before reaching the backend.
    state.branches.set({ local: [], remote: [], current: 'main' });
  });

  it('surges when a push goes through', async () => {
    stub.responses['push'] = { kind: 'success' };
    await ops.push(state);
    expect(cue()).toBe('surge');
  });

  it('falters when a push is rejected or fails outright', async () => {
    stub.responses['push'] = { kind: 'rejected', reason: 'non-fast-forward' };
    await ops.push(state);
    expect(cue()).toBe('falter');

    sign.surge();
    delete stub.responses['push'];
    await ops.push(state);
    expect(cue()).toBe('falter');
  });

  it('stays dark when there was nothing to push or pull', async () => {
    stub.responses['push'] = { kind: 'up_to_date' };
    stub.responses['pull'] = { kind: 'up_to_date' };
    await ops.push(state);
    await ops.pull(state);
    expect(cue()).toBeNull();
  });

  it('surges on a pull that brought commits and falters on one with conflicts', async () => {
    stub.responses['pull'] = { kind: 'fast_forward' };
    await ops.pull(state);
    expect(cue()).toBe('surge');

    stub.responses['pull'] = { kind: 'conflicts', files: ['a.ts'] };
    await ops.pull(state);
    expect(cue()).toBe('falter');
  });

  it('reacts to a fetch the developer asked for, never to the background one', async () => {
    stub.responses['fetch_remote'] = undefined;
    await ops.fetch(state, { silent: true });
    expect(cue()).toBeNull();

    await ops.fetch(state);
    expect(cue()).toBe('surge');
  });
});
