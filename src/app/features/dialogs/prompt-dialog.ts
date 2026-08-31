import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { YoruButton, YoruDialog, YoruField } from '../../shared/ui';
import { DialogsService } from './dialogs.service';

/**
 * Single-line text prompt (branch name, stash message, revision to jump to).
 * Driven by `DialogsService.prompt()`.
 */
@Component({
  selector: 'app-prompt-dialog',
  imports: [YoruDialog, YoruButton, YoruField],
  templateUrl: './prompt-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'prompt-dialog-host' },
})
export class PromptDialog {
  private readonly dialogs = inject(DialogsService);

  protected readonly request = this.dialogs.promptRequest;

  protected readonly value = linkedSignal<
    ReturnType<typeof this.dialogs.promptRequest>,
    string
  >({
    source: this.request,
    computation: (request) => request?.initialValue ?? '',
  });

  protected readonly error = computed(() => {
    const request = this.request();
    const value = this.value().trim();
    if (!request?.validate || value.length === 0) return '';
    return request.validate(value) ?? '';
  });

  protected readonly canSubmit = computed(
    () => this.value().trim().length > 0 && this.error().length === 0,
  );

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onCancel(): void {
    this.dialogs.settlePrompt(null);
  }

  protected onSubmit(): void {
    if (!this.canSubmit()) return;
    this.dialogs.settlePrompt(this.value().trim());
  }
}
