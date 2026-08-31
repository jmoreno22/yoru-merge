import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import {
  buildLinePatch,
  changedLineIndexes,
  patchApplyFlags,
  shortSha,
} from '../../core/utils';
import type { SegmentedOption } from '../../shared/ui';
import {
  ClipboardService,
  KeyboardShortcutsService,
  YoruButton,
  YoruEmptyState,
  YoruSegmented,
} from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';
import type { DiffHunkAction, DiffLineAction, StageTarget } from './diff-actions';
import { DiffView } from './diff-view';
import { UNLIMITED_CONTEXT } from './diff-view-model';
import type { ImageDiffContext } from './image-preview';

const LAYOUT_OPTIONS: readonly SegmentedOption[] = [
  { value: 'unified', label: 'Unified', icon: 'lucideRows3' },
  { value: 'split', label: 'Split', icon: 'lucideColumns2' },
];

/**
 * Context budget, in unchanged lines kept around each change.
 *
 * `get_diff` runs plain `git diff`, so a patch always arrives with git's three
 * lines of context: this control can only take context away, never add it.
 * `ALL_CONTEXT` is the top of the preference's 0–20 range, which no real patch
 * reaches, so it stands for "everything git sent" and keeps the value finite —
 * the preference schema rejects `Infinity`.
 */
const ALL_CONTEXT = 20;

const CONTEXT_OPTIONS: readonly SegmentedOption[] = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: String(ALL_CONTEXT), label: 'All' },
];

/**
 * The diff panel: everything around the patch.
 *
 * It owns the header, the options bar and the git round trips; `<app-diff-view>`
 * owns the rendering and hands actions back as ordinals and body positions.
 * Splitting them keeps the renderer reusable (file history uses it too) and
 * keeps the git facade out of a component that paints tens of thousands of
 * rows.
 */
@Component({
  selector: 'app-diff-viewer',
  imports: [DiffView, NgIcon, YoruButton, YoruEmptyState, YoruSegmented],
  templateUrl: './diff-viewer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'diff-viewer',
    class: 'block h-full min-h-0 w-full',
  },
})
export class DiffViewer {
  private readonly repo = inject(CurrentRepoService);
  private readonly prefs = inject(PreferencesService);
  private readonly dialogs = inject(DialogsService);
  private readonly clipboard = inject(ClipboardService);

  /** Asks the workbench to open blame for this path. */
  readonly openBlame = output<string>();
  /** Asks the workbench to open the file history for this path. */
  readonly openHistory = output<string>();

  private readonly view = viewChild(DiffView);

  protected readonly layoutOptions = LAYOUT_OPTIONS;
  protected readonly contextOptions = CONTEXT_OPTIONS;

  protected readonly diffText = this.repo.diffText;
  protected readonly diffSource = this.repo.diffSource;
  protected readonly busy = this.repo.stagingBusy;

  protected readonly viewMode = this.prefs.diffViewMode;
  protected readonly ignoreWhitespace = this.prefs.diffIgnoreWhitespace;
  protected readonly wordWrap = this.prefs.diffWordWrap;

  protected readonly hasDiff = computed(() => this.diffSource().kind !== 'none');

  /** The working-tree path on screen; `null` for a commit or stash patch. */
  protected readonly currentFile = computed(() => {
    const source = this.diffSource();
    return source.kind === 'workingFile' ? source.file : null;
  });

  /** Staging is only possible against a working-tree file. */
  protected readonly stageTarget = computed<StageTarget | null>(() => {
    const source = this.diffSource();
    return source.kind === 'workingFile'
      ? { file: source.file, staged: source.staged }
      : null;
  });

  /** Which revisions an image in this patch can be read from. */
  protected readonly imageContext = computed<ImageDiffContext>(() => {
    const source = this.diffSource();
    if (source.kind === 'commit') return { kind: 'commit', sha: source.sha };
    if (source.kind === 'workingFile') {
      return { kind: 'working', staged: source.staged };
    }
    return { kind: 'none' };
  });

  protected readonly heading = computed(() => {
    const source = this.diffSource();
    if (source.kind === 'workingFile') {
      const slash = source.file.lastIndexOf('/');
      return {
        dirname: slash < 0 ? '' : source.file.slice(0, slash + 1),
        basename: slash < 0 ? source.file : source.file.slice(slash + 1),
        chip: source.staged ? 'Staged' : 'Unstaged',
        copy: source.file,
        title: source.file,
      };
    }
    if (source.kind === 'commit') {
      return {
        dirname: '',
        basename: shortSha(source.sha),
        chip: 'Commit',
        copy: source.sha,
        title: source.sha,
      };
    }
    return null;
  });

  protected readonly summary = computed(() => this.view()?.summary() ?? null);
  protected readonly hunkTotal = computed(() => this.view()?.hunkTotal() ?? 0);
  protected readonly hunkPosition = computed(() => this.view()?.hunkPosition() ?? 0);

  /** Value fed to the context segmented control. */
  protected readonly contextValue = computed(() => {
    const lines = this.prefs.diffContextLines();
    return lines === 0 || lines === 1 ? String(lines) : String(ALL_CONTEXT);
  });

  /** What the renderer gets: the sentinel becomes a real infinity. */
  protected readonly contextLines = computed(() => {
    const lines = this.prefs.diffContextLines();
    return lines <= 1 ? lines : UNLIMITED_CONTEXT;
  });

  constructor() {
    const shortcuts = inject(KeyboardShortcutsService);
    const offNext = shortcuts.register({
      id: 'diff.next-hunk',
      combo: 'n',
      label: 'Next hunk',
      when: () => this.hunkTotal() > 0,
      run: () => this.view()?.goToNextHunk(),
    });
    const offPrevious = shortcuts.register({
      id: 'diff.previous-hunk',
      combo: 'p',
      label: 'Previous hunk',
      when: () => this.hunkTotal() > 0,
      run: () => this.view()?.goToPreviousHunk(),
    });
    inject(DestroyRef).onDestroy(() => {
      offNext();
      offPrevious();
    });
  }

  // ── options bar ─────────────────────────────────────────────────────────

  protected onLayout(value: string): void {
    this.prefs.setDiffViewMode(value === 'split' ? 'split' : 'unified');
  }

  protected onContext(value: string): void {
    this.prefs.setDiffContextLines(Number(value));
  }

  protected toggleWhitespace(): void {
    this.prefs.setDiffIgnoreWhitespace(!this.ignoreWhitespace());
  }

  protected toggleWrap(): void {
    this.prefs.setDiffWordWrap(!this.wordWrap());
  }

  protected goToNextHunk(): void {
    this.view()?.goToNextHunk();
  }

  protected goToPreviousHunk(): void {
    this.view()?.goToPreviousHunk();
  }

  // ── file actions ────────────────────────────────────────────────────────

  protected async copyHeading(): Promise<void> {
    const heading = this.heading();
    if (heading) await this.clipboard.writeText(heading.copy);
  }

  protected onOpenFile(file: string): void {
    void this.repo.openInEditor(file);
  }

  protected onRevealFile(file: string): void {
    void this.repo.revealInFileManager(file);
  }

  // ── staging ─────────────────────────────────────────────────────────────

  protected async onHunkAction(action: DiffHunkAction): Promise<void> {
    if (action.kind === 'stage') {
      await this.repo.stageHunks(action.file, [{ index: action.hunkIndex }]);
      return;
    }
    if (action.kind === 'unstage') {
      await this.repo.unstageHunks(action.file, [{ index: action.hunkIndex }]);
      return;
    }
    await this.discard(
      action,
      changedLineIndexes(action.fileDiff, action.hunkIndex),
      'hunk',
    );
  }

  protected async onLineAction(action: DiffLineAction): Promise<void> {
    if (action.kind === 'discard') {
      await this.discard(action, action.lines, 'lines');
      return;
    }
    const patch = buildLinePatch(
      action.fileDiff,
      action.hunkIndex,
      action.lines,
      action.kind,
    );
    if (patch === '') return;
    await this.repo.applyPatchAction(patch, patchApplyFlags(action.kind));
  }

  /**
   * Discard is the one action that destroys work, so it always builds the
   * patch first: an empty patch means the selection changes nothing and the
   * user is never asked to confirm a no-op.
   */
  private async discard(
    action: DiffHunkAction,
    lines: readonly number[],
    scope: 'hunk' | 'lines',
  ): Promise<void> {
    const patch = buildLinePatch(action.fileDiff, action.hunkIndex, lines, 'discard');
    if (patch === '') return;

    const what =
      scope === 'hunk'
        ? 'This hunk'
        : `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;
    const confirmed = await this.dialogs.confirm({
      title: 'Discard changes',
      body: `${what} of ${action.file} will be reverted in the working tree. This cannot be undone.`,
      confirmLabel: 'Discard',
      tone: 'danger',
      skippable: true,
    });
    if (!confirmed) return;

    await this.repo.applyPatchAction(patch, patchApplyFlags('discard'));
  }
}
