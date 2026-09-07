// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { formatCombo, KeyboardShortcutsService, type Shortcut } from '../../shared/ui';
import { DiffViewer } from '../diff-viewer/diff-viewer';
import { SettingsDialog } from './settings-dialog';
import { SettingsDialogService } from './settings-dialog.service';

/** SCR-05: the six rows Settings › Keyboard must list, label → key caps. */
const SCR_05_ROWS: Readonly<Record<string, string>> = {
  'Open in diff workspace': 'Ctrl+D',
  'Close diff workspace': 'Esc',
  'Next file': 'Shift+N',
  'Previous file': 'Shift+P',
  'Collapse or expand commit header': 'Ctrl+Shift+H',
  'Collapse or expand commit file list': 'Ctrl+Shift+L',
};

/** Everything the diff viewer bound hunk navigation to, as it bound it. */
function hunkShortcuts(): readonly Shortcut[] {
  return TestBed.inject(KeyboardShortcutsService)
    .shortcuts()
    .filter((shortcut) => shortcut.id.endsWith('-hunk'));
}

/** The six rows of SCR-05, read from what the workspace service registered. */
function workspaceShortcuts(): readonly Shortcut[] {
  return TestBed.inject(KeyboardShortcutsService)
    .shortcuts()
    .filter(
      (shortcut) =>
        shortcut.id.startsWith('diff-workspace.') ||
        shortcut.id.startsWith('inspector.'),
    );
}

function caps(combo: string): string {
  return formatCombo(combo).join('+');
}

/** Every row of the Keyboard table, as label → key caps joined with `+`. */
function keyboardRows(host: HTMLElement): Record<string, string> {
  const table = host.querySelector('[data-testid="settings-shortcuts"]');
  if (!table) throw new Error('The Keyboard section is not rendered.');
  const rows: Record<string, string> = {};
  for (const row of table.querySelectorAll('tbody tr')) {
    const label = row.children[0]?.textContent?.trim();
    if (label === undefined) continue;
    rows[label] = [...row.querySelectorAll('kbd')]
      .map((cap) => cap.textContent?.trim() ?? '')
      .join('+');
  }
  return rows;
}

describe('Settings › Keyboard (AC-12)', () => {
  let host: HTMLElement;
  let workspace: DiffWorkspaceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTestIcons(),
        { provide: TauriGitService, useValue: createTauriGitStub().service },
      ],
    });

    // Injecting the service is what registers the six rows; nothing renders the
    // workspace here, which is the point of the row.
    workspace = TestBed.inject(DiffWorkspaceService);
    // The hunk keys come from the viewer's own `register` calls, so the
    // collision row compares the table against what it really binds. With no
    // diff selected the viewer paints its empty state and nothing else.
    TestBed.createComponent(DiffViewer).detectChanges();

    TestBed.inject(SettingsDialogService).open('keyboard');
    const fixture = TestBed.createComponent(SettingsDialog);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  it('AC-12: lists the six workspace shortcuts with the workspace closed', () => {
    expect(workspace.isOpen()).toBe(false);

    const rows = keyboardRows(host);
    const listed = Object.fromEntries(
      Object.keys(SCR_05_ROWS).map((label) => [label, rows[label] ?? null]),
    );

    expect(listed).toEqual(SCR_05_ROWS);
  });

  it('AC-12: no workspace shortcut shares a combo with the hunk keys', () => {
    const hunks = hunkShortcuts();
    const workspaceCombos = workspaceShortcuts().map((shortcut) => shortcut.combo);

    expect(hunks.map((hunk) => hunk.id)).toEqual([
      'diff.next-hunk',
      'diff.previous-hunk',
    ]);
    expect(workspaceCombos).toHaveLength(Object.keys(SCR_05_ROWS).length);
    for (const combo of workspaceCombos) {
      expect(hunks.map((hunk) => hunk.combo)).not.toContain(combo);
    }

    // The hunk rows are in the same table, next to the workspace ones, with
    // the caps of the combos the viewer registered.
    const rows = keyboardRows(host);
    for (const hunk of hunks) {
      expect(rows[hunk.label]).toBe(caps(hunk.combo));
    }
  });
});
