import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert, lucideX } from '@ng-icons/lucide';

export type DialogSize = 'sm' | 'md' | 'lg' | 'full';
export type DialogTone = 'default' | 'danger' | 'conflict';

const SIZES: Readonly<Record<DialogSize, string>> = {
  sm: 'w-[min(24rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)]',
  md: 'w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)]',
  lg: 'w-[min(46rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)]',
  full: 'h-[calc(100vh-3rem)] w-[calc(100vw-3rem)]',
};

const TONES: Readonly<Record<DialogTone, string>> = {
  default: 'text-neon-cyan',
  danger: 'text-git-deleted',
  conflict: 'text-[var(--app-conflict-text)]',
};

let nextDialogId = 0;

/**
 * Modal shell for every dialog in the app.
 *
 * ```html
 * <yoru-dialog [open]="open()" title="Delete branch" tone="danger" (closed)="open.set(false)">
 *   <p dialog-body>This cannot be undone.</p>
 *   <yoru-button dialog-actions variant="danger" (click)="confirm()">Delete</yoru-button>
 * </yoru-dialog>
 * ```
 *
 * Escape always cancels; `dismissible` only governs the backdrop click, so a
 * destructive confirmation can require an explicit choice without trapping the
 * keyboard user. Focus is captured on open and restored on close by
 * `cdkTrapFocusAutoCapture`.
 */
@Component({
  selector: 'yoru-dialog',
  imports: [CdkTrapFocus, NgIcon],
  viewProviders: [provideIcons({ lucideX, lucideTriangleAlert })],
  templateUrl: './yoru-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class YoruDialog {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly size = input<DialogSize>('md');
  readonly tone = input<DialogTone>('default');
  /** Whether clicking the backdrop closes the dialog. */
  readonly dismissible = input<boolean>(true);

  readonly closed = output<void>();

  protected readonly titleId = `yoru-dialog-title-${nextDialogId++}`;

  protected readonly panelClass = computed(
    () =>
      'flex flex-col overflow-hidden rounded-lg border border-[var(--app-border)] ' +
      `bg-[var(--app-surface-raised)] shadow-panel ${SIZES[this.size()]}`,
  );

  protected readonly titleClass = computed(
    () => `flex-1 truncate text-[15px] font-semibold ${TONES[this.tone()]}`,
  );

  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onBackdrop(): void {
    if (this.dismissible()) this.closed.emit();
  }

  protected requestClose(): void {
    this.closed.emit();
  }
}
