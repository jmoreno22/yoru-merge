// @vitest-environment jsdom
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { TEST_REPO } from '../../../testing/repo-fixtures';
import {
  installResizeObserver,
  type ResizeObserverStub,
} from '../../../testing/resize-observer';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { sizeVirtualViewport } from '../../../testing/virtual-scroll';
import type { CommitInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { FileHistoryPanel } from './file-history-panel';

const FILE = 'src/main.ts';
const COUNT = 40;
const VIEWPORT_ROWS = 10;

function history(count: number): CommitInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    sha: `5ha${String(index).padStart(37, '0')}`,
    short_sha: `5ha${index}`,
    message: `commit ${index}`,
    author_name: 'Jhoan Moreno',
    author_email: 'jmoreno@example.com',
    date: '2026-09-02T14:10:00Z',
    parent_shas: [],
    refs: [],
    on_current_branch: true,
  }));
}

@Component({
  imports: [FileHistoryPanel],
  template: `<app-file-history-panel [file]="file()" />`,
})
class Host {
  readonly file = signal<string | null>(FILE);
}

async function settle(ms = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  TestBed.tick();
}

describe('FileHistoryPanel keyboard', () => {
  let stub: TauriGitStub;
  let list: HTMLElement;
  let viewport: CdkVirtualScrollViewport;
  let rowHeight: number;
  let resizeObserver: ResizeObserverStub;

  afterEach(() => resizeObserver.restore());

  beforeEach(async () => {
    resizeObserver = installResizeObserver();
    stub = createTauriGitStub({
      file_history: history(COUNT),
      get_commit_file_diff: 'diff --git a/src/main.ts b/src/main.ts\n',
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTestIcons(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    TestBed.inject(CurrentRepoService).repo.set(TEST_REPO);
    rowHeight = TestBed.inject(AppearanceService).historyRowHeight();

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await settle();
    await settle();

    viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
      .componentInstance as CdkVirtualScrollViewport;
    sizeVirtualViewport(viewport, VIEWPORT_ROWS * rowHeight);
    await settle(32);
    list = fixture.nativeElement.querySelector('[data-testid="file-history-list"]');
  });

  function press(key: string): Promise<void> {
    list.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    return settle(32);
  }

  function activeRow(): HTMLElement | null {
    const id = list.getAttribute('aria-activedescendant');
    return id === null ? null : document.getElementById(id);
  }

  it('takes one tab stop on the list, not one per row', () => {
    expect(list.getAttribute('tabindex')).toBe('0');
    expect(list.querySelector('[role="option"][tabindex]')).toBeNull();
  });

  it('moves the active row with the arrows without selecting it', async () => {
    await press('ArrowDown');
    await press('ArrowDown');
    expect(activeRow()?.dataset['testid']).toBe(
      `file-history-item-${history(COUNT)[1]?.sha}`,
    );
    expect(stub.calls.some((call) => call.command === 'get_commit_file_diff')).toBe(
      false,
    );

    await press('ArrowUp');
    expect(activeRow()?.dataset['testid']).toBe(
      `file-history-item-${history(COUNT)[0]?.sha}`,
    );
  });

  it('jumps to the ends with Home and End, scrolling the last row into view', async () => {
    await press('End');
    const last = history(COUNT)[COUNT - 1]?.sha;
    expect(activeRow()?.dataset['testid']).toBe(`file-history-item-${last}`);
    expect(viewport.measureScrollOffset('top')).toBe(
      (COUNT - VIEWPORT_ROWS) * rowHeight,
    );

    await press('Home');
    expect(activeRow()?.dataset['testid']).toBe(
      `file-history-item-${history(COUNT)[0]?.sha}`,
    );
    expect(viewport.measureScrollOffset('top')).toBe(0);
  });

  it('selects the active row with Enter', async () => {
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Enter');
    const sha = history(COUNT)[1]?.sha;
    expect(
      stub.calls.find((call) => call.command === 'get_commit_file_diff')?.args,
    ).toContain(sha);
    expect(activeRow()?.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the patch of the last row chosen when an earlier one answers later', async () => {
    const answers: ((patch: string) => void)[] = [];
    Object.defineProperty(stub.responses, 'get_commit_file_diff', {
      get: () => new Promise<string>((resolve) => answers.push(resolve)),
    });
    await press('ArrowDown');
    await press('Enter');
    await press('ArrowDown');
    await press('Enter');

    answers[1]?.('second');
    await settle();
    answers[0]?.('first');
    await settle();

    const repo = TestBed.inject(CurrentRepoService);
    expect(repo.diffSource()).toEqual({ kind: 'commit', sha: history(COUNT)[1]?.sha });
    expect(repo.diffText()).toBe('second');
  });
});
