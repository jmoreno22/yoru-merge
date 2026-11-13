// @vitest-environment jsdom
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { gitResponses, TEST_REPO } from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { sizeVirtualViewport } from '../../../testing/virtual-scroll';
import type { BranchInfo, CommitInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { ContextMenuService } from '../../shared/ui';
import { CommitList } from './commit-list';

const TIP = 'd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0';

/** HEAD is on `feat/x`; `develop` and `origin/develop` sit on the same commit. */
const TIP_COMMIT: CommitInfo = {
  sha: TIP,
  short_sha: TIP.slice(0, 7),
  message: 'feat: the tip',
  author_name: 'Jhoan Moreno',
  author_email: 'jmoreno@example.com',
  date: '2026-11-13T10:00:00Z',
  parent_shas: [],
  refs: [
    { name: 'feat/x', ref_type: 'head' },
    { name: 'feat/x', ref_type: 'branch' },
    { name: 'develop', ref_type: 'branch' },
    { name: 'origin/develop', ref_type: 'remote' },
  ],
  on_current_branch: true,
};

function branch(name: string, overrides: Partial<BranchInfo> = {}): BranchInfo {
  return {
    name,
    sha: TIP,
    is_remote: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    ...overrides,
  };
}

interface Bench {
  readonly fixture: ComponentFixture<CommitList>;
  readonly host: HTMLElement;
  readonly git: TauriGitStub;
  settle(): Promise<void>;
}

async function renderList(developBehind: number): Promise<Bench> {
  const git = createTauriGitStub(
    gitResponses({
      checkout_branch: { kind: 'success' },
      fast_forward: { kind: 'fast_forwarded' },
    }),
  );
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: git.service },
    ],
  });

  const repo = TestBed.inject(CurrentRepoService);
  repo.repo.set(TEST_REPO);
  repo.commits.set([TIP_COMMIT]);
  repo.historyTotal.set(1);
  repo.branches.set({
    local: [
      branch('feat/x'),
      branch('develop', { upstream: 'origin/develop', behind: developBehind }),
    ],
    remote: [branch('origin/develop', { is_remote: true })],
    current: 'feat/x',
  });

  const fixture = TestBed.createComponent(CommitList);
  fixture.componentRef.setInput('showSearch', false);
  fixture.detectChanges();

  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 32));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  };

  const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
    .componentInstance as CdkVirtualScrollViewport;
  sizeVirtualViewport(viewport, 10 * TestBed.inject(AppearanceService).rowHeight());
  await settle();

  return { fixture, host: fixture.nativeElement, git, settle };
}

function pill(host: HTMLElement, label: string): HTMLElement {
  const found = [
    ...host.querySelectorAll<HTMLElement>(
      `[data-testid="commit-row-${TIP}"] yoru-badge`,
    ),
  ].find((badge) => badge.textContent?.trim() === label);
  if (!found) throw new Error(`No ${label} pill on the row.`);
  return found;
}

function commands(git: TauriGitStub, ...names: string[]): [string, unknown[]][] {
  return git.calls
    .filter((call) => names.includes(call.command))
    .map((call) => [call.command, [...call.args]]);
}

function openMenu(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('yoru-context-menu');
}

function menuLabels(): string[] {
  return [...(openMenu()?.querySelectorAll('button') ?? [])].map(
    (button) => button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

function dispatch(element: Element, type: string): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe('Ref pills in the commit list', () => {
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
    TestBed.inject(ContextMenuService).close();
    observer.restore();
  });

  it('checks a local branch out on double-click, without leaving for the sidebar', async () => {
    const bench = await renderList(0);

    dispatch(pill(bench.host, 'develop'), 'dblclick');
    await bench.settle();

    expect(commands(bench.git, 'checkout_branch', 'fast_forward')).toEqual([
      ['checkout_branch', [TEST_REPO.path, 'develop', false, false]],
    ]);
  });

  it('brings develop up to origin/develop before checking it out', async () => {
    const bench = await renderList(2);

    dispatch(pill(bench.host, 'origin/develop'), 'dblclick');
    await bench.settle();

    expect(commands(bench.git, 'checkout_branch', 'fast_forward')).toEqual([
      ['fast_forward', [TEST_REPO.path, 'develop']],
      ['checkout_branch', [TEST_REPO.path, 'origin/develop', true, false]],
    ]);
  });

  it('only checks out when develop has nothing to catch up on', async () => {
    const bench = await renderList(0);

    dispatch(pill(bench.host, 'origin/develop'), 'dblclick');
    await bench.settle();

    expect(commands(bench.git, 'checkout_branch', 'fast_forward')).toEqual([
      ['checkout_branch', [TEST_REPO.path, 'origin/develop', true, false]],
    ]);
  });

  it("opens the ref's own menu on right-click instead of the commit's", async () => {
    const bench = await renderList(2);

    const event = dispatch(pill(bench.host, 'develop'), 'contextmenu');
    await bench.settle();

    expect(event.defaultPrevented).toBe(true);
    expect(
      openMenu()?.querySelector('[data-testid="menu-header"]')?.textContent,
    ).toContain('develop');
    const labels = menuLabels();
    expect(labels).toContain('Fast-forward to upstream');
    expect(labels).not.toContain('Show in inspector');
  });

  it('lists the refs atop the row menu, each leading to its own menu', async () => {
    const bench = await renderList(2);

    const subject = bench.host.querySelector(
      `[data-testid="commit-row-${TIP}"] .subject`,
    );
    if (!subject) throw new Error('No subject on the row.');
    dispatch(subject, 'contextmenu');
    await bench.settle();

    expect(menuLabels().slice(0, 4)).toEqual([
      'feat/x…',
      'develop…',
      'origin/develop…',
      'Show in inspector',
    ]);

    const remote = [...(openMenu()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent?.trim() === 'origin/develop…',
    );
    remote?.click();
    await bench.settle();

    expect(menuLabels()).toContain('Checkout develop and fast-forward');
  });
});
