import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import type { BranchInfo } from '../../core/models';
import type { CurrentRepoService } from '../../core/services/current-repo.service';
import type { SystemOps } from '../../core/services/ops';
import type { PreferencesService } from '../../core/services/preferences.service';
import type { ThemeService } from '../../core/services/theme.service';
import type { ToastService } from '../../core/services/toast.service';
import type { UpdaterService } from '../../core/services/updater.service';
import type { WorkspaceStore } from '../../core/services/workspace.store';
import { validateRefName } from '../../core/utils';
import { canSkipSequencer } from '../../shared/components/repo-state-banner/repo-state.model';
import type { YoruIconName } from '../../shared/icons';
import type { ClipboardService } from '../../shared/ui';
import type { InteractiveRebaseService } from '../commit-inspector/interactive-rebase.service';
import type { DialogsService } from '../dialogs/dialogs.service';
import type { SettingsDialogService } from '../settings/settings-dialog.service';
import type { CommitComposerFocus } from '../working-changes/commit-composer-focus.service';

export type PaletteGroup =
  | 'Repository'
  | 'Remote'
  | 'Branch'
  | 'Commit'
  | 'Stash'
  | 'Sequencer'
  | 'View';

export interface PaletteCommand {
  readonly id: string;
  readonly label: string;
  readonly group: PaletteGroup;
  readonly icon: YoruIconName;
  /**
   * Id of the shortcut whose combo the palette shows. Read from
   * `KeyboardShortcutsService` at render time so a binding and its hint cannot
   * drift; commands without a registered shortcut simply show none.
   */
  readonly shortcutId?: string;
  /** The command is hidden when this returns false. */
  readonly when?: () => boolean;
  readonly run: () => void;
}

/** Everything the commands need. Kept explicit so the list stays testable. */
export interface PaletteContext {
  readonly repo: CurrentRepoService;
  readonly dialogs: DialogsService;
  readonly settings: SettingsDialogService;
  readonly theme: ThemeService;
  readonly prefs: PreferencesService;
  readonly workspace: WorkspaceStore;
  readonly clipboard: ClipboardService;
  readonly rebase: InteractiveRebaseService;
  readonly system: SystemOps;
  readonly toast: ToastService;
  readonly updater: UpdaterService;
  readonly composerFocus: CommitComposerFocus;
  /** Switches the palette to the branch list; `run` gets the picked branch. */
  readonly pickBranch: (label: string, run: (branch: BranchInfo) => void) => void;
}

/**
 * Every command the palette can run.
 *
 * Built per open so `when` predicates read live signals. Commands never take
 * arguments: each one closes over the context it needs.
 */
export function buildPaletteCommands(ctx: PaletteContext): PaletteCommand[] {
  const { repo, dialogs, settings, theme, prefs, workspace, clipboard } = ctx;
  const isOpen = (): boolean => repo.isOpen();
  const hasSelection = (): boolean => repo.selectedCommitSha() !== null;

  return [
    // ── Repository ───────────────────────────────────────────────────────
    {
      id: 'repo.open',
      label: 'Open repository…',
      group: 'Repository',
      icon: 'lucideFolderOpen',
      shortcutId: 'repo.open',
      run: () => void openFolder(ctx),
    },
    {
      id: 'repo.clone',
      label: 'Clone repository…',
      group: 'Repository',
      icon: 'lucideCloudDownload',
      run: () => dialogs.openClone(),
    },
    {
      id: 'repo.init',
      label: 'Initialize repository…',
      group: 'Repository',
      icon: 'lucideGitBranchPlus',
      run: () => void initRepo(ctx),
    },
    {
      id: 'repo.refresh',
      label: 'Refresh repository',
      group: 'Repository',
      icon: 'lucideRefreshCw',
      shortcutId: 'repo.refresh',
      when: isOpen,
      run: () => void repo.refreshAll(),
    },
    {
      id: 'repo.reveal',
      label: 'Reveal in file manager',
      group: 'Repository',
      icon: 'lucideFolder',
      when: isOpen,
      run: () => void repo.revealInFileManager(),
    },
    {
      id: 'repo.terminal',
      label: 'Open terminal here',
      group: 'Repository',
      icon: 'lucideTerminal',
      when: isOpen,
      run: () => void repo.openInTerminal(),
    },
    {
      id: 'repo.editor',
      label: 'Open in editor',
      group: 'Repository',
      icon: 'lucidePencil',
      when: isOpen,
      run: () => void repo.openInEditor(),
    },
    {
      id: 'repo.copyPath',
      label: 'Copy repository path',
      group: 'Repository',
      icon: 'lucideCopy',
      when: isOpen,
      run: () => {
        const path = repo.repo()?.path;
        if (path) void clipboard.writeText(path);
      },
    },
    {
      id: 'tab.close',
      label: 'Close repository tab',
      group: 'Repository',
      icon: 'lucideX',
      shortcutId: 'tab.close',
      when: isOpen,
      run: () => void repo.close(),
    },
    {
      id: 'tab.next',
      label: 'Next tab',
      group: 'Repository',
      icon: 'lucideChevronRight',
      shortcutId: 'tab.next',
      when: () => workspace.workspaces().length > 1,
      run: () => moveTab(ctx, 1),
    },
    {
      id: 'tab.previous',
      label: 'Previous tab',
      group: 'Repository',
      icon: 'lucideChevronLeft',
      shortcutId: 'tab.previous',
      when: () => workspace.workspaces().length > 1,
      run: () => moveTab(ctx, -1),
    },

    // ── Remote ───────────────────────────────────────────────────────────
    {
      id: 'remote.fetch',
      label: 'Fetch',
      group: 'Remote',
      icon: 'lucideCloudDownload',
      shortcutId: 'remote.fetch',
      when: isOpen,
      run: () => void repo.fetchAction(),
    },
    {
      id: 'remote.fetchAll',
      label: 'Fetch all remotes and prune',
      group: 'Remote',
      icon: 'lucideRefreshCw',
      when: isOpen,
      run: () => void repo.fetchAction({ remote: null, prune: true }),
    },
    {
      id: 'remote.pull',
      label: 'Pull',
      group: 'Remote',
      icon: 'lucideDownload',
      shortcutId: 'remote.pull',
      when: isOpen,
      run: () => void repo.pullAction(),
    },
    {
      id: 'remote.pullRebase',
      label: 'Pull with rebase',
      group: 'Remote',
      icon: 'lucideGitPullRequestArrow',
      when: isOpen,
      run: () => void repo.pullAction({ mode: 'rebase' }),
    },
    {
      id: 'remote.push',
      label: 'Push',
      group: 'Remote',
      icon: 'lucideCloudUpload',
      shortcutId: 'remote.push',
      when: isOpen,
      run: () => void repo.pushAction({}),
    },
    {
      id: 'remote.pushUpstream',
      label: 'Push and set upstream',
      group: 'Remote',
      icon: 'lucideLink',
      when: isOpen,
      run: () => void repo.pushAction({ setUpstream: true }),
    },
    {
      id: 'remote.pushTags',
      label: 'Push tags',
      group: 'Remote',
      icon: 'lucideTags',
      when: isOpen,
      run: () => void repo.pushAction({ tags: true }),
    },
    {
      id: 'remote.manage',
      label: 'Manage remotes…',
      group: 'Remote',
      icon: 'lucideGlobe',
      when: isOpen,
      run: () => dialogs.openRemotes(),
    },

    // ── Branch ───────────────────────────────────────────────────────────
    {
      id: 'branch.create',
      label: 'Create branch…',
      group: 'Branch',
      icon: 'lucideGitBranchPlus',
      when: isOpen,
      run: () => void createBranch(ctx),
    },
    {
      id: 'branch.checkout',
      label: 'Checkout branch…',
      group: 'Branch',
      icon: 'lucideGitBranch',
      when: isOpen,
      run: () => ctx.pickBranch('Checkout', (branch) => void checkout(ctx, branch)),
    },
    {
      id: 'branch.merge',
      label: 'Merge branch…',
      group: 'Branch',
      icon: 'lucideGitMerge',
      when: isOpen,
      run: () => dialogs.openMerge(),
    },
    {
      id: 'branch.rebase',
      label: 'Rebase current branch onto…',
      group: 'Branch',
      icon: 'lucideGitPullRequestArrow',
      when: () => repo.currentBranch() !== null,
      run: () =>
        ctx.pickBranch('Rebase onto', (branch) => {
          const current = repo.currentBranch();
          if (current) void repo.rebaseBranchAction(current, branch.name);
        }),
    },

    // ── Stash ────────────────────────────────────────────────────────────
    {
      id: 'stash.save',
      label: 'Stash changes',
      group: 'Stash',
      icon: 'lucideArchive',
      when: isOpen,
      run: () => void repo.stashSaveAction('', { includeUntracked: true }),
    },
    {
      id: 'stash.saveMessage',
      label: 'Stash with message…',
      group: 'Stash',
      icon: 'lucideArchive',
      when: isOpen,
      run: () => void stashWithMessage(ctx),
    },
    {
      id: 'stash.pop',
      label: 'Pop latest stash',
      group: 'Stash',
      icon: 'lucideUndo2',
      when: () => repo.stashes().length > 0,
      run: () => void repo.stashApplyAction(0, true),
    },

    // ── Commit ───────────────────────────────────────────────────────────
    {
      id: 'commit.focus',
      label: 'Commit staged changes',
      group: 'Commit',
      icon: 'lucideGitCommitHorizontal',
      shortcutId: 'working-changes.commit',
      when: isOpen,
      run: () => {
        // The composer only exists in the Changes view; the focus latch is
        // consumed once it is on screen.
        prefs.setRailView('changes');
        ctx.composerFocus.request();
      },
    },
    {
      id: 'commit.amend',
      label: 'Amend last commit…',
      group: 'Commit',
      icon: 'lucidePencil',
      when: isOpen,
      run: () => void amend(ctx),
    },
    {
      id: 'commit.goto',
      label: 'Go to commit…',
      group: 'Commit',
      icon: 'lucideSearch',
      when: isOpen,
      run: () => void goToCommit(ctx),
    },
    {
      id: 'commit.copySha',
      label: 'Copy selected commit SHA',
      group: 'Commit',
      icon: 'lucideCopy',
      when: hasSelection,
      run: () => {
        const sha = repo.selectedCommitSha();
        if (sha) void clipboard.writeText(sha);
      },
    },
    {
      id: 'commit.interactiveRebase',
      label: 'Interactive rebase from selected commit…',
      group: 'Commit',
      icon: 'lucideLayers',
      when: hasSelection,
      run: () => {
        const sha = repo.selectedCommitSha();
        if (sha) ctx.rebase.open(sha);
      },
    },

    // ── Sequencer ────────────────────────────────────────────────────────
    {
      id: 'sequencer.continue',
      label: 'Continue merge, rebase, cherry-pick or revert',
      group: 'Sequencer',
      icon: 'lucidePlay',
      when: () => repo.sequencerActive(),
      run: () => void repo.continueSequencerAction(),
    },
    {
      id: 'sequencer.skip',
      label: 'Skip this commit',
      group: 'Sequencer',
      icon: 'lucideSkipForward',
      when: () => canSkipSequencer(repo.repoState().state),
      run: () => void repo.skipSequencerAction(),
    },
    {
      id: 'sequencer.abort',
      label: 'Abort the operation in progress',
      group: 'Sequencer',
      icon: 'lucideBan',
      when: () => repo.sequencerActive(),
      run: () => void repo.abortSequencerAction(),
    },
    {
      id: 'sequencer.resolve',
      label: 'Resolve conflicts…',
      group: 'Sequencer',
      icon: 'lucideTriangleAlert',
      when: () => repo.conflictCount() > 0,
      run: () => dialogs.openMergeResolver(),
    },

    // ── View ─────────────────────────────────────────────────────────────
    {
      id: 'view.changes',
      label: 'Show working changes',
      group: 'View',
      icon: 'lucideFileDiff',
      shortcutId: 'view.changes',
      when: isOpen,
      run: () => prefs.setRailView('changes'),
    },
    {
      id: 'view.history',
      label: 'Show history',
      group: 'View',
      icon: 'lucideGitCommitHorizontal',
      shortcutId: 'view.history',
      when: isOpen,
      run: () => prefs.setRailView('history'),
    },
    {
      id: 'view.reflog',
      label: 'Show reflog',
      group: 'View',
      icon: 'lucideHistory',
      shortcutId: 'view.reflog',
      when: isOpen,
      run: () => prefs.setRailView('reflog'),
    },
    {
      id: 'view.theme',
      label: 'Toggle theme',
      group: 'View',
      icon: 'lucideMoon',
      shortcutId: 'view.theme',
      run: () => theme.cycle(),
    },
    {
      id: 'view.refsPanel',
      label: 'Toggle refs panel',
      group: 'View',
      icon: 'lucidePanelLeft',
      shortcutId: 'view.refsPanel',
      run: () => prefs.setRefsPanelOpen(!prefs.refsPanelOpen()),
    },
    {
      id: 'view.diffMode',
      label: 'Toggle diff layout',
      group: 'View',
      icon: 'lucideColumns2',
      run: () =>
        prefs.setDiffViewMode(prefs.diffViewMode() === 'split' ? 'unified' : 'split'),
    },
    {
      id: 'view.whitespace',
      label: 'Toggle ignore whitespace in diffs',
      group: 'View',
      icon: 'lucideSpace',
      run: () => prefs.setDiffIgnoreWhitespace(!prefs.diffIgnoreWhitespace()),
    },
    {
      id: 'view.density',
      label: 'Toggle interface density',
      group: 'View',
      icon: 'lucideRows3',
      run: () =>
        prefs.setUiDensity(prefs.uiDensity() === 'compact' ? 'comfortable' : 'compact'),
    },
    {
      id: 'app.settings',
      label: 'Settings…',
      group: 'View',
      icon: 'lucideSettings2',
      shortcutId: 'app.settings',
      run: () => settings.open(),
    },
    {
      id: 'app.checkUpdates',
      label: 'Check for updates',
      group: 'View',
      icon: 'lucideDownload',
      run: () => void checkUpdates(ctx),
    },
    {
      id: 'app.about',
      label: 'About YoruMerge',
      group: 'View',
      icon: 'lucideInfo',
      run: () => dialogs.openAbout(),
    },
  ];
}

async function openFolder(ctx: PaletteContext): Promise<void> {
  const chosen = await openFolderDialog({ directory: true, multiple: false });
  if (typeof chosen === 'string' && chosen.length > 0) {
    await ctx.repo.openRepo(chosen);
  }
}

async function initRepo(ctx: PaletteContext): Promise<void> {
  const chosen = await openFolderDialog({ directory: true, multiple: false });
  if (typeof chosen !== 'string' || chosen.length === 0) return;
  const branch = await ctx.dialogs.prompt({
    title: 'Initialize repository',
    label: 'Initial branch name',
    initialValue: ctx.repo.globalConfig()?.default_branch ?? 'main',
    hint: chosen,
    confirmLabel: 'Initialize',
    validate: (value) => validateRefName(value),
  });
  if (branch === null) return;
  await ctx.repo.initRepoAction(chosen, branch);
}

async function createBranch(ctx: PaletteContext): Promise<void> {
  const taken = (ctx.repo.branches()?.local ?? []).map((branch) => branch.name);
  const name = await ctx.dialogs.prompt({
    title: 'Create branch',
    label: 'Branch name',
    placeholder: 'feat/graph',
    confirmLabel: 'Create',
    validate: (value) => validateRefName(value, taken),
  });
  if (name === null) return;
  await ctx.repo.createBranchAction(name, { checkout: true });
}

async function checkout(ctx: PaletteContext, branch: BranchInfo): Promise<void> {
  const result = await ctx.repo.checkoutBranchAction(branch.name, branch.is_remote);
  if (result?.kind === 'would_overwrite') {
    ctx.toast.warning(
      `Checkout would overwrite ${result.files.length} local change${result.files.length === 1 ? '' : 's'}. Stash or discard them first.`,
    );
  }
}

async function stashWithMessage(ctx: PaletteContext): Promise<void> {
  const message = await ctx.dialogs.prompt({
    title: 'Stash changes',
    label: 'Message',
    placeholder: 'wip: graph lanes',
    confirmLabel: 'Stash',
  });
  if (message === null) return;
  await ctx.repo.stashSaveAction(message, { includeUntracked: true });
}

async function amend(ctx: PaletteContext): Promise<void> {
  const current = await ctx.repo.getHeadMessage();
  const message = await ctx.dialogs.prompt({
    title: 'Amend last commit',
    label: 'Commit message',
    initialValue: current,
    hint: 'Rewrites the commit at HEAD.',
    confirmLabel: 'Amend',
  });
  if (message === null) return;
  await ctx.repo.createCommit(message, true);
}

async function goToCommit(ctx: PaletteContext): Promise<void> {
  const rev = await ctx.dialogs.prompt({
    title: 'Go to commit',
    label: 'Revision',
    placeholder: 'a1b2c3d',
    confirmLabel: 'Go',
  });
  if (rev === null) return;
  await ctx.repo.navigateToSha(rev);
}

/** The updater never opens a dialog itself; a manual check earns one. */
async function checkUpdates(ctx: PaletteContext): Promise<void> {
  await ctx.updater.checkForUpdates(true);
  if (ctx.updater.state() === 'available') ctx.dialogs.openUpdate();
}

function moveTab(ctx: PaletteContext, step: number): void {
  const tabs = ctx.workspace.workspaces();
  if (tabs.length < 2) return;
  const activeId = ctx.workspace.activeTabId();
  const index = tabs.findIndex((state) => state.tabId === activeId);
  const next = tabs[(index + step + tabs.length) % tabs.length];
  if (next) ctx.workspace.setActive(next.tabId);
}
