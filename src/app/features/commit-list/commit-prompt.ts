import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import type { DialogSize, DialogTone } from '../../shared/ui';
import { YoruButton, YoruDialog, YoruField } from '../../shared/ui';

/** One editable line of a prompt. */
export interface PromptField {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly multiline?: boolean;
  readonly required?: boolean;
}

/** One read-only line, for prompts that report a result instead of asking. */
export interface PromptRow {
  readonly label: string;
  readonly value: string;
}

export interface PromptSpec {
  readonly title: string;
  readonly body?: string;
  readonly fields?: readonly PromptField[];
  readonly rows?: readonly PromptRow[];
  readonly confirmLabel: string;
  /** `null` hides the cancel button, turning the prompt into an acknowledgement. */
  readonly cancelLabel?: string | null;
  readonly tone?: DialogTone;
  readonly size?: DialogSize;
}

/** Field values keyed by `PromptField.key`, or `null` when cancelled. */
export type PromptResult = Readonly<Record<string, string>> | null;

/**
 * The multi-field questions and read-outs the commit views need, which the
 * single-input `DialogsService.prompt` cannot express: a tag name plus its
 * annotation, a commit message, a compare result. Mounted by
 * `CommitPromptService`, never placed in a template.
 */
@Component({
  selector: 'app-commit-prompt',
  imports: [YoruDialog, YoruButton, YoruField],
  templateUrl: './commit-prompt.html',
  styleUrl: './commit-prompt.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitPrompt {
  readonly spec = input.required<PromptSpec>();
  readonly settled = output<PromptResult>();

  private readonly values = signal<Readonly<Record<string, string>>>({});

  private readonly controls =
    viewChildren<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('control');

  protected readonly fields = computed(() => this.spec().fields ?? []);

  constructor() {
    // The dialog's focus trap captures the header close button; a prompt that
    // asks for text should land in the text.
    afterNextRender(() => {
      const first = this.controls()[0]?.nativeElement;
      first?.focus();
      first?.select();
    });
  }

  protected readonly canConfirm = computed(() =>
    this.fields().every(
      (field) => !field.required || this.valueOf(field).trim().length > 0,
    ),
  );

  protected valueOf(field: PromptField): string {
    return this.values()[field.key] ?? field.value ?? '';
  }

  protected onInput(field: PromptField, value: string): void {
    this.values.update((current) => ({ ...current, [field.key]: value }));
  }

  /** Enter confirms from a single-line field; a textarea keeps its newlines. */
  protected onFieldEnter(field: PromptField): void {
    if (!field.multiline) this.confirm();
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    const result: Record<string, string> = {};
    for (const field of this.fields()) {
      result[field.key] = this.valueOf(field);
    }
    this.settled.emit(result);
  }

  protected cancel(): void {
    this.settled.emit(null);
  }
}
