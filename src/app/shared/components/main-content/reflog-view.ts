import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { ReflogEntry, ResetMode } from '../../../core/models';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { relativeTime } from '../../../core/utils';
import { CommitActions } from '../../../features/commit-list/commit-actions.service';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import { ContextMenuService, YoruEmptyState, YoruSectionHeader } from '../../ui';

/**
 * `git reflog` as a list: where HEAD has been, and the way back to any of it.
 *
 * Selecting a row loads that commit into the inspector; the reset submenu is
 * the only place in the app that offers a hard reset from the reflog, so it
 * asks twice before throwing the working tree away.
 */
@Component({
  selector: 'app-reflog-view',
  imports: [NgIcon, YoruEmptyState, YoruSectionHeader],
  templateUrl: './reflog-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'reflog-view',
    class: 'flex h-full min-h-0 flex-col bg-[var(--app-surface)]',
  },
})
export class ReflogView {
  private readonly repo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly menu = inject(ContextMenuService);
  private readonly commits = inject(CommitActions);

  protected readonly entries = this.repo.reflog;
  protected readonly selectedSha = this.repo.selectedCommitSha;
  protected readonly busy = this.repo.branchBusy;

  private readonly repoPath = computed(() => this.repo.repo()?.path ?? null);

  constructor() {
    // The reflog is not part of refreshAll: load it when the view appears and
    // whenever the tab changes under it.
    effect(() => {
      if (this.repoPath() === null) return;
      void this.repo.loadReflog();
    });
  }

  protected when(entry: ReflogEntry): string {
    return relativeTime(entry.date);
  }

  protected onSelect(entry: ReflogEntry): void {
    void this.repo.selectCommit(entry.sha);
  }

  protected async onMenu(entry: ReflogEntry, anchor: HTMLElement): Promise<void> {
    const sequencing = this.repo.sequencerActive();
    await this.menu.open(
      [
        {
          id: 'checkout',
          label: 'Checkout commit (detached)',
          icon: 'lucideCircleDot',
          disabled: sequencing,
          disabledReason: sequencing
            ? 'Finish or abort the operation in progress first'
            : undefined,
          run: () => void this.checkout(entry),
        },
        {
          id: 'branch',
          label: 'Create branch here…',
          icon: 'lucideGitBranchPlus',
          run: () => void this.createBranch(entry),
        },
        {
          separatorBefore: true,
          id: 'reset',
          label: `Reset to ${entry.selector}…`,
          icon: 'lucideRotateCcw',
          children: [
            {
              id: 'soft',
              label: 'Soft — keep the index and the working tree',
              run: () => void this.reset(entry, 'soft'),
            },
            {
              id: 'mixed',
              label: 'Mixed — keep the working tree',
              run: () => void this.reset(entry, 'mixed'),
            },
            {
              id: 'hard',
              label: 'Hard — discard everything',
              tone: 'danger',
              run: () => void this.reset(entry, 'hard'),
            },
          ],
        },
      ],
      anchor,
    );
  }

  private async checkout(entry: ReflogEntry): Promise<void> {
    await this.repo.checkoutCommitAction(entry.sha);
    await this.repo.loadReflog();
  }

  private async createBranch(entry: ReflogEntry): Promise<void> {
    await this.commits.createBranch(entry.sha);
    await this.repo.loadReflog();
  }

  private async reset(entry: ReflogEntry, mode: ResetMode): Promise<void> {
    if (mode === 'hard') {
      const confirmed = await this.dialogs.confirm({
        title: `Hard reset to ${entry.selector}`,
        body: `HEAD moves to ${entry.short_sha} and every uncommitted change in the working tree is lost. Commits left behind stay in the reflog.`,
        confirmLabel: 'Reset hard',
        tone: 'danger',
        doubleConfirm: true,
      });
      if (!confirmed) return;
    }
    await this.repo.resetToCommitAction(entry.sha, mode);
    await this.repo.loadReflog();
  }
}
