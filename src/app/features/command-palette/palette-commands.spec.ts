import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { RepoStateKind } from '../../core/models';
import { CLEAN_REPO_STATE } from '../../core/models';
import { buildPaletteCommands, type PaletteContext } from './palette-commands';

interface Overrides {
  readonly isOpen?: boolean;
  readonly currentBranch?: string | null;
  readonly selectedSha?: string | null;
  readonly state?: RepoStateKind;
  readonly conflicts?: number;
  readonly stashes?: number;
  readonly tabs?: number;
}

function contextWith(overrides: Overrides = {}): PaletteContext {
  const {
    isOpen = true,
    currentBranch = 'main',
    selectedSha = null,
    state = 'clean',
    conflicts = 0,
    stashes = 0,
    tabs = 1,
  } = overrides;

  const repo = {
    isOpen: signal(isOpen),
    currentBranch: signal(currentBranch),
    selectedCommitSha: signal(selectedSha),
    repoState: signal({ ...CLEAN_REPO_STATE, state }),
    sequencerActive: signal(state !== 'clean'),
    conflictCount: signal(conflicts),
    stashes: signal(new Array(stashes).fill({})),
    repo: signal({ path: '/repos/yoru' }),
    globalConfig: signal(null),
    fetchAction: vi.fn(),
    pullAction: vi.fn(),
    pushAction: vi.fn(),
    refreshAll: vi.fn(),
    close: vi.fn(),
  };

  const workspace = {
    workspaces: signal(new Array(tabs).fill({ tabId: 'tab' })),
    activeTabId: signal('tab'),
    setActive: vi.fn(),
  };

  return {
    repo,
    workspace,
    dialogs: {
      openClone: vi.fn(),
      openMerge: vi.fn(),
      openRemotes: vi.fn(),
      openUpdate: vi.fn(),
    },
    settings: { open: vi.fn() },
    theme: { cycle: vi.fn() },
    prefs: {
      refsPanelOpen: signal(true),
      setRefsPanelOpen: vi.fn(),
      diffViewMode: signal('unified'),
      setDiffViewMode: vi.fn(),
      diffIgnoreWhitespace: signal(false),
      setDiffIgnoreWhitespace: vi.fn(),
      uiDensity: signal('comfortable'),
      setUiDensity: vi.fn(),
      setRailView: vi.fn(),
    },
    clipboard: { writeText: vi.fn() },
    rebase: { open: vi.fn() },
    system: {},
    toast: { warning: vi.fn() },
    updater: { checkForUpdates: vi.fn(), state: signal('idle') },
    composerFocus: { request: vi.fn() },
    pickBranch: vi.fn(),
  } as unknown as PaletteContext;
}

/** Commands the palette would actually list right now. */
function visible(context: PaletteContext): string[] {
  return buildPaletteCommands(context)
    .filter((command) => command.when?.() !== false)
    .map((command) => command.id);
}

describe('buildPaletteCommands', () => {
  it('offers at least thirty commands', () => {
    expect(buildPaletteCommands(contextWith()).length).toBeGreaterThanOrEqual(30);
  });

  it('gives every command a unique id, a label and an icon', () => {
    const commands = buildPaletteCommands(contextWith());
    const ids = commands.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const command of commands) {
      expect(command.label.length).toBeGreaterThan(0);
      expect(command.icon.startsWith('lucide')).toBe(true);
    }
  });

  it('hides repository commands until one is open', () => {
    const closed = visible(contextWith({ isOpen: false, currentBranch: null }));
    expect(closed).toContain('repo.open');
    expect(closed).toContain('repo.clone');
    expect(closed).toContain('repo.init');
    expect(closed).not.toContain('remote.fetch');
    expect(closed).not.toContain('branch.merge');
  });

  it('shows sequencer commands only while one is in progress', () => {
    expect(visible(contextWith())).not.toContain('sequencer.continue');
    const rebasing = visible(contextWith({ state: 'rebasing' }));
    expect(rebasing).toContain('sequencer.continue');
    expect(rebasing).toContain('sequencer.abort');
    expect(rebasing).toContain('sequencer.skip');
  });

  it('offers skip for every sequence but a merge', () => {
    for (const state of ['rebasing', 'cherry_picking', 'reverting'] as const) {
      expect(visible(contextWith({ state }))).toContain('sequencer.skip');
    }
    expect(visible(contextWith({ state: 'merging' }))).not.toContain('sequencer.skip');
  });

  it('offers the resolver only while files conflict', () => {
    expect(visible(contextWith())).not.toContain('sequencer.resolve');
    expect(visible(contextWith({ state: 'merging', conflicts: 2 }))).toContain(
      'sequencer.resolve',
    );
  });

  it('needs a selected commit for the commit actions', () => {
    expect(visible(contextWith())).not.toContain('commit.copySha');
    const selected = visible(contextWith({ selectedSha: 'a1b2c3d' }));
    expect(selected).toContain('commit.copySha');
    expect(selected).toContain('commit.interactiveRebase');
  });

  it('offers tab movement only with more than one tab', () => {
    expect(visible(contextWith())).not.toContain('tab.next');
    expect(visible(contextWith({ tabs: 3 }))).toContain('tab.next');
  });

  it('offers pop only when something is stashed', () => {
    expect(visible(contextWith())).not.toContain('stash.pop');
    expect(visible(contextWith({ stashes: 1 }))).toContain('stash.pop');
  });

  it('runs view toggles against the preferences', () => {
    const context = contextWith();
    const commands = buildPaletteCommands(context);
    commands.find((command) => command.id === 'view.diffMode')?.run();
    expect(context.prefs.setDiffViewMode).toHaveBeenCalledWith('split');
    commands.find((command) => command.id === 'view.density')?.run();
    expect(context.prefs.setUiDensity).toHaveBeenCalledWith('compact');
    commands.find((command) => command.id === 'view.theme')?.run();
    expect(context.theme.cycle).toHaveBeenCalled();
  });

  it('switches the central view from the palette', () => {
    const context = contextWith();
    const commands = buildPaletteCommands(context);
    commands.find((command) => command.id === 'view.reflog')?.run();
    expect(context.prefs.setRailView).toHaveBeenCalledWith('reflog');
    commands.find((command) => command.id === 'view.history')?.run();
    expect(context.prefs.setRailView).toHaveBeenCalledWith('history');
  });

  it('opens the Changes view before asking the composer for focus', () => {
    const context = contextWith();
    buildPaletteCommands(context)
      .find((command) => command.id === 'commit.focus')
      ?.run();
    expect(context.prefs.setRailView).toHaveBeenCalledWith('changes');
    expect(context.composerFocus.request).toHaveBeenCalled();
  });

  it('fetches every remote with prune for the fetch-all command', () => {
    const context = contextWith();
    buildPaletteCommands(context)
      .find((command) => command.id === 'remote.fetchAll')
      ?.run();
    expect(context.repo.fetchAction).toHaveBeenCalledWith({
      remote: null,
      prune: true,
    });
  });
});
