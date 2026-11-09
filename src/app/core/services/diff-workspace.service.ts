import { computed, DOCUMENT, effect, Injectable, inject, signal } from '@angular/core';
// By module path, not the barrel: the barrel re-exports `yoru-dialog`, which
// imports back into `core`, and that closes an import cycle.
import { KeyboardShortcutsService } from '../../shared/ui/keyboard-shortcuts.service';
import { CurrentRepoService } from './current-repo.service';
import {
  close as applyClose,
  navigate as applyNavigate,
  open as applyOpen,
  setFiles as applySetFiles,
  canNext as canNextOf,
  canPrev as canPrevOf,
  type DiffWorkspaceSource,
  type DiffWorkspaceState,
  type SetFilesOrigin,
  shouldCloseFor,
} from './diff-workspace-state';
import { PreferencesService } from './preferences.service';
import { ToastService } from './toast.service';
import { WorkspaceStore } from './workspace.store';

const CLOSED: DiffWorkspaceState = { open: false };

export interface OpenDiffWorkspaceRequest {
  readonly source: DiffWorkspaceSource;
  /** Paths in the order the owning list shows them, folders skipped (AC-11). */
  readonly files: string[];
  readonly index: number;
  /** `data-focus-key` of the row the gesture came from (AC-08). */
  readonly focusKey: string;
}

/**
 * Opens the active row of the list holding the gesture. `focusKey` is the row
 * the gesture came from when that is not the row being opened — pressing the
 * shortcut on a commit row opens the inspector's active file, and Close must
 * bring focus back to the commit row (AC-08).
 */
export type DiffWorkspaceOpener = (focusKey: string | null) => void;

/**
 * The diff workspace as the app sees it: signals over the state machine in
 * `diff-workspace-state.ts` plus the four things only Angular can do — drive
 * the diff viewer, replay the restore snapshot, close the workspace when the
 * selection it was opened from moves away (AC-17), and own the shortcuts the
 * help has to list whether or not the workspace is on screen (AC-12).
 */
@Injectable({ providedIn: 'root' })
export class DiffWorkspaceService {
  private readonly repo = inject(CurrentRepoService);
  private readonly workspace = inject(WorkspaceStore);
  private readonly prefs = inject(PreferencesService);
  private readonly toast = inject(ToastService);
  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly document = inject(DOCUMENT);

  private readonly state = signal<DiffWorkspaceState>(CLOSED);

  readonly isOpen = computed<boolean>(() => this.state().open);

  /** What the centre shows, or `null` while the workspace is closed. */
  readonly current = computed(() => {
    const state = this.state();
    if (!state.open) return null;
    return {
      source: state.source,
      file: state.file,
      files: state.files,
      index: state.index,
    };
  });

  readonly canPrev = computed<boolean>(() => canPrevOf(this.state()));
  readonly canNext = computed<boolean>(() => canNextOf(this.state()));

  /**
   * The commit file the diff viewer shows. A commit `diffSource` carries only
   * the sha, so the file the commit inspector put in the viewer cannot be read
   * back from repo state; whoever opens one reports it here, which is what
   * lets an open on the file already on screen skip a second load.
   */
  readonly activeCommitFile = signal<string | null>(null);

  /** The working-tree side on screen; `null` while a commit diff is shown. */
  private readonly shownSide = computed<'staged' | 'unstaged' | null>(() => {
    const source = this.repo.diffSource();
    if (source.kind !== 'workingFile') return null;
    return source.staged ? 'staged' : 'unstaged';
  });

  /** The list that currently owns the open gesture, if any. */
  private opener: DiffWorkspaceOpener | null = null;

  private readonly pendingFocus = signal<string | null>(null);

  /**
   * `data-focus-key` of the row the owning list has to scroll into view and
   * focus now that the workspace is gone; `null` once a list has taken it. The
   * lists own this because both restore targets live in a virtual viewport,
   * where a row outside the rendered range has no element to focus (AC-08).
   */
  readonly pendingFocusKey = this.pendingFocus.asReadonly();

  constructor() {
    effect(() => {
      const current = {
        railView: this.prefs.railView(),
        tabId: this.workspace.activeTabId() ?? '',
        selectedCommitSha: this.repo.selectedCommitSha(),
        side: this.shownSide(),
      };
      // The new selection wins: no snapshot is replayed here (AC-17).
      if (shouldCloseFor(this.state(), current)) this.state.set(CLOSED);
    });

    this.shortcuts.register({
      id: 'diff-workspace.open',
      combo: 'mod+d',
      label: 'Open in diff workspace',
      when: () => this.opener !== null && !this.isOpen(),
      run: () => this.opener?.(this.focusedRowKey()),
    });
    this.shortcuts.register({
      id: 'diff-workspace.close',
      combo: 'escape',
      label: 'Close diff workspace',
      // Registered so the shortcuts help lists Close (AC-12), never to run:
      // Escape belongs to the rank-1 layer and to no other listener (ADR-0002),
      // and a guard that is always false keeps it that way while the settings
      // table, which does not read `when`, still shows the row.
      when: () => false,
      run: () => this.close(),
    });
    this.shortcuts.register({
      id: 'diff-workspace.next',
      combo: 'shift+n',
      label: 'Next file',
      when: () => this.canNext(),
      run: () => this.next(),
    });
    this.shortcuts.register({
      id: 'diff-workspace.prev',
      combo: 'shift+p',
      label: 'Previous file',
      when: () => this.canPrev(),
      run: () => this.prev(),
    });
    this.shortcuts.register({
      id: 'inspector.toggle-header',
      combo: 'mod+shift+h',
      label: 'Collapse or expand commit header',
      // The Changes view unmounts the inspector but leaves the commit History
      // loaded, so the details alone do not say the panel is on screen.
      when: () => this.isInspectorMounted(),
      run: () =>
        this.prefs.set(
          'commitHeaderCollapsed',
          !this.prefs.all().commitHeaderCollapsed,
        ),
    });
    this.shortcuts.register({
      id: 'inspector.toggle-files',
      combo: 'mod+shift+l',
      label: 'Collapse or expand commit file list',
      when: () => this.isInspectorMounted(),
      run: () =>
        this.prefs.set(
          'commitFileListCollapsed',
          !this.prefs.all().commitFileListCollapsed,
        ),
    });
  }

  /**
   * Shows `files[index]` of `source` at full centre width and takes the
   * snapshot Close replays. Always replaces: there is only ever one (AC-09).
   */
  open(request: OpenDiffWorkspaceRequest): void {
    // A restore no list ever claimed must not steal the focus later on.
    this.pendingFocus.set(null);
    // Driving the viewer before the snapshot keeps the snapshot and the
    // close-on-change effect reading the same `diffSource`: opening a side the
    // viewer was not showing must not look like a selection change.
    this.showFile(request.source, request.files[request.index]);
    this.state.set(
      applyOpen(this.state(), {
        source: request.source,
        files: request.files,
        index: request.index,
        snapshot: {
          railView: this.prefs.railView(),
          tabId: this.workspace.activeTabId() ?? '',
          selectedCommitSha: this.repo.selectedCommitSha(),
          side: this.shownSide(),
          listScrollTop: this.repo.listScrollTop(),
          focusKey: request.focusKey,
        },
      }),
    );
  }

  /** Shows the file at `index`; an index outside the list is a no-op. */
  navigate(index: number): void {
    const next = applyNavigate(this.state(), index);
    this.state.set(next);
    if (next.open) this.showFile(next.source, next.file);
  }

  next(): void {
    const state = this.state();
    if (state.open) this.navigate(state.index + 1);
  }

  prev(): void {
    const state = this.state();
    if (state.open) this.navigate(state.index - 1);
  }

  /**
   * Re-publishes the owning list's files. The shown file surviving keeps the
   * workspace where it is; otherwise it advances to whatever took its place,
   * or closes with `closeNotice` when `origin` or the empty list says the
   * developer has nothing left to walk (AC-13, AC-16).
   */
  setFiles(files: string[], origin: SetFilesOrigin, closeNotice?: string): void {
    const result = applySetFiles(this.state(), files, origin);
    if (result.effect === 'close') {
      // The state is deliberately not replaced first: `close()` still sees the
      // open one, so there is still a snapshot to replay.
      this.close();
      if (closeNotice) this.toast.info(closeNotice);
      return;
    }
    this.state.set(result.state);
    if (result.effect === 'advance' && result.state.open) {
      this.showFile(result.state.source, result.state.file);
      return;
    }
    // A commit workspace outlives an emptied list (AC-07). Nothing else writes
    // `diffText`, so without this the centre keeps the diff of a file the
    // commit no longer publishes instead of the viewer's own explanation.
    if (
      result.state.open &&
      result.state.source.kind === 'commit' &&
      result.state.files.length === 0
    ) {
      this.repo.diffText.set('');
      // The viewer shows no file any more, so the guard that skips a reload
      // must stop naming the one the emptied list dropped (AC-07).
      this.activeCommitFile.set(null);
    }
  }

  /** Close or Esc: brings back the centre view the workspace replaced. */
  close(): void {
    const { state, restore } = applyClose(this.state());
    this.state.set(state);
    if (!restore) return;
    this.repo.listScrollTop.set(restore.listScrollTop);
    this.pendingFocus.set(restore.focusKey);
  }

  /** The list owning the row reports it has taken the restore over. */
  focusRestored(focusKey: string): void {
    if (this.pendingFocus() === focusKey) this.pendingFocus.set(null);
  }

  /**
   * Hands the `mod+d` shortcut to the list with an active row; the returned
   * function gives it back.
   */
  registerOpener(fn: DiffWorkspaceOpener): () => void {
    this.opener = fn;
    return () => {
      if (this.opener === fn) this.opener = null;
    };
  }

  /** Whether the commit inspector, which owns both toggles, is rendered. */
  private isInspectorMounted(): boolean {
    return this.prefs.railView() !== 'changes' && this.repo.commitDetails() !== null;
  }

  /** `data-focus-key` of the row the keyboard is on, if it is on one. */
  private focusedRowKey(): string | null {
    const active = this.document.activeElement as HTMLElement | null;
    if (!active) return null;
    // A list that names its row through `aria-activedescendant` keeps the
    // tabindex on the viewport, so the focused element is not the row.
    const named = active.getAttribute('aria-activedescendant');
    const row = named
      ? this.document.getElementById(named)
      : active.closest<HTMLElement>('[data-focus-key]');
    return row?.dataset['focusKey'] ?? null;
  }

  private isShowing(source: DiffWorkspaceSource, file: string): boolean {
    const shown = this.repo.diffSource();
    if (source.kind === 'working-tree') {
      return (
        shown.kind === 'workingFile' &&
        shown.file === file &&
        shown.staged === (source.side === 'staged')
      );
    }
    return (
      shown.kind === 'commit' &&
      shown.sha === source.sha &&
      this.activeCommitFile() === file
    );
  }

  /**
   * Drives the diff viewer down the same path the owning list uses, so its
   * active row follows and staging stays gated by `diffSource` (AC-14).
   * Skipping the file already on screen is what keeps a diff opened from the
   * viewer from being loaded a second time.
   */
  private showFile(source: DiffWorkspaceSource, file: string): void {
    if (this.isShowing(source, file)) return;
    if (source.kind === 'working-tree') {
      void this.repo.selectWorkingFile(file, source.side === 'staged');
      return;
    }
    this.activeCommitFile.set(file);
    void this.showCommitFile(source.sha, file);
  }

  private async showCommitFile(sha: string, file: string): Promise<void> {
    const diff = await this.repo.commitFileDiff(sha, file);
    // Stepping through files leaves several of these in flight; a slow answer
    // must not overwrite the diff of the file now shown.
    if (this.activeCommitFile() !== file) return;
    this.repo.diffText.set(diff);
  }
}
