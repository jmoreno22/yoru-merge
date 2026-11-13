// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gitResponses, TEST_REPO } from '../../../testing/repo-fixtures';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { CommitLandingService, LANDING_MS } from './commit-landing.service';
import { CurrentRepoService } from './current-repo.service';
import { StagingOps } from './ops/staging-ops';
import { TauriGitService } from './tauri-git.service';
import { RepoState } from './workspace.store';

describe('commit landing', () => {
  let stub: TauriGitStub;

  beforeEach(() => {
    stub = createTauriGitStub(gitResponses({ create_commit: 'ab12cd34' }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves the new commit pending on its tab once the commit is made', async () => {
    const state = new RepoState('repo-1', TEST_REPO.path);
    state.repo.set(TEST_REPO);

    await TestBed.inject(StagingOps).commit(state, 'feat: land');

    expect(state.landedSha()).toBe('ab12cd34');
  });

  it('spends the pending commit when History claims it, and plays it once', () => {
    vi.useFakeTimers();
    const repo = TestBed.inject(CurrentRepoService);
    const landing = TestBed.inject(CommitLandingService);
    repo.landedSha.set('ab12cd34');

    landing.claim();
    expect(landing.playing()).toBe('ab12cd34');
    expect(repo.landedSha()).toBeNull();

    vi.advanceTimersByTime(LANDING_MS);
    expect(landing.playing()).toBeNull();

    landing.claim();
    expect(landing.playing()).toBeNull();
  });

  it('keeps a newer landing playing when an older one times out', () => {
    vi.useFakeTimers();
    const repo = TestBed.inject(CurrentRepoService);
    const landing = TestBed.inject(CommitLandingService);

    repo.landedSha.set('first');
    landing.claim();
    vi.advanceTimersByTime(LANDING_MS - 100);
    repo.landedSha.set('second');
    landing.claim();
    vi.advanceTimersByTime(100);

    expect(landing.playing()).toBe('second');
  });
});
