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
 * Everything on screen that keeps the commit header from pushing the commit
 * file list below its floor (AC-03): a cap the header scrolls inside, or a
 * wrapper that can give way. jsdom lays nothing out, so the row asserts the bound itself
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

/** The block that hosts the commit header and file list — the growing child. */
function inspectorBlock(host: HTMLElement): HTMLElement {
  const element = host
    .querySelector('[data-testid="inspector-column"] app-commit-inspector')
    ?.closest<HTMLElement>('div');
  if (!element) throw new Error('The commit inspector block is not on screen.');
  return element;
}

/**
 * Direct children of the inspector column that flex-grow — by the `flex-1`
 * class OR by an inline `flex` whose grow term is not 0. The stacked panels
 * take their basis inline (`[style.flex]`), so a class-only filter could not
 * see them growing (review round 10, R10-S1-F8).
 */
function growingChildren(host: HTMLElement): HTMLElement[] {
  const column = host.querySelector<HTMLElement>('[data-testid="inspector-column"]');
  if (!column) throw new Error('The inspector column is not on screen.');
  return [...column.children].filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false;
    if (child.classList.contains('flex-1')) return true;
    const grow = child.style.flex.trim().split(/\s+/)[0];
    return grow !== undefined && grow !== '' && grow !== '0';
  });
}

/**
 * The wrapper each stacked panel sits in, in template order. `growingChildren()`
 * answers «which children grow»; this answers «what did the template declare»,
 * which is the only question a jsdom tier can answer about a CLASS-based grow:
 * with no stylesheet loaded, `getComputedStyle(el).flexGrow` reports the
 * initial `0` for `flex-[3]` just as it does for a non-growing panel (review
 * round 11, R11-S2-F2).
 */
function stackedPanelWrappers(host: HTMLElement): HTMLElement[] {
  return ['app-blame-viewer', 'app-file-history-panel']
    .map((tag) => host.querySelector(tag)?.closest<HTMLElement>('[style*="flex"], div'))
    .filter((element): element is HTMLElement => Boolean(element));
}

/** Tailwind utilities that would make a child grow. */
const GROWTH_UTILITIES = /^(flex-1|flex-auto|grow|grow-\[|flex-\[)/;

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

  it('AC-06: the viewer option controls render once, inside the workspace, and the History slot only parks the element', async () => {
    const bench = await renderWorkbench();

    // Before: the viewer element is parked at home, but in History the slot is
    // already at zero height — the commit diff is read only in the workspace,
    // so the slot never grows there and the commit file list is what does
    // (AC-06 as amended 2026-09-07).
    expect(slot(bench.host).querySelector('app-diff-viewer')).not.toBeNull();
    expect(slot(bench.host).classList.contains('h-0')).toBe(true);
    expect(slot(bench.host).classList.contains('flex-1')).toBe(false);

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
    // Home again, and still parked: closing restores the element, not a slot
    // that grows — that only happens in Changes.
    expect(back.classList.contains('h-0')).toBe(true);
    expect(back.classList.contains('flex-1')).toBe(false);
    for (const selector of OPTION_CONTROLS) {
      expect(bench.host.querySelectorAll(selector)).toHaveLength(1);
    }
  });

  it('AC-06: the Changes view keeps a real, growing slot for the working tree', async () => {
    // The reversal is History-only: the working tree still reads its diff
    // inline, which is why the slot is conditional rather than always h-0.
    const bench = await renderWorkbench((prefs) => prefs.setRailView('changes'));

    expect(slot(bench.host).querySelector('app-diff-viewer')).not.toBeNull();
    expect(slot(bench.host).classList.contains('flex-1')).toBe(true);
    expect(slot(bench.host).classList.contains('h-0')).toBe(false);
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
    // The list block is the growing child now, not the diff slot: the header
    // is what the cap binds, and the height it gives up lands in the list.
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);

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
    // floor(560 − max(50 % floor 280, 2-row floor 34 + 2 × 30)) — the cap is
    // what the list's share leaves the header, not what the diff's did
    // (T31 — V3, re-pinned for the 2026-09-07 reversal). The operation read
    // `round(` until review round 14 (R14-S2-F2): it was true when written, and
    // T44 changed the policy to `Math.floor` for R10-S2-F2 without sweeping this
    // comment. 280 is an integer, so the value is the same either way — what was
    // false was the name of the operation, in the one file that contradicted
    // `inspector-layout.spec.ts`'s «FLOOR, not round».
    expect(expected.headerMaxH).toBe(280);
  });

  it('AC-03: the header cap is written in whole pixels when the column height is odd (T29 — R9)', async () => {
    const bench = await renderWorkbench();

    // Half of an odd remainder is the list floor, so every term downstream of
    // it carries the fraction the layout pass then keys and writes.
    sizeColumn(bench.host, MIN_COLUMN_HEIGHT + 1);
    bench.repo.commitDetails.set({ ...commitDetails(), refs: [...MANY_REFS] });
    await bench.settle();

    expect(headerMaxH(bench.host)).toMatch(/^\d+px$/);
  });

  it('AC-19: blame and file history hold a fixed basis, so the commit file list stays the only growing child (R10)', async () => {
    // These two bases are the whole of AC-19 and the reason AC-05 says the
    // released height is «left empty»: a stacked panel that grew would take a
    // cut of every pixel the commit inspector releases. Turning either into a
    // growing child left the whole suite green until this row existed (review
    // round 10, R10-S1-F8) — the four rows above filter on the `flex-1` CLASS
    // while the panels set their basis inline, and none of them opens a panel.
    const bench = await renderWorkbench();
    bench.repo.blameFile.set(COMMIT_TEXT_FILE);
    await bench.settle();

    expect(bench.host.querySelector('app-blame-viewer')).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);
    // Blame alone: 3/8 of the column, the share the 1.0.5 build gave it.
    expect(stackedPanelWrappers(bench.host)[0]?.style.flex).toBe('0 0 37.5%');

    bench.repo.fileHistoryFile.set(COMMIT_TEXT_FILE);
    await bench.settle();

    // Both stacked: the bases change (3/8 → 3/10, 2/7 → 2/10) and stay fixed.
    expect(bench.host.querySelector('app-file-history-panel')).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);

    // And the mechanism itself, not only its current effect. `growingChildren()`
    // is a whitelist of two ways to grow — the `flex-1` class and an inline
    // `flex` — so it cannot see a third: giving blame the `flex-[3]` the
    // pre-feature stack used (`sad.md` §2) and dropping its `[style.flex]` left
    // the whole suite green (review round 11, R11-S2-F2). What every panel must
    // declare is a fixed basis and no growth utility at all.
    const wrappers = stackedPanelWrappers(bench.host);
    expect(wrappers).toHaveLength(2);
    for (const wrapper of wrappers) {
      expect(wrapper.style.flex).toMatch(/^0 0 /);
      expect(
        [...wrapper.classList].filter((name) => GROWTH_UTILITIES.test(name)),
      ).toEqual([]);
      // A fixed basis is not enough on its own: a min-height overrides it and
      // the panel takes the height whatever it declares. Doubling the bases,
      // or adding `[style.minHeight]="'400px'"`, left all 838 tests green
      // (review round 12, R12-S2-F1) — and these are the values the 110 px
      // remainder AC-18's carve-out band is derived from.
      expect(wrapper.style.minHeight).toBe('');
      expect(wrapper.style.maxHeight).toBe('');
      // `min-h-0` is the opposite hazard and is required here: it is what lets
      // a flex child shrink below its content. What must never appear is a
      // FLOOR (`min-h-40`, `min-h-[400px]`) or a ceiling other than `none`.
      expect(
        [...wrapper.classList].filter(
          (name) =>
            /^(min-h-|max-h-)/.test(name) &&
            name !== 'min-h-0' &&
            name !== 'max-h-none',
        ),
      ).toEqual([]);
    }
    // Each panel must also FILL the wrapper its basis won. The wrapper is pinned
    // three ways above and the child was pinned in none of them: replacing
    // `h-full` with `h-1/2` on either host left all 839 tests green, which
    // paints half of a 30 % / 20 % band empty at every window size (review
    // round 15, R15-L-F2). Asserted on the component host, where the utility is.
    for (const tag of ['app-blame-viewer', 'app-file-history-panel']) {
      const panel = bench.host.querySelector<HTMLElement>(tag);
      expect(panel, tag).not.toBeNull();
      expect([...(panel?.classList ?? [])], tag).toContain('h-full');
      expect(
        [...(panel?.classList ?? [])].filter((name) => /^h-(?!full$)/.test(name)),
        tag,
      ).toEqual([]);
    }
    // The values themselves, in template order, so the remainder every artefact
    // quotes as «a fixed 110 px» cannot move without reddening a row.
    expect(wrappers.map((wrapper) => wrapper.style.flex)).toEqual([
      '0 0 30%',
      '0 0 20%',
    ]);

    // The fourth declared basis: file history opened ALONE. It is the one value
    // of the four the owner decision named that nothing pinned — changing it
    // left all 839 tests green (review round 13, R13-S1-F2 ≡ R13-S2-F2), so a
    // single stacked panel could take 58.6 % of the column instead of 28.6 %,
    // which is AC-19's subject in the words `main-content.ts` uses. The
    // `toEqual` on the mapped list pins the COUNT too: with blame closed there
    // must be exactly one stacked wrapper left.
    bench.repo.blameFile.set(null);
    await bench.settle();

    expect(bench.host.querySelector('app-blame-viewer')).toBeNull();
    expect(
      stackedPanelWrappers(bench.host).map((wrapper) => wrapper.style.flex),
    ).toEqual(['0 0 28.6%']);
  });

  it('AC-18: the inspector at the bottom renders both collapsible blocks and only the commit file list grows', async () => {
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
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);

    collapseHeader?.click();
    await bench.settle();

    expect(
      bench.host.querySelector('[data-testid="inspector-expand-header"]'),
    ).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);

    bench.host
      .querySelector<HTMLElement>('[data-testid="inspector-collapse-files"] button')
      ?.click();
    await bench.settle();

    expect(
      bench.host.querySelector('[data-testid="inspector-expand-files"]'),
    ).not.toBeNull();
    expect(growingChildren(bench.host)).toEqual([inspectorBlock(bench.host)]);

    // MIN_BOTTOM_PX, pinned through the only thing that observes it: the centre
    // column's clamped height. Dragging the splitter to the far end must still
    // leave the inspector its 220 px minimum, which — with both panels stacked
    // at 30 % + 20 % — is the 110 px remainder AC-18's carve-out band, T51's
    // collapsed twin and the fourth manual run are all derived from. Raising
    // the constant to 400 left all 838 tests green (review round 12,
    // R12-S2-F1).
    const splitHost = bench.host.querySelector<HTMLElement>(
      '[data-testid="centre-column"]',
    )?.parentElement;
    expect(splitHost).toBeTruthy();
    if (!splitHost) throw new Error('The workbench split host is not on screen.');

    bench.prefs.setWorkbenchSplit(100);
    observer.resize(splitHost, { width: 1280, height: 800 });
    await bench.settle();

    const centre = bench.host.querySelector<HTMLElement>(
      '[data-testid="centre-column"]',
    );
    expect(centre?.style.height).toBe('580px');
    expect(800 - Number.parseFloat(centre?.style.height ?? '0')).toBe(220);
  });

  it('AC-18: the split clamp keeps both minimums on each axis, from either end of the drag', async () => {
    // The bottom axis had one witness (the row above, MIN_BOTTOM_PX through the
    // clamped centre height) and the RIGHT axis had none: MIN_CENTRE_PX took any
    // value from 60 to 2000 and MIN_RIGHT_PX from 20 to 2000 with all 839 tests
    // green, while MIN_CENTRE_HEIGHT_PX was only ever witnessed from above
    // (review round 15, R15-L-F1 and R15-L-F3). It is not only a splitter: the
    // criteria scope the expanded carve-out band as unreachable ON THE ARGUMENT
    // that MIN_RIGHT_PX is a width, so a criterion leans on this constant.
    const bench = await renderWorkbench();

    const splitHost = bench.host.querySelector<HTMLElement>(
      '[data-testid="centre-column"]',
    )?.parentElement;
    expect(splitHost).toBeTruthy();
    if (!splitHost) throw new Error('The workbench split host is not on screen.');

    const centre = () =>
      bench.host.querySelector<HTMLElement>('[data-testid="centre-column"]');

    // Inspector right (the default): the axis is width.
    expect(bench.prefs.inspectorPlacement()).toBe('right');

    // Drag to the far right. The centre may not swallow the inspector: it stops
    // at container - MIN_RIGHT_PX = 1280 - 320.
    bench.prefs.setWorkbenchSplit(100);
    observer.resize(splitHost, { width: 1280, height: 800 });
    await bench.settle();
    expect(centre()?.style.width).toBe('960px');
    expect(1280 - Number.parseFloat(centre()?.style.width ?? '0')).toBe(320);

    // Drag to the far left. The centre keeps MIN_CENTRE_PX.
    bench.prefs.setWorkbenchSplit(0);
    await bench.settle();
    expect(centre()?.style.width).toBe('360px');

    // Inspector bottom: the axis is height, and the floor is the one the row
    // above never reaches because it only ever drags to the far end.
    bench.prefs.setInspectorPlacement('bottom');
    await bench.settle();
    expect(centre()?.style.height).toBe('200px');
    expect(centre()?.style.width).toBe('');
  });
});
