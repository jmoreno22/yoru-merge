// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { KeyboardShortcutsService } from '../../shared/ui/keyboard-shortcuts.service';
import { CurrentRepoService } from './current-repo.service';
import { DiffWorkspaceService } from './diff-workspace.service';
import { TauriGitService } from './tauri-git.service';

/** SCR-05: the six rows Settings › Keyboard must list, id → label. */
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

  it('registers the six SCR-05 rows at root, with the workspace closed', () => {
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
