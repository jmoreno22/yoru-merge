// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { COMMIT_SHA, commitDetails } from '../../../testing/repo-fixtures';
import { createTauriGitStub, type TauriGitStub } from '../../../testing/tauri-git-stub';
import { KeyboardShortcutsService } from '../../shared/ui/keyboard-shortcuts.service';
import { CurrentRepoService } from './current-repo.service';
import { DiffWorkspaceService } from './diff-workspace.service';
import { TauriGitService } from './tauri-git.service';

/** The six rows Settings › Keyboard must list, id → label. */
const SCR_05_ROWS: Record<string, string> = {
  'diff-workspace.open': 'Open in diff workspace',
  'diff-workspace.close': 'Close diff workspace',
  'diff-workspace.next': 'Next file',
  'diff-workspace.prev': 'Previous file',
  'inspector.toggle-header': 'Collapse or expand commit header',
  'inspector.toggle-files': 'Collapse or expand commit file list',
};

describe('DiffWorkspaceService shortcut registrations (AC-12)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: createTauriGitStub().service },
      ],
    });
  });

  it('registers the six Settings › Keyboard rows at root, with the workspace closed', () => {
    const workspace = TestBed.inject(DiffWorkspaceService);
    const shortcuts = TestBed.inject(KeyboardShortcutsService);

    expect(workspace.isOpen()).toBe(false);

    const registered = new Map(shortcuts.shortcuts().map((s) => [s.id, s.label]));
    const found = Object.fromEntries(
      Object.keys(SCR_05_ROWS).map((id) => [id, registered.get(id) ?? null]),
    );

    expect(found).toEqual(SCR_05_ROWS);
  });

  it('registers each id exactly once', () => {
    TestBed.inject(DiffWorkspaceService);
    const ids = TestBed.inject(KeyboardShortcutsService)
      .shortcuts()
      .map((s) => s.id);

    expect(ids).toEqual([...new Set(ids)]);
  });
});

/** Lets the `void`-ed diff load and every promise hop under it settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('DiffWorkspaceService on an emptied commit list (AC-07)', () => {
  const SHA = 'c0ffee1';
  const FILES = ['src/a.ts', 'src/b.ts'];
  const DIFF = '@@ -1 +1 @@\n-old\n+new\n';

  let repo: CurrentRepoService;
  let workspace: DiffWorkspaceService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: TauriGitService,
          useValue: createTauriGitStub({ get_commit_file_diff: DIFF }).service,
        },
      ],
    });

    repo = TestBed.inject(CurrentRepoService);
    // `commitFileDiff` refuses to reach the backend without a repository on
    // the active tab, and the snapshot the open takes reads the selected sha.
    repo.repo.set({
      path: '/repo',
      name: 'repo',
      current_branch: 'main',
      is_bare: false,
    });
    repo.selectedCommitSha.set(SHA);

    workspace = TestBed.inject(DiffWorkspaceService);
    workspace.open({
      source: { kind: 'commit', sha: SHA },
      files: FILES,
      index: 0,
      focusKey: FILES[0],
    });
    await flushAsync();
    TestBed.tick();
  });

  it('shows the diff of the opened commit file', () => {
    expect(workspace.isOpen()).toBe(true);
    expect(workspace.canNext()).toBe(true);
    expect(repo.diffText()).toBe(DIFF);
  });

  it('clears the diff text when the published list empties', async () => {
    workspace.setFiles([], 'external');
    await flushAsync();
    TestBed.tick();

    expect(workspace.isOpen()).toBe(true);
    expect(workspace.canNext()).toBe(false);
    expect(workspace.canPrev()).toBe(false);
    expect(repo.diffText()).toBe('');
  });
});

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

/** A canned answer released by hand: parked in `responses`, it holds a load. */
function deferred<T>(): Deferred<T> {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: release };
}

describe('DiffWorkspaceService and the diff source it shows a commit file under', () => {
  const FILES = ['src/a.ts', 'src/b.ts'];
  const FILE_DIFF = '@@ -1 +1 @@\n-old\n+new\n';
  const WORKING_DIFF = '@@ -1 +1 @@\n-mine\n+theirs\n';
  const WHOLE_DIFF = `${FILE_DIFF}${FILE_DIFF}`;
  const WORKING_SOURCE = {
    kind: 'workingFile',
    file: 'foo.ts',
    staged: false,
  } as const;

  let stub: TauriGitStub;
  let repo: CurrentRepoService;
  let workspace: DiffWorkspaceService;

  beforeEach(() => {
    stub = createTauriGitStub({
      get_commit_file_diff: FILE_DIFF,
      get_diff: WORKING_DIFF,
      get_commit_details: commitDetails(FILES),
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    repo = TestBed.inject(CurrentRepoService);
    repo.repo.set({
      path: '/repo',
      name: 'repo',
      current_branch: 'main',
      is_bare: false,
    });
    workspace = TestBed.inject(DiffWorkspaceService);
  });

  function openOnB(): void {
    workspace.open({
      source: { kind: 'commit', sha: COMMIT_SHA },
      files: FILES,
      index: 1,
      focusKey: FILES[1],
    });
  }

  /** What a visit to Changes leaves behind: no rail switch resets the source. */
  function leaveWorkingFileOnScreen(): void {
    repo.selectedCommitSha.set(COMMIT_SHA);
    repo.diffSource.set(WORKING_SOURCE);
    repo.diffText.set(WORKING_DIFF);
  }

  it('AC-14: a commit file put on screen makes the commit the diff source', async () => {
    leaveWorkingFileOnScreen();

    openOnB();
    await flushAsync();
    TestBed.tick();

    expect(repo.diffText()).toBe(FILE_DIFF);
    expect(repo.diffSource()).toEqual({ kind: 'commit', sha: COMMIT_SHA });
    expect(workspace.isOpen()).toBe(true);
  });

  it('AC-14: a commit file diff answering after a working file was picked stays off screen', async () => {
    leaveWorkingFileOnScreen();
    const late = deferred<string>();
    stub.responses['get_commit_file_diff'] = late.promise;

    openOnB();
    // The developer is back in Changes and picks a file before git answers.
    await repo.selectWorkingFile('foo.ts', false);
    late.resolve(FILE_DIFF);
    await flushAsync();
    TestBed.tick();

    expect(repo.diffSource()).toEqual(WORKING_SOURCE);
    expect(repo.diffText()).toBe(WORKING_DIFF);
  });

  it('AC-06: the whole-commit diff answering late does not replace the file on screen', async () => {
    const whole = deferred<string>();
    stub.responses['get_commit_diff'] = whole.promise;

    const selecting = repo.selectCommit(COMMIT_SHA);
    // The details answer first, so the file list is there to open a file from.
    await flushAsync();
    openOnB();
    await flushAsync();
    TestBed.tick();
    expect(repo.diffText()).toBe(FILE_DIFF);

    whole.resolve(WHOLE_DIFF);
    await selecting;
    TestBed.tick();

    expect(workspace.current()?.file).toBe('src/b.ts');
    expect(repo.diffText()).toBe(FILE_DIFF);
  });

  it('AC-06: re-selecting the selected commit makes the file it showed load again', async () => {
    stub.responses['get_commit_diff'] = WHOLE_DIFF;
    await repo.selectCommit(COMMIT_SHA);
    openOnB();
    await flushAsync();
    TestBed.tick();
    workspace.close();

    // The developer clicks the row of the commit that is already selected.
    await repo.selectCommit(COMMIT_SHA);
    TestBed.tick();
    expect(repo.diffText()).toBe(WHOLE_DIFF);

    openOnB();
    await flushAsync();
    TestBed.tick();

    expect(workspace.current()?.file).toBe('src/b.ts');
    expect(repo.diffText()).toBe(FILE_DIFF);
  });
});
