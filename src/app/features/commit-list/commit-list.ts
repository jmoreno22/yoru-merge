import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { CommitInfo, RefInfo } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import type { DragPayload } from '../../core/services/drag-payload.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { absoluteTime, relativeTime } from '../../core/utils';
import { DragDropDirective } from '../../shared/directives/drag-drop.directive';
import {
  YoruAvatar,
  YoruBadge,
  YoruEmptyState,
  YoruSkeleton,
  YoruSpinner,
} from '../../shared/ui';
import { CommitActions } from './commit-actions.service';
import {
  COMMIT_HEADER_HEIGHT,
  COMMIT_ROW_HEIGHT,
  COMMIT_SEARCH_HEIGHT,
  CommitListLayout,
} from './commit-list-layout';
import { describeRef, isHeadCommit, splitRefs } from './commit-refs';
import { CommitSearch } from './commit-search';
import {
  applySelection,
  type CommitSelection,
  EMPTY_SELECTION,
  pruneSelection,
  type SelectionMode,
} from './commit-selection';

export {
  COMMIT_HEADER_HEIGHT,
  COMMIT_ROW_HEIGHT,
  COMMIT_SEARCH_HEIGHT,
} from './commit-list-layout';

/** How close to the end of the loaded history triggers the next page. */
const PREFETCH_ROWS = 40;

/** Placeholder rows drawn while the first page is on its way. */
const SKELETON_ROWS = 14;

/** Everything one row draws, derived once per history change. */
interface CommitRow {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly relativeDate: string;
  readonly absoluteDate: string;
  readonly refs: readonly RefInfo[];
  readonly hiddenRefs: number;
  readonly hiddenRefsTitle: string;
  readonly isHead: boolean;
  readonly offBranch: boolean;
  readonly title: string;
  readonly payload: DragPayload;
}

/**
 * The commit history: one virtualised 34 px row per commit.
 *
 * The lane graph is a sibling component, not a column here — the two stay in
 * step through `listScrollTop` for the scroll offset and `CommitListLayout`
 * for the height of the chrome drawn above the first row.
 */
@Component({
  selector: 'app-commit-list',
  imports: [
    ScrollingModule,
    DragDropDirective,
    CommitSearch,
    YoruAvatar,
    YoruBadge,
    YoruEmptyState,
    YoruSkeleton,
    YoruSpinner,
  ],
  templateUrl: './commit-list.html',
  styleUrl: './commit-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'commit-list',
    class: 'flex h-full flex-col overflow-hidden bg-[var(--app-surface)]',
  },
})
export class CommitList {
  private readonly repo = inject(CurrentRepoService);
  private readonly actions = inject(CommitActions);
  private readonly layout = inject(CommitListLayout);
  private readonly prefs = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  /** Set to false once the layout mounts `<app-commit-search>` in the header. */
  readonly showSearch = input<boolean>(true);

  protected readonly rowHeight = COMMIT_ROW_HEIGHT;
  protected readonly skeletonRows = Array.from({ length: SKELETON_ROWS }, (_, i) => i);

  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  private readonly search = viewChild(CommitSearch);

  protected readonly selectedSha = this.repo.selectedCommitSha;
  protected readonly isSearchActive = this.repo.isSearchActive;
  protected readonly historyLoading = this.repo.historyLoading;
  protected readonly historyTotal = this.repo.historyTotal;
  protected readonly searchQuery = this.repo.searchQuery;

  private readonly columns = computed(() => new Set(this.prefs.commitsColumns()));
  protected readonly showAuthor = computed(() => this.columns().has('author'));
  protected readonly showDate = computed(() => this.columns().has('date'));
  protected readonly showSha = computed(() => this.columns().has('sha'));

  /** Rows on screen: the search hits while searching, the history otherwise. */
  private readonly commits = computed<readonly CommitInfo[]>(() =>
    this.isSearchActive() ? this.repo.searchResults() : this.repo.commits(),
  );

  protected readonly rows = computed<readonly CommitRow[]>(() => {
    const now = Date.now();
    return this.commits().map((commit) => toRow(commit, now));
  });

  private readonly order = computed<readonly string[]>(() =>
    this.commits().map((commit) => commit.sha),
  );

  private readonly selection = signal<CommitSelection>(EMPTY_SELECTION);

  /** Shas the user has selected, in row order. Read by compare / range menus. */
  readonly selectedShas = computed<readonly string[]>(() => this.selection().shas);

  private readonly selectedSet = computed(() => new Set(this.selection().shas));

  /** Row the keyboard is on; `aria-activedescendant` points at it. */
  protected readonly activeIndex = signal<number>(-1);

  protected readonly activeRowId = computed<string | null>(() => {
    const sha = this.order()[this.activeIndex()];
    return sha === undefined ? null : this.rowId(sha);
  });

  protected readonly showSkeleton = computed(
    () => this.historyLoading() && this.rows().length === 0,
  );

  protected readonly searchEmpty = computed(
    () =>
      this.isSearchActive() &&
      !this.repo.isSearching() &&
      this.repo.searchResults().length === 0,
  );

  protected readonly footerLabel = computed<string>(() => {
    const loaded = this.repo.commits().length;
    const total = this.historyTotal();
    if (total === null) return `${loaded} commits loaded`;
    return `${loaded} of ${total} commits loaded`;
  });

  constructor() {
    effect(() => {
      this.layout.chromeHeight.set(
        COMMIT_HEADER_HEIGHT + (this.showSearch() ? COMMIT_SEARCH_HEIGHT : 0),
      );
    });

    // The sibling graph paints from this offset; the viewport is remounted
    // whenever the list leaves its empty state, so re-subscribe each time.
    effect(() => {
      const viewport = this.viewport();
      if (!viewport) {
        this.repo.listScrollTop.set(0);
        return;
      }
      viewport
        .elementScrolled()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.repo.listScrollTop.set(viewport.measureScrollOffset('top'));
          this.maybeLoadMore();
        });
    });

    // A short viewport can show the whole first page without ever scrolling.
    effect(() => {
      this.rows();
      this.maybeLoadMore();
    });

    effect(() => {
      const order = this.order();
      this.selection.update((current) => pruneSelection(current, order));
      if (this.activeIndex() >= order.length) {
        this.activeIndex.set(order.length - 1);
      }
    });

    effect(() => {
      const request = this.repo.scrollReveal();
      if (!request) return;
      const index = this.order().indexOf(request.sha);
      if (index < 0) return;
      this.activeIndex.set(index);
      this.viewport()?.scrollToIndex(index, 'smooth');
    });
  }

  /** Focus target for `Ctrl+F` and the command palette. */
  focusSearch(): void {
    this.search()?.focus();
  }

  protected readonly trackBySha = (_index: number, row: CommitRow): string => row.sha;

  protected rowId(sha: string): string {
    return `commit-row-${sha}`;
  }

  protected isSelected(sha: string): boolean {
    return this.selectedSet().has(sha);
  }

  // ── pointer ──────────────────────────────────────────────────────────────

  protected onRowClick(event: MouseEvent, index: number): void {
    const mode: SelectionMode = event.shiftKey
      ? 'extend'
      : event.ctrlKey || event.metaKey
        ? 'toggle'
        : 'replace';
    this.activate(index, mode, false);
  }

  protected async onContextMenu(event: MouseEvent, index: number): Promise<void> {
    event.preventDefault();
    const sha = this.order()[index];
    if (sha === undefined) return;
    // Right-clicking outside the selection moves it, the way file managers do.
    if (!this.isSelected(sha)) this.activate(index, 'replace', false);
    await this.actions.openMenu(
      { x: event.clientX, y: event.clientY },
      sha,
      this.selectedShas(),
    );
  }

  // ── keyboard ─────────────────────────────────────────────────────────────

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.order().length;
    if (count === 0) return;
    const current = Math.max(0, this.activeIndex());
    const mode: SelectionMode = event.shiftKey ? 'extend' : 'replace';

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activate(Math.min(count - 1, current + 1), mode, true);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.activate(Math.max(0, current - 1), mode, true);
        return;
      case 'Home':
        event.preventDefault();
        this.activate(0, mode, true);
        return;
      case 'End':
        event.preventDefault();
        this.activate(count - 1, mode, true);
        return;
      case 'PageDown':
        event.preventDefault();
        this.activate(Math.min(count - 1, current + this.pageSize()), mode, true);
        return;
      case 'PageUp':
        event.preventDefault();
        this.activate(Math.max(0, current - this.pageSize()), mode, true);
        return;
      case 'Enter':
        event.preventDefault();
        this.activate(current, 'replace', true);
        return;
      case 'c':
      case 'C':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          void this.copyActiveSha();
        }
        return;
      case 'ContextMenu':
        event.preventDefault();
        void this.openMenuAtActiveRow();
        return;
      default:
        return;
    }
  }

  private async copyActiveSha(): Promise<void> {
    const sha = this.order()[this.activeIndex()];
    if (sha === undefined) return;
    await this.actions.run('copy-sha', sha, this.selectedShas());
  }

  private async openMenuAtActiveRow(): Promise<void> {
    const index = this.activeIndex();
    const sha = this.order()[index];
    if (sha === undefined) return;
    const row = document.getElementById(this.rowId(sha));
    await this.actions.openMenu(row ?? { x: 0, y: 0 }, sha, this.selectedShas());
  }

  // ── shared row activation ────────────────────────────────────────────────

  private activate(index: number, mode: SelectionMode, scroll: boolean): void {
    const sha = this.order()[index];
    if (sha === undefined) return;

    this.activeIndex.set(index);
    this.selection.update((current) =>
      applySelection(current, this.order(), sha, mode),
    );
    if (scroll) this.viewport()?.scrollToIndex(index);

    // Ctrl-clicking a selected row removes it; do not reload its diff.
    if (this.isSelected(sha)) void this.repo.selectCommit(sha);
  }

  private pageSize(): number {
    const height = this.viewport()?.getViewportSize() ?? 0;
    return Math.max(1, Math.floor(height / this.rowHeight) - 1);
  }

  private maybeLoadMore(): void {
    if (this.isSearchActive()) return;
    if (!this.repo.historyHasMore() || this.historyLoading()) return;
    const viewport = this.viewport();
    if (!viewport) return;
    const end = viewport.getRenderedRange().end;
    if (end >= this.repo.commits().length - PREFETCH_ROWS) {
      void this.repo.loadMoreHistory();
    }
  }
}

function toRow(commit: CommitInfo, now: number): CommitRow {
  const { shown, hidden } = splitRefs(commit.refs);
  const subject = commit.message.split('\n')[0] ?? '';
  const offBranch = !commit.on_current_branch;
  return {
    sha: commit.sha,
    shortSha: commit.short_sha,
    subject,
    authorName: commit.author_name,
    authorEmail: commit.author_email,
    relativeDate: relativeTime(commit.date, now),
    absoluteDate: absoluteTime(commit.date),
    refs: shown,
    hiddenRefs: hidden.length,
    hiddenRefsTitle: hidden.map(describeRef).join('\n'),
    isHead: isHeadCommit(commit.refs),
    offBranch,
    title: offBranch ? `${subject}\n\nNot on the current branch` : subject,
    payload: { type: 'commit', sha: commit.sha },
  };
}
