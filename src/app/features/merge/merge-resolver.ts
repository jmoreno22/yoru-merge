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
import type { ConflictFile, MergeContent, ParsedConflict } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import {
  YoruButton,
  YoruDialog,
  YoruEmptyState,
  YoruSectionHeader,
  YoruSpinner,
} from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';
import {
  findSequence,
  hasConflictMarkers,
  parseConflicts,
  replaceConflict,
} from './conflict-parser';

/** Human label for the sequencer the conflicts belong to. */
const OPERATION_LABELS: Readonly<Record<string, string>> = {
  merging: 'merge',
  rebasing: 'rebase',
  cherry_picking: 'cherry-pick',
  reverting: 'revert',
};

/**
 * Conflict resolver: file list on the left, the two sides of the active block
 * and the editable result on the right.
 *
 * The buffer is the source of truth while editing — the block counter, the
 * take buttons and the save guard all read it — so a hand edit in the textarea
 * stays in sync with the block navigation.
 */
@Component({
  selector: 'app-merge-resolver',
  imports: [
    YoruDialog,
    YoruButton,
    YoruSectionHeader,
    YoruEmptyState,
    YoruSpinner,
    NgIcon,
  ],
  templateUrl: './merge-resolver.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'merge-resolver-host' },
})
export class MergeResolver {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);

  readonly open = input<boolean>(false);
  /** File to select when the dialog opens; `null` picks the first conflict. */
  readonly initialFile = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly conflicts = this.currentRepo.conflicts;
  protected readonly repoState = this.currentRepo.repoState;
  protected readonly busy = this.currentRepo.mergeBusy;

  protected readonly file = signal<string | null>(null);
  protected readonly content = signal<MergeContent | null>(null);
  protected readonly text = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly blocks = computed<ParsedConflict[]>(() =>
    parseConflicts(this.text()),
  );

  protected readonly active = computed<ParsedConflict | null>(() => {
    const blocks = this.blocks();
    if (blocks.length === 0) return null;
    const index = Math.min(this.activeIndex(), blocks.length - 1);
    return blocks[index] ?? null;
  });

  /** 1-based position of the active block, 0 when nothing is left. */
  protected readonly activePosition = computed(() =>
    this.blocks().length === 0
      ? 0
      : Math.min(this.activeIndex(), this.blocks().length - 1) + 1,
  );

  protected readonly fileIndex = computed(() => {
    const path = this.file();
    if (!path) return 0;
    return this.conflicts().findIndex((entry) => entry.path === path) + 1;
  });

  protected readonly resolved = computed(() => !hasConflictMarkers(this.text()));

  protected readonly canSave = computed(
    () => this.file() !== null && this.resolved() && !this.saving() && !this.loading(),
  );

  protected readonly oursText = computed(() =>
    (this.active()?.oursLines ?? []).join('\n'),
  );
  protected readonly theirsText = computed(() =>
    (this.active()?.theirsLines ?? []).join('\n'),
  );

  /** Line where the block's "ours" side sits in the full HEAD version. */
  protected readonly oursLine = computed(() =>
    this.sideLine(this.content()?.ours, this.active()?.oursLines),
  );
  protected readonly theirsLine = computed(() =>
    this.sideLine(this.content()?.theirs, this.active()?.theirsLines),
  );

  protected readonly operation = computed(
    () => OPERATION_LABELS[this.repoState().state] ?? 'operation',
  );

  protected readonly allResolved = computed(() => this.conflicts().length === 0);

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.file.set(null);
        this.content.set(null);
        this.text.set('');
        return;
      }
      const requested = this.initialFile();
      const list = this.conflicts();
      const current = this.file();
      if (current && list.some((entry) => entry.path === current)) return;
      const next =
        (requested && list.some((entry) => entry.path === requested)
          ? requested
          : list[0]?.path) ?? null;
      this.file.set(next);
    });

    effect(() => {
      const path = this.file();
      if (path === null) {
        this.content.set(null);
        this.text.set('');
        this.loadError.set(null);
        return;
      }
      void this.load(path);
    });
  }

  private sideLine(
    side: string | undefined,
    lines: readonly string[] | undefined,
  ): number {
    if (!side || !lines || lines.length === 0) return -1;
    const at = findSequence(side.split('\n'), lines);
    return at < 0 ? -1 : at + 1;
  }

  private async load(path: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const content = await this.currentRepo.getMergeContentAction(path);
      if (!content) {
        this.loadError.set('Could not read the conflicted file.');
        this.content.set(null);
        this.text.set('');
        return;
      }
      this.content.set(content);
      this.text.set(content.current);
      this.activeIndex.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  protected selectFile(entry: ConflictFile): void {
    this.file.set(entry.path);
  }

  protected onTextInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected next(): void {
    const total = this.blocks().length;
    if (total === 0) return;
    this.activeIndex.update((index) => (index + 1) % total);
  }

  protected previous(): void {
    const total = this.blocks().length;
    if (total === 0) return;
    this.activeIndex.update((index) => (index - 1 + total) % total);
  }

  protected take(side: 'ours' | 'theirs' | 'both'): void {
    const block = this.active();
    if (!block) return;
    const replacement =
      side === 'ours'
        ? block.oursLines
        : side === 'theirs'
          ? block.theirsLines
          : [...block.oursLines, ...block.theirsLines];
    this.text.set(replaceConflict(this.text(), block, replacement));
    // Keep pointing at the same ordinal: the next block shifted into it.
    const remaining = parseConflicts(this.text()).length;
    if (remaining > 0)
      this.activeIndex.set(Math.min(this.activeIndex(), remaining - 1));
  }

  /** Keyboard shortcuts, ignored while the caret is in the editor. */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || target.isContentEditable) return;
    }
    switch (event.key) {
      case 'n':
        this.next();
        break;
      case 'p':
        this.previous();
        break;
      case '1':
        this.take('ours');
        break;
      case '2':
        this.take('theirs');
        break;
      case '3':
        this.take('both');
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected async onSave(): Promise<void> {
    const path = this.file();
    if (!path || !this.canSave()) return;
    this.saving.set(true);
    try {
      await this.currentRepo.resolveConflictAction(path, this.text());
      this.advanceAfter(path);
    } finally {
      this.saving.set(false);
    }
  }

  protected async onTakeWholeFile(side: 'ours' | 'theirs'): Promise<void> {
    const path = this.file();
    if (!path) return;
    await this.currentRepo.takeConflictSideAction(path, side);
    this.advanceAfter(path);
  }

  protected async onDeleteFile(): Promise<void> {
    const path = this.file();
    if (!path) return;
    const confirmed = await this.dialogs.confirm({
      title: 'Delete file',
      body: `Removes ${path} from the working tree and the index as the resolution of this conflict.`,
      confirmLabel: 'Delete file',
      tone: 'danger',
    });
    if (!confirmed) return;
    await this.currentRepo.deleteConflictedFileAction(path);
    this.advanceAfter(path);
  }

  protected async onContinue(): Promise<void> {
    const result = await this.currentRepo.continueSequencerAction();
    if (result?.kind === 'completed') this.closed.emit();
  }

  protected async onAbort(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: `Abort ${this.operation()}`,
      body: 'Everything done since the operation started is discarded and the branch goes back to where it was.',
      confirmLabel: `Abort ${this.operation()}`,
      tone: 'danger',
      skippable: true,
    });
    if (!confirmed) return;
    await this.currentRepo.abortSequencerAction();
    this.closed.emit();
  }

  protected onClose(): void {
    this.closed.emit();
  }

  /** Moves to whatever is still conflicted after `path` was dealt with. */
  private advanceAfter(path: string): void {
    const remaining = this.conflicts().filter((entry) => entry.path !== path);
    this.file.set(remaining[0]?.path ?? null);
  }
}
