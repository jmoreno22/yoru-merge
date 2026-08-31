import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  type RepoState,
  WorkspaceStore,
  type WorkspaceTabId,
} from '../../../core/services/workspace.store';
import { YoruTooltip } from '../../ui';
import { WorkspaceActions } from '../app-shell/workspace-actions.service';

/**
 * Repository tabs, rendered inside the custom titlebar.
 *
 * Presentational only: every interaction goes through {@link WorkspaceStore} or
 * {@link WorkspaceActions}, so the tab strip, the "+" menu and the global
 * shortcuts all take the same code path.
 */
@Component({
  selector: 'app-workspace-tabs',
  imports: [NgIcon, YoruTooltip],
  templateUrl: './workspace-tabs.html',
  styleUrl: './workspace-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'workspace-tabs',
    class: 'flex h-full min-w-0 items-stretch',
  },
})
export class WorkspaceTabs {
  private readonly store = inject(WorkspaceStore);
  private readonly actions = inject(WorkspaceActions);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly tabs = this.store.workspaces;
  protected readonly activeTabId = this.store.activeTabId;

  /** Bumped on every keyboard move so re-focusing the same tab still works. */
  private readonly focusRequest = signal(0);
  private lastFocusSeq = 0;

  constructor() {
    afterRenderEffect(() => {
      const seq = this.focusRequest();
      if (seq === this.lastFocusSeq) return;
      this.lastFocusSeq = seq;
      this.host.nativeElement
        .querySelector<HTMLElement>('[data-tab-active="true"]')
        ?.focus();
    });
  }

  protected isActive(state: RepoState): boolean {
    return this.activeTabId() === state.tabId;
  }

  /** Backend name when the repo is loaded, path basename until then. */
  protected tabName(state: RepoState): string {
    return state.repo()?.name || basename(state.path);
  }

  /** Files the tab has staged, unstaged or conflicted — the dirty chip. */
  protected dirtyCount(state: RepoState): number {
    return state.stagedCount() + state.unstagedCount() + state.conflictCount();
  }

  protected onSelect(tabId: WorkspaceTabId): void {
    this.store.setActive(tabId);
  }

  protected onClose(state: RepoState, event: Event): void {
    event.stopPropagation();
    void this.actions.closeTab(state.tabId);
  }

  /** Middle click closes, the way browser tabs do. */
  protected onAuxClick(state: RepoState, event: MouseEvent): void {
    if (event.button !== 1) return;
    event.preventDefault();
    void this.actions.closeTab(state.tabId);
  }

  protected async onContextMenu(state: RepoState, event: MouseEvent): Promise<void> {
    event.preventDefault();
    await this.actions.openTabMenu(state, { x: event.clientX, y: event.clientY });
  }

  protected onKeydown(state: RepoState, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onSelect(state.tabId);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Delete':
        event.preventDefault();
        void this.actions.closeTab(state.tabId);
        break;
    }
  }

  protected async onAdd(event: MouseEvent): Promise<void> {
    await this.actions.openAddMenu(event.currentTarget as HTMLElement);
  }

  private moveFocus(step: number): void {
    this.actions.moveTab(step);
    this.focusRequest.update((seq) => seq + 1);
  }
}

/** Cross-platform basename; a restored tab has a path before it has a name. */
function basename(path: string): string {
  if (!path) return '';
  const trimmed = path.replace(/[\\/]+$/, '');
  const lastSep = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSep >= 0 ? trimmed.slice(lastSep + 1) : trimmed;
}
