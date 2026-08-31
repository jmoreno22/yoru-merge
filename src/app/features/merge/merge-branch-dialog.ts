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
import type { BranchInfo } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { ToastService } from '../../core/services/toast.service';
import { fuzzyFilter } from '../../core/utils';
import {
  type SegmentedOption,
  YoruButton,
  YoruDialog,
  YoruEmptyState,
  YoruField,
  YoruSegmented,
} from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';

type MergeMode = 'default' | 'no_ff' | 'squash' | 'ff_only';

/**
 * Merges another branch into the current one.
 *
 * `ff_only` is not a flag of `merge_branch`: git can only fast-forward the
 * current branch onto its own upstream, so that mode is offered exclusively
 * when the picked branch *is* that upstream, and runs `fastForwardAction`.
 */
@Component({
  selector: 'app-merge-branch-dialog',
  imports: [YoruDialog, YoruButton, YoruField, YoruSegmented, YoruEmptyState, NgIcon],
  templateUrl: './merge-branch-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'merge-branch-host' },
})
export class MergeBranchDialog {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly toast = inject(ToastService);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  protected readonly currentBranch = this.currentRepo.currentBranch;
  protected readonly busy = this.currentRepo.mergeBusy;

  protected readonly query = signal('');
  protected readonly selected = signal('');
  protected readonly mode = signal<MergeMode>('default');

  protected readonly modeOptions: readonly SegmentedOption[] = [
    { value: 'default', label: 'Merge' },
    { value: 'no_ff', label: 'No fast-forward' },
    { value: 'squash', label: 'Squash' },
    { value: 'ff_only', label: 'Fast-forward only' },
  ];

  /** Upstream of the current branch, the only branch a fast-forward can take. */
  protected readonly upstream = computed(() => {
    const current = this.currentBranch();
    if (!current) return null;
    const local = this.currentRepo.branches()?.local ?? [];
    return local.find((branch) => branch.name === current)?.upstream ?? null;
  });

  private readonly candidates = computed<readonly BranchInfo[]>(() => {
    const list = this.currentRepo.branches();
    if (!list) return [];
    const current = this.currentBranch();
    return [...list.local, ...list.remote].filter((branch) => branch.name !== current);
  });

  protected readonly matches = computed(() =>
    fuzzyFilter(this.candidates(), this.query(), (branch) => branch.name).slice(0, 200),
  );

  protected readonly ffBlockedReason = computed(() => {
    if (this.mode() !== 'ff_only') return '';
    const upstream = this.upstream();
    if (!upstream) {
      return `${this.currentBranch() ?? 'HEAD'} has no upstream to fast-forward from.`;
    }
    if (this.selected() !== upstream) {
      return `Fast-forward only updates ${this.currentBranch()} from its upstream ${upstream}. Pick ${upstream} or choose another mode.`;
    }
    return '';
  });

  protected readonly canMerge = computed(
    () =>
      this.selected().length > 0 && this.ffBlockedReason().length === 0 && !this.busy(),
  );

  /** What the resulting commit will say, so the choice is not blind. */
  protected readonly preview = computed(() => {
    const branch = this.selected();
    const current = this.currentBranch() ?? 'HEAD';
    if (branch.length === 0) return '';
    switch (this.mode()) {
      case 'squash':
        return `Applies the changes of ${branch} to the working tree and index, without a commit.`;
      case 'no_ff':
        return `Merge branch '${branch}' into ${current}`;
      case 'ff_only':
        return `Moves ${current} to ${branch}. No merge commit.`;
      case 'default':
        return `Merge branch '${branch}' into ${current} — fast-forwards when possible.`;
    }
  });

  constructor() {
    effect(() => {
      if (this.open()) return;
      this.query.set('');
      this.selected.set('');
      this.mode.set('default');
    });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onMode(value: string): void {
    this.mode.set(value as MergeMode);
  }

  protected select(branch: string): void {
    this.selected.set(branch);
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected async onMerge(): Promise<void> {
    if (!this.canMerge()) return;
    const branch = this.selected();
    const current = this.currentBranch() ?? 'HEAD';

    if (this.mode() === 'ff_only') {
      await this.currentRepo.fastForwardAction(current);
      this.closed.emit();
      return;
    }

    const result = await this.currentRepo.mergeBranchAction(
      branch,
      this.mode() === 'squash',
      this.mode() === 'no_ff',
    );
    if (!result) return;

    this.closed.emit();
    if (result.kind === 'conflicts') {
      this.toast.warning(
        `Merge stopped with conflicts in ${result.files.length} file${result.files.length === 1 ? '' : 's'}.`,
      );
      this.dialogs.openMergeResolver(result.files[0]);
    }
  }
}
