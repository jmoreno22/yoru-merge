// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import {
  binaryDiff,
  COMMIT_BINARY_FILE,
  COMMIT_SHA,
  COMMIT_SUBJECT,
  COMMIT_TEXT_FILE,
  commitDetails,
  gitResponses,
  TEST_REPO,
  textDiff,
} from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { MainContent } from '../../shared/components/main-content/main-content';

/**
 * Component rows of AC-06, AC-07 and AC-14 (T25).
 *
 * The host is `MainContent`, not `DiffWorkspace` on its own: the workspace
 * renders a strip and a portal outlet, and the diff it shows is the one live
 * `<app-diff-viewer>` the workbench moves into that outlet (ADR-0003). A bare
 * `DiffWorkspace` fixture would have an empty centre, which is precisely what
 * these rows have to rule out.
 */

const COMMIT_FILES = [COMMIT_TEXT_FILE, COMMIT_BINARY_FILE];

/** Two hunks, so «next hunk» has somewhere to go and «previous» comes back. */
const TWO_HUNK_DIFF = [
  `diff --git a/${COMMIT_TEXT_FILE} b/${COMMIT_TEXT_FILE}`,
  'index 1111111..2222222 100644',
  `--- a/${COMMIT_TEXT_FILE}`,
  `+++ b/${COMMIT_TEXT_FILE}`,
  '@@ -1,3 +1,3 @@',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  '@@ -20,3 +20,3 @@',
  ' const c = 1;',
  '-const d = 2;',
  '+const d = 3;',
  '',
].join('\n');

/** Lets the `void`-ed diff loads and the diff view's own parse pass settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Workbench {
  readonly host: HTMLElement;
  readonly stub: TauriGitStub;
  readonly repo: CurrentRepoService;
  readonly workspace: DiffWorkspaceService;
  settle(): Promise<void>;
}

/** The History view with a commit selected and its first file in the viewer. */
async function renderCommitWorkbench(
  responses: Record<string, unknown> = {},
): Promise<Workbench> {
  const stub = createTauriGitStub(gitResponses(responses));
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: stub.service },
    ],
  });

  const repo = TestBed.inject(CurrentRepoService);
  repo.repo.set(TEST_REPO);
  repo.selectedCommitSha.set(COMMIT_SHA);
  repo.commitDetails.set(commitDetails());
  // What `selectCommit` leaves behind, plus the file the inspector reports as
  // shown: opening that same file must not fetch its diff a second time.
  repo.diffSource.set({ kind: 'commit', sha: COMMIT_SHA });
  repo.diffText.set(textDiff(COMMIT_TEXT_FILE));

  const workspace = TestBed.inject(DiffWorkspaceService);
  workspace.activeCommitFile.set(COMMIT_TEXT_FILE);

  const fixture = TestBed.createComponent(MainContent);
  fixture.detectChanges();

  const settle = async (): Promise<void> => {
    await flushAsync();
    TestBed.tick();
    await flushAsync();
    TestBed.tick();
  };
  await settle();

  return { host: fixture.nativeElement, stub, repo, workspace, settle };
}

function openOn(bench: Workbench, index: number): Promise<void> {
  bench.workspace.open({
    source: { kind: 'commit', sha: COMMIT_SHA },
    files: [...COMMIT_FILES],
    index,
    focusKey: COMMIT_FILES[index],
  });
  return bench.settle();
}

function strip(host: HTMLElement): HTMLElement {
  const element = host.querySelector<HTMLElement>('[data-testid="diff-workspace"]');
  if (!element) throw new Error('The diff workspace is not on screen.');
  return element;
}

function control(host: HTMLElement, testId: string): HTMLButtonElement {
  const element = host.querySelector<HTMLElement>(`[data-testid="${testId}"] button`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`No button under [data-testid="${testId}"].`);
  }
  return element;
}

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('Diff workspace on a commit file', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
    // The commit file list scrolls its active row into view through the CDK
    // viewport and hunk navigation scrolls the hunk it lands on; jsdom
    // implements no scrolling at all.
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

  it('AC-06: the workspace withholds the per-file collapse chevron, and parking the viewer gives it back', async () => {
    // The workspace shows the one file the developer asked to read at full
    // width, so collapsing it would leave the centre empty — `diff-view.ts`
    // gates the chevron on `workspace.isOpen()`. The gate shipped in `2049df4`
    // with no criterion and no row: forcing it to either constant left the
    // whole suite green (review round 9, R9-S1-F10 / R9-S2-F3). Both halves
    // below are needed — the first alone passes with the chevron removed
    // outright, the second alone passes with the gate always off.
    const bench = await renderCommitWorkbench();
    const chevron = (): Element | null =>
      bench.host.querySelector('.dv-file-head button[aria-expanded]');

    await openOn(bench, 0);
    expect(strip(bench.host).querySelector('.dv-file-head')).not.toBeNull();
    expect(chevron()).toBeNull();

    press('Escape');
    await bench.settle();

    // Back in its parking slot the element is the Changes view's inline viewer
    // again, and the control has to come back with it.
    expect(bench.host.querySelector('.dv-file-head')).not.toBeNull();
    expect(chevron()).not.toBeNull();
  });

  it('AC-06: the strip shows the path, the source commit, previous / next and Close', async () => {
    const bench = await renderCommitWorkbench();
    await openOn(bench, 0);

    const workspace = strip(bench.host);
    const path = workspace.querySelector('[data-testid="diff-workspace-path"]');
    const source = workspace.querySelector('[data-testid="diff-workspace-source"]');

    expect(path?.textContent?.replace(/\s+/g, '')).toBe(COMMIT_TEXT_FILE);
    expect(source?.textContent?.trim()).toBe('Commit');
    // Short sha and subject, both from the state rather than from repo prose.
    expect(workspace.textContent).toContain(COMMIT_SHA.slice(0, 7));
    expect(workspace.textContent).toContain(COMMIT_SUBJECT);

    expect(control(workspace, 'diff-workspace-prev').disabled).toBe(true);
    expect(control(workspace, 'diff-workspace-next').disabled).toBe(false);
    expect(control(workspace, 'diff-workspace-close').disabled).toBe(false);
  });

  it('AC-14: a commit-sourced workspace renders no stage or unstage control', async () => {
    const bench = await renderCommitWorkbench();
    await openOn(bench, 0);

    const workspace = strip(bench.host);
    // The patch really is on screen: a workspace with no hunk would pass this
    // row for the wrong reason.
    expect(workspace.querySelector('.dv-hunk-head')).not.toBeNull();

    const staging = [...workspace.querySelectorAll('button')]
      .map(
        (button) =>
          `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`,
      )
      .filter((label) => /\b(un)?stage\b/i.test(label));

    expect(staging).toEqual([]);
  });

  it('AC-14: the staging keys make no bridge call, wherever focus is', async () => {
    const bench = await renderCommitWorkbench();
    await openOn(bench, 0);

    const workspace = strip(bench.host);
    const targets = [
      workspace.querySelector<HTMLElement>('[data-testid="diff-workspace-path"]'),
      workspace.querySelector<HTMLElement>('.dv-hunk-body'),
      workspace.querySelector<HTMLElement>('.dv-row'),
      bench.host.querySelector<HTMLElement>('[data-testid="inspector-column"]'),
      control(workspace, 'diff-workspace-close'),
    ].filter((element): element is HTMLElement => element !== null);

    expect(targets).toHaveLength(5);

    for (const target of targets) {
      target.focus();
      for (const key of [' ', 'Enter', 'ArrowDown']) {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }),
      );
    }
    await bench.settle();

    const staging = bench.stub.calls
      .map((call) => call.command)
      .filter((command) => /stage_hunks|apply_patch|discard/.test(command));

    expect(staging).toEqual([]);
  });

  it('AC-12: the hunk keys still move between hunks with the workspace open (T27)', async () => {
    const bench = await renderCommitWorkbench({
      get_commit_file_diff: TWO_HUNK_DIFF,
    });
    // The patch the viewer is already showing, so the open reuses it.
    bench.repo.diffText.set(TWO_HUNK_DIFF);
    await bench.settle();
    await openOn(bench, 0);

    const position = (): string =>
      strip(bench.host)
        .querySelector('[data-testid="diff-hunk-counter"]')
        ?.textContent?.replace(/\s+/g, '') ?? '';

    expect(position()).toBe('0/2');

    press('n');
    await bench.settle();
    expect(position()).toBe('1/2');

    press('n');
    await bench.settle();
    expect(position()).toBe('2/2');

    press('p');
    await bench.settle();
    expect(position()).toBe('1/2');
  });

  it('AC-07: a binary file shows the viewer explanation with an active strip', async () => {
    const bench = await renderCommitWorkbench({
      get_commit_file_diff: binaryDiff(COMMIT_BINARY_FILE),
    });
    await openOn(bench, 1);

    const workspace = strip(bench.host);

    expect(workspace.textContent).toContain(
      'Binary file. There is no text diff to show.',
    );
    expect(
      workspace
        .querySelector('[data-testid="diff-workspace-path"]')
        ?.textContent?.replace(/\s+/g, ''),
    ).toBe(COMMIT_BINARY_FILE);
    expect(control(workspace, 'diff-workspace-prev').disabled).toBe(false);
    expect(control(workspace, 'diff-workspace-next').disabled).toBe(true);
  });

  it('AC-07: an emptied commit list explains itself, disables both edges and Close still returns', async () => {
    const bench = await renderCommitWorkbench();
    await openOn(bench, 0);

    // A refresh that keeps the commit selected but leaves it with no file: the
    // inspector owns that list and re-publishes it, which is what empties the
    // workspace. Calling `setFiles` here instead would be undone by the very
    // next run of that effect.
    bench.repo.commitDetails.set(commitDetails([]));
    await bench.settle();

    const workspace = strip(bench.host);
    expect(workspace.textContent).toContain('No changes to show');
    expect(control(workspace, 'diff-workspace-prev').disabled).toBe(true);
    expect(control(workspace, 'diff-workspace-next').disabled).toBe(true);

    control(workspace, 'diff-workspace-close').click();
    await bench.settle();

    expect(bench.host.querySelector('[data-testid="diff-workspace"]')).toBeNull();
    // The History view is back with the same commit still selected.
    expect(bench.host.querySelector('app-commit-list')).not.toBeNull();
    expect(bench.repo.selectedCommitSha()).toBe(COMMIT_SHA);
  });

  it('AC-09: another file row and previous / next navigate in place, never opening a second workspace (T29 — R7)', async () => {
    const bench = await renderCommitWorkbench();
    const opened = vi.spyOn(bench.workspace, 'open');
    await openOn(bench, 0);

    const path = (): string =>
      strip(bench.host)
        .querySelector('[data-testid="diff-workspace-path"]')
        ?.textContent?.replace(/\s+/g, '') ?? '';

    const step = async (act: () => void, expected: string): Promise<void> => {
      act();
      await bench.settle();
      expect(
        bench.host.querySelectorAll('[data-testid="diff-workspace"]'),
      ).toHaveLength(1);
      expect(path()).toBe(expected);
      // The open that put the workspace on screen, and no other: a second one
      // would be a new workspace over the old (AC-09).
      expect(opened).toHaveBeenCalledTimes(1);
    };

    expect(path()).toBe(COMMIT_TEXT_FILE);

    // The commit file list stays mounted behind the workspace, so its rows are
    // the "click another file" half of this criterion.
    const row = bench.host.querySelector<HTMLElement>(
      `[data-focus-key="${COMMIT_BINARY_FILE}"]`,
    );
    if (!row) throw new Error('The commit file list has no binary-file row.');
    await step(() => row.click(), COMMIT_BINARY_FILE);

    await step(
      () => control(strip(bench.host), 'diff-workspace-prev').click(),
      COMMIT_TEXT_FILE,
    );
    await step(
      () => control(strip(bench.host), 'diff-workspace-next').click(),
      COMMIT_BINARY_FILE,
    );
  });
});
