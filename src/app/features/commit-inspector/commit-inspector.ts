import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  Injector,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { CommitDetails, CommitFile, SignatureStatus } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { focusKeyOwner } from '../../core/services/diff-workspace-state';
import { computeInspectorLayout } from '../../core/services/inspector-layout';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { absoluteTime, relativeTime, shortSha } from '../../core/utils';
import type { YoruIconName } from '../../shared/icons';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  focusVirtualRow,
  KeyboardShortcutsService,
  YoruAvatar,
  YoruBadge,
  YoruButton,
  YoruEmptyState,
  YoruSkeleton,
  YoruTooltip,
} from '../../shared/ui';
import { CommitActions } from '../commit-list/commit-actions.service';
import {
  buildFileRows,
  FILE_STATUS_LABEL,
  type FileRow,
  type FileViewMode,
  filterFiles,
} from './commit-files';

/** Rows drawn while `get_commit_details` is in flight. */
const SKELETON_FILES = 8;

/** Width the commit subject keeps in the collapsed summary line, in pixels. */
const SUBJECT_MIN_WIDTH = 160;

/** The element whose height the whole inspector column has to share out. */
const INSPECTOR_COLUMN = '[data-testid="inspector-column"]';

/**
 * The panels that stack under the diff viewer. They keep whatever share they
 * already have, so the policy takes their height off the top (AC-19).
 */
const STACKED_PANELS = 'app-blame-viewer, app-file-history-panel';

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((path, index) => path === b[index]);
}

interface HeaderAction {
  readonly id: string;
  readonly icon: YoruIconName;
  /** Used as both the tooltip and the accessible name of the icon button. */
  readonly label: string;
}

/**
 * The actions of the collapsed summary line, More excluded.
 *
 * The order is also the drop order: the last one is the first to move into
 * More when the line runs out of room.
 */
const HEADER_ACTIONS: readonly HeaderAction[] = [
  { id: 'branch', icon: 'lucideGitBranchPlus', label: 'Create branch here' },
  { id: 'tag', icon: 'lucideTag', label: 'Create tag here' },
  { id: 'cherry-pick', icon: 'lucideCherry', label: 'Cherry-pick this commit' },
  { id: 'revert', icon: 'lucideUndo2', label: 'Revert this commit' },
  { id: 'reset', icon: 'lucideRotateCcw', label: 'Reset to this commit' },
];

interface SignatureChip {
  readonly icon: YoruIconName | null;
  readonly label: string;
  readonly color: string;
}

const SIGNATURE_CHIP: Readonly<Record<SignatureStatus, SignatureChip>> = {
  good: {
    icon: 'lucideShieldCheck',
    label: 'Signature verified',
    color: 'var(--color-git-added)',
  },
  bad: {
    icon: 'lucideTriangleAlert',
    label: 'Bad signature',
    color: 'var(--color-git-deleted)',
  },
  unknown: {
    icon: 'lucideTriangleAlert',
    label: 'Signature from an unknown key',
    color: 'var(--color-git-modified)',
  },
  none: { icon: null, label: 'Unsigned', color: 'var(--app-text-faint)' },
};

/**
 * Everything about the selected commit: who wrote it, what it says, and which
 * files it touched.
 *
 * The commit actions live in `CommitActions`, the same service the history
 * list right-click menu uses, so the buttons here and the menu there can never
 * drift apart or confirm a destructive rewrite differently.
 */
@Component({
  selector: 'app-commit-inspector',
  imports: [
    NgIcon,
    ScrollingModule,
    YoruAvatar,
    YoruBadge,
    YoruButton,
    YoruEmptyState,
    YoruSkeleton,
    YoruTooltip,
  ],
  templateUrl: './commit-inspector.html',
  styleUrl: './commit-inspector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'commit-inspector',
    class: 'flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-surface)]',
  },
})
export class CommitInspector {
  private readonly repo = inject(CurrentRepoService);
  private readonly actions = inject(CommitActions);
  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);
  private readonly toast = inject(ToastService);
  private readonly appearance = inject(AppearanceService);
  private readonly prefs = inject(PreferencesService);
  protected readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly workspace = inject(DiffWorkspaceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly rowHeight = this.appearance.fileRowHeight;
  protected readonly details = this.repo.commitDetails;
  protected readonly loading = this.repo.commitDetailsLoading;
  protected readonly skeletonFiles = Array.from(
    { length: SKELETON_FILES },
    (_, i) => i,
  );

  protected readonly viewMode = signal<FileViewMode>('tree');
  protected readonly filter = signal<string>('');
  protected readonly activeFile = signal<string | null>(null);
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());

  private readonly bodyText = viewChild<ElementRef<HTMLElement>>('bodyText');
  private readonly headerBlock = viewChild<ElementRef<HTMLElement>>('headerBlock');
  private readonly summarySubject =
    viewChild<ElementRef<HTMLElement>>('summarySubject');
  private readonly headerActions = viewChild<ElementRef<HTMLElement>>('headerActions');
  private readonly fileViewport = viewChild(CdkVirtualScrollViewport);

  /** Bumped by the column observer; a DOM box is not a signal on its own. */
  private readonly columnResized = signal(0);

  /**
   * Read straight off the durable preference, so the panel paints in its
   * remembered state on the first frame instead of settling into it.
   */
  protected readonly headerCollapsed = computed<boolean>(
    () => this.prefs.all().commitHeaderCollapsed,
  );

  /** Same synchronous read as the header, for the same reason. */
  protected readonly fileListCollapsed = computed<boolean>(
    () => this.prefs.all().commitFileListCollapsed,
  );

  /** AC-22: whether a single click on a file row opens the diff workspace. */
  protected readonly clickOpensWorkspace = computed<boolean>(
    () => this.prefs.all().commitFileClickOpensWorkspace,
  );

  /** «Show more» pressed: the clamp stays off until another commit is picked. */
  protected readonly bodyExpanded = signal(false);

  /** Whether the clamp is actually hiding part of the body. */
  protected readonly bodyOverflows = signal(false);

  /** How many of `HEADER_ACTIONS` the collapsed summary line has room for. */
  private readonly visibleActionCount = signal(HEADER_ACTIONS.length);

  protected readonly inlineActions = computed<readonly HeaderAction[]>(() =>
    HEADER_ACTIONS.slice(0, this.visibleActionCount()),
  );

  /** What the summary line dropped, lifted to the top of the More menu. */
  private readonly overflowActionIds = computed<readonly string[]>(() =>
    this.headerCollapsed()
      ? HEADER_ACTIONS.slice(this.visibleActionCount()).map((action) => action.id)
      : [],
  );

  protected readonly authorDate = computed(() => this.dateLabels('author'));
  protected readonly committerDate = computed(() => this.dateLabels('committer'));

  /** True when the commit was applied by someone other than its author. */
  protected readonly showCommitter = computed<boolean>(() => {
    const details = this.details();
    if (!details) return false;
    return (
      details.committer_email !== details.author_email ||
      details.committer_date !== details.author_date
    );
  });

  protected readonly signature = computed<SignatureChip>(
    () => SIGNATURE_CHIP[this.details()?.signature ?? 'none'],
  );

  private readonly visibleFiles = computed<readonly CommitFile[]>(() =>
    filterFiles(this.details()?.files ?? [], this.filter()),
  );

  protected readonly fileRows = computed<readonly FileRow[]>(() =>
    buildFileRows(this.visibleFiles(), this.viewMode(), this.collapsed()),
  );

  /**
   * What the workspace walks: the rows the list is drawing right now, which is
   * what leaves out folders, the files a collapsed folder hides and everything
   * the filter dropped, in tree or flat order (AC-11).
   */
  private readonly displayedFiles = computed<string[]>(() =>
    this.fileRows()
      .filter((row) => row.kind === 'file')
      .map((row) => row.path),
  );

  protected readonly fileCountLabel = computed<string>(() => {
    const total = this.details()?.files.length ?? 0;
    const shown = this.visibleFiles().length;
    if (shown === total) return `${total} ${total === 1 ? 'file' : 'files'}`;
    return `${shown} of ${total} files`;
  });

  protected readonly noMatches = computed<boolean>(
    () =>
      this.filter().trim().length > 0 &&
      this.visibleFiles().length === 0 &&
      (this.details()?.files.length ?? 0) > 0,
  );

  /** Sha the panel is currently showing; drives the per-commit state reset. */
  private shownSha: string | null = null;

  /** The layout answer already on the host, so a settled pass writes nothing. */
  private appliedLayout = '';

  constructor() {
    // A new commit starts with a clean filter and no file open; the previous
    // commit's path almost never exists in the next one.
    effect(() => {
      const sha = this.details()?.sha ?? null;
      // Keyed on the sha, not on the object: a background refresh hands back a
      // new `CommitDetails` for the same commit and must not wipe the filter.
      if (sha === this.shownSha) return;
      this.shownSha = sha;
      this.filter.set('');
      this.activeFile.set(null);
      // A path left over from the previous commit would make the service read
      // this commit's file as the one already on screen and skip its diff.
      this.workspace.activeCommitFile.set(null);
      this.collapsed.set(new Set<string>());
      this.bodyExpanded.set(false);
    });

    // The open shortcut belongs to whichever list has an active row; `mod+d`
    // itself is the service's, and this is what tells it what to open.
    effect((onCleanup) => {
      const path = this.activeFile();
      if (path === null) return;
      onCleanup(
        this.workspace.registerOpener((focusKey) => this.openLarge(path, focusKey)),
      );
    });

    // Only this panel knows which files the commit shows and in which order, so
    // it re-publishes whenever the order or the content moves. A refresh that
    // moves the selection off the commit closes the workspace through AC-17;
    // only the residual case — the sha stays selected and its list empties —
    // keeps it open on the viewer's explanation with both edges disabled
    // (AC-07 as amended 2026-09-03, AC-11).
    effect(() => {
      const current = this.workspace.current();
      if (current === null || current.source.kind !== 'commit') return;
      const sha = current.source.sha;
      const details = this.details();
      const files = details?.sha === sha ? this.displayedFiles() : [];
      // Republishing an unchanged list would write the state the effect reads.
      if (sameOrder(files, current.files)) return;
      // The shown file is only hidden, not gone: a filter keystroke or a folder
      // collapse is not a change to the commit, so the workspace keeps its file
      // instead of advancing off it (AC-11).
      if (
        details?.sha === sha &&
        !files.includes(current.file) &&
        details.files.some((file) => file.path === current.file)
      ) {
        return;
      }
      // A commit's files only move when history is rewritten, never through a
      // staging action, and a commit workspace never closes on the origin.
      this.workspace.setFiles(files, 'external');
    });

    // Close hands the restore back to the list that owns the row: the file can
    // sit outside the rendered range, and only its viewport can bring it in.
    effect(() => {
      const key = this.workspace.pendingFocusKey();
      if (key === null) return;
      const index = this.fileRows().findIndex(
        (row) => row.kind === 'file' && row.path === key,
      );
      if (index < 0) {
        // The row is not drawn. Expire the key only when this panel owns it
        // and the commit it has loaded really lost the path: expiring keeps
        // the path, coming back on a later publish, from taking the focus
        // then (AC-08), while a filter or a collapsed folder only hides a row
        // and a panel with no details loaded knows nothing about it. Runs
        // before the viewport check because an emptied list renders none.
        const files = this.details()?.files;
        if (
          focusKeyOwner(key) === 'commit-file' &&
          files !== undefined &&
          !files.some((file) => file.path === key)
        ) {
          this.workspace.focusRestored(key);
        }
        return;
      }
      const viewport = this.fileViewport();
      if (!viewport) return;
      this.workspace.focusRestored(key);
      focusVirtualRow(viewport, index, key, this.injector);
    });

    // Previous / next moves the workspace on its own, and the row it lands on
    // is the one the list has to show as active (AC-11).
    effect(() => {
      const current = this.workspace.current();
      if (current === null || current.source.kind !== 'commit') return;
      if (this.details()?.sha !== current.source.sha) return;
      if (current.file === this.activeFile()) return;
      this.activeFile.set(current.file);
      const index = this.fileRows().findIndex((row) => row.path === current.file);
      if (index >= 0) this.fileViewport()?.scrollToIndex(index);
    });

    // A different commit or a released clamp only shows in the DOM after the
    // paint that carries it.
    afterRenderEffect(() => {
      this.details();
      this.bodyExpanded();
      this.headerCollapsed();
      this.measureBody();
      // A different commit brings a different author name and subject, which
      // move the boundary without resizing anything the observer watches.
      this.measureHeaderActions();
    });

    // A narrower panel or a new clamp value rewraps the body without any
    // signal moving, so the answer has to be re-measured from the box itself.
    effect((onCleanup) => {
      const element = this.bodyText()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(() => this.measureBody());
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });

    // How many icons fit is a width question, and the panel is resizable.
    effect((onCleanup) => {
      const element = this.headerActions()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(() => this.measureHeaderActions());
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });

    // The policy reads boxes, not signals, so the pass has to be re-run
    // whenever something that would change a measurement moves.
    afterRenderEffect(() => {
      this.columnResized();
      this.bodyExpanded();
      // «Show more» belongs to the fixed part of the header and comes and goes.
      this.bodyOverflows();
      // Opening or closing a stacked panel changes what is left to share out.
      this.repo.blameFile();
      this.repo.fileHistoryFile();
      this.applyLayout();
    });

    const destroyRef = inject(DestroyRef);

    // The height budget is the column, not this element: watching a box the
    // two variables resize would feed the policy its own output.
    afterNextRender(() => {
      const column = this.host.nativeElement.closest(INSPECTOR_COLUMN);
      if (!column) return;
      const observer = new ResizeObserver(() =>
        this.columnResized.update((tick) => tick + 1),
      );
      observer.observe(column);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected shortOf(sha: string): string {
    return shortSha(sha);
  }

  protected statusLabel(file: CommitFile): string {
    return FILE_STATUS_LABEL[file.status];
  }

  protected trackRow(_index: number, row: FileRow): string {
    return row.path;
  }

  protected onFilter(value: string): void {
    this.filter.set(value);
  }

  protected setViewMode(mode: FileViewMode): void {
    this.viewMode.set(mode);
  }

  protected toggleFolder(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  // ── header collapse ──────────────────────────────────────────────────────

  protected toggleHeader(): void {
    this.prefs.set('commitHeaderCollapsed', !this.headerCollapsed());
  }

  protected expandBody(): void {
    this.bodyExpanded.set(true);
  }

  /**
   * The clamp is CSS, so only a measurement tells whether it cut anything off.
   * A fractional line height rounds `scrollHeight` up on its own, hence the
   * one-pixel slack.
   */
  private measureBody(): void {
    const element = this.bodyText()?.nativeElement;
    this.bodyOverflows.set(
      element !== undefined && element.scrollHeight - element.clientHeight > 1,
    );
  }

  /**
   * Counts the icons the summary line can afford: the row minus its padding,
   * its gaps, every part that cannot shrink and the reserve the subject keeps.
   *
   * The budget comes from the row rather than from the icons themselves, so it
   * does not depend on how many are drawn right now and the count settles in a
   * single pass instead of chasing its own effect on the layout.
   */
  private measureHeaderActions(): void {
    const actions = this.headerActions()?.nativeElement;
    const subject = this.summarySubject()?.nativeElement;
    const row = actions?.parentElement;
    const more = actions?.lastElementChild;
    if (!actions || !subject || !row || !(more instanceof HTMLElement)) return;

    const rowStyle = getComputedStyle(row);
    let taken =
      Number.parseFloat(rowStyle.paddingLeft) +
      Number.parseFloat(rowStyle.paddingRight) +
      (Number.parseFloat(rowStyle.columnGap) || 0) *
        Math.max(row.children.length - 1, 0) +
      SUBJECT_MIN_WIDTH;
    for (const child of Array.from(row.children)) {
      if (child !== actions && child !== subject) {
        taken += child.getBoundingClientRect().width;
      }
    }

    const moreWidth = more.getBoundingClientRect().width;
    const slot =
      moreWidth + (Number.parseFloat(getComputedStyle(actions).columnGap) || 0);
    if (slot <= 0) return;

    const free = row.clientWidth - taken - moreWidth;
    this.visibleActionCount.set(
      Math.min(HEADER_ACTIONS.length, Math.max(0, Math.floor(free / slot))),
    );
  }

  // ── layout policy ────────────────────────────────────────────────────────

  protected toggleFileList(): void {
    this.prefs.set('commitFileListCollapsed', !this.fileListCollapsed());
  }

  protected toggleClickOpens(): void {
    this.prefs.set('commitFileClickOpensWorkspace', !this.clickOpensWorkspace());
  }

  /**
   * Hands the layout policy what only the DOM knows and applies its answer as
   * the two variables the stylesheet and the header clamp read.
   *
   * Every box is read before the first variable is written, so the pass costs
   * one forced layout; running in the after-render phase means the paint that
   * follows already carries the heights instead of settling into them.
   */
  private applyLayout(): void {
    // Read before the guard below: an early return that skipped these would
    // drop them from the effect's dependencies and freeze the variables.
    //
    // The rows the list draws, not the files the commit touched: a filter or an
    // open folder changes how many there are to fit.
    const fileCount = this.fileRows().length;
    const headerCollapsed = this.headerCollapsed();
    const fileListCollapsed = this.fileListCollapsed();
    const fileRowH = this.rowHeight();
    const panelHeadH = this.appearance.panelHeadHeight();

    const host = this.host.nativeElement;
    const column = host.closest(INSPECTOR_COLUMN);
    if (!column) return;

    const body = this.bodyText()?.nativeElement;
    const header = this.headerBlock()?.nativeElement;
    const lineH = body ? Number.parseFloat(getComputedStyle(body).lineHeight) : 0;
    // `scrollHeight` ignores the clamp, so the count is the body's real length
    // rather than the part currently on screen.
    const bodyLines = body && lineH > 0 ? Math.round(body.scrollHeight / lineH) : 0;
    // What is left after the body is the part the clamp cannot shrink. Read
    // off `scrollHeight`, not the rendered box: the header scrolls inside the
    // cap this pass writes, so its box would feed the policy its own output.
    const headerFixedH = header
      ? header.scrollHeight - (body?.getBoundingClientRect().height ?? 0)
      : 0;
    let stackedPanelsHeight = 0;
    for (const panel of column.querySelectorAll(STACKED_PANELS)) {
      stackedPanelsHeight += panel.getBoundingClientRect().height;
    }

    const layout = computeInspectorLayout({
      availableHeight: column.clientHeight,
      fileCount,
      bodyLines,
      headerCollapsed,
      fileListCollapsed,
      stackedPanelsHeight,
      // Guarded with the same predicate `bodyLines` above uses: a commit with
      // no body renders no `#bodyText`, so `lineH` is 0 (or NaN, when jsdom
      // resolves `line-height: normal`), and the clamp term would divide by
      // it — `(headerAllowance - headerFixedH) / 0` is NaN wherever the two
      // are equal, and that NaN reaches `--inspector-list-rows`, whose
      // `calc()` is then invalid at computed-value time (review round 15,
      // R15-S2-F1). The fallback is only ever read when `bodyLines` is 0,
      // where the clamp resolves to 0 for any positive value, so which
      // positive value it is cannot be observed.
      tokens: { fileRowH, panelHeadH, lineH: lineH > 0 ? lineH : 1, headerFixedH },
    });

    // Never zero: the header collapses a frame before this pass agrees, and a
    // zero clamp would blank the body for that frame.
    const clampLines = Math.max(layout.clampLines, 1);
    // The row height is in the key because the list's box is rows x token: a
    // density change resizes it without moving the row count.
    const applied = `${layout.listRows}/${clampLines}/${fileRowH}/${layout.headerMaxH}`;
    if (applied === this.appliedLayout) return;
    this.appliedLayout = applied;

    host.style.setProperty('--inspector-list-rows', String(layout.listRows));
    host.style.setProperty('--inspector-clamp-lines', String(clampLines));
    host.style.setProperty('--inspector-header-max-h', `${layout.headerMaxH}px`);
    // The CDK caches the viewport height and re-reads it only on a window
    // resize, so a height that came from a variable has to announce itself.
    this.fileViewport()?.checkViewportSize();
  }

  // ── header actions ───────────────────────────────────────────────────────

  protected async copySha(): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.clipboard.writeText(sha);
    this.toast.success('Commit SHA copied.');
  }

  protected async goToParent(sha: string): Promise<void> {
    await this.repo.navigateToSha(sha);
  }

  protected async run(id: string): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.actions.run(id, sha, [sha]);
  }

  protected async openResetMenu(event: MouseEvent): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    const branch = this.repo.currentBranch() ?? 'HEAD';
    const choice = await this.menu.open(
      [
        {
          id: 'reset-soft',
          label: `Soft — move ${branch}, keep index and working tree`,
        },
        { id: 'reset-mixed', label: `Mixed — move ${branch}, keep working tree` },
        {
          id: 'reset-hard',
          label: 'Hard — discard everything…',
          tone: 'danger',
        },
      ],
      event.currentTarget as HTMLElement,
    );
    if (choice) await this.actions.run(choice, sha, [sha]);
  }

  protected async openMoreMenu(event: MouseEvent): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;
    await this.actions.openMenu(
      event.currentTarget as HTMLElement,
      sha,
      [sha],
      this.overflowActionIds(),
    );
  }

  /** One inline icon of the collapsed summary line. */
  protected async runHeaderAction(
    action: HeaderAction,
    event: MouseEvent,
  ): Promise<void> {
    if (action.id === 'reset') {
      await this.openResetMenu(event);
      return;
    }
    await this.run(action.id);
  }

  // ── files ────────────────────────────────────────────────────────────────

  protected async openFile(path: string): Promise<void> {
    const sha = this.details()?.sha;
    if (!sha) return;

    const current = this.workspace.current();
    if (current !== null && current.source.kind === 'commit') {
      // The open workspace walks this commit's files, so another row is a move
      // inside it rather than a second workspace (AC-09); a row the workspace
      // has not been told about yet reopens on the list as it stands now.
      const index = current.files.indexOf(path);
      if (index < 0) this.openLarge(path);
      else this.workspace.navigate(index);
      return;
    }

    // AC-22: with the preference on, the row itself is the open gesture.
    if (this.clickOpensWorkspace()) {
      this.openLarge(path);
      return;
    }

    this.activeFile.set(path);
    // Both clicks of a double-click land here before the open-large gesture
    // runs, and the file already in the viewer must not be fetched again.
    if (this.workspace.activeCommitFile() === path) return;
    // The service cannot read the shown commit file back out of repo state, so
    // whoever puts one in the viewer reports it (AC-06: opening the file
    // already on screen must not fetch its diff a second time).
    this.workspace.activeCommitFile.set(path);
    const diff = await this.repo.commitFileDiff(sha, path);
    // Clicking through files leaves several of these in flight; a slow answer
    // must not overwrite the diff of the file now open.
    if (this.activeFile() !== path || this.details()?.sha !== sha) return;
    this.repo.diffText.set(diff);
  }

  /**
   * Shows `path` at full centre width, in the list's display order (AC-06).
   * `focusKey` names the row Close returns focus to when the gesture came from
   * another list — the commit row behind this panel (AC-08).
   */
  protected openLarge(path: string, focusKey: string | null = null): void {
    const sha = this.details()?.sha;
    if (!sha) return;
    const files = this.displayedFiles();
    const index = files.indexOf(path);
    if (index < 0) return;
    this.workspace.open({
      source: { kind: 'commit', sha },
      files,
      index,
      focusKey: focusKey ?? path,
    });
  }

  protected async onFileMenu(event: MouseEvent, file: CommitFile): Promise<void> {
    event.preventDefault();
    const details = this.details();
    if (!details) return;

    const deleted = file.status === 'deleted';
    const items: MenuItem[] = [
      { id: 'open', label: 'Open diff', icon: 'lucideFileDiff', tone: 'primary' },
      {
        id: 'history',
        label: 'File history',
        icon: 'lucideHistory',
        separatorBefore: true,
      },
      { id: 'blame', label: 'Blame', icon: 'lucideUser' },
      {
        id: 'copy-content',
        label: 'Copy content at this commit',
        icon: 'lucideClipboard',
        separatorBefore: true,
        disabled: file.binary,
        disabledReason: file.binary ? 'The file is binary' : undefined,
      },
      { id: 'copy-path', label: 'Copy path', icon: 'lucideCopy' },
      {
        id: 'editor',
        label: 'Open in editor',
        icon: 'lucidePencil',
        separatorBefore: true,
        disabled: deleted,
        disabledReason: deleted ? 'The commit deleted this file' : undefined,
      },
      {
        id: 'reveal',
        label: 'Reveal in file manager',
        icon: 'lucideFolderOpen',
        disabled: deleted,
        disabledReason: deleted ? 'The commit deleted this file' : undefined,
      },
    ];

    const choice = await this.menu.open(items, {
      x: event.clientX,
      y: event.clientY,
    });
    if (choice === null) return;
    await this.runFileAction(choice, details, file);
  }

  private async runFileAction(
    id: string,
    details: CommitDetails,
    file: CommitFile,
  ): Promise<void> {
    switch (id) {
      case 'open':
        await this.openFile(file.path);
        return;
      case 'history':
        await this.repo.loadFileHistory(file.path);
        return;
      case 'blame':
        // Blaming the working tree from a historic commit answers a question
        // nobody asked: the file may not even exist there any more.
        await this.repo.loadBlame(file.path, details.sha);
        return;
      case 'copy-content': {
        const content = await this.repo.fileAtRevision(details.sha, file.path);
        if (content.length === 0) {
          this.toast.warning('That revision of the file could not be read.');
          return;
        }
        await this.clipboard.writeText(content);
        this.toast.success(`Copied ${file.path} as of ${details.short_sha}.`);
        return;
      }
      case 'copy-path':
        await this.clipboard.writeText(file.path);
        this.toast.success('Path copied.');
        return;
      case 'editor':
        await this.repo.openInEditor(file.path);
        return;
      case 'reveal':
        await this.repo.revealInFileManager(file.path);
        return;
    }
  }

  private dateLabels(who: 'author' | 'committer'): {
    absolute: string;
    relative: string;
  } {
    const details = this.details();
    if (!details) return { absolute: '', relative: '' };
    const raw = who === 'author' ? details.author_date : details.committer_date;
    return { absolute: absoluteTime(raw), relative: relativeTime(raw) };
  }
}
