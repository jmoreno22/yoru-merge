import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { CommitInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { EscapeRank } from '../../core/services/escape-layers';
import { EscapeLayersService } from '../../core/services/escape-layers.service';
import { absoluteTime, relativeTime } from '../../core/utils';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  commitMenuHeader,
  YoruAvatar,
  YoruEmptyState,
  YoruIconButton,
  YoruSkeleton,
} from '../../shared/ui';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

interface HistoryRow {
  readonly commit: CommitInfo;
  readonly when: string;
  readonly exact: string;
}

/**
 * Commits that touched one file.
 *
 * Selecting a row loads that commit's changes **to this file** into the diff
 * panel and keeps the list open, so the file can be walked back through its
 * history; "Open full commit" is the action that leaves for the whole commit.
 */
@Component({
  selector: 'app-file-history-panel',
  imports: [
    YoruIconButton,
    NgIcon,
    ScrollingModule,
    YoruAvatar,
    YoruEmptyState,
    YoruSkeleton,
  ],
  templateUrl: './file-history-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'file-history-host' },
})
export class FileHistoryPanel {
  private readonly service = inject(CurrentRepoService);
  private readonly appearance = inject(AppearanceService);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);
  private readonly escapeLayers = inject(EscapeLayersService);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  /** File whose history to show; `null` keeps the panel closed. */
  readonly file = input.required<string | null>();

  /** Emitted on close button or Escape. */
  readonly close = output<void>();

  /** Emitted when the user asks for the whole commit, not just this file. */
  readonly selectCommit = output<string>();

  protected readonly rowHeight = this.appearance.historyRowHeight;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly error = this.service.fileHistoryError;
  protected readonly loading = signal(false);
  protected readonly selectedSha = signal<string | null>(null);

  protected readonly rows = computed<readonly HistoryRow[]>(() =>
    this.service.fileHistoryEntries().map((commit) => ({
      commit,
      when: relativeTime(commit.date),
      exact: absoluteTime(commit.date),
    })),
  );

  /** Row the keyboard is on; `aria-activedescendant` points at it. */
  protected readonly activeIndex = signal(-1);

  protected readonly activeRowId = computed<string | null>(() => {
    const row = this.rows()[this.activeIndex()];
    return row === undefined ? null : this.rowId(row.commit.sha);
  });

  protected readonly isEmpty = computed(
    () => !this.loading() && this.error() === null && this.rows().length === 0,
  );

  constructor() {
    this.escapeLayers.bind(
      EscapeRank.stackedPanel,
      computed(() => this.file() !== null),
      () => this.close.emit(),
    );

    effect(() => {
      const target = this.file();
      this.selectedSha.set(null);
      this.activeIndex.set(-1);
      if (!target) {
        this.loading.set(false);
        this.service.clearFileHistory();
        return;
      }
      this.loading.set(true);
      void this.service.loadFileHistory(target).finally(() => this.loading.set(false));
    });
  }

  protected readonly trackRow = (_: number, row: HistoryRow): string => row.commit.sha;

  protected rowId(sha: string): string {
    return `file-history-row-${sha}`;
  }

  protected onRowClick(index: number): void {
    const row = this.rows()[index];
    if (row === undefined) return;
    this.activeIndex.set(index);
    void this.onSelect(row.commit.sha);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.rows().length;
    if (count === 0) return;
    const active = this.activeIndex();
    const current = Math.max(0, active);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveTo(active < 0 ? 0 : Math.min(count - 1, current + 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveTo(Math.max(0, current - 1));
        return;
      case 'Home':
        event.preventDefault();
        this.moveTo(0);
        return;
      case 'End':
        event.preventDefault();
        this.moveTo(count - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onRowClick(current);
        return;
      default:
        return;
    }
  }

  /** Scrolls only as far as needed to bring the row into view. */
  private moveTo(index: number): void {
    this.activeIndex.set(index);
    const viewport = this.viewport();
    if (!viewport) return;
    const height = this.rowHeight();
    const top = index * height;
    const offset = viewport.measureScrollOffset('top');
    const size = viewport.getViewportSize();
    if (top < offset) viewport.scrollToOffset(top);
    else if (top + height > offset + size) viewport.scrollToOffset(top + height - size);
  }

  protected onClose(): void {
    this.close.emit();
  }

  /**
   * Shows what this commit did to this file.
   *
   * The patch is written straight into the diff panel's state: `selectCommit`
   * would load the whole commit and drop the file scope the user asked for.
   */
  protected async onSelect(sha: string): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.selectedSha.set(sha);
    const patch = await this.service.commitFileDiff(sha, file);
    // A quicker answer for a later row may already be on screen.
    if (this.selectedSha() !== sha || this.file() !== file) return;
    this.service.diffSource.set({ kind: 'commit', sha });
    this.service.diffText.set(patch);
  }

  /** Puts the file's uncommitted changes back in the diff panel. */
  protected onShowWorkingCopy(): void {
    const file = this.file();
    if (!file) return;
    this.selectedSha.set(null);
    void this.service.selectWorkingFile(file, false);
  }

  protected async onRowMenu(event: MouseEvent, row: HistoryRow): Promise<void> {
    event.preventDefault();
    const items: MenuItem[] = [
      {
        id: 'file-diff',
        label: 'Show changes to this file',
        icon: 'lucideFileDiff',
        run: () => void this.onSelect(row.commit.sha),
      },
      {
        id: 'full-commit',
        label: 'Open full commit',
        icon: 'lucideGitCommitHorizontal',
        run: () => this.selectCommit.emit(row.commit.sha),
      },
      {
        id: 'copy-sha',
        label: 'Copy SHA',
        icon: 'lucideCopy',
        separatorBefore: true,
        run: () => void this.clipboard.writeText(row.commit.sha),
      },
      {
        id: 'copy-message',
        label: 'Copy message',
        icon: 'lucideClipboard',
        run: () => void this.clipboard.writeText(row.commit.message),
      },
    ];
    await this.menu.open(
      items,
      { x: event.clientX, y: event.clientY },
      {
        header: commitMenuHeader(
          row.commit.short_sha,
          row.commit.message.split('\n', 1)[0] ?? '',
        ),
      },
    );
  }
}
