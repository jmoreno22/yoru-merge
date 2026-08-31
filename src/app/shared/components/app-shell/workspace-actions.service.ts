import { Injectable, inject } from '@angular/core';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { SystemOps } from '../../../core/services/ops';
import {
  type RepoState,
  WorkspaceStore,
  type WorkspaceTabId,
} from '../../../core/services/workspace.store';
import { validateRefName } from '../../../core/utils';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import { ClipboardService, ContextMenuService, type MenuAnchor } from '../../ui';

/**
 * Everything the titlebar, the shell shortcuts and the tab menus need to do to
 * a workspace, in one place so the three entry points cannot drift apart.
 *
 * The open / clone / init flows mirror the command palette's on purpose: two
 * different prompts for "initialize a repository" would be two different
 * products.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceActions {
  private readonly repo = inject(CurrentRepoService);
  private readonly workspace = inject(WorkspaceStore);
  private readonly dialogs = inject(DialogsService);
  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);
  private readonly system = inject(SystemOps);

  async openRepo(): Promise<void> {
    const chosen = await openFolderDialog({ directory: true, multiple: false });
    if (typeof chosen === 'string' && chosen.length > 0) {
      await this.repo.openRepo(chosen);
    }
  }

  cloneRepo(): void {
    this.dialogs.openClone();
  }

  async initRepo(): Promise<void> {
    const chosen = await openFolderDialog({ directory: true, multiple: false });
    if (typeof chosen !== 'string' || chosen.length === 0) return;
    const branch = await this.dialogs.prompt({
      title: 'Initialize repository',
      label: 'Initial branch name',
      initialValue: this.repo.globalConfig()?.default_branch ?? 'main',
      hint: chosen,
      confirmLabel: 'Initialize',
      validate: (value) => validateRefName(value),
    });
    if (branch === null) return;
    await this.repo.initRepoAction(chosen, branch);
  }

  /** The "+" menu in the titlebar. */
  async openAddMenu(anchor: MenuAnchor): Promise<void> {
    await this.menu.open(
      [
        {
          id: 'open',
          label: 'Open repository…',
          icon: 'lucideFolderOpen',
          shortcut: 'mod+o',
          run: () => void this.openRepo(),
        },
        {
          id: 'clone',
          label: 'Clone repository…',
          icon: 'lucideCloudDownload',
          run: () => this.cloneRepo(),
        },
        {
          id: 'init',
          label: 'Initialize repository…',
          icon: 'lucideGitBranchPlus',
          run: () => void this.initRepo(),
        },
      ],
      anchor,
    );
  }

  /** Right-click menu of one repository tab. */
  async openTabMenu(state: RepoState, anchor: MenuAnchor): Promise<void> {
    const tabs = this.workspace.workspaces();
    const index = tabs.findIndex((tab) => tab.tabId === state.tabId);
    const toTheRight = index >= 0 ? tabs.length - index - 1 : 0;
    const path = state.repo()?.path ?? state.path;

    await this.menu.open(
      [
        {
          id: 'close',
          label: 'Close',
          icon: 'lucideX',
          shortcut: 'mod+w',
          run: () => void this.closeTab(state.tabId),
        },
        {
          id: 'close-others',
          label: 'Close others',
          disabled: tabs.length < 2,
          disabledReason: 'This is the only open tab',
          run: () => void this.closeOthers(state.tabId),
        },
        {
          id: 'close-right',
          label: 'Close to the right',
          disabled: toTheRight === 0,
          disabledReason: 'Nothing is open to the right',
          run: () => void this.closeToTheRight(state.tabId),
        },
        {
          id: 'reveal',
          label: 'Reveal in file manager',
          icon: 'lucideFolderOpen',
          separatorBefore: true,
          disabled: state.notFound(),
          disabledReason: 'The folder no longer exists',
          run: () => void this.system.reveal(path),
        },
        {
          id: 'copy-path',
          label: 'Copy path',
          icon: 'lucideCopy',
          run: () => void this.clipboard.writeText(path),
        },
      ],
      anchor,
    );
  }

  closeTab(tabId: WorkspaceTabId): Promise<void> {
    return this.workspace.closeWorkspace(tabId);
  }

  async closeOthers(tabId: WorkspaceTabId): Promise<void> {
    const others = this.workspace
      .workspaces()
      .filter((tab) => tab.tabId !== tabId)
      .map((tab) => tab.tabId);
    for (const id of others) await this.workspace.closeWorkspace(id);
  }

  async closeToTheRight(tabId: WorkspaceTabId): Promise<void> {
    const tabs = this.workspace.workspaces();
    const index = tabs.findIndex((tab) => tab.tabId === tabId);
    if (index < 0) return;
    for (const tab of tabs.slice(index + 1)) {
      await this.workspace.closeWorkspace(tab.tabId);
    }
  }

  /** Cycles tabs; `step` is +1 for the next tab and -1 for the previous. */
  moveTab(step: number): void {
    const tabs = this.workspace.workspaces();
    if (tabs.length < 2) return;
    const index = tabs.findIndex((tab) => tab.tabId === this.workspace.activeTabId());
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) this.workspace.setActive(next.tabId);
  }
}
