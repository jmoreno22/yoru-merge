// @vitest-environment jsdom
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import {
  COMMIT_SHA,
  COMMIT_SUBJECT,
  commitDetails,
} from '../../../testing/repo-fixtures';
import {
  installResizeObserver,
  type ResizeObserverStub,
} from '../../../testing/resize-observer';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { sizeVirtualViewport } from '../../../testing/virtual-scroll';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { computeInspectorLayout } from '../../core/services/inspector-layout';
import { PreferencesService } from '../../core/services/preferences.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import type { MenuAnchor, MenuItem } from '../../shared/ui';
import { ContextMenuService, YoruTooltip } from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';
import { CommitInspector } from './commit-inspector';

const SHORT_SHA = COMMIT_SHA.slice(0, 7);
/** Rows of viewport box the specs give the CDK list; jsdom sizes nothing. */
const LIST_ROWS = 6;
/** Thirty files: more than the column fits, so the list has to scroll (AC-04). */
const THIRTY = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
/** The column height `mount()` defaults to; the layout pass reads it off it. */
const COLUMN_H = 800;
/**
 * Column height at which the policy has to spend both of its floors, and the
 * body line height jsdom reports as `normal` unless a spec sets it (AC-03).
 */
const SQUEEZED_COLUMN_H = 300;
// Taller than the half of SQUEEZED_COLUMN_H the list floor leaves the header,
// so the cap binds and the clamp has to yield (AC-03).
const TALL_HEADER_H = 200;
const BODY_LINE_H = 16;
/**
 * The bottom placement's own minimum (`main-content.ts` MIN_BOTTOM_PX) and the
 * share the two stacked panels take of it when both are open (`blameFlex`
 * `0 0 30%`, `fileHistoryFlex` `0 0 20%`). What they leave is the remainder
 * AC-18's carve-out band is measured at, so the fixture is the real split.
 */
const BOTTOM_MIN_H = 220;
const BLAME_H = 0.3 * BOTTOM_MIN_H;
const FILE_HISTORY_H = 0.2 * BOTTOM_MIN_H;
const DIFF = '@@ -1 +1 @@\n-old\n+new\n';

/**
 * The inspector reads its height budget off an ancestor carrying this testid,
 * and jsdom gives every box a height of zero, so the layout pass needs both a
 * real ancestor and a height on it before it writes any variable.
 */
@Component({
  imports: [CommitInspector],
  template: `<div data-testid="inspector-column"><app-commit-inspector /></div>`,
})
class InspectorColumn {}

function lines(count: number): string {
  return Array.from({ length: count }, (_, i) => `body line ${i + 1}`).join('\n');
}

/** Records what the inspector asked the one shared menu to show. */
class MenuStub {
  readonly opened: { items: readonly MenuItem[]; anchor: MenuAnchor }[] = [];
  /** Id the next `open` resolves with; `null` dismisses the menu. */
  choice: string | null = null;

  open(items: readonly MenuItem[], anchor: MenuAnchor): Promise<string | null> {
    this.opened.push({ items, anchor });
    return Promise.resolve(this.choice);
  }

  close(): void {}
}

let menu: MenuStub;
let observer: ResizeObserverStub;
let stub: TauriGitStub;
let repo: CurrentRepoService;
let prefs: PreferencesService;
let workspace: DiffWorkspaceService;
let rowHeight: number;

function configure(): void {
  menu = new MenuStub();
  observer = installResizeObserver();
  stub = createTauriGitStub({ get_commit_file_diff: DIFF });
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: stub.service },
      { provide: ContextMenuService, useValue: menu },
    ],
  });

  repo = TestBed.inject(CurrentRepoService);
  prefs = TestBed.inject(PreferencesService);
  workspace = TestBed.inject(DiffWorkspaceService);
  rowHeight = TestBed.inject(AppearanceService).fileRowHeight();
  repo.repo.set({
    path: '/repo',
    name: 'repo',
    current_branch: 'main',
    is_bare: false,
  });
  repo.selectedCommitSha.set(COMMIT_SHA);
  // What `selectCommit` leaves behind: without it the service cannot tell that
  // the file the list already put in the viewer is the one on screen.
  repo.diffSource.set({ kind: 'commit', sha: COMMIT_SHA });
}

/** Lets the `void`-ed diff loads settle and runs a full render pass. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.tick();
}

/** Same, plus the animation frame the CDK audits its scroll pipeline on. */
async function settleScroll(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 32));
  TestBed.tick();
}

interface Mounted {
  fixture: ComponentFixture<InspectorColumn>;
  host: HTMLElement;
}

/**
 * Renders the inspector inside a column `columnHeight` pixels tall, with the
 * file list given a fixed viewport box the CDK can scroll inside.
 */
function mount(columnHeight = COLUMN_H): Mounted {
  const fixture = TestBed.createComponent(InspectorColumn);
  const host: HTMLElement = fixture.nativeElement;
  const column = host.querySelector('[data-testid="inspector-column"]');
  Object.defineProperty(column, 'clientHeight', {
    configurable: true,
    get: () => columnHeight,
  });
  fixture.detectChanges();
  const viewport = viewportOf(fixture);
  if (viewport) sizeVirtualViewport(viewport, LIST_ROWS * rowHeight);
  return { fixture, host };
}

function viewportOf(
  fixture: ComponentFixture<InspectorColumn>,
): CdkVirtualScrollViewport | null {
  const found = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport));
  return (found?.componentInstance as CdkVirtualScrollViewport) ?? null;
}

function fileRow(host: HTMLElement, path: string): HTMLElement {
  const row = host.querySelector<HTMLElement>(`[data-focus-key="${path}"]`);
  if (!row) throw new Error(`No row rendered for ${path}.`);
  return row;
}

function activeRowPath(host: HTMLElement): string | null {
  const active = host.querySelector('.file-row-wrap.is-active [data-focus-key]');
  return active?.getAttribute('data-focus-key') ?? null;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** The inner `<button>` a `yoru-button` renders, which is what a user hits. */
function control(host: HTMLElement, testId: string): HTMLElement {
  const button = host.querySelector<HTMLElement>(`[data-testid="${testId}"] button`);
  if (!button) throw new Error(`No control rendered for ${testId}.`);
  return button;
}

/**
 * Gives the message body the box a browser would have measured. The clamp is
 * CSS, so «Show more» only appears once a measurement says the clamp is hiding
 * something, and in jsdom every box is zero high.
 *
 * `lineHeight` is what turns that box into a line count for the layout policy:
 * jsdom resolves the property to `normal` unless it is set inline, and only a
 * row that asserts on the clamp needs the count to be real.
 */
function measureBodyAs(
  host: HTMLElement,
  shown: number,
  total: number,
  lineHeight?: number,
): HTMLElement {
  const body = host.querySelector<HTMLElement>('.body');
  if (!body) throw new Error('The commit body is not rendered.');
  if (lineHeight !== undefined) body.style.lineHeight = `${lineHeight}px`;
  Object.defineProperty(body, 'clientHeight', { configurable: true, get: () => shown });
  Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => total });
  observer.resize(body, { width: 320, height: shown });
  return body;
}

/**
 * Stacks a blame or file-history panel inside the inspector column, with the
 * box a browser would have measured for it. `applyLayout` finds them with a
 * plain `querySelectorAll` over the column, so the element only has to carry
 * the tag the production selector names and a rect; jsdom reports zero for
 * every box, which is what left this loop unobserved.
 */
function stackPanelIn(column: Element, tag: string, height: number): void {
  const panel = document.createElement(tag);
  panel.getBoundingClientRect = () => new DOMRect(0, 0, 320, height);
  column.append(panel);
}

/**
 * Gives the commit header the scroll height a browser would have measured for
 * a commit carrying many refs. The policy derives `headerFixedH` from the
 * header's `scrollHeight` minus the body's box, so this is what makes the part
 * the clamp CANNOT shrink cost anything in jsdom.
 */
function measureHeaderAs(host: HTMLElement, total: number): HTMLElement {
  const header = host.querySelector<HTMLElement>('.inspector-header');
  if (!header) throw new Error('The commit header is not rendered.');
  Object.defineProperty(header, 'scrollHeight', {
    configurable: true,
    get: () => total,
  });
  return header;
}

/** The `--inspector-*` variables the layout pass writes on the panel host. */
function layoutVariable(host: HTMLElement, name: string): string {
  const inspector = host.querySelector<HTMLElement>('app-commit-inspector');
  if (!inspector) throw new Error('The inspector is not rendered.');
  return inspector.style.getPropertyValue(name);
}

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }),
  );
}

function typeFilter(host: HTMLElement, term: string): void {
  const input = host.querySelector<HTMLInputElement>(
    '[data-testid="inspector-file-filter"]',
  );
  if (!input) throw new Error('The file filter is not rendered.');
  input.value = term;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** How many times the bridge was asked for `path`'s diff. */
function diffFetches(path: string): number {
  return stub.calls.filter(
    (call) => call.command === 'get_commit_file_diff' && call.args[2] === path,
  ).length;
}

beforeEach(configure);
afterEach(() => observer.restore());

describe('CommitInspector commit message (AC-01)', () => {
  it('AC-01: clamps a 12-line body and offers «Show more»', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();

    // The clamp height itself is the layout policy's `--inspector-clamp-lines`,
    // measured in `inspector-layout.spec.ts`; what the panel owns is applying
    // the clamp and offering the control once it hides something.
    const body = measureBodyAs(host, 64, 192);
    TestBed.tick();

    expect(body.classList.contains('is-clamped')).toBe(true);
    expect(host.querySelector('[data-testid="inspector-show-more"]')).not.toBeNull();
  });

  it('AC-01: shows a 2-line body in full with no control', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(2) }));
    const { host } = mount();
    await settle();

    const body = measureBodyAs(host, 32, 32);
    TestBed.tick();

    expect(body.textContent).toContain('body line 2');
    expect(host.querySelector('[data-testid="inspector-show-more"]')).toBeNull();
  });

  it('AC-01: «Show more» unclamps the body in place', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();
    const body = measureBodyAs(host, 64, 192);
    TestBed.tick();

    click(control(host, 'inspector-show-more'));
    TestBed.tick();

    expect(body.classList.contains('is-clamped')).toBe(false);
    expect(host.querySelector('[data-testid="inspector-show-more"]')).toBeNull();
    // Still the expanded header, still the same element: nothing was remounted.
    expect(host.querySelector('.inspector-header')).not.toBeNull();
    expect(host.querySelector('.body')).toBe(body);
  });

  it('AC-01: the expanded header carries the metadata, the ref badges and the six actions (T27)', async () => {
    repo.commitDetails.set(
      commitDetails(['a.ts'], {
        body: lines(2),
        refs: [
          { name: 'main', ref_type: 'head' },
          { name: 'v1.0.5', ref_type: 'tag' },
        ],
      }),
    );
    const { host } = mount();
    await settle();

    const header = host.querySelector<HTMLElement>('.inspector-header');
    if (!header) throw new Error('The expanded header is not rendered.');

    expect(header.textContent).toContain('Jhoan Moreno');
    expect(header.textContent).toContain('jmoreno@example.com');
    expect(header.textContent).toContain('authored');
    // The commit is dated 2026-09-02, in whichever way the locale writes it.
    expect(header.textContent).toContain('2026');
    // A bare button, not a `yoru-button`: the chip is the sha itself.
    expect(
      header.querySelector('[data-testid="inspector-copy-sha"]')?.textContent,
    ).toContain(SHORT_SHA);
    expect(
      [...header.querySelectorAll('yoru-badge')].map((badge) =>
        badge.textContent?.trim(),
      ),
    ).toEqual(['main', 'v1.0.5']);

    // The same six actions the collapsed summary line offers as icons (AC-21).
    const actions = [...header.querySelectorAll('yoru-button')]
      .map((button) => button.textContent?.trim() ?? '')
      .filter((label) => label !== '');
    expect(actions).toEqual([
      'Branch',
      'Tag',
      'Cherry-pick',
      'Revert',
      'Reset',
      'More',
    ]);
  });
});

describe('CommitInspector header collapse (AC-02)', () => {
  it('AC-02: the collapse control leaves a summary line with subject, author and short sha', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();

    click(control(host, 'inspector-collapse-header'));
    await settle();

    const summary = host.querySelector<HTMLElement>('.inspector-summary');
    expect(summary).not.toBeNull();
    expect(host.querySelector('.inspector-header')).toBeNull();
    expect(summary?.textContent).toContain(COMMIT_SUBJECT);
    expect(summary?.textContent).toContain('Jhoan Moreno');
    expect(summary?.textContent).toContain(SHORT_SHA);
  });

  it('AC-02: expanding restores the clamp state the header was collapsed in', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();
    measureBodyAs(host, 64, 192);
    TestBed.tick();
    click(control(host, 'inspector-show-more'));
    await settle();

    click(control(host, 'inspector-collapse-header'));
    await settle();
    click(control(host, 'inspector-expand-header'));
    await settle();

    const body = host.querySelector<HTMLElement>('.body');
    expect(body?.classList.contains('is-clamped')).toBe(false);
    expect(host.querySelector('[data-testid="inspector-show-more"]')).toBeNull();
  });

  it('AC-02: the two toggle shortcuts collapse each block and write its preference (T27)', async () => {
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();

    press('H', { ctrlKey: true, shiftKey: true });
    await settle();

    expect(prefs.all().commitHeaderCollapsed).toBe(true);
    expect(host.querySelector('.inspector-summary')).not.toBeNull();
    expect(host.querySelector('.inspector-header')).toBeNull();

    press('L', { ctrlKey: true, shiftKey: true });
    await settle();

    expect(prefs.all().commitFileListCollapsed).toBe(true);
    expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    // The list is gone but its header still says how many files there are.
    expect(host.querySelector('.files-header .meta-label')?.textContent).toContain(
      '1 file',
    );

    press('H', { ctrlKey: true, shiftKey: true });
    press('L', { ctrlKey: true, shiftKey: true });
    await settle();

    expect(prefs.all().commitHeaderCollapsed).toBe(false);
    expect(prefs.all().commitFileListCollapsed).toBe(false);
    expect(host.querySelector('.inspector-header')).not.toBeNull();
    expect(host.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
  });

  it('AC-02: a preference seeded collapsed paints the summary line on the first render', () => {
    prefs.set('commitHeaderCollapsed', true);
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));

    const { host } = mount();

    expect(host.querySelector('.inspector-summary')).not.toBeNull();
    expect(host.querySelector('.inspector-header')).toBeNull();
  });
});

describe('CommitInspector squeezed column (AC-03)', () => {
  it('AC-03: the squeezed column takes it out of the clamp, never out of the list floor', async () => {
    // The exact pixel arithmetic is pinned in inspector-layout.spec.ts; every
    // box is zero high in jsdom, so a row here that asserted a row COUNT would
    // be pinning the environment. What it can prove is the yield ORDER the
    // reversal inverted (AC-03, ADR-0004 amendment): the clamp gives way
    // first, and the list still holds its two-row floor.
    repo.commitDetails.set(commitDetails(THIRTY, { body: lines(12) }));
    const { host } = mount(SQUEEZED_COLUMN_H);
    await settle();

    const body = measureBodyAs(host, 4 * BODY_LINE_H, 12 * BODY_LINE_H, BODY_LINE_H);
    // The header has to cost something for the yield to be observable: jsdom
    // gives every box zero height, which would leave the policy room it never
    // has at 960x640. A commit with many refs is what makes it real.
    measureHeaderAs(host, TALL_HEADER_H + body.clientHeight);
    TestBed.tick();

    expect(Number(layoutVariable(host, '--inspector-clamp-lines'))).toBe(1);
    expect(
      Number(layoutVariable(host, '--inspector-list-rows')),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('CommitInspector collapsed clamp (AC-03)', () => {
  it('AC-03: a collapsed header still gets one clamp line, where the policy returns none', async () => {
    // The policy returns `clampLines: 0` for a collapsed header, and the
    // consumer raises it to 1 on purpose — «the header collapses a frame
    // before this pass agrees, and a zero clamp would blank the body for that
    // frame». Dropping that `Math.max` left all 835 tests green, and it is
    // also why no collapsed `clampLines` the policy returns ever reaches the
    // DOM: the two unit rows that assert 0 describe nothing observable
    // (review round 11, R11-S2-F6).
    repo.commitDetails.set(commitDetails(['a.ts'], { body: lines(12) }));
    const { host } = mount();
    await settle();

    click(control(host, 'inspector-collapse-header'));
    await settle();

    const appearance = TestBed.inject(AppearanceService);
    const policy = computeInspectorLayout({
      availableHeight: COLUMN_H,
      fileCount: 1,
      bodyLines: 12,
      headerCollapsed: true,
      fileListCollapsed: false,
      stackedPanelsHeight: 0,
      tokens: {
        fileRowH: appearance.fileRowHeight(),
        panelHeadH: appearance.panelHeadHeight(),
        lineH: 0,
        headerFixedH: 0,
      },
    });

    expect(host.querySelector('.inspector-summary')).not.toBeNull();
    // Premise, not coverage: `headerCollapsed: true` makes the policy's clamp 0
    // through its own branch, so this holds whatever `bodyLines`, `lineH` and
    // `headerFixedH` above are -- those three arguments are decorative here
    // (review round 16, O7). The assertion that carries the row is the next
    // one: the CONSUMER floors the clamp at 1 so a collapsing header cannot
    // blank the body for a frame.
    expect(policy.clampLines).toBe(0);
    expect(layoutVariable(host, '--inspector-clamp-lines')).toBe('1');
  });
});

describe('CommitInspector file list (AC-04)', () => {
  it('AC-04: thirty files get every row the column fits, with no six-row cap', async () => {
    const paths = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    repo.commitDetails.set(commitDetails(paths));
    const { fixture, host } = mount();
    await settle();

    // The pre-reversal policy pinned this at exactly 6 to hold height back
    // for the diff slot. With no diff slot in History the list is the growing
    // child (AC-04), so what the row proves is that the cap is gone: more
    // than six rows, and never more than the file count.
    const rows = Number(layoutVariable(host, '--inspector-list-rows'));
    expect(rows).toBeGreaterThan(6);
    expect(rows).toBeLessThanOrEqual(30);
    expect(host.querySelector('.files-header .meta-label')?.textContent).toContain(
      '30 files',
    );
    // Fewer rows of height than items is what makes the list scroll.
    expect(viewportOf(fixture)?.getDataLength()).toBe(30);
  });

  it('AC-04: two files render exactly two rows', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    const { host } = mount();
    await settle();

    const inspector = host.querySelector<HTMLElement>('app-commit-inspector');
    expect(inspector?.style.getPropertyValue('--inspector-list-rows')).toBe('2');
    expect(host.querySelectorAll('[data-focus-key]')).toHaveLength(2);
  });

  it('AC-04 / AC-06: the inspector column does not change shape when the workspace opens', async () => {
    repo.commitDetails.set(commitDetails(THIRTY));
    const { host } = mount();
    await settle();

    const rows = (): number => Number(layoutVariable(host, '--inspector-list-rows'));
    const closed = rows();
    expect(closed).toBeGreaterThan(0);

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [...THIRTY],
      index: 0,
      focusKey: THIRTY[0],
    });
    await settle();

    // Before the reversal the list grew here, taking over the height the diff
    // slot released. Now there is no diff share to hand over: the list already
    // owns the column, so opening and closing the workspace must leave it
    // exactly as it was — «the inspector column does not change shape» (AC-06).
    expect(rows()).toBe(closed);

    workspace.close();
    await settle();

    expect(rows()).toBe(closed);
  });

  it('AC-04: a filter that matches nothing releases the whole share, not just the rows', async () => {
    // AC-04's no-share clause names this as its reachable case, and its own
    // marker says why it works: the policy is fed the DISPLAYED row count, so
    // a filter matching none of thirty files is the same layout case as a
    // commit with no files at all. That wiring is one expression
    // (`commit-inspector.ts` `fileRows().length`) and nothing could see it —
    // handing the policy the commit's file count instead left all 835 tests
    // green, with the header capped at half the column and the other half
    // blank (review round 11, R11-S1-F2 / R11-S2-F3). The unit rows cannot
    // cover this: they pass `fileCount: 0` as a literal.
    repo.commitDetails.set(commitDetails(THIRTY));
    const { host } = mount(COLUMN_H);
    await settle();

    typeFilter(host, 'nothing-matches-this');
    await settle();

    const appearance = TestBed.inject(AppearanceService);
    const bareHead = computeInspectorLayout({
      availableHeight: COLUMN_H,
      fileCount: 0,
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

    expect(host.textContent).toContain('matches');
    expect(layoutVariable(host, '--inspector-list-rows')).toBe('0');
    expect(layoutVariable(host, '--inspector-header-max-h')).toBe(
      `${bareHead.headerMaxH}px`,
    );
    // Not merely «some cap»: the cap a THIRTY-file commit would have got is
    // the number this row must not see.
    expect(bareHead.headerMaxH).toBe(COLUMN_H - appearance.panelHeadHeight());
  });

  it('AC-04: zero files leave the header with the count and one «No files changed» line', async () => {
    repo.commitDetails.set(commitDetails([]));
    const { host } = mount();
    await settle();

    expect(host.querySelector('.files-header .meta-label')?.textContent).toContain(
      '0 files',
    );
    expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(host.textContent).toContain('No files changed');
  });

  it('AC-04 / AC-05: a body-less commit writes row and clamp counts, never NaN', async () => {
    // A commit with no message body renders no `#bodyText`, so the pass has
    // nothing to measure and hands the policy a line height of 0. Where the
    // header's allowance is exactly the part the clamp cannot shrink, the
    // clamp term is `0 / 0`, and the NaN it returns runs through `clampLines`
    // into `listHeight` and — since the `fileCount === 0` arm left `listRows`
    // — into the row count itself. `--inspector-list-rows: NaN` makes
    // `commit-inspector.css`'s `calc()` invalid at computed-value time, and
    // the `var()` fallback cannot rescue a property that IS set, so the file
    // list falls to `height: auto` (review round 15, R15-S2-F1).
    const appearance = TestBed.inject(AppearanceService);
    // Derived, not pinned: the divergence is at the height where the
    // allowance equals the fixed header, which moves with the commit's refs.
    const headerFixedH = 3 * appearance.panelHeadHeight();
    const columnH = headerFixedH + appearance.panelHeadHeight();

    repo.commitDetails.set(commitDetails([]));
    const { host } = mount(columnH);
    await settle();

    // No body, so the whole scroll height is the part the clamp cannot shrink.
    measureHeaderAs(host, headerFixedH);
    const column = host.querySelector('[data-testid="inspector-column"]');
    if (!column) throw new Error('The inspector column is not rendered.');
    observer.resize(column, { width: 320, height: columnH });
    TestBed.tick();

    const rows = layoutVariable(host, '--inspector-list-rows');
    const clamp = layoutVariable(host, '--inspector-clamp-lines');
    // Both must be written: an unwritten variable reads as '' and would let
    // this row pass without observing anything.
    expect(rows).not.toBe('');
    expect(clamp).not.toBe('');
    expect(Number.isFinite(Number(rows))).toBe(true);
    // The half that predates the `fileCount === 0` deletion: with no body
    // element to clamp it was inert, and it is still wrong.
    expect(Number.isFinite(Number(clamp))).toBe(true);
    // A list with no row to draw claims no share, exactly as a collapsed one.
    expect(rows).toBe('0');
  });
});

describe('CommitInspector file list collapse (AC-05)', () => {
  it('AC-05: collapsing keeps the header count and the active file, expanding brings the row back', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    const { host } = mount();
    await settle();

    click(fileRow(host, 'b.ts'));
    await settle();
    expect(activeRowPath(host)).toBe('b.ts');

    click(control(host, 'inspector-collapse-files'));
    await settle();

    expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(host.querySelector('.files-header .meta-label')?.textContent).toContain(
      '2 files',
    );
    // What the diff viewer is showing, which is what must not move.
    expect(workspace.activeCommitFile()).toBe('b.ts');
    expect(repo.diffText()).toBe(DIFF);

    click(control(host, 'inspector-expand-files'));
    await settle();

    expect(activeRowPath(host)).toBe('b.ts');
  });
});

describe('CommitInspector stacked panels (AC-19)', () => {
  it('AC-19: the stacked panels come off the column before the policy is given a height', async () => {
    // The consumer half of AC-19 had no witness: neutering the
    // `stackedPanelsHeight` accumulation in `applyLayout` left all 842 tests
    // green, because no component row rendered a stacked panel inside the
    // column and both of this file's own policy calls pass 0 (review round 17,
    // R17-F11). `main-content.spec.ts` pins the two panels' flex BASES and the
    // unit sweep pins the policy's `availableHeight - stackedPanelsHeight`;
    // nothing joined them, so an inspector that stopped subtracting them would
    // size against the whole column and overflow its box at every window size.
    //
    // This is also where the branch's canonical 110 px remainder comes from —
    // the one AC-18's carve-out band, the collapsed twin and the fourth manual
    // run are all measured at — so the fixture is the real split rather than a
    // round number: the bottom placement's own minimum, with both panels open.
    repo.commitDetails.set(commitDetails(THIRTY));
    const { host } = mount(BOTTOM_MIN_H);
    await settle();

    const column = host.querySelector('[data-testid="inspector-column"]');
    if (!column) throw new Error('The inspector column is not rendered.');
    stackPanelIn(column, 'app-blame-viewer', BLAME_H);
    stackPanelIn(column, 'app-file-history-panel', FILE_HISTORY_H);
    observer.resize(column, { width: 320, height: BOTTOM_MIN_H });
    TestBed.tick();

    // Derived from the policy, never pinned: what this row proves is WHICH
    // height reached it. A commit with no body renders no `#bodyText`, so the
    // pass hands the policy 0 lines and the `lineH` fallback, and jsdom leaves
    // the header's `scrollHeight` at 0 — the three arguments below are the
    // consumer's real inputs at this fixture, not decoration.
    const appearance = TestBed.inject(AppearanceService);
    const asked = {
      fileCount: THIRTY.length,
      bodyLines: 0,
      headerCollapsed: false,
      fileListCollapsed: false,
      tokens: {
        fileRowH: appearance.fileRowHeight(),
        panelHeadH: appearance.panelHeadHeight(),
        lineH: 1,
        headerFixedH: 0,
      },
    };
    const minusPanels = computeInspectorLayout({
      ...asked,
      availableHeight: BOTTOM_MIN_H,
      stackedPanelsHeight: BLAME_H + FILE_HISTORY_H,
    });
    const wholeColumn = computeInspectorLayout({
      ...asked,
      availableHeight: BOTTOM_MIN_H,
      stackedPanelsHeight: 0,
    });

    // Premise, not coverage: without this the row could pass on a policy that
    // ignores its `stackedPanelsHeight` argument entirely, and the two
    // expectations below would be the same number.
    expect(minusPanels).not.toEqual(wholeColumn);

    // The detectors. Both variables carry the remainder the panels left, and
    // neither carries the height of the column they sit in.
    expect(layoutVariable(host, '--inspector-list-rows')).toBe(
      String(minusPanels.listRows),
    );
    expect(layoutVariable(host, '--inspector-header-max-h')).toBe(
      `${minusPanels.headerMaxH}px`,
    );
    expect(layoutVariable(host, '--inspector-list-rows')).not.toBe(
      String(wholeColumn.listRows),
    );
    expect(layoutVariable(host, '--inspector-header-max-h')).not.toBe(
      `${wholeColumn.headerMaxH}px`,
    );
  });
});

describe('CommitInspector open-large gesture (AC-06)', () => {
  /** Also the displayed order: tree order with the `src` folder row skipped. */
  const PATHS = ['src/a.ts', 'src/b.ts', 'README.md'];

  /**
   * The three gestures below are the ones AC-06 lists for the preference OFF
   * («with that preference off — double-click, its open-large control, or the
   * shortcut»), so the preference is pinned rather than inherited: with it on,
   * the click that makes the row active would itself open the workspace and
   * these rows would be measuring the wrong gesture. The ON path is T36's.
   */
  async function withActiveRow(): Promise<HTMLElement> {
    prefs.set('commitFileClickOpensWorkspace', false);
    repo.commitDetails.set(commitDetails(PATHS));
    const { host } = mount();
    await settle();
    click(fileRow(host, 'src/b.ts'));
    await settle();
    return host;
  }

  function expectOpenedOnB(open: ReturnType<typeof vi.spyOn>): void {
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toEqual({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: PATHS,
      index: 1,
      focusKey: 'src/b.ts',
    });
  }

  it('AC-06: a double-click on the active row opens the workspace once', async () => {
    const host = await withActiveRow();
    const open = vi.spyOn(workspace, 'open');

    host
      .querySelector('.file-row-wrap.is-active')
      ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();

    expectOpenedOnB(open);
  });

  it('AC-06: the row control opens the workspace once', async () => {
    const host = await withActiveRow();
    const open = vi.spyOn(workspace, 'open');

    click(control(host, 'inspector-open-large-src/b.ts'));
    await settle();

    expectOpenedOnB(open);
  });

  it('AC-06: a double-click loads the diff once, not once per click (T27)', async () => {
    // `withActiveRow` is the first click of the double-click; the second and
    // the `dblclick` both land on a row whose diff is already on screen.
    const host = await withActiveRow();
    click(fileRow(host, 'src/b.ts'));
    await settle();

    host
      .querySelector('.file-row-wrap.is-active')
      ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();

    expect(workspace.current()?.file).toBe('src/b.ts');
    expect(diffFetches('src/b.ts')).toBe(1);
  });

  it('AC-06: mod+d opens the workspace once on the active row', async () => {
    const host = await withActiveRow();
    const open = vi.spyOn(workspace, 'open');
    expect(host).not.toBeNull();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }),
    );
    await settle();

    expectOpenedOnB(open);
  });
});

describe('CommitInspector workspace navigation (AC-11)', () => {
  it('AC-11: next moves the active row to the third of five files', async () => {
    const paths = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    repo.commitDetails.set(commitDetails(paths));
    const { host } = mount();
    await settle();

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [...paths],
      index: 1,
      focusKey: 'b.ts',
    });
    await settle();
    expect(activeRowPath(host)).toBe('b.ts');

    workspace.next();
    await settle();

    expect(workspace.current()?.file).toBe('c.ts');
    expect(activeRowPath(host)).toBe('c.ts');
  });

  it('AC-11: a filter term that hides the shown file leaves the workspace alone (T27)', async () => {
    const paths = ['src/a.ts', 'src/b.ts', 'README.md'];
    repo.commitDetails.set(commitDetails(paths));
    const { host } = mount();
    await settle();

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [...paths],
      index: 1,
      focusKey: 'src/b.ts',
    });
    await settle();

    typeFilter(host, 'README');
    await settle();

    // The row really is gone from the list, so the panel did re-publish.
    expect(host.querySelector('[data-focus-key="src/b.ts"]')).toBeNull();
    // The file is only hidden, not removed from the commit: a keystroke in the
    // filter must not advance the workspace off it, or close it.
    expect(workspace.isOpen()).toBe(true);
    expect(workspace.current()?.file).toBe('src/b.ts');
    expect(workspace.current()?.files).toEqual(paths);
  });
});

describe('CommitInspector focus restore on close (AC-08)', () => {
  const PATHS = Array.from(
    { length: 30 },
    (_, i) => `file${String(i).padStart(2, '0')}.ts`,
  );

  it('AC-08: close focuses the row the gesture came from', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    const { host } = mount();
    await settle();

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: ['a.ts', 'b.ts'],
      index: 1,
      focusKey: 'b.ts',
    });
    await settle();

    workspace.close();
    await settle();
    TestBed.tick();

    expect(workspace.pendingFocusKey()).toBeNull();
    expect(document.activeElement).toBe(fileRow(host, 'b.ts'));
  });

  it('AC-08: close after navigation focuses the now-active row', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts', 'c.ts']));
    const { host } = mount();
    await settle();

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: ['a.ts', 'b.ts', 'c.ts'],
      index: 0,
      focusKey: 'a.ts',
    });
    await settle();
    workspace.next();
    await settle();

    workspace.close();
    await settle();
    TestBed.tick();

    expect(document.activeElement).toBe(fileRow(host, 'b.ts'));
  });

  it('AC-08: a target row outside the rendered range is scrolled in, then focused', async () => {
    repo.commitDetails.set(commitDetails(PATHS));
    const { fixture, host } = mount();
    await settle();

    const viewport = viewportOf(fixture);
    if (!viewport) throw new Error('The file list is not rendered.');
    const target = PATHS[25];
    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: [...PATHS],
      index: 25,
      focusKey: target,
    });
    await settleScroll();

    // The developer scrolls back to the top while the workspace is open, so the
    // row the restore has to reach is no longer in the rendered range.
    viewport.scrollToIndex(0);
    await settleScroll();
    expect(host.querySelector(`[data-focus-key="${target}"]`)).toBeNull();

    workspace.close();
    await settleScroll();
    await settleScroll();

    expect(document.activeElement).toBe(fileRow(host, target));
  });

  it('AC-08: a pending key whose commit file row is gone expires instead of taking the focus when the path comes back (T30 — Q2)', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    const { host } = mount();
    await settle();

    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: ['a.ts', 'b.ts'],
      index: 1,
      focusKey: 'b.ts',
    });
    await settle();

    // History was rewritten under the open workspace: the commit publishes no
    // files at all, so a commit workspace stays open on the viewer's
    // explanation (AC-07) and the row the restore will name is gone.
    repo.commitDetails.set(commitDetails([]));
    await settle();
    expect(workspace.isOpen()).toBe(true);
    expect(host.querySelector('[data-focus-key="b.ts"]')).toBeNull();

    workspace.close();
    await settle();
    TestBed.tick();

    // Nobody owns a bare-path key but this panel, and its row is absent: the
    // key has to expire here rather than wait for a row to appear — dropping
    // `focusRestored` from the `index < 0` arm reddens this line.
    expect(workspace.pendingFocusKey()).toBeNull();
    // Where the focus sits is not observable at this tier, in either phase: the
    // `index < 0` arm returns without focusing, and on the returning path below
    // the deferred `focusVirtualRow` never lands on the viewport the emptied
    // list re-created — so an assertion on the focus would pass whether or not
    // the key expired (T33).

    // The path comes back — a revert, or the file touched again.
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    await settle();
    TestBed.tick();

    // The list really re-rendered: a panel left on stale details draws no row.
    expect(host.querySelector('[data-focus-key="b.ts"]')).not.toBeNull();
    // The key stays gone. This reddens only if *neither* arm of the restore
    // effect consumes it — either one alone clears it.
    expect(workspace.pendingFocusKey()).toBeNull();
  });
});

describe('CommitInspector on a list that empties and comes back (AC-07)', () => {
  /** How many times the panel has asked the backend for a commit file's diff. */
  function fileDiffLoads(): number {
    return stub.calls.filter((call) => call.command === 'get_commit_file_diff').length;
  }

  it('AC-07: the file the emptied list dropped loads again once it is back', async () => {
    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    const { fixture, host } = mount();
    await settle();

    click(fileRow(host, 'a.ts'));
    await settle();
    expect(repo.diffText()).toBe(DIFF);

    click(control(host, 'inspector-open-large-a.ts'));
    await settle();
    expect(workspace.isOpen()).toBe(true);

    // History was rewritten under the open workspace: the commit is still
    // selected but publishes no files, so AC-07 keeps the workspace on the
    // viewer's own explanation and blanks the patch.
    repo.commitDetails.set(commitDetails([]));
    await settle();
    expect(repo.diffText()).toBe('');

    workspace.close();
    await settle();

    repo.commitDetails.set(commitDetails(['a.ts', 'b.ts']));
    await settle();
    // A repopulated list is a new viewport, and a new viewport measures zero.
    const viewport = viewportOf(fixture);
    if (viewport) sizeVirtualViewport(viewport, LIST_ROWS * rowHeight);
    await settle();

    const before = fileDiffLoads();
    click(fileRow(host, 'a.ts'));
    await settle();

    expect(fileDiffLoads() - before).toBe(1);
    expect(repo.diffText()).toBe(DIFF);
  });
});

describe('CommitInspector collapsed summary actions (AC-21)', () => {
  const ACTION_LABELS: Readonly<Record<string, string>> = {
    'inspector-action-branch': 'Create branch here',
    'inspector-action-tag': 'Create tag here',
    'inspector-action-cherry-pick': 'Cherry-pick this commit',
    'inspector-action-revert': 'Revert this commit',
    'inspector-action-reset': 'Reset to this commit',
    'inspector-more': 'More commit actions',
  };

  /**
   * Makes the summary line report a real width. The count is a width budget:
   * the row's own box minus the reserve the subject keeps and the width of one
   * icon slot, so both numbers have to come from somewhere in jsdom.
   */
  function measureSummaryAs(host: HTMLElement, rowWidth: number, slot: number): void {
    const actions = host.querySelector<HTMLElement>(
      '[data-testid="inspector-header-actions"]',
    );
    const row = actions?.parentElement;
    const more = actions?.lastElementChild as HTMLElement | undefined;
    if (!actions || !row || !more) throw new Error('The summary line is not rendered.');

    Object.defineProperty(row, 'clientWidth', {
      configurable: true,
      get: () => rowWidth,
    });
    more.getBoundingClientRect = () => new DOMRect(0, 0, slot, 28);
    observer.resize(actions, { width: rowWidth, height: 28 });
  }

  async function collapsed(): Promise<Mounted> {
    prefs.set('commitHeaderCollapsed', true);
    repo.commitDetails.set(commitDetails(['a.ts']));
    const mounted = mount();
    await settle();
    return mounted;
  }

  it('AC-21: the summary line shows the six icon actions with tooltips', async () => {
    const { fixture, host } = await collapsed();

    for (const [testId, label] of Object.entries(ACTION_LABELS)) {
      expect(control(host, testId).getAttribute('aria-label')).toBe(label);
    }

    // A tooltip is a directive, not an attribute: it only reaches the DOM on
    // hover, so what the row can assert is the text each control carries.
    const tooltips = fixture.debugElement
      .queryAll(By.directive(YoruTooltip))
      .map((element) => element.injector.get(YoruTooltip).text());
    for (const label of Object.values(ACTION_LABELS)) {
      expect(tooltips).toContain(label);
    }
  });

  it('AC-21: a narrow summary line moves the trailing actions into More', async () => {
    const { host } = await collapsed();
    // The full menu asks the bridge for the remotes when it holds none, and
    // the browse items are not what this row is about.
    repo.remotes.set([{ name: 'origin', fetch_url: '', push_url: '' }]);

    measureSummaryAs(host, 250, 28);
    TestBed.tick();

    const inline = [...host.querySelectorAll('[data-testid^="inspector-action-"]')].map(
      (element) => element.getAttribute('data-testid'),
    );
    expect(inline).toEqual(['inspector-action-branch', 'inspector-action-tag']);

    click(control(host, 'inspector-more'));
    await settle();

    const promoted = menu.opened
      .at(-1)
      ?.items.slice(0, 3)
      .map((item) => item.id);
    expect(promoted).toEqual(['cherry-pick', 'revert', 'reset']);
  });

  it('AC-21: Reset → Hard raises the danger confirmation and resets nothing', async () => {
    const { host } = await collapsed();
    const dialogs = TestBed.inject(DialogsService);
    menu.choice = 'reset-hard';

    click(control(host, 'inspector-action-reset'));
    await settle();

    const submenu = menu.opened[0]?.items.map((item) => item.id);
    expect(submenu).toEqual(['reset-soft', 'reset-mixed', 'reset-hard']);

    const confirm = dialogs.confirmRequest();
    expect(confirm?.tone).toBe('danger');
    expect(confirm?.doubleConfirm).toBe(true);
    expect(confirm?.title).toContain(SHORT_SHA);
  });
});

describe('CommitInspector open-behaviour control (AC-22)', () => {
  const PATHS = ['src/a.ts', 'src/b.ts'];

  async function mounted(clickOpens: boolean): Promise<HTMLElement> {
    prefs.set('commitFileClickOpensWorkspace', clickOpens);
    repo.commitDetails.set(commitDetails(PATHS));
    const { host } = mount();
    await settle();
    return host;
  }

  it('AC-22: a single click opens the diff workspace while the preference is on', async () => {
    const host = await mounted(true);
    const open = vi.spyOn(workspace, 'open');

    click(fileRow(host, 'src/b.ts'));
    await settle();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toEqual({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: PATHS,
      index: 1,
      focusKey: 'src/b.ts',
    });
  });

  it('AC-22: a single click only makes the row active while the preference is off', async () => {
    const host = await mounted(false);
    const open = vi.spyOn(workspace, 'open');

    click(fileRow(host, 'src/b.ts'));
    await settle();

    expect(open).not.toHaveBeenCalled();
    expect(workspace.isOpen()).toBe(false);
    expect(activeRowPath(host)).toBe('src/b.ts');
  });

  it('AC-22: the control shows which of the two modes is live, not the one it would switch to', async () => {
    const host = await mounted(true);

    const button = (): HTMLElement => {
      const found = host.querySelector<HTMLElement>(
        '[data-testid="inspector-click-opens"]',
      );
      if (!found) throw new Error('The open-behaviour control is not rendered.');
      return found;
    };

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().getAttribute('aria-label')).toBe(
      'A single click opens the diff workspace',
    );

    click(button());
    await settle();

    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().getAttribute('aria-label')).toBe(
      'A single click only selects the file',
    );
  });

  it('AC-22: the control writes the durable preference, like the two collapse states', async () => {
    const host = await mounted(true);

    click(
      host.querySelector<HTMLElement>('[data-testid="inspector-click-opens"]') ??
        document.body,
    );
    await settle();

    expect(prefs.all().commitFileClickOpensWorkspace).toBe(false);

    // What a restart sees: a second inspector reads the stored value, it is not
    // component state that dies with the view.
    const { host: remounted } = mount();
    await settle();
    expect(
      remounted
        .querySelector('[data-testid="inspector-click-opens"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('AC-22: the three explicit gestures keep working in BOTH modes', async () => {
    for (const clickOpens of [true, false]) {
      const host = await mounted(clickOpens);

      // Double-click: the first click of the pair may open the workspace on
      // its own when the preference is on, so what matters is that the gesture
      // lands on the right file either way.
      click(fileRow(host, 'src/b.ts'));
      await settle();
      fileRow(host, 'src/b.ts')
        .closest('.file-row-wrap')
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(workspace.isOpen()).toBe(true);
      expect(workspace.current()?.file).toBe('src/b.ts');
      workspace.close();
      await settle();

      // The open-large control on the row.
      click(control(host, 'inspector-open-large-src/a.ts'));
      await settle();
      expect(workspace.isOpen()).toBe(true);
      expect(workspace.current()?.file).toBe('src/a.ts');
      workspace.close();
      await settle();

      // The shortcut, from the active row.
      click(fileRow(host, 'src/b.ts'));
      await settle();
      if (workspace.isOpen()) {
        workspace.close();
        await settle();
      }
      press('d', { ctrlKey: true });
      await settle();
      expect(workspace.isOpen()).toBe(true);
      expect(workspace.current()?.file).toBe('src/b.ts');
      workspace.close();
      await settle();
    }
  });
});
