// @vitest-environment jsdom
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import {
  COMMIT_SHA,
  COMMIT_SUBJECT,
  COMMIT_TEXT_FILE,
  commitDetails,
  gitResponses,
  TEST_REPO,
  textDiff,
} from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { sizeVirtualViewport } from '../../../testing/virtual-scroll';
import type { CommitInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { MainContent } from '../../shared/components/main-content/main-content';

/**
 * Component row of AC-08 on the commit-list side (T27).
 *
 * The host is `MainContent`: the History view unmounts the list while the
 * workspace holds the centre, so the restore this row is about only exists
 * around the workbench — the list has to come back, scroll to the offset the
 * snapshot carries and put the keyboard back on the row the gesture came from.
 *
 * The offset half exposed a defect when this row was written (T27): the
 * remounted list zeroed `listScrollTop` on the first run of its viewport
 * effect, while the view query was still empty, so the offset Close published
 * never reached the CDK. The guard in `commit-list.ts` fixes it and the last
 * assertion pins it.
 */

/** The commit the gesture starts from, four rows down the history. */
const TARGET_INDEX = 4;

/** Rows the sized viewport shows, and where the list is scrolled to. */
const VIEWPORT_ROWS = 10;
const SCROLL_ROWS = 2;

function history(count: number): CommitInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    sha: index === TARGET_INDEX ? COMMIT_SHA : `5ha${String(index).padStart(37, '0')}`,
    short_sha: index === TARGET_INDEX ? COMMIT_SHA.slice(0, 7) : `5ha${index}`,
    message: index === TARGET_INDEX ? COMMIT_SUBJECT : `commit ${index}`,
    author_name: 'Jhoan Moreno',
    author_email: 'jmoreno@example.com',
    date: '2026-09-02T14:10:00Z',
    parent_shas: ['a4848bd'],
    refs: [],
    on_current_branch: true,
  }));
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Workbench {
  readonly fixture: ComponentFixture<MainContent>;
  readonly host: HTMLElement;
  readonly repo: CurrentRepoService;
  readonly workspace: DiffWorkspaceService;
  settle(): Promise<void>;
  /** Same, plus the frame the CDK audits its scroll pipeline on. */
  settleScroll(): Promise<void>;
}

async function renderHistoryWorkbench(): Promise<Workbench> {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      {
        provide: TauriGitService,
        useValue: createTauriGitStub(
          gitResponses({
            // The commit this row selects, with the one file the gesture opens.
            get_commit_details: commitDetails([COMMIT_TEXT_FILE]),
            get_commit_file_diff: textDiff(COMMIT_TEXT_FILE),
          }),
        ).service,
      },
    ],
  });

  // Pinned rather than inherited: with the default on, the click that makes a
  // file row active would itself open the workspace (AC-22), and the rows below
  // would never reach the gesture they are about. The click-to-open path is
  // covered where it belongs, in the commit inspector's own spec.
  TestBed.inject(PreferencesService).set('commitFileClickOpensWorkspace', false);

  const repo = TestBed.inject(CurrentRepoService);
  repo.repo.set(TEST_REPO);
  repo.commits.set(history(60));
  repo.historyTotal.set(60);

  const fixture = TestBed.createComponent(MainContent);
  fixture.detectChanges();

  const settle = async (): Promise<void> => {
    await flushAsync();
    TestBed.tick();
    await flushAsync();
    TestBed.tick();
  };
  const settleScroll = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 32));
    TestBed.tick();
    await settle();
  };
  await settle();

  return {
    fixture,
    host: fixture.nativeElement,
    repo,
    workspace: TestBed.inject(DiffWorkspaceService),
    settle,
    settleScroll,
  };
}

/** The commit history's virtual viewport, or `null` while it is unmounted. */
function commitViewport(bench: Workbench): CdkVirtualScrollViewport | null {
  const found = bench.fixture.debugElement
    .queryAll(By.directive(CdkVirtualScrollViewport))
    .find(
      (element) =>
        element.nativeElement.closest('[data-testid="commit-list"]') !== null,
    );
  return (found?.componentInstance as CdkVirtualScrollViewport) ?? null;
}

function sizedCommitViewport(bench: Workbench): CdkVirtualScrollViewport {
  const viewport = commitViewport(bench);
  if (!viewport) throw new Error('The commit list is not on screen.');
  sizeVirtualViewport(viewport, VIEWPORT_ROWS * rowHeight());
  return viewport;
}

function rowHeight(): number {
  return TestBed.inject(AppearanceService).rowHeight();
}

function commitRow(host: HTMLElement, sha: string): HTMLElement {
  const row = host.querySelector<HTMLElement>(`[data-testid="commit-row-${sha}"]`);
  if (!row) throw new Error(`No commit row rendered for ${sha}.`);
  return row;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }),
  );
}

describe('Commit list restore on close (AC-08)', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
    for (const method of ['scrollTo', 'scrollIntoView']) {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        writable: true,
        value: () => undefined,
      });
    }
  });

  afterEach(() => {
    observer.restore();
  });

  it('AC-08: mod+d from a scrolled commit row replays the offset and focuses that row on close (T27)', async () => {
    const bench = await renderHistoryWorkbench();
    const viewport = sizedCommitViewport(bench);
    await bench.settleScroll();

    // The developer has scrolled the history and picked a commit; the file the
    // inspector shows is what `mod+d` from the commit row opens.
    viewport.scrollToOffset(SCROLL_ROWS * rowHeight());
    await bench.settleScroll();
    const offset = bench.repo.listScrollTop();
    expect(offset).toBe(SCROLL_ROWS * rowHeight());

    click(commitRow(bench.host, COMMIT_SHA));
    await bench.settle();
    expect(bench.repo.selectedCommitSha()).toBe(COMMIT_SHA);

    click(
      bench.host.querySelector<HTMLElement>(`[data-focus-key="${COMMIT_TEXT_FILE}"]`) ??
        document.body,
    );
    await bench.settle();

    // A commit row is not focusable itself: the viewport holds the tabindex and
    // names the active row through `aria-activedescendant`.
    const list = viewport.elementRef.nativeElement;
    list.focus();
    expect(list.getAttribute('aria-activedescendant')).toBe(`commit-row-${COMMIT_SHA}`);

    press('d', { ctrlKey: true });
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(true);
    expect(bench.workspace.current()?.file).toBe(COMMIT_TEXT_FILE);
    expect(bench.host.querySelector('app-commit-list')).toBeNull();
    // Anything the snapshot replays has to differ from what is on screen, or
    // «no replay» and «replayed» would look the same.
    bench.repo.listScrollTop.set(0);

    press('Escape');

    // Read before the list is rendered again: this is the offset Close
    // published from the snapshot; the remounted list must keep it.
    expect(bench.repo.listScrollTop()).toBe(offset);

    await bench.settleScroll();
    await bench.settleScroll();

    const restored = commitViewport(bench);
    if (!restored) throw new Error('The commit list did not come back.');
    expect(bench.repo.selectedCommitSha()).toBe(COMMIT_SHA);
    expect(bench.workspace.pendingFocusKey()).toBeNull();
    expect(document.activeElement).toBe(restored.elementRef.nativeElement);
    expect(
      restored.elementRef.nativeElement.getAttribute('aria-activedescendant'),
    ).toBe(`commit-row-${COMMIT_SHA}`);
    // The remounted list must scroll back to the snapshot's offset, not start
    // over at the top (AC-08 «same scroll»).
    expect(bench.repo.listScrollTop()).toBe(offset);
  });

  it('AC-08: a bare-path key pending while the list remounts is left for the inspector to claim (T29 — R1)', async () => {
    // No commit is selected, so no inspector is mounted to claim the key: what
    // the list does with a key it cannot own is all this row sees.
    const bench = await renderHistoryWorkbench();
    sizedCommitViewport(bench);
    await bench.settleScroll();
    expect(bench.repo.commitDetails()).toBeNull();

    const foreign = 'src/app/app.ts';
    bench.workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [foreign],
      index: 0,
      focusKey: foreign,
    });
    await bench.settle();
    expect(bench.host.querySelector('app-commit-list')).toBeNull();

    bench.workspace.close();
    await bench.settleScroll();
    await bench.settleScroll();

    expect(commitViewport(bench)).not.toBeNull();
    // A commit file row owns this key; expiring it here is the commit list
    // taking a restore that is not its own (AC-08).
    expect(bench.workspace.pendingFocusKey()).toBe(foreign);
  });

  it('AC-08: a sha dropped from the history before Close expires without focusing anything (T29 — R2)', async () => {
    const bench = await renderHistoryWorkbench();
    const viewport = sizedCommitViewport(bench);
    await bench.settleScroll();

    click(commitRow(bench.host, COMMIT_SHA));
    await bench.settle();

    // `mod+d` belongs to the list with an active row, and the inspector only
    // registers it once a file row is picked.
    click(
      bench.host.querySelector<HTMLElement>(`[data-focus-key="${COMMIT_TEXT_FILE}"]`) ??
        document.body,
    );
    await bench.settle();

    // The commit row keys itself so the list can tell its own restore from a
    // commit file's bare path (AC-08, T29).
    expect(commitRow(bench.host, COMMIT_SHA).getAttribute('data-focus-key')).toBe(
      `commit:${COMMIT_SHA}`,
    );

    const list = viewport.elementRef.nativeElement;
    list.focus();
    press('d', { ctrlKey: true });
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(true);

    // History is rewritten while the workspace holds the centre: the commit
    // the restore names is gone by the time the list comes back.
    bench.repo.commits.set(history(60).filter((row) => row.sha !== COMMIT_SHA));
    press('Escape');
    await bench.settleScroll();
    await bench.settleScroll();

    const restored = commitViewport(bench);
    if (!restored) throw new Error('The commit list did not come back.');
    expect(bench.workspace.pendingFocusKey()).toBeNull();
    expect(document.activeElement).not.toBe(restored.elementRef.nativeElement);
    expect(
      (document.activeElement as HTMLElement | null)?.closest('[data-focus-key]') ??
        null,
    ).toBeNull();
  });

  it('AC-08: with both lists mounted the inspector file row keeps the restore and takes it once (T29 — R1)', async () => {
    const bench = await renderHistoryWorkbench();
    sizedCommitViewport(bench);
    await bench.settleScroll();

    click(commitRow(bench.host, COMMIT_SHA));
    await bench.settle();
    expect(bench.host.querySelector('app-commit-inspector')).not.toBeNull();

    bench.workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [COMMIT_TEXT_FILE],
      index: 0,
      focusKey: COMMIT_TEXT_FILE,
    });
    await bench.settle();

    const restored = vi.spyOn(bench.workspace, 'focusRestored');
    press('Escape');
    await bench.settleScroll();
    await bench.settleScroll();

    const row = bench.host.querySelector(`[data-focus-key="${COMMIT_TEXT_FILE}"]`);
    expect(row).not.toBeNull();
    expect(document.activeElement).toBe(row);
    expect(restored.mock.calls).toEqual([[COMMIT_TEXT_FILE]]);
  });
});
