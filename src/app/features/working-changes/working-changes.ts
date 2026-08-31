import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { SystemOps } from '../../core/services/ops';
import { PreferencesService } from '../../core/services/preferences.service';
import {
  ClipboardService,
  ContextMenuService,
  type SegmentedOption,
  YoruButton,
  YoruEmptyState,
  YoruSegmented,
} from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';
import { ChangesList, type RowMenuEvent, type RowSelectEvent } from './changes-list';
import {
  type ChangeRow,
  type FileEntry,
  filterEntries,
  listRows,
  type SectionId,
  treeRows,
} from './changes-tree';
import { CommitComposer } from './commit-composer';
import { DiscardConfirmModal } from './discard-confirm-modal';
import {
  absolutePath,
  fileMenuItems,
  IGNORE_PREFIX,
  parentDirectory,
} from './file-menu';
import {
  actionTargets,
  EMPTY_SELECTION,
  pruneSelection,
  type SelectionState,
  selectAllIn,
  selectRow,
  setActive,
} from './selection';

/** Conflicts must never push the other two sections off screen. */
const MAX_CONFLICT_ROWS = 6;

const NO_PATHS: ReadonlySet<string> = new Set<string>();

const VIEW_OPTIONS: readonly SegmentedOption[] = [
  { value: 'list', label: 'List', icon: 'lucideList' },
  { value: 'tree', label: 'Tree', icon: 'lucideFolderTree' },
];

/**
 * The working tree: conflicts, staged and unstaged/untracked files, with the
 * commit composer pinned underneath.
 *
 * Selection lives here rather than in each list so a bulk action reads one
 * selection; the lists own navigation and focus.
 */
@Component({
  selector: 'app-working-changes',
  imports: [
    ChangesList,
    CommitComposer,
    DiscardConfirmModal,
    NgIcon,
    YoruButton,
    YoruEmptyState,
    YoruSegmented,
  ],
  templateUrl: './working-changes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col overflow-hidden' },
})
export class WorkingChangesPanel {
  private readonly service = inject(CurrentRepoService);
  private readonly prefs = inject(PreferencesService);
  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);
  private readonly system = inject(SystemOps);
  private readonly dialogs = inject(DialogsService);

  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly maxConflictRows = MAX_CONFLICT_ROWS;

  protected readonly filter = signal<string>('');
  protected readonly viewMode = signal<string>('list');
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());
  private readonly selection = signal<SelectionState>(EMPTY_SELECTION);

  protected readonly discardOpen = signal<boolean>(false);
  protected readonly discardTargets = signal<readonly string[]>([]);

  protected readonly sequencerActive = this.service.sequencerActive;
  protected readonly conflictCount = this.service.conflictCount;

  private readonly entries = computed<FileEntry[]>(() => {
    const changes = this.service.changes();
    if (!changes) return [];

    const entries: FileEntry[] = [];
    for (const path of changes.conflicted) {
      entries.push({
        path,
        oldPath: null,
        status: 'conflicted',
        section: 'conflicts',
        isSubmodule: false,
      });
    }
    for (const file of changes.staged) {
      entries.push({
        path: file.path,
        oldPath: file.old_path,
        status: file.status,
        section: 'staged',
        isSubmodule: file.is_submodule,
      });
    }
    for (const file of changes.unstaged) {
      entries.push({
        path: file.path,
        oldPath: file.old_path,
        status: file.status,
        section: 'changes',
        isSubmodule: file.is_submodule,
      });
    }
    for (const path of changes.untracked) {
      entries.push({
        path,
        oldPath: null,
        status: 'untracked',
        section: 'changes',
        isSubmodule: false,
      });
    }
    return entries;
  });

  private readonly filtered = computed(() =>
    filterEntries(this.entries(), this.filter()),
  );

  protected readonly hasChanges = computed(() => this.entries().length > 0);

  protected readonly untrackedPaths = computed<ReadonlySet<string>>(
    () => new Set(this.service.changes()?.untracked ?? []),
  );

  protected readonly conflictRows = computed(() => this.rowsFor('conflicts'));
  protected readonly stagedRows = computed(() => this.rowsFor('staged'));
  protected readonly changeRows = computed(() => this.rowsFor('changes'));

  protected readonly showConflicts = computed(
    () => this.conflictCount() > 0 || this.sequencerActive(),
  );

  protected readonly selectedPaths = computed(() => new Set(this.selection().paths));
  protected readonly activePath = computed(() => this.selection().active);
  private readonly activeSection = computed(() => this.selection().section);

  /** The row the diff viewer is showing, split by which list owns it. */
  protected readonly stagedDiffPath = computed(() => {
    const source = this.service.diffSource();
    return source.kind === 'workingFile' && source.staged ? source.file : null;
  });

  protected readonly worktreeDiffPath = computed(() => {
    const source = this.service.diffSource();
    return source.kind === 'workingFile' && !source.staged ? source.file : null;
  });

  constructor() {
    // Staging or discarding removes rows; a selection pointing at them would
    // keep feeding vanished paths to the next bulk action.
    effect(() => {
      const state = this.selection();
      if (state.section === null) return;
      const pruned = pruneSelection(state, this.visibleIn(state.section));
      if (pruned !== state) this.selection.set(pruned);
    });
  }

  protected selectedIn(section: SectionId): ReadonlySet<string> {
    return this.activeSection() === section ? this.selectedPaths() : NO_PATHS;
  }

  protected activeIn(section: SectionId): string | null {
    return this.activeSection() === section ? this.activePath() : null;
  }

  protected fileCount(rows: readonly ChangeRow[]): number {
    return rows.reduce((total, row) => total + (row.kind === 'file' ? 1 : 0), 0);
  }

  protected onFilterInput(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected clearFilter(): void {
    this.filter.set('');
  }

  // ── row interaction ─────────────────────────────────────────────────────

  protected onRowSelect(section: SectionId, event: RowSelectEvent): void {
    this.selection.update((state) =>
      selectRow(state, section, event.path, this.visibleIn(section), event.modifiers),
    );
    // Plain click doubles as "show me this file"; a modifier is only building
    // a selection and must not swap the diff under the user.
    if (!event.modifiers.ctrl && !event.modifiers.shift) {
      this.openDiff(section, event.path);
    }
  }

  protected onRowActivate(section: SectionId, path: string): void {
    this.openDiff(section, path);
  }

  /** Space / the row button: stage, unstage, or mark a conflict resolved. */
  protected onRowPrimary(section: SectionId, path: string): void {
    const targets = this.targetsFor(section, path);
    if (section === 'staged') void this.service.unstageFiles(targets);
    else void this.service.stageFiles(targets);
  }

  protected onRowDiscard(section: SectionId, path: string): void {
    this.requestDiscard(this.targetsFor(section, path));
  }

  /** The three-way resolver lives in the shared dialog host, not in the panel. */
  protected onRowResolve(path: string): void {
    this.dialogs.openMergeResolver(path);
  }

  protected onFolderToggle(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  }

  protected onActiveChange(section: SectionId, path: string): void {
    this.selection.update((state) => setActive(state, section, path));
  }

  protected onSelectAll(section: SectionId): void {
    this.selection.set(selectAllIn(section, this.visibleIn(section)));
  }

  // ── bulk actions ────────────────────────────────────────────────────────

  protected stageAll(): void {
    const paths = this.visibleIn('changes');
    if (paths.length > 0) void this.service.stageFiles(paths);
  }

  protected unstageAll(): void {
    const paths = this.visibleIn('staged');
    if (paths.length > 0) void this.service.unstageFiles(paths);
  }

  protected discardAll(): void {
    this.requestDiscard(this.visibleIn('changes'));
  }

  // ── discard ─────────────────────────────────────────────────────────────

  private requestDiscard(paths: readonly string[]): void {
    if (paths.length === 0) return;
    if (!this.prefs.confirmDangerous()) {
      void this.service.discardChanges([...paths]);
      return;
    }
    this.discardTargets.set(paths);
    this.discardOpen.set(true);
  }

  protected onDiscardConfirm(): void {
    const paths = [...this.discardTargets()];
    this.closeDiscard();
    void this.service.discardChanges(paths);
  }

  protected closeDiscard(): void {
    this.discardOpen.set(false);
    this.discardTargets.set([]);
  }

  // ── context menu ────────────────────────────────────────────────────────

  protected async onRowMenu(section: SectionId, event: RowMenuEvent): Promise<void> {
    const entry = this.filtered().find(
      (candidate) => candidate.section === section && candidate.path === event.path,
    );
    if (!entry) return;

    // Right-clicking outside the selection acts on that row alone, so make the
    // row the menu will operate on the visibly selected one.
    const state = this.selection();
    if (state.section !== section || !state.paths.includes(event.path)) {
      this.selection.set(
        selectRow(state, section, event.path, this.visibleIn(section), {
          ctrl: false,
          shift: false,
        }),
      );
    }

    const targets = this.targetsFor(section, event.path);
    const choice = await this.menu.open(
      fileMenuItems({ entry, targets }),
      event.anchor,
    );
    if (choice !== null) await this.runMenuAction(choice, entry, targets);
  }

  private async runMenuAction(
    choice: string,
    entry: FileEntry,
    targets: readonly string[],
  ): Promise<void> {
    if (choice.startsWith(IGNORE_PREFIX)) {
      await this.service.ignorePathAction(choice.slice(IGNORE_PREFIX.length));
      return;
    }

    switch (choice) {
      case 'stage':
      case 'mark-resolved':
        await this.service.stageFiles([...targets]);
        return;
      case 'unstage':
        await this.service.unstageFiles([...targets]);
        return;
      case 'discard':
        this.requestDiscard(targets);
        return;
      case 'stash':
        await this.stash(targets);
        return;
      case 'assume-unchanged':
        await this.service.setAssumeUnchangedAction(entry.path, true);
        return;
      case 'history':
        await this.service.loadFileHistory(entry.path);
        return;
      case 'blame':
        await this.service.loadBlame(entry.path);
        return;
      case 'editor':
        await this.service.openInEditor(entry.path);
        return;
      case 'reveal':
        await this.service.revealInFileManager(entry.path);
        return;
      case 'terminal':
        await this.openTerminalAt(entry.path);
        return;
      case 'copy-path':
        await this.clipboard.writeText(this.absolute(entry.path));
        return;
      case 'copy-relative':
        await this.clipboard.writeText(entry.path);
        return;
      case 'resolve':
        this.dialogs.openMergeResolver(entry.path);
        return;
      case 'take-ours':
        await this.service.takeConflictSideAction(entry.path, 'ours');
        return;
      case 'take-theirs':
        await this.service.takeConflictSideAction(entry.path, 'theirs');
        return;
      case 'delete-conflicted':
        await this.service.deleteConflictedFileAction(entry.path);
        return;
      default:
        return;
    }
  }

  private async stash(targets: readonly string[]): Promise<void> {
    const untracked = this.untrackedPaths();
    const message =
      targets.length === 1 ? `WIP: ${targets[0]}` : `WIP: ${targets.length} files`;
    await this.service.stashSaveAction(message, {
      paths: [...targets],
      includeUntracked: targets.some((path) => untracked.has(path)),
    });
  }

  private async openTerminalAt(path: string): Promise<void> {
    if (this.service.repo() === null) return;
    await this.system.openTerminal(parentDirectory(this.absolute(path)));
  }

  private absolute(path: string): string {
    const repo = this.service.repo();
    return repo ? absolutePath(repo.path, path) : path;
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private openDiff(section: SectionId, path: string): void {
    void this.service.selectWorkingFile(path, section === 'staged');
  }

  private rowsFor(section: SectionId): ChangeRow[] {
    const entries = this.filtered().filter((entry) => entry.section === section);
    return this.viewMode() === 'tree'
      ? treeRows(entries, this.collapsed())
      : listRows(entries);
  }

  /**
   * File paths of a section in display order. Folders and rows the filter hid
   * are left out, so "Stage all" stages exactly what the user can see.
   */
  private visibleIn(section: SectionId): string[] {
    const rows =
      section === 'conflicts'
        ? this.conflictRows()
        : section === 'staged'
          ? this.stagedRows()
          : this.changeRows();
    return rows.filter((row) => row.kind === 'file').map((row) => row.path);
  }

  private targetsFor(section: SectionId, path: string): string[] {
    return actionTargets(this.selection(), section, path);
  }
}
