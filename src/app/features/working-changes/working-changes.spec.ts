// @vitest-environment jsdom
import { Component, provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import {
  commitDetails,
  gitResponses,
  STAGED_PATHS,
  TEST_REPO,
  textDiff,
  UNSTAGED_PATHS,
  workingChanges,
} from '../../../testing/repo-fixtures';
import { installResizeObserver } from '../../../testing/resize-observer';
import {
  emitRepoChanged,
  installTauriEventBridge,
  restoreTauriEventBridge,
} from '../../../testing/tauri-events';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import type { WorkingChanges } from '../../core/models';
import {
  CurrentRepoService,
  WATCHER_DEBOUNCE_MS,
} from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkspaceStore } from '../../core/services/workspace.store';
import { MainContent } from '../../shared/components/main-content/main-content';
import { KeyboardShortcutsService } from '../../shared/ui/keyboard-shortcuts.service';
import { CommandPalette } from '../command-palette/command-palette';
import { CommandPaletteService } from '../command-palette/command-palette.service';
import { ConfirmDialog } from '../dialogs/confirm-dialog';
import { DialogsService } from '../dialogs/dialogs.service';

/**
 * Component rows of AC-13, AC-15 and AC-16 (T25).
 *
 * The host is `MainContent` with the rail on the Changes view: the panel is
 * hidden by the workbench rather than by itself, the diff on screen is the
 * viewer the workbench moved into the workspace outlet, and the file order the
 * workspace walks is the one this panel publishes — none of which exists
 * around a bare `WorkingChangesPanel` fixture.
 */

const SHOWN = UNSTAGED_PATHS[0];

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

/**
 * A canned answer the spec releases by hand. The stub resolves whatever sits
 * in `responses`, so parking a promise there holds one command in flight while
 * the next one runs — which is the only way to interleave two loads.
 */
function deferred<T>(): Deferred<T> {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: release };
}

interface Workbench {
  readonly host: HTMLElement;
  readonly stub: TauriGitStub;
  readonly repo: CurrentRepoService;
  readonly workspace: DiffWorkspaceService;
  readonly toasts: ToastService;
  settle(): Promise<void>;
}

interface RenderOptions {
  /**
   * Component mounted around the workbench. `MainContent` on its own for the
   * rows that only need the panel; a host that adds the sibling layers for
   * the Esc stack of AC-10.
   */
  readonly root?: Type<unknown>;
  /**
   * Reach the repository through `openRepo` instead of writing `repo`: that
   * is what puts the path on a workspace tab and subscribes the watcher, both
   * of which a `repo-changed` event is routed by (AC-16).
   */
  readonly throughOpenRepo?: boolean;
}

/** The Changes view of the workbench, with the fixture working tree loaded. */
async function renderChangesWorkbench(options: RenderOptions = {}): Promise<Workbench> {
  const stub = createTauriGitStub(
    gitResponses({ stage_hunks: undefined, blame_file: [] }),
  );
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTestIcons(),
      { provide: TauriGitService, useValue: stub.service },
    ],
  });

  TestBed.inject(PreferencesService).setRailView('changes');

  const repo = TestBed.inject(CurrentRepoService);
  if (options.throughOpenRepo) {
    installTauriEventBridge();
    await repo.openRepo(TEST_REPO.path);
  } else {
    repo.repo.set(TEST_REPO);
    repo.changes.set(workingChanges());
  }

  const fixture = TestBed.createComponent(options.root ?? MainContent);
  fixture.detectChanges();

  const settle = async (): Promise<void> => {
    await flushAsync();
    TestBed.tick();
    await flushAsync();
    TestBed.tick();
  };
  await settle();

  return {
    host: fixture.nativeElement,
    stub,
    repo,
    workspace: TestBed.inject(DiffWorkspaceService),
    toasts: TestBed.inject(ToastService),
    settle,
  };
}

/** The open-large gesture on an unstaged row, as the user performs it. */
async function openLarge(bench: Workbench, path: string): Promise<void> {
  bench.stub.responses['get_diff'] = textDiff(path);
  const button = bench.host.querySelector<HTMLElement>(
    `[data-testid="changes-open-large-unstaged-${path}"]`,
  );
  if (!button) throw new Error(`No open-large control for ${path}.`);
  button.click();
  await bench.settle();
}

/**
 * Replays a refresh that publishes `unstaged`. `origin` picks which side of
 * AC-13 / AC-16 it is: `own` mimics a staging action, which holds
 * `stagingBusy` across the refresh it triggers; `external` is everything else.
 */
async function republish(
  bench: Workbench,
  unstaged: readonly string[],
  origin: 'own' | 'external',
): Promise<void> {
  bench.stub.responses['get_working_changes'] = workingChanges(unstaged);
  bench.repo.stagingBusy.set(origin === 'own');
  await bench.repo.refreshAll();
  bench.repo.stagingBusy.set(false);
  await bench.settle();
}

function changesPanelHidden(host: HTMLElement): boolean {
  const panel = host.querySelector('app-working-changes');
  if (!panel) throw new Error('The Changes panel is not mounted.');
  return panel.parentElement?.classList.contains('hidden') ?? false;
}

function workspacePath(host: HTMLElement): string {
  return (
    host
      .querySelector('[data-testid="diff-workspace-path"]')
      ?.textContent?.replace(/\s+/g, '') ?? ''
  );
}

function field(
  host: HTMLElement,
  label: string,
): HTMLInputElement | HTMLTextAreaElement {
  const element = host.querySelector(`[aria-label="${label}"]`);
  if (
    !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`No editable field labelled "${label}".`);
  }
  return element;
}

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function guardOf(id: string): boolean {
  const shortcut = TestBed.inject(KeyboardShortcutsService)
    .shortcuts()
    .find((candidate) => candidate.id === id);
  if (!shortcut) throw new Error(`The shortcut "${id}" is not registered.`);
  return shortcut.when?.() ?? true;
}

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }),
  );
}

function inWorkspace(host: HTMLElement, selector: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(
    `[data-testid="diff-workspace"] ${selector}`,
  );
  if (!element) throw new Error(`No "${selector}" inside the diff workspace.`);
  return element;
}

/** Stages the shown hunk the way a user does: the control on the hunk head. */
function stageHunk(host: HTMLElement): void {
  const control = [...host.querySelectorAll<HTMLElement>('.dv-hunk-head button')].find(
    (button) => button.textContent?.trim() === 'Stage hunk',
  );
  if (!control) throw new Error('The workspace shows no «Stage hunk» control.');
  control.click();
}

/** How many diff lines the viewer holds selected. */
function selectedLines(host: HTMLElement): number {
  return host.querySelectorAll('[data-testid="diff-workspace"] .dv-row.dv-sel').length;
}

/**
 * Waits out the watcher's own debounce, never a round number of our own and
 * never longer than the debounce itself: the watcher scheduled its timer
 * first, so at an equal delay it fires before this one, and the macrotask
 * flush that follows lets the refresh it started reach its `await` (T30 — Q7).
 */
async function afterDebounce(bench: Workbench): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, WATCHER_DEBOUNCE_MS));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await bench.settle();
}

describe('Diff workspace on a working-tree file', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
  });

  afterEach(() => {
    observer.restore();
    restoreTauriEventBridge();
  });

  it('AC-13: opening an unstaged file hides the Changes panel, publishes its side and shows the staging controls', async () => {
    const bench = await renderChangesWorkbench();

    expect(changesPanelHidden(bench.host)).toBe(false);

    await openLarge(bench, SHOWN);

    expect(bench.workspace.isOpen()).toBe(true);
    expect(changesPanelHidden(bench.host)).toBe(true);

    // Only the opened side, in display order: previous / next never cross over.
    expect(bench.workspace.current()?.files).toEqual(UNSTAGED_PATHS);
    for (const staged of STAGED_PATHS) {
      expect(bench.workspace.current()?.files).not.toContain(staged);
    }

    const workspace = bench.host.querySelector<HTMLElement>(
      '[data-testid="diff-workspace"]',
    );
    expect(workspacePath(bench.host)).toBe(SHOWN);
    const hunkControls = [
      ...(workspace?.querySelectorAll('.dv-hunk-head button') ?? []),
    ]
      .map((button) => button.textContent?.trim())
      .filter((label): label is string => label !== undefined && label !== '');
    expect(hunkControls).toContain('Stage hunk');
    // Line-level staging is the listbox on the hunk body; without it the
    // keyboard stage / unstage of a line selection has nothing to select.
    expect(workspace?.querySelector('.dv-hunk-body[role="listbox"]')).not.toBeNull();
    expect(workspace?.querySelector('.dv-row[role="option"]')).not.toBeNull();
  });

  it('AC-13: an own staging action that takes the shown file away advances on the same side', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    await republish(bench, UNSTAGED_PATHS.slice(1), 'own');

    expect(bench.workspace.isOpen()).toBe(true);
    expect(bench.workspace.current()?.file).toBe(UNSTAGED_PATHS[1]);
    expect(workspacePath(bench.host)).toBe(UNSTAGED_PATHS[1]);
    expect(bench.toasts.toasts()).toEqual([]);
  });

  it('AC-13: emptying the side by an own action closes the workspace with its notice', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    await republish(bench, [], 'own');

    expect(bench.workspace.isOpen()).toBe(false);
    expect(bench.host.querySelector('[data-testid="diff-workspace"]')).toBeNull();
    expect(changesPanelHidden(bench.host)).toBe(false);
    expect(bench.toasts.toasts().map((toast) => toast.message)).toEqual([
      'No changes left in Unstaged',
    ]);
  });

  it('AC-16: a refresh reloads the diff on screen', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    const loadsOf = (): number =>
      bench.stub.calls.filter(
        (call) => call.command === 'get_diff' && call.args[1] === SHOWN,
      ).length;
    const before = loadsOf();

    await republish(bench, UNSTAGED_PATHS, 'external');

    expect(bench.workspace.isOpen()).toBe(true);
    expect(loadsOf()).toBe(before + 1);
  });

  it('AC-16: an external change that removed the shown file closes with the outside notice', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    // Two files are left on the side; an external removal closes anyway.
    await republish(bench, UNSTAGED_PATHS.slice(1), 'external');

    expect(bench.workspace.isOpen()).toBe(false);
    expect(changesPanelHidden(bench.host)).toBe(false);
    expect(bench.toasts.toasts().map((toast) => toast.message)).toEqual([
      `${SHOWN} no longer has unstaged changes (changed outside the app)`,
    ]);
  });

  it('AC-16: a refresh answer landing after the shown file moved does not overwrite the diff', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    // The refresh reads the diff of the file on screen; this one answers late.
    const late = deferred<string>();
    bench.stub.responses['get_diff'] = late.promise;
    const refresh = bench.repo.refreshAll();

    // The developer steps to the next file while that read is still in flight.
    const moved = UNSTAGED_PATHS[1];
    bench.stub.responses['get_diff'] = textDiff(moved);
    bench.workspace.next();
    await bench.settle();
    expect(bench.repo.diffText()).toBe(textDiff(moved));

    late.resolve(textDiff(SHOWN));
    await refresh;
    await bench.settle();

    expect(bench.workspace.current()?.file).toBe(moved);
    expect(bench.repo.diffText()).toBe(textDiff(moved));
  });

  it('AC-13: two loads in flight each publish under their own origin', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    // A watcher round starts with no staging action of ours running, so what
    // it publishes came from outside the app.
    const outside = deferred<WorkingChanges>();
    bench.stub.responses['get_working_changes'] = outside.promise;
    const watcher = bench.repo.refreshAll();

    // A staging action starts its own reload before that one has answered.
    const own = deferred<WorkingChanges>();
    bench.stub.responses['get_working_changes'] = own.promise;
    bench.repo.stagingBusy.set(true);
    const staging = bench.repo.refreshChanges();

    // The watcher's answer lands first, without the file on screen.
    outside.resolve(workingChanges(UNSTAGED_PATHS.slice(1)));
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(false);
    expect(bench.toasts.toasts().map((toast) => toast.message)).toEqual([
      `${SHOWN} no longer has unstaged changes (changed outside the app)`,
    ]);

    own.resolve(workingChanges(UNSTAGED_PATHS.slice(1)));
    bench.repo.stagingBusy.set(false);
    await Promise.all([watcher, staging]);
    await bench.settle();

    // The staging answer publishes under its own origin even though the
    // watcher's landed first, and it says nothing a second time: the notice
    // belongs to the external round (AC-13, T29 — R14).
    expect(bench.repo.changesOrigin()).toBe('own');
    expect(bench.toasts.toasts().map((toast) => toast.message)).toEqual([
      `${SHOWN} no longer has unstaged changes (changed outside the app)`,
    ]);
  });

  it('AC-08: a close whose row is gone expires the restore instead of stealing focus later', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    // An external removal closes the workspace, so the row the restore names
    // is no longer in the list that owns it.
    await republish(bench, UNSTAGED_PATHS.slice(1), 'external');
    expect(bench.workspace.isOpen()).toBe(false);
    const pending = bench.workspace.pendingFocusKey();

    // The file comes back — a revert, or the editor writing it again.
    await republish(bench, UNSTAGED_PATHS, 'external');
    const row = bench.host.querySelector(`[data-focus-key="unstaged:${SHOWN}"]`);
    expect(row).not.toBeNull();

    expect({ pending, focusedTheRow: document.activeElement === row }).toEqual({
      pending: null,
      focusedTheRow: false,
    });
  });

  it('AC-12: the two inspector toggles flip nothing while the rail is on Changes', async () => {
    const bench = await renderChangesWorkbench();
    // Switching to Changes unmounts the inspector; it does not clear the
    // commit History had loaded, so the guard cannot read that alone.
    bench.repo.commitDetails.set(commitDetails());
    await bench.settle();
    expect(bench.host.querySelector('app-commit-inspector')).toBeNull();

    const prefs = TestBed.inject(PreferencesService);
    const before = {
      header: prefs.all().commitHeaderCollapsed,
      files: prefs.all().commitFileListCollapsed,
    };

    press('h', { ctrlKey: true, shiftKey: true });
    press('l', { ctrlKey: true, shiftKey: true });
    await bench.settle();

    expect({
      header: prefs.all().commitHeaderCollapsed,
      files: prefs.all().commitFileListCollapsed,
    }).toEqual(before);
  });

  it('AC-15: the commit and commit-draft shortcuts stay inert until the workspace closes', async () => {
    const bench = await renderChangesWorkbench();
    bench.stub.responses['create_commit'] = 'ab12cd34';
    type(field(bench.host, 'Commit subject'), 'teach the workspace to walk');
    await bench.settle();

    expect(guardOf('working-changes.commit')).toBe(true);

    await openLarge(bench, SHOWN);

    expect(guardOf('working-changes.commit')).toBe(false);
    expect(guardOf('working-changes.draft-message')).toBe(false);

    press('Enter', { ctrlKey: true });
    press('Enter', { ctrlKey: true, shiftKey: true });
    await bench.settle();

    expect(bench.stub.calls.map((call) => call.command)).not.toContain('create_commit');

    bench.workspace.close();
    await bench.settle();

    expect(guardOf('working-changes.commit')).toBe(true);

    press('Enter', { ctrlKey: true });
    await bench.settle();

    expect(
      bench.stub.calls.filter((call) => call.command === 'create_commit'),
    ).toHaveLength(1);
  });

  it('AC-13: the Stage control advances the workspace on its own refresh (T27)', async () => {
    const bench = await renderChangesWorkbench();
    await openLarge(bench, SHOWN);

    // What the stage leaves behind: the whole hunk moves to the index, so the
    // side the workspace walks loses the file it is showing.
    bench.stub.responses['get_working_changes'] = workingChanges(
      UNSTAGED_PATHS.slice(1),
    );

    stageHunk(bench.host);
    await bench.settle();
    await bench.settle();

    expect(bench.stub.calls.map((call) => call.command)).toContain('stage_hunks');
    // Read from the load the staging action itself triggered, not written by
    // the spec: `stagingBusy` is up for as long as that refresh runs (D11).
    expect(bench.repo.changesOrigin()).toBe('own');
    expect(bench.workspace.isOpen()).toBe(true);
    expect(bench.workspace.current()?.file).toBe(UNSTAGED_PATHS[1]);
    expect(workspacePath(bench.host)).toBe(UNSTAGED_PATHS[1]);
    expect(bench.toasts.toasts()).toEqual([]);
  });

  it('AC-16: a watcher event reloads the diff, and its own echo is dropped (T27)', async () => {
    const bench = await renderChangesWorkbench({ throughOpenRepo: true });
    await openLarge(bench, SHOWN);

    const state = TestBed.inject(WorkspaceStore).activeRepoState();
    if (!state) throw new Error('The repository is not on a workspace tab.');
    const loadsOf = (): number =>
      bench.stub.calls.filter(
        (call) => call.command === 'get_diff' && call.args[1] === SHOWN,
      ).length;
    const before = loadsOf();

    // The app has just written the working tree itself, so the event the
    // watcher reports for that write is its own echo.
    state.lastRefreshAt = Date.now();
    await emitRepoChanged(TEST_REPO.path, 'worktree');
    await afterDebounce(bench);

    expect(loadsOf()).toBe(before);

    // A change from outside, a second after the last own write: the backend
    // emits one event per kind and the debounce collapses them into one
    // refresh, which reloads the diff on screen exactly once.
    state.lastRefreshAt = 0;
    await emitRepoChanged(TEST_REPO.path, 'worktree');
    await emitRepoChanged(TEST_REPO.path, 'index');
    await afterDebounce(bench);

    expect(loadsOf()).toBe(before + 1);
    expect(bench.workspace.isOpen()).toBe(true);
    expect(workspacePath(bench.host)).toBe(SHOWN);
  });

  it('AC-15: Esc with focus in the composer body closes the workspace and keeps the draft', async () => {
    const bench = await renderChangesWorkbench();
    const body = field(bench.host, 'Commit body');
    type(body, 'Why this change is needed.');
    await bench.settle();

    await openLarge(bench, SHOWN);

    body.focus();
    expect(document.activeElement).toBe(body);

    press('Escape');
    await bench.settle();

    // The body carries no `data-escape-clears`, so Esc falls through to the
    // workspace instead of wiping a draft nobody asked to be clearable.
    expect(bench.workspace.isOpen()).toBe(false);
    expect(field(bench.host, 'Commit body').value).toBe('Why this change is needed.');
  });
});

/**
 * The layers Esc has to walk down, mounted where the shell mounts them: the
 * confirm dialog and the palette are siblings of the workbench, the refs
 * filter and the diff line selection live inside it (ADR-0002).
 */
@Component({
  imports: [MainContent, ConfirmDialog, CommandPalette],
  template: `<app-main-content /><app-confirm-dialog /><app-command-palette />`,
})
class EscapeLayerStack {}

describe('Esc layer stack over an open workspace (AC-10)', () => {
  let observer: ReturnType<typeof installResizeObserver>;

  beforeEach(() => {
    observer = installResizeObserver();
    for (const method of ['scrollTo', 'scrollIntoView']) {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        writable: true,
        value: () => undefined,
      });
    }
  });

  afterEach(() => {
    observer.restore();
    restoreTauriEventBridge();
  });

  it('AC-10: each Esc closes exactly one layer and the workspace goes last (T27)', async () => {
    const bench = await renderChangesWorkbench({ root: EscapeLayerStack });
    await openLarge(bench, SHOWN);

    // rank 3 — a line selection in the viewer the workspace hosts.
    inWorkspace(bench.host, '.dv-row[role="option"]').click();
    await bench.settle();
    expect(selectedLines(bench.host)).toBeGreaterThan(0);

    // rank 2 — blame stacked in the inspector column.
    bench.repo.blameFile.set(SHOWN);
    await bench.settle();
    expect(bench.host.querySelector('app-blame-viewer')).not.toBeNull();

    // rank 4 — the refs filter is the opted-in field; it holds focus through
    // the whole descent, so every press below has to outrank it on merit.
    const refs = field(bench.host, 'Filter refs');
    type(refs, 'main');
    refs.focus();

    const palette = TestBed.inject(CommandPaletteService);
    const dialogs = TestBed.inject(DialogsService);
    palette.open();
    void dialogs.confirm({ title: 'Discard changes', body: 'Cannot be undone.' });
    await bench.settle();

    press('Escape');
    await bench.settle();

    expect(dialogs.confirmRequest()).toBeNull();
    expect(palette.isOpen()).toBe(true);
    expect(refs.value).toBe('main');
    expect(selectedLines(bench.host)).toBeGreaterThan(0);
    expect(bench.workspace.isOpen()).toBe(true);

    press('Escape');
    await bench.settle();

    expect(palette.isOpen()).toBe(false);
    expect(refs.value).toBe('main');
    expect(selectedLines(bench.host)).toBeGreaterThan(0);
    expect(bench.workspace.isOpen()).toBe(true);

    refs.focus();
    press('Escape');
    await bench.settle();

    // The field clears in place: no layer closes and focus stays on it.
    expect(refs.value).toBe('');
    expect(document.activeElement).toBe(refs);
    expect(selectedLines(bench.host)).toBeGreaterThan(0);
    expect(bench.repo.blameFile()).toBe(SHOWN);
    expect(bench.workspace.isOpen()).toBe(true);

    press('Escape');
    await bench.settle();

    expect(selectedLines(bench.host)).toBe(0);
    expect(bench.repo.blameFile()).toBe(SHOWN);
    expect(bench.workspace.isOpen()).toBe(true);

    press('Escape');
    await bench.settle();

    expect(bench.repo.blameFile()).toBeNull();
    expect(bench.workspace.isOpen()).toBe(true);

    press('Escape');
    await bench.settle();

    expect(bench.workspace.isOpen()).toBe(false);
    expect(changesPanelHidden(bench.host)).toBe(false);
  });
});
