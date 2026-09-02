import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { CommitDetails, CommitFile, SignatureStatus } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { ToastService } from '../../core/services/toast.service';
import { absoluteTime, relativeTime, shortSha } from '../../core/utils';
import type { YoruIconName } from '../../shared/icons';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  YoruAvatar,
  YoruBadge,
  YoruButton,
  YoruEmptyState,
  YoruSkeleton,
} from '../../shared/ui';
import { CommitActions } from '../commit-list/commit-actions.service';
import {
  buildFileRows,
  FILE_STATUS_LABEL,
  type FileRow,
  type FileViewMode,
  filterFiles,
} from './commit-files';

/** Rows drawn while `get_commit_details` is in flight. */
const SKELETON_FILES = 8;

interface SignatureChip {
  readonly icon: YoruIconName | null;
  readonly label: string;
  readonly color: string;
}

const SIGNATURE_CHIP: Readonly<Record<SignatureStatus, SignatureChip>> = {
  good: {
    icon: 'lucideShieldCheck',
    label: 'Signature verified',
    color: 'var(--color-git-added)',
  },
  bad: {
    icon: 'lucideTriangleAlert',
    label: 'Bad signature',
    color: 'var(--color-git-deleted)',
  },
  unknown: {
    icon: 'lucideTriangleAlert',
    label: 'Signature from an unknown key',
    color: 'var(--color-git-modified)',
  },
  none: { icon: null, label: 'Unsigned', color: 'var(--app-text-faint)' },
};

/**
 * Everything about the selected commit: who wrote it, what it says, and which
 * files it touched.
 *
 * The commit actions live in `CommitActions`, the same service the history
 * list right-click menu uses, so the buttons here and the menu there can never
 * drift apart or confirm a destructive rewrite differently.
 */
@Component({
  selector: 'app-commit-inspector',
  imports: [
    NgIcon,
    ScrollingModule,
    YoruAvatar,
    YoruBadge,
    YoruButton,
    YoruEmptyState,
    YoruSkeleton,
  ],
  templateUrl: './commit-inspector.html',
  styleUrl: './commit-inspector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'commit-inspector',
    class: 'flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-surface)]',
  },
})
export class CommitInspector {
  private readonly repo = inject(CurrentRepoService);
  private readonly actions = inject(CommitActions);
  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);
  private readonly toast = inject(ToastService);
  private readonly appearance = inject(AppearanceService);

  protected readonly rowHeight = this.appearance.fileRowHeight;
  protected readonly details = this.repo.commitDetails;
  protected readonly loading = this.repo.commitDetailsLoading;
  protected readonly skeletonFiles = Array.from(
    { length: SKELETON_FILES },
    (_, i) => i,
  );

  protected readonly viewMode = signal<FileViewMode>('tree');
  protected readonly filter = signal<string>('');
  protected readonly activeFile = signal<string | null>(null);
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());

  protected readonly authorDate = computed(() => this.dateLabels('author'));
  protected readonly committerDate = computed(() => this.dateLabels('committer'));

  /** True when the commit was applied by someone other than its author. */
  protected readonly showCommitter = computed<boolean>(() => {
    const details = this.details();
    if (!details) return false;
    return (
      details.committer_email !== details.author_email ||
      details.committer_date !== details.author_date
    );
  });

  protected readonly signature = computed<SignatureChip>(
    () => SIGNATURE_CHIP[this.details()?.signature ?? 'none'],
  );

  private readonly visibleFiles = computed<readonly CommitFile[]>(() =>
    filterFiles(this.details()?.files ?? [], this.filter()),
  );

  protected readonly fileRows = computed<readonly FileRow[]>(() =>
    buildFileRows(this.visibleFiles(), this.viewMode(), this.collapsed()),
  );

  protected readonly fileCountLabel = computed<string>(() => {
    const total = this.details()?.files.length ?? 0;
    const shown = this.visibleFiles().length;
    if (shown === total) return `${total} ${total === 1 ? 'file' : 'files'}`;
    return `${shown} of ${total} files`;
  });

  protected readonly noMatches = computed<boolean>(
    () =>
      this.filter().trim().length > 0 &&
      this.visibleFiles().length === 0 &&
      (this.details()?.files.length ?? 0) > 0,
  );

  /** Sha the panel is currently showing; drives the per-commit state reset. */
  private shownSha: string | null = null;

  constructor() {
    // A new commit starts with a clean filter and no file open; the previous
    // commit's path almost never exists in the next one.
    effect(() => {
      const sha = this.details()?.sha ?? null;
      // Keyed on the sha, not on the object: a background refresh hands back a
      // new `CommitDetails` for the same commit and must not wipe the filter.
      if (sha === this.shownSha) return;
      this.shownSha = sha;
      this.filter.set('');
      this.activeFile.set(null);
      this.collapsed.set(new Set<string>());
    });
  }

  protected shortOf(sha: string): string {
    return shortSha(sha);
  }

  protected statusLabel(file: CommitFile): string {
    return FILE_STATUS_LABEL[file.status];
  }

  protected trackRow(_index: number, row: FileRow): string {
    return row.path;
  }

  protected onFilter(value: string): void {
    this.filter.set(value);
  }

  protected setViewMode(mode: FileViewMode): void {
    this.viewMode.set(mode);
  }

  protected toggleFolder(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  // ── header actions ───────────────────────────────────────────────────────

  protected async copySha(): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.clipboard.writeText(sha);
    this.toast.success('Commit SHA copied.');
  }

  protected async goToParent(sha: string): Promise<void> {
    await this.repo.navigateToSha(sha);
  }

  protected async run(id: string): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.actions.run(id, sha, [sha]);
  }

  protected async openResetMenu(event: MouseEvent): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    const branch = this.repo.currentBranch() ?? 'HEAD';
    const choice = await this.menu.open(
      [
        {
          id: 'reset-soft',
          label: `Soft — move ${branch}, keep index and working tree`,
        },
        { id: 'reset-mixed', label: `Mixed — move ${branch}, keep working tree` },
        {
          id: 'reset-hard',
          label: 'Hard — discard everything…',
          tone: 'danger',
        },
      ],
      event.currentTarget as HTMLElement,
    );
    if (choice) await this.actions.run(choice, sha, [sha]);
  }

  protected async openMoreMenu(event: MouseEvent): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.actions.openMenu(event.currentTarget as HTMLElement, sha, [sha]);
  }

  // ── files ────────────────────────────────────────────────────────────────

  protected async openFile(path: string): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    this.activeFile.set(path);
    const diff = await this.repo.commitFileDiff(sha, path);
    // Clicking through files leaves several of these in flight; a slow answer
    // must not overwrite the diff of the file now open.
    if (this.activeFile() !== path || this.details()?.sha !== sha) return;
    this.repo.diffText.set(diff);
  }

  protected async onFileMenu(event: MouseEvent, file: CommitFile): Promise<void> {
    event.preventDefault();
    const details = this.details();
    if (!details) return;

    const deleted = file.status === 'deleted';
    const items: MenuItem[] = [
      { id: 'open', label: 'Open diff', icon: 'lucideFileDiff', tone: 'primary' },
      {
        id: 'history',
        label: 'File history',
        icon: 'lucideHistory',
        separatorBefore: true,
      },
      { id: 'blame', label: 'Blame', icon: 'lucideUser' },
      {
        id: 'copy-content',
        label: 'Copy content at this commit',
        icon: 'lucideClipboard',
        separatorBefore: true,
        disabled: file.binary,
        disabledReason: file.binary ? 'The file is binary' : undefined,
      },
      { id: 'copy-path', label: 'Copy path', icon: 'lucideCopy' },
      {
        id: 'editor',
        label: 'Open in editor',
        icon: 'lucidePencil',
        separatorBefore: true,
        disabled: deleted,
        disabledReason: deleted ? 'The commit deleted this file' : undefined,
      },
      {
        id: 'reveal',
        label: 'Reveal in file manager',
        icon: 'lucideFolderOpen',
        disabled: deleted,
        disabledReason: deleted ? 'The commit deleted this file' : undefined,
      },
    ];

    const choice = await this.menu.open(items, {
      x: event.clientX,
      y: event.clientY,
    });
    if (choice === null) return;
    await this.runFileAction(choice, details, file);
  }

  private async runFileAction(
    id: string,
    details: CommitDetails,
    file: CommitFile,
  ): Promise<void> {
    switch (id) {
      case 'open':
        await this.openFile(file.path);
        return;
      case 'history':
        await this.repo.loadFileHistory(file.path);
        return;
      case 'blame':
        // Blaming the working tree from a historic commit answers a question
        // nobody asked: the file may not even exist there any more.
        await this.repo.loadBlame(file.path, details.sha);
        return;
      case 'copy-content': {
        const content = await this.repo.fileAtRevision(details.sha, file.path);
        if (content.length === 0) {
          this.toast.warning('That revision of the file could not be read.');
          return;
        }
        await this.clipboard.writeText(content);
        this.toast.success(`Copied ${file.path} as of ${details.short_sha}.`);
        return;
      }
      case 'copy-path':
        await this.clipboard.writeText(file.path);
        this.toast.success('Path copied.');
        return;
      case 'editor':
        await this.repo.openInEditor(file.path);
        return;
      case 'reveal':
        await this.repo.revealInFileManager(file.path);
        return;
    }
  }

  private dateLabels(who: 'author' | 'committer'): {
    absolute: string;
    relative: string;
  } {
    const details = this.details();
    if (!details) return { absolute: '', relative: '' };
    const raw = who === 'author' ? details.author_date : details.committer_date;
    return { absolute: absoluteTime(raw), relative: relativeTime(raw) };
  }
}
