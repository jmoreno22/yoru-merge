import {
  CdkDrag,
  type CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { RebaseTodoEntry } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { shortSha } from '../../core/utils';
import type { SegmentedOption } from '../../shared/ui';
import { YoruButton, YoruDialog, YoruSegmented, YoruSpinner } from '../../shared/ui';
import {
  editsMessage,
  moveTodoEntry,
  previewTodo,
  updateTodoEntry,
  validateTodo,
} from './rebase-todo';

const ACTIONS: readonly SegmentedOption[] = [
  { value: 'pick', label: 'Pick' },
  { value: 'reword', label: 'Reword' },
  { value: 'squash', label: 'Squash' },
  { value: 'fixup', label: 'Fixup' },
  { value: 'edit', label: 'Edit' },
  { value: 'drop', label: 'Drop' },
];

type Outcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'stopped'; readonly title: string; readonly message: string };

/**
 * The interactive rebase editor.
 *
 * `fromSha` is the commit the user pointed at, and it is **included** in the
 * plan: the rebase runs from its parent, which is what "rebase from here"
 * means everywhere else. Mounted by `InteractiveRebaseService`.
 */
@Component({
  selector: 'app-interactive-rebase-dialog',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    NgIcon,
    YoruDialog,
    YoruButton,
    YoruSegmented,
    YoruSpinner,
  ],
  templateUrl: './interactive-rebase-dialog.html',
  styleUrl: './interactive-rebase-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractiveRebaseDialog {
  private readonly repo = inject(CurrentRepoService);

  /** Oldest commit to rewrite; the rebase base is its parent. */
  readonly fromSha = input.required<string>();
  readonly closed = output<void>();

  protected readonly actions = ACTIONS;
  protected readonly entries = signal<readonly RebaseTodoEntry[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly applying = signal<boolean>(false);
  protected readonly outcome = signal<Outcome>({ kind: 'idle' });

  protected readonly base = computed(() => `${this.fromSha()}^`);
  protected readonly preview = computed(() => previewTodo(this.entries()));
  protected readonly problem = computed(() => validateTodo(this.entries()));

  constructor() {
    void this.load();
  }

  protected shortOf(sha: string): string {
    return shortSha(sha);
  }

  protected editsMessage(action: string): boolean {
    return editsMessage(action);
  }

  protected subjectOf(entry: RebaseTodoEntry): string {
    return entry.message.split('\n')[0] ?? '';
  }

  protected onAction(index: number, action: string): void {
    this.entries.update((entries) => updateTodoEntry(entries, index, { action }));
  }

  protected onMessage(index: number, message: string): void {
    this.entries.update((entries) => updateTodoEntry(entries, index, { message }));
  }

  protected onDrop(event: CdkDragDrop<readonly RebaseTodoEntry[]>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  protected move(from: number, to: number): void {
    if (from === to) return;
    this.entries.update((entries) => moveTodoEntry(entries, from, to));
  }

  /** `Alt+↑` / `Alt+↓` reorder without a pointer. */
  protected onRowKeydown(event: KeyboardEvent, index: number): void {
    if (!event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(index, index - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(index, index + 1);
    }
  }

  protected async start(): Promise<void> {
    if (this.problem() !== null || this.applying()) return;
    this.applying.set(true);
    this.outcome.set({ kind: 'idle' });
    try {
      const result = await this.repo.applyRebaseAction(this.base(), [
        ...this.entries(),
      ]);
      if (!result) {
        this.outcome.set({
          kind: 'error',
          message: 'The rebase could not be started.',
        });
        return;
      }
      switch (result.kind) {
        case 'rebased':
        case 'up_to_date':
          this.closed.emit();
          return;
        case 'conflicts':
          this.outcome.set({
            kind: 'stopped',
            title: 'Rebase stopped with conflicts',
            message: `Resolve ${result.files.join(', ')}, then use Continue, Skip or Abort in the repository banner.`,
          });
          return;
        case 'paused':
          this.outcome.set({
            kind: 'stopped',
            title: 'Rebase paused',
            message:
              'An "edit" step stopped the rebase. Amend the commit, then use Continue in the repository banner.',
          });
          return;
        case 'not_possible':
          this.outcome.set({
            kind: 'error',
            message:
              'Git refused to start the rebase. Commit or stash your changes and try again.',
          });
          return;
        case 'error':
          this.outcome.set({ kind: 'error', message: result.message });
          return;
      }
    } finally {
      this.applying.set(false);
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  private async load(): Promise<void> {
    try {
      const todo = await this.repo.rebaseTodoAction(this.base());
      this.entries.set(todo);
      if (todo.length === 0) {
        this.outcome.set({
          kind: 'error',
          message:
            'There is nothing to rebase from this commit. It may not be on the current branch.',
        });
      }
    } finally {
      this.loading.set(false);
    }
  }
}
