import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  effect,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { BlameViewer } from '../../../features/blame/blame-viewer';
import { BranchGraph } from '../../../features/branch-graph/branch-graph';
import { CommitInspector } from '../../../features/commit-inspector/commit-inspector';
import { CommitList } from '../../../features/commit-list/commit-list';
import { CommitSearch } from '../../../features/commit-list/commit-search';
import { DiffViewer } from '../../../features/diff-viewer/diff-viewer';
import { FileHistoryPanel } from '../../../features/file-history/file-history-panel';
import { RepoManager } from '../../../features/repo-manager/repo-manager';
import { WorkingChangesPanel } from '../../../features/working-changes/working-changes';
import { RepoStateBanner } from '../repo-state-banner/repo-state-banner';
import { Sidebar } from '../sidebar/sidebar';
import { Splitter } from '../splitter/splitter';
import { ReflogView } from './reflog-view';

/** Pixel clamps for the refs panel. */
const MIN_SIDEBAR_PX = 180;
const MAX_SIDEBAR_PX = 420;

/** Pixel clamps for the centre column of the workbench. */
const MIN_CENTRE_PX = 360;
const MIN_RIGHT_PX = 320;

/** Must match `LANE_WIDTH` in the branch graph, which sizes its canvas by it. */
const LANE_WIDTH = 16;

/** Four lanes: below this the graph says nothing worth the space it takes. */
const MIN_GRAPH_PX = 4 * LANE_WIDTH;

/**
 * The workbench: refs panel, centre view and inspector column.
 *
 * The rail picks the centre view through the `railView` preference; this
 * component only owns the three column widths and which feature component
 * fills each one.
 */
@Component({
  selector: 'app-main-content',
  imports: [
    BlameViewer,
    BranchGraph,
    CommitInspector,
    CommitList,
    CommitSearch,
    DiffViewer,
    FileHistoryPanel,
    ReflogView,
    RepoManager,
    RepoStateBanner,
    Sidebar,
    Splitter,
    WorkingChangesPanel,
  ],
  templateUrl: './main-content.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'main-content',
    class: 'flex min-h-0 min-w-0 flex-col',
  },
})
export class MainContent {
  protected readonly repo = inject(CurrentRepoService);
  protected readonly prefs = inject(PreferencesService);

  protected readonly view = this.prefs.railView;

  protected readonly blameFile = this.repo.blameFile;
  protected readonly blameRev = this.repo.blameRev;
  protected readonly fileHistoryFile = this.repo.fileHistoryFile;

  /**
   * Width the graph column needs for every lane. `max_lanes` is global, so it
   * does not move as pages load; a search filters the list, at which point the
   * lanes no longer line up with the rows and the column is dropped entirely.
   *
   * Capped at a third of the centre column: a repository with twenty lanes
   * would otherwise leave the commit list too narrow for a subject, and the
   * canvas clips its deepest lanes far more gracefully than the list does.
   */
  protected readonly graphWidth = computed(() => {
    if (this.repo.isSearchActive()) return 0;
    const lanes = this.repo.graphData()?.max_lanes ?? 0;
    if (lanes === 0) return 0;
    const cap = Math.max(MIN_GRAPH_PX, Math.round(this.centrePx() / 3));
    return Math.min(lanes * LANE_WIDTH, cap);
  });

  // ── refs panel width ─────────────────────────────────────────────────────

  private readonly viewportWidth = signal(readWindowWidth());

  protected readonly sidebarDragging = signal(false);

  protected readonly sidebarPx = computed(() =>
    clamp(
      Math.round((this.prefs.sidebarWidth() / 100) * this.viewportWidth()),
      MIN_SIDEBAR_PX,
      MAX_SIDEBAR_PX,
    ),
  );

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.viewportWidth.set(readWindowWidth());
  }

  protected onSidebarResize(delta: number): void {
    const width = this.viewportWidth();
    if (width <= 0) return;
    const next = clamp(this.sidebarPx() + delta, MIN_SIDEBAR_PX, MAX_SIDEBAR_PX);
    this.prefs.setSidebarWidth((next / width) * 100);
  }

  protected onSidebarDragStart(): void {
    this.sidebarDragging.set(true);
  }

  protected onSidebarDragEnd(): void {
    this.sidebarDragging.set(false);
  }

  // ── centre / inspector split ─────────────────────────────────────────────

  private readonly splitHost = viewChild<ElementRef<HTMLElement>>('split');
  private readonly splitWidth = signal(0);

  protected readonly workbenchDragging = signal(false);

  /**
   * Centre column width. Clamped against the container rather than a fixed
   * maximum so the inspector keeps its minimum on any window size.
   */
  protected readonly centrePx = computed(() => {
    const container = this.splitWidth();
    if (container <= 0) return MIN_CENTRE_PX;
    const max = Math.max(MIN_CENTRE_PX, container - MIN_RIGHT_PX);
    return clamp(
      Math.round((this.prefs.workbenchSplit() / 100) * container),
      MIN_CENTRE_PX,
      max,
    );
  });

  constructor() {
    effect((onCleanup) => {
      const element = this.splitHost()?.nativeElement;
      if (!element) return;
      // Seeded by hand: ResizeObserver does not fire on observe().
      this.splitWidth.set(element.clientWidth);
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        if (width > 0) this.splitWidth.set(Math.round(width));
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  protected onWorkbenchResize(delta: number): void {
    const container = this.splitWidth();
    if (container <= 0) return;
    const max = Math.max(MIN_CENTRE_PX, container - MIN_RIGHT_PX);
    const next = clamp(this.centrePx() + delta, MIN_CENTRE_PX, max);
    this.prefs.setWorkbenchSplit((next / container) * 100);
  }

  protected onWorkbenchDragStart(): void {
    this.workbenchDragging.set(true);
  }

  protected onWorkbenchDragEnd(): void {
    this.workbenchDragging.set(false);
  }

  // ── stacked file panels ──────────────────────────────────────────────────

  protected onOpenBlame(file: string): void {
    void this.repo.loadBlame(file);
  }

  protected onOpenFileHistory(file: string): void {
    void this.repo.loadFileHistory(file);
  }

  protected onCloseBlame(): void {
    this.repo.clearBlame();
  }

  protected onCloseFileHistory(): void {
    this.repo.clearFileHistory();
  }

  protected onSelectHistoryCommit(sha: string): void {
    void this.repo.selectCommit(sha);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readWindowWidth(): number {
  return typeof window === 'undefined' ? 1280 : window.innerWidth;
}
