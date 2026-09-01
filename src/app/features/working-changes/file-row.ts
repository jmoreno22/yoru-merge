import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { YoruIconName } from '../../shared/icons';
import { type ChipKind, chipLabel, type FileRow } from './changes-tree';

/** Status icon and colour, straight from the design system's status table. */
const STATUS_ICONS: Readonly<Record<ChipKind, YoruIconName>> = {
  added: 'lucideFilePlus',
  modified: 'lucideFileDiff',
  deleted: 'lucideFileMinus',
  renamed: 'lucideFile',
  copied: 'lucideFile',
  type_changed: 'lucideFileDiff',
  untracked: 'lucideFile',
  conflicted: 'lucideFileX',
};

const STATUS_COLORS: Readonly<Record<ChipKind, string>> = {
  added: 'text-git-added',
  modified: 'text-git-modified',
  deleted: 'text-git-deleted',
  renamed: 'text-git-renamed',
  copied: 'text-git-renamed',
  type_changed: 'text-neon-violet',
  untracked: 'text-[var(--app-text-muted)]',
  conflicted: 'text-[var(--app-conflict-text)]',
};

/**
 * One 30 px file row. Purely presentational: every interaction leaves through
 * an output or bubbles to the list, which owns selection and the menu.
 */
@Component({
  selector: 'app-file-row',
  imports: [NgIcon],
  templateUrl: './file-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'option',
    '[class]': 'hostClass()',
    '[attr.data-path]': 'row().path',
    '[attr.tabindex]': 'active() ? 0 : -1',
    '[attr.aria-selected]': 'selected()',
    '[attr.title]': 'row().path',
  },
})
export class FileRowItem {
  readonly row = input.required<FileRow>();
  readonly selected = input<boolean>(false);
  /** Holds the roving tabindex; only one row per list has it. */
  readonly active = input<boolean>(false);
  /** This row is what the diff viewer is showing. */
  readonly openInDiff = input<boolean>(false);

  /** Stage, unstage or (conflicts) mark resolved — the row's primary action. */
  readonly primary = output<void>();
  readonly discard = output<void>();
  readonly resolve = output<void>();

  protected readonly hostClass = computed(() => {
    const base =
      'group flex h-[var(--file-row-h)] items-center gap-2 border-l-2 pr-1 ' +
      'text-xs cursor-pointer select-none outline-none';
    const fill = this.selected()
      ? 'bg-[var(--app-panel)]'
      : 'hover:bg-[var(--app-panel)]/60';
    // The cyan edge marks the row the diff viewer is showing, not the selection.
    const edge = this.openInDiff() ? 'border-accent' : 'border-transparent';
    return `${base} ${fill} ${edge}`;
  });

  protected readonly entry = computed(() => this.row().entry);
  protected readonly label = computed(() => chipLabel(this.entry().status));
  protected readonly statusIcon = computed(() => STATUS_ICONS[this.entry().status]);
  protected readonly statusClass = computed(() => STATUS_COLORS[this.entry().status]);
  protected readonly indent = computed(() => 8 + this.row().depth * 18);
  protected readonly untracked = computed(() => this.entry().status === 'untracked');
  protected readonly submodule = computed(() => this.entry().isSubmodule);
  protected readonly conflicted = computed(() => this.entry().section === 'conflicts');
  protected readonly staged = computed(() => this.entry().section === 'staged');

  /**
   * Discarding a staged row would restore the work tree from the index, which
   * already holds that content: unstage first, then discard.
   */
  protected readonly canDiscard = computed(() => !this.conflicted() && !this.staged());

  /** Untracked files are deleted, not reverted: say so on the button. */
  protected readonly discardLabel = computed(() =>
    this.untracked()
      ? `Delete ${this.row().name}`
      : `Discard changes in ${this.row().name}`,
  );

  protected readonly primaryIcon = computed(() => {
    if (this.conflicted()) return 'lucideCheck' as const;
    return this.staged() ? ('lucideMinus' as const) : ('lucidePlus' as const);
  });

  protected readonly primaryClass = computed(() =>
    this.staged()
      ? 'border-accent/40 bg-accent/5 text-accent-ink hover:bg-accent/20'
      : 'border-git-added/40 bg-git-added/5 text-git-added hover:bg-git-added/20',
  );

  protected readonly primaryLabel = computed(() => {
    if (this.conflicted()) return `Mark ${this.row().name} as resolved`;
    return this.staged() ? `Unstage ${this.row().name}` : `Stage ${this.row().name}`;
  });

  protected onPrimary(event: Event): void {
    event.stopPropagation();
    this.primary.emit();
  }

  protected onDiscard(event: Event): void {
    event.stopPropagation();
    this.discard.emit();
  }

  protected onResolve(event: Event): void {
    event.stopPropagation();
    this.resolve.emit();
  }
}
