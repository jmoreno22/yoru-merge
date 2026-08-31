import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { YoruButton, YoruDialog, YoruField, YoruSwitch } from '../../shared/ui';

/**
 * `git stash push` with the two flags the plain toolbar entries hard-code.
 *
 * The quick entries stay as they are; this is for the cases where the defaults
 * are wrong — keeping the index staged, or leaving untracked files alone.
 */
@Component({
  selector: 'app-stash-options-dialog',
  imports: [YoruDialog, YoruButton, YoruField, YoruSwitch],
  templateUrl: './stash-options-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'stash-options-host' },
})
export class StashOptionsDialog {
  private readonly currentRepo = inject(CurrentRepoService);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  protected readonly message = signal('');
  protected readonly includeUntracked = signal(true);
  protected readonly keepIndex = signal(false);

  protected readonly busy = this.currentRepo.stashBusy;

  constructor() {
    effect(() => {
      if (this.open()) return;
      this.message.set('');
      this.includeUntracked.set(true);
      this.keepIndex.set(false);
    });
  }

  protected onMessageInput(event: Event): void {
    this.message.set((event.target as HTMLInputElement).value);
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected async onStash(): Promise<void> {
    const stashed = await this.currentRepo.stashSaveAction(this.message().trim(), {
      includeUntracked: this.includeUntracked(),
      keepIndex: this.keepIndex(),
    });
    if (stashed) this.closed.emit();
  }
}
