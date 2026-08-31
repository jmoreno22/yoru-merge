import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { YoruButton, YoruDialog } from '../../shared/ui';
import { DialogsService } from './dialogs.service';

/**
 * The one confirmation dialog. Driven by `DialogsService.confirm()`, which
 * resolves the promise the caller is awaiting — so a destructive action reads
 * as a single `if (await confirm(…))` instead of a callback dance.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [YoruDialog, YoruButton],
  templateUrl: './confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'confirm-dialog-host' },
})
export class ConfirmDialog {
  private readonly dialogs = inject(DialogsService);

  protected readonly request = this.dialogs.confirmRequest;

  /** Second-press state for `doubleConfirm`; reset whenever the request changes. */
  protected readonly armed = linkedSignal<unknown, boolean>({
    source: this.request,
    computation: () => false,
  });

  protected readonly tone = computed(() => this.request()?.tone ?? 'default');

  protected readonly confirmLabel = computed(() => {
    const request = this.request();
    if (!request) return 'Confirm';
    const label = request.confirmLabel ?? 'Confirm';
    return request.doubleConfirm && this.armed() ? `Yes, ${lower(label)}` : label;
  });

  protected onCancel(): void {
    this.dialogs.settleConfirm(false);
  }

  protected onConfirm(): void {
    const request = this.request();
    if (!request) return;
    if (request.doubleConfirm && !this.armed()) {
      this.armed.set(true);
      return;
    }
    this.dialogs.settleConfirm(true);
  }
}

/** Lower-cases the first letter only, so acronyms survive ("Force push" becomes "force push"). */
function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
