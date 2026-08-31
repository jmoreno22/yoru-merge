import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { YoruButton, YoruDialog } from '../../shared/ui';
import { discardSummary } from './discard';

/**
 * Confirmation for `discardChanges`. The panel owns the open state and the
 * list of paths; this component only turns them into honest copy.
 */
@Component({
  selector: 'app-discard-confirm-modal',
  imports: [YoruButton, YoruDialog],
  templateUrl: './discard-confirm-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscardConfirmModal {
  readonly open = input<boolean>(false);
  readonly files = input.required<readonly string[]>();
  /** Which of `files` are untracked — those get deleted, not reverted. */
  readonly untracked = input<ReadonlySet<string>>(new Set<string>());

  readonly cancel = output<void>();
  readonly confirm = output<void>();

  protected readonly summary = computed(() =>
    discardSummary(this.files(), this.untracked()),
  );

  protected isUntracked(path: string): boolean {
    return this.untracked().has(path);
  }
}
