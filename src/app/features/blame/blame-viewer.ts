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
import type { BlameLine } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { relativeTime, shortSha } from '../../core/utils';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  YoruAvatar,
  YoruEmptyState,
  YoruSkeleton,
} from '../../shared/ui';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

interface BlameRow {
  readonly line: BlameLine;
  /** First line of a run by the same commit: the only row with a gutter. */
  readonly first: boolean;
  readonly shortSha: string;
  readonly when: string;
}

/**
 * Blame overlay for a single file.
 *
 * Lines are virtualised because blaming a big file returns as many rows as it
 * has lines; consecutive lines from the same commit collapse their gutter into
 * a stripe so the eye stays on the code.
 */
@Component({
  selector: 'app-blame-viewer',
  imports: [NgIcon, ScrollingModule, YoruAvatar, YoruEmptyState, YoruSkeleton],
  templateUrl: './blame-viewer.html',
  styleUrl: './blame-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'blame-viewer-host',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class BlameViewer {
  private readonly service = inject(CurrentRepoService);
  private readonly appearance = inject(AppearanceService);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);

  /** Path of the file to blame, or `null` to hide the overlay. */
  readonly file = input.required<string | null>();
  /** Revision to blame at; `null` blames the working tree. */
  readonly rev = input<string | null>(null);

  /** Fired when the user closes the overlay. */
  readonly close = output<void>();

  /** Blame rows are code, so they follow the code type size, not the UI one. */
  protected readonly rowHeight = this.appearance.codeLineHeight;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly error = this.service.blameError;
  protected readonly loading = signal(false);

  protected readonly rows = computed<readonly BlameRow[]>(() => {
    const lines = this.service.blameLines();
    let previous = '';
    const out: BlameRow[] = [];
    for (const line of lines) {
      out.push({
        line,
        first: line.sha !== previous,
        shortSha: shortSha(line.sha),
        when: line.time ? relativeTime(line.time) : '',
      });
      previous = line.sha;
    }
    return out;
  });

  /** Widest line number, so the gutter and the code column stay aligned. */
  protected readonly lineNoWidth = computed(() =>
    Math.max(2, String(this.service.blameLines().length).length),
  );

  protected readonly isEmpty = computed(
    () => !this.loading() && this.error() === null && this.rows().length === 0,
  );

  /** Short sha the blame is pinned to, or `null` for the working tree. */
  protected readonly revLabel = computed(() => {
    const rev = this.rev();
    return rev === null ? null : shortSha(rev);
  });

  constructor() {
    effect(() => {
      const target = this.file();
      const rev = this.rev();
      if (!target) {
        this.loading.set(false);
        this.service.clearBlame();
        return;
      }
      this.loading.set(true);
      void this.service.loadBlame(target, rev).finally(() => this.loading.set(false));
    });
  }

  protected readonly trackRow = (_: number, row: BlameRow): number => row.line.line_no;

  protected onClose(): void {
    this.close.emit();
  }

  protected onEscape(): void {
    if (this.file()) this.close.emit();
  }

  /** Reveals the commit in the history and steps out of the way. */
  protected onSelectCommit(sha: string): void {
    void this.service.navigateToSha(sha);
    this.close.emit();
  }

  protected async onCommitMenu(event: MouseEvent, row: BlameRow): Promise<void> {
    event.preventDefault();
    const items: MenuItem[] = [
      {
        id: 'navigate',
        label: `Go to ${row.shortSha}`,
        icon: 'lucideGitCommitHorizontal',
        run: () => this.onSelectCommit(row.line.sha),
      },
      {
        id: 'copy-sha',
        label: 'Copy SHA',
        icon: 'lucideCopy',
        run: () => void this.clipboard.writeText(row.line.sha),
      },
      {
        id: 'copy-line',
        label: 'Copy line',
        icon: 'lucideClipboard',
        run: () => void this.clipboard.writeText(row.line.content),
      },
    ];
    await this.menu.open(items, { x: event.clientX, y: event.clientY });
  }
}
