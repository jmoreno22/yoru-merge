// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../../testing/icons';
import {
  COMMIT_BINARY_FILE,
  COMMIT_SHA,
  COMMIT_TEXT_FILE,
  commitDetails,
  gitResponses,
  TEST_REPO,
  textDiff,
  workingChanges,
} from '../../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../../testing/resize-observer';
import { createTauriGitStub } from '../../../../testing/tauri-git-stub';
import type { RefInfo } from '../../../core/models';
import { AppearanceService } from '../../../core/services/appearance.service';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../../core/services/diff-workspace.service';
import { computeInspectorLayout } from '../../../core/services/inspector-layout';
import { PreferencesService } from '../../../core/services/preferences.service';
import { TauriGitService } from '../../../core/services/tauri-git.service';
import { WorkspaceStore } from '../../../core/services/workspace.store';
import { MainContent } from './main-content';

/**
 * Component rows of AC-06 (centre wiring), AC-17 and AC-18 (T25): what the
 * workbench itself owns — where the one diff viewer lives, what closes the
 * workspace, and which child of the inspector column grows.
 */

const COMMIT_FILES = [COMMIT_TEXT_FILE, COMMIT_BINARY_FILE];

/** The scroll offset the snapshot carries; a replay would put it back. */
const SNAPSHOT_SCROLL = 120;

/** The diff viewer's four option controls, by the attribute each renders. */
const OPTION_CONTROLS = [
  '[aria-label="Diff layout"]',
  '[aria-label="Context lines"]',
  '[title="Ignore whitespace-only changes"]',
  '[title="Wrap long lines"]',
];

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Workbench {
  readonly host: HTMLElement;
  readonly repo: CurrentRepoService;
  readonly prefs: PreferencesService;
  readonly workspace: DiffWorkspaceService;
  settle(): Promise<void>;
}

async function renderWorkbench(
  configure: (prefs: PreferencesService) => void = () => undefined,
): Promise<Workbench> {
  const stub = createTauriGitStub(gitResponses());
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: stub.service },
    ],
  });

  const prefs = TestBed.inject(PreferencesService);
  configure(prefs);

  const repo = TestBed.inject(CurrentRepoService);
  repo.repo.set(TEST_REPO);
  repo.changes.set(workingChanges());
  repo.selectedCommitSha.set(COMMIT_SHA);
  repo.commitDetails.set(commitDetails());
  repo.diffSource.set({ kind: 'commit', sha: COMMIT_SHA });
  repo.diffText.set(textDiff(COMMIT_TEXT_FILE));
  repo.listScrollTop.set(SNAPSHOT_SCROLL);

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

  return { host: fixture.nativeElement, repo, prefs, workspace, settle };
}

async function openWorkspace(bench: Workbench): Promise<void> {
  bench.workspace.open({
    source: { kind: 'commit', sha: COMMIT_SHA },
    files: [...COMMIT_FILES],
    index: 0,
    focusKey: COMMIT_TEXT_FILE,
  });
  await bench.settle();
  // Anything the snapshot would replay has to differ from what is on screen,
  // or "no replay" and "replayed" would look the same.
  bench.repo.listScrollTop.set(0);
}

function slot(host: HTMLElement): HTMLElement {
  const element = host.querySelector<HTMLElement>(
    '[data-testid="inspector-diff-slot"]',
  );
  if (!element) throw new Error('The inspector diff slot is not on screen.');
  return element;
}

/** A release commit tagged and branched more times than one header row holds. */
const MANY_REFS: readonly RefInfo[] = Array.from({ length: 30 }, (_, i) => ({
  name: `release/2026.09.${String(i).padStart(2, '0')}`,
  ref_type: 'branch' as const,
}));

/** The inspector column at the app's minimum window height, in pixels. */
const MIN_COLUMN_HEIGHT = 560;

/**
 * Rows the file list draws for the fixture commit in its default tree view:
 * the `src/app` folder over `app.ts`, then `assets` over `data.bin`. The
 * layout pass counts drawn rows, not the files the commit touched.
 */
const FIXTURE_FILE_ROWS = 4;

/**
 * Everything on screen that keeps the commit header from pushing the diff slot
 * below its floor (AC-03): a cap the header scrolls inside, or a wrapper that
 * can give way. jsdom lays nothing out, so the row asserts the bound itself
 * rather than the pixels it produces; either shape satisfies it.
 *
 * `overflow-y` carries the cap here, not `max-height`: jsdom drops a
 * declaration whose value is a `var()` or a `calc()`, which is what a cap
 * derived from the layout policy would be.
 */
function headerBounds(host: HTMLElement): string[] {
  const found: string[] = [];

  const wrapper = host.querySelector('app-commit-inspector')?.parentElement;
  if (wrapper && !wrapper.classList.contains('flex-none')) {
    found.push('the wrapper can shrink');
  }

  const header = host.querySelector<HTMLElement>('.inspector-header');
  if (header) {
    const computed = getComputedStyle(header);
    const maxHeight = header.style.maxHeight || computed.maxHeight;
    const overflowY = header.style.overflowY || computed.overflowY;
    if (maxHeight !== '' && maxHeight !== 'none') found.push(`max-height ${maxHeight}`);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      found.push(`overflow-y ${overflowY}`);
    }
  }

  return found;
}

/**
 * The cap the layout pass writes on the inspector host, in pixels. The header
 * scrolls inside it, so it is the value AC-03 is really about — `overflow-y`
 * alone says only that a cap exists somewhere.
 */
function headerMaxH(host: HTMLElement): string {
  const inspector = host.querySelector<HTMLElement>('app-commit-inspector');
  if (!inspector) throw new Error('The inspector is not rendered.');
  return inspector.style.getPropertyValue('--inspector-header-max-h');
}

/** Fixes the inspector column at `height` for the layout pass to read. */
function sizeColumn(host: HTMLElement, height: number): void {
  const column = host.querySelector('[data-testid="inspector-column"]');
  Object.defineProperty(column, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
}

/** Direct children of the inspector column that flex-grow. */
function growingChildren(host: HTMLElement): HTMLElement[] {
  const column = host.querySelector<HTMLElement>('[data-testid="inspector-column"]');
  if (!column) throw new Error('The inspector column is not on screen.');
  return [...column.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains('flex-1'),
  );
}

describe('Workbench centre wiring', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
  });

  afterEach(() => {
    observer.restore();
  });

  it('AC-06: the viewer option controls render once, inside the workspace, and the diff slot collapses', async () => {
    const bench = await renderWorkbench();

    // Before: the viewer is at home in the inspector and the slot grows.
    expect(slot(bench.host).querySelector('app-diff-viewer')).not.toBeNull();
    expect(slot(bench.host).classList.contains('flex-1')).toBe(true);

    await openWorkspace(bench);

    for (const selector of OPTION_CONTROLS) {
      expect(bench.host.querySelectorAll(selector)).toHaveLength(1);
      expect(
        bench.host.querySelectorAll(`[data-testid="diff-workspace"] ${selector}`),
      ).toHaveLength(1);
    }

    const away = slot(bench.host);
    expect(away.classList.contains('h-0')).toBe(true);
    expect(away.classList.contains('flex-1')).toBe(false);
    expect(away.querySelector('app-diff-viewer')).toBeNull();

    bench.workspace.close();
    await bench.settle();

    const back = slot(bench.host);
    expect(back.querySelector('app-diff-viewer')).not.toBeNull();
    expect(back.classList.contains('flex-1')).toBe(true);
    expect(back.classList.contains('h-0')).toBe(false);
    for (const selector of OPTION_CONTROLS) {
      expect(bench.host.querySelectorAll(selector)).toHaveLength(1);
    }
  });

  it('AC-17: changing the rail view closes the workspace and the Changes view shows its list', async () => {
    const bench = await renderWorkbench();
    await openWorkspace(bench);

    bench.prefs.setRailView('changes');
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(false);
    expect(bench.host.querySelector('[data-testid="diff-workspace"]')).toBeNull();
    expect(bench.repo.listScrollTop()).toBe(0);

    const panel = bench.host.querySelector<HTMLElement>('app-working-changes');
    expect(panel).not.toBeNull();
    expect(panel?.parentElement?.classList.contains('hidden')).toBe(false);
    expect(
      bench.host.querySelectorAll('[data-testid^="changes-open-large-"]').length,
    ).toBeGreaterThan(0);
  });

  it('AC-17: changing the selected commit closes the workspace and the History view shows its list', async () => {
    const bench = await renderWorkbench();
    await openWorkspace(bench);

    bench.repo.selectedCommitSha.set('0ther5ha');
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(false);
    expect(bench.host.querySelector('[data-testid="diff-workspace"]')).toBeNull();
    expect(bench.host.querySelector('app-commit-list')).not.toBeNull();
    expect(bench.repo.listScrollTop()).toBe(0);
  });

  it('AC-17: changing the repository tab closes the workspace without replaying the snapshot', async () => {
    const bench = await renderWorkbench();
    await openWorkspace(bench);

    TestBed.inject(WorkspaceStore).activeTabId.set('another-tab');
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(false);
    expect(bench.host.querySelector('[data-testid="diff-workspace"]')).toBeNull();
    expect(bench.repo.listScrollTop()).toBe(0);
  });

  it('AC-03: a commit with thirty refs cannot leave the header unbounded at the minimum height', async () => {
    const bench = await renderWorkbench();

    sizeColumn(bench.host, MIN_COLUMN_HEIGHT);
    bench.repo.commitDetails.set({ ...commitDetails(), refs: [...MANY_REFS] });
    await bench.settle();

    expect(bench.host.querySelectorAll('.inspector-header yoru-badge')).toHaveLength(
      MANY_REFS.length,
    );
    expect(growingChildren(bench.host)).toEqual([slot(bench.host)]);

    expect(headerBounds(bench.host)).not.toEqual([]);

    const appearance = TestBed.inject(AppearanceService);

    // The cap the header scrolls inside is a whole number of pixels and never
    // shorter than the summary line the collapsed header shows, or the commit
    // disappears behind its own scrollbar (T29 — R4, R8).
    const written = headerMaxH(bench.host);
    expect(written).toMatch(/^\d+px$/);
    expect(Number.parseFloat(written)).toBeGreaterThanOrEqual(
      appearance.panelHeadHeight(),
    );

    // The cap the host writes is the policy's, not merely a bounded integer:
    // jsdom feeds the layout pass deterministic inputs — the column height
    // above, no stacked panels, and no measurable body, so no clamp lines and
    // no fixed header height — so the same call it makes can be made here
    // (T30 — Q1).
    const expected = computeInspectorLayout({
      availableHeight: MIN_COLUMN_HEIGHT,
      fileCount: FIXTURE_FILE_ROWS,
      bodyLines: 0,
      headerCollapsed: false,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: {
        fileRowH: appearance.fileRowHeight(),
        panelHeadH: appearance.panelHeadHeight(),
        lineH: 0,
        headerFixedH: 0,
      },
    });
    expect(written).toBe(`${expected.headerMaxH}px`);
    // round(560 − 280 − (34 + 4 × 30)) (T31 — V3).
    expect(expected.headerMaxH).toBe(126);
  });

  it('AC-03: the header cap is written in whole pixels when the column height is odd (T29 — R9)', async () => {
    const bench = await renderWorkbench();

    // Half of an odd remainder is the diff floor, so every term downstream of
    // it carries the fraction the layout pass then keys and writes.
    sizeColumn(bench.host, MIN_COLUMN_HEIGHT + 1);
    bench.repo.commitDetails.set({ ...commitDetails(), refs: [...MANY_REFS] });
    await bench.settle();

    expect(headerMaxH(bench.host)).toMatch(/^\d+px$/);
  });

  it('AC-18: the inspector at the bottom renders both collapsible blocks and only the diff slot grows', async () => {
    const bench = await renderWorkbench((prefs) =>
      prefs.setInspectorPlacement('bottom'),
    );

    expect(bench.prefs.inspectorPlacement()).toBe('bottom');
    // The split runs vertically, so the inspector really is below the centre.
    expect(
      bench.host
        .querySelector('[data-testid="centre-column"]')
        ?.parentElement?.classList.contains('flex-col'),
    ).toBe(true);

    const collapseHeader = bench.host.querySelector<HTMLElement>(
      '[data-testid="inspector-collapse-header"] button',
    );
    const collapseFiles = bench.host.querySelector<HTMLElement>(
      '[data-testid="inspector-collapse-files"] button',
    );
    expect(collapseHeader).not.toBeNull();
    expect(collapseFiles).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([slot(bench.host)]);

    collapseHeader?.click();
    await bench.settle();

    expect(
      bench.host.querySelector('[data-testid="inspector-expand-header"]'),
    ).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([slot(bench.host)]);

    bench.host
      .querySelector<HTMLElement>('[data-testid="inspector-collapse-files"] button')
      ?.click();
    await bench.settle();

    expect(
      bench.host.querySelector('[data-testid="inspector-expand-files"]'),
    ).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([slot(bench.host)]);
  });
});
