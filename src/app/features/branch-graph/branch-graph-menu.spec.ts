// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { gitResponses, TEST_REPO } from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import type { CommitInfo, GraphData } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { ContextMenuService } from '../../shared/ui';
import { BranchGraph } from './branch-graph';

const ROW_HEIGHT = 34;
/** Centre of lane 0: lanes are 16 px wide. */
const LANE_0_X = 8;

function commit(index: number): CommitInfo {
  const sha = String(index).repeat(40);
  return {
    sha,
    short_sha: sha.slice(0, 7),
    message: `commit ${index}`,
    author_name: 'Jhoan Moreno',
    author_email: 'jmoreno@example.com',
    date: '2026-11-13T10:00:00Z',
    parent_shas: [],
    refs: [],
    on_current_branch: true,
  };
}

const COMMITS = [commit(1), commit(2)];
const GRAPH: GraphData = {
  commits: COMMITS.map(() => ({ lane: 0, edges: [] })),
  max_lanes: 1,
};

interface Bench {
  readonly fixture: ComponentFixture<BranchGraph>;
  readonly canvas: HTMLCanvasElement;
  readonly repo: CurrentRepoService;
  settle(): Promise<void>;
}

async function renderGraph(
  observer: ReturnType<typeof installResizeObserver>,
): Promise<Bench> {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      {
        provide: TauriGitService,
        useValue: createTauriGitStub(gitResponses()).service,
      },
    ],
  });
  const repo = TestBed.inject(CurrentRepoService);
  repo.repo.set(TEST_REPO);
  repo.commits.set(COMMITS);

  const fixture = TestBed.createComponent(BranchGraph);
  fixture.componentRef.setInput('graphData', GRAPH);
  fixture.componentRef.setInput('rowHeight', ROW_HEIGHT);
  fixture.componentRef.setInput('graphTopOffset', 0);
  fixture.componentRef.setInput('graphBottomOffset', 0);
  fixture.detectChanges();

  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  };
  await settle();
  observer.resize(fixture.nativeElement, { width: 16, height: 10 * ROW_HEIGHT });
  await settle();

  const canvas = fixture.nativeElement.querySelector('canvas');
  if (!canvas) throw new Error('The graph drew no canvas.');
  return { fixture, canvas, repo, settle };
}

/** jsdom leaves `offsetX` / `offsetY` at 0, and the hit test reads them. */
function rightClick(canvas: HTMLCanvasElement, x: number, y: number): MouseEvent {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'offsetX', { value: x });
  Object.defineProperty(event, 'offsetY', { value: y });
  canvas.dispatchEvent(event);
  return event;
}

function openMenu(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('yoru-context-menu');
}

describe('Right-click on a graph node', () => {
  let observer: ReturnType<typeof installResizeObserver>;
  let getContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    observer = installResizeObserver();
    // jsdom has no 2D context and logs every attempt; the graph skips painting
    // without one, which is all a hit test needs.
    getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    TestBed.inject(ContextMenuService).close();
    HTMLCanvasElement.prototype.getContext = getContext;
    observer.restore();
  });

  it("opens that commit's menu and selects it, as its row would", async () => {
    const bench = await renderGraph(observer);
    const second = COMMITS[1];
    if (!second) throw new Error('Fixture lost its second commit.');

    const event = rightClick(bench.canvas, LANE_0_X, ROW_HEIGHT + ROW_HEIGHT / 2);
    await bench.settle();

    expect(event.defaultPrevented).toBe(true);
    expect(bench.repo.selectedCommitSha()).toBe(second.sha);
    expect(
      openMenu()?.querySelector('[data-testid="menu-header"]')?.textContent,
    ).toContain(second.short_sha);
    expect(openMenu()?.textContent).toContain('Show in inspector');
  });

  it('leaves the pointer alone between nodes', async () => {
    const bench = await renderGraph(observer);

    const event = rightClick(bench.canvas, LANE_0_X + 16, ROW_HEIGHT / 2);
    await bench.settle();

    expect(event.defaultPrevented).toBe(false);
    expect(openMenu()).toBeNull();
  });
});
