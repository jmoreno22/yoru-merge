// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { gitResponses, TEST_REPO } from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import type { CommitInfo } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import {
  FILE_HISTORY_LIMIT,
  TauriGitService,
} from '../../core/services/tauri-git.service';
import { FileHistoryPanel } from './file-history-panel';

function commits(count: number): CommitInfo[] {
  return Array.from({ length: count }, (_, index) => {
    const sha = index.toString(16).padStart(40, '0');
    return {
      sha,
      short_sha: sha.slice(0, 7),
      message: `change ${index}`,
      author_name: 'Ana',
      author_email: 'ana@example.com',
      date: '2026-01-01T00:00:00Z',
      parent_shas: [],
      refs: [],
      on_current_branch: true,
    };
  });
}

async function render(history: CommitInfo[]): Promise<HTMLElement> {
  const stub = createTauriGitStub(gitResponses({ file_history: history }));
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: stub.service },
    ],
  });
  TestBed.inject(CurrentRepoService).repo.set(TEST_REPO);
  const fixture = TestBed.createComponent(FileHistoryPanel);
  fixture.componentRef.setInput('file', 'src/a.ts');
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('FileHistoryPanel', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    observer.restore();
  });

  it('says the list is cut when the backend sent more than the limit', async () => {
    const host = await render(commits(FILE_HISTORY_LIMIT + 1));

    const note = host.querySelector('[data-testid="file-history-truncated"]');
    expect(note?.textContent).toContain(`newest ${FILE_HISTORY_LIMIT} commits`);
    expect(host.querySelector('header')?.textContent).toContain(
      `${FILE_HISTORY_LIMIT}+`,
    );
  });

  it('lists a short history without the note', async () => {
    const host = await render(commits(3));

    expect(host.querySelector('[data-testid="file-history-truncated"]')).toBeNull();
    expect(host.querySelector('[data-testid="file-history-list"]')).not.toBeNull();
    expect(host.querySelector('header')?.textContent).not.toContain('+');
  });
});
