import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { UpdaterService } from '../../core/services/updater.service';
import { YoruButton, YoruDialog, YoruSpinner } from '../../shared/ui';

/**
 * The release waiting to be installed: versions, date and the notes as the
 * release wrote them.
 *
 * Closing never cancels anything — the download belongs to `UpdaterService`,
 * so Escape, the backdrop and Later only dismiss the dialog while the toolbar
 * pill keeps reporting progress.
 */
@Component({
  selector: 'app-update-dialog',
  imports: [NgIcon, YoruDialog, YoruButton, YoruSpinner],
  templateUrl: './update-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'update-dialog-host' },
})
export class UpdateDialog {
  private readonly updater = inject(UpdaterService);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  protected readonly info = this.updater.info;
  protected readonly state = this.updater.state;
  /** Null while the release size is unknown; the bar goes indeterminate. */
  protected readonly percent = this.updater.progress;

  protected readonly downloading = computed(() => this.state() === 'downloading');
  protected readonly ready = computed(() => this.state() === 'ready');

  protected async onUpdate(): Promise<void> {
    await this.updater.downloadAndInstall();
  }

  protected async onRestart(): Promise<void> {
    await this.updater.restart();
  }
}
