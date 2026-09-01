import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { CommitInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { absoluteTime, relativeTime } from '../../core/utils';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  YoruAvatar,
  YoruEmptyState,
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
  imports: [NgIcon, ScrollingModule, YoruAvatar, YoruEmptyState, YoruSkeleton],
  templateUrl: './file-history-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'file-history-host',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class FileHistoryPanel {
  private readonly service = inject(CurrentRepoService);
  private readonly appearance = inject(AppearanceService);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);

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

  protected readonly isEmpty = computed(
    () => !this.loading() && this.error() === null && this.rows().length === 0,
  );

  constructor() {
    effect(() => {
      const target = this.file();
      this.selectedSha.set(null);
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

  protected onClose(): void {
    this.close.emit();
  }

  protected onEscape(): void {
    if (this.file()) this.close.emit();
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
    await this.menu.open(items, { x: event.clientX, y: event.clientY });
  }
}
