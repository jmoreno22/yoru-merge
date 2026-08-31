import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { open as openFolder } from '@tauri-apps/plugin-dialog';
import type { RepoEntry } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { SystemOps } from '../../core/services/ops';
import { relativeTime, validateRefName } from '../../core/utils';
import { ClipboardService, ContextMenuService, YoruEmptyState } from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';

/**
 * Entry screen when no repository is open: open, clone or initialise one, and
 * the list of recents.
 */
@Component({
  selector: 'app-repo-manager',
  imports: [YoruEmptyState, NgIcon],
  templateUrl: './repo-manager.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'repo-manager',
    class: 'block h-full w-full',
  },
})
export class RepoManager implements OnInit {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly system = inject(SystemOps);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);

  protected readonly loading = this.currentRepo.loading;
  protected readonly error = this.currentRepo.error;

  protected readonly recents = signal<readonly RepoEntry[]>([]);
  protected readonly visibleRecents = computed(() => this.recents().slice(0, 12));

  async ngOnInit(): Promise<void> {
    // The global config supplies init.defaultBranch for the initialize prompt.
    await Promise.allSettled([
      this.loadRecents(),
      this.currentRepo.loadGlobalConfigAction(),
    ]);
  }

  protected lastOpened(entry: RepoEntry): string {
    return relativeTime(entry.last_opened);
  }

  protected async onOpen(): Promise<void> {
    if (this.loading()) return;
    const chosen = await openFolder({ directory: true, multiple: false });
    if (typeof chosen !== 'string' || chosen.length === 0) return;
    await this.currentRepo.openRepo(chosen);
    await this.loadRecents();
  }

  protected onClone(): void {
    this.dialogs.openClone();
  }

  protected async onInit(): Promise<void> {
    if (this.loading()) return;
    const chosen = await openFolder({ directory: true, multiple: false });
    if (typeof chosen !== 'string' || chosen.length === 0) return;

    const branch = await this.dialogs.prompt({
      title: 'Initialize repository',
      label: 'Initial branch name',
      initialValue: this.currentRepo.globalConfig()?.default_branch ?? 'main',
      hint: chosen,
      confirmLabel: 'Initialize',
      validate: (value) => validateRefName(value),
    });
    if (branch === null) return;

    await this.currentRepo.initRepoAction(chosen, branch);
    await this.loadRecents();
  }

  protected async onRecent(entry: RepoEntry): Promise<void> {
    if (this.loading()) return;
    await this.currentRepo.openRepo(entry.path);
    await this.loadRecents();
  }

  protected async onRemoveRecent(entry: RepoEntry, event: Event): Promise<void> {
    event.stopPropagation();
    await this.removeRecent(entry);
  }

  protected async onRecentMenu(event: MouseEvent, entry: RepoEntry): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.menu.open(
      [
        {
          id: 'open',
          label: 'Open',
          icon: 'lucideFolderOpen',
          tone: 'primary',
          run: () => void this.onRecent(entry),
        },
        {
          id: 'reveal',
          label: 'Reveal in file manager',
          icon: 'lucideFolder',
          run: () => void this.system.reveal(entry.path),
        },
        {
          id: 'terminal',
          label: 'Open in terminal',
          icon: 'lucideTerminal',
          run: () => void this.system.openTerminal(entry.path),
        },
        {
          id: 'copy',
          label: 'Copy path',
          icon: 'lucideCopy',
          run: () => void this.clipboard.writeText(entry.path),
        },
        {
          id: 'remove',
          label: 'Remove from recents',
          icon: 'lucideX',
          tone: 'danger',
          separatorBefore: true,
          run: () => void this.removeRecent(entry),
        },
      ],
      { x: event.clientX, y: event.clientY },
    );
  }

  private async removeRecent(entry: RepoEntry): Promise<void> {
    await this.currentRepo.removeRecentRepoAction(entry.path);
    await this.loadRecents();
  }

  private async loadRecents(): Promise<void> {
    this.recents.set(await this.currentRepo.recentReposAction());
  }
}
