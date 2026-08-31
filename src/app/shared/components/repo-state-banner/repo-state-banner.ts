import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import { YoruButton } from '../../ui';
import { repoStateBanner } from './repo-state.model';

/**
 * The strip above the workbench while git is parked mid-merge, mid-rebase,
 * mid-cherry-pick or mid-revert.
 *
 * It is the only place that offers Continue / Skip / Abort, so a conflicted
 * repository always has one obvious way forward regardless of which view or
 * panel the user is looking at.
 */
@Component({
  selector: 'app-repo-state-banner',
  imports: [NgIcon, YoruButton],
  templateUrl: './repo-state-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class RepoStateBanner {
  private readonly repo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);

  /** A merge continue runs on the merge busy flag, the rest on the sequencer's. */
  protected readonly busy = computed(
    () => this.repo.sequencerBusy() || this.repo.mergeBusy(),
  );

  /** Either source reporting a conflict means there is one to resolve. */
  private readonly conflictCount = computed(() =>
    Math.max(this.repo.conflictCount(), this.repo.repoState().conflicted_files.length),
  );

  protected readonly banner = computed(() =>
    repoStateBanner(this.repo.repoState(), this.conflictCount()),
  );

  protected onContinue(): void {
    const driver = this.banner()?.driver;
    if (driver === 'merge') void this.repo.mergeContinueAction();
    else if (driver === 'sequencer') void this.repo.continueSequencerAction();
  }

  protected onSkip(): void {
    void this.repo.skipSequencerAction();
  }

  protected onAbort(): void {
    const driver = this.banner()?.driver;
    if (driver === 'merge') void this.repo.abortMergeAction();
    else if (driver === 'sequencer') void this.repo.abortSequencerAction();
  }

  protected onResolve(): void {
    this.dialogs.openMergeResolver();
  }
}
