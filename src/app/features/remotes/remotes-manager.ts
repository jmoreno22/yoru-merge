import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { RemoteInfo } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { parseRemoteUrl } from '../../core/utils';
import {
  ClipboardService,
  ContextMenuService,
  type MenuItem,
  YoruButton,
  YoruDialog,
  YoruField,
} from '../../shared/ui';
import { DialogsService } from '../dialogs/dialogs.service';
import { isValidRemoteName, isValidRemoteUrl } from './remote-form';

/**
 * Remote management: list, add, rename, remove and fetch one remote at a time.
 *
 * Reads its own list through `listRemotesAction` so it is correct whether it
 * was opened from the toolbar, the palette or the refs panel.
 */
@Component({
  selector: 'app-remotes-manager',
  imports: [YoruDialog, YoruButton, YoruField, NgIcon],
  templateUrl: './remotes-manager.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'remotes-manager-host' },
})
export class RemotesManager {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  protected readonly remotes = this.currentRepo.remotes;
  protected readonly error = this.currentRepo.remotesError;
  protected readonly busy = this.currentRepo.remoteBusy;

  protected readonly adding = signal(false);
  protected readonly newName = signal('');
  protected readonly newUrl = signal('');
  /** Remote whose fetch is running, so only its row shows a spinner. */
  protected readonly fetching = signal<string | null>(null);

  protected readonly nameError = computed(() => {
    const name = this.newName().trim();
    if (name.length === 0) return '';
    if (!isValidRemoteName(name)) {
      return 'Use letters, digits, dot, dash or underscore.';
    }
    if (this.remotes().some((remote) => remote.name === name)) {
      return `A remote named ${name} already exists.`;
    }
    return '';
  });

  protected readonly urlError = computed(() => {
    const url = this.newUrl().trim();
    if (url.length === 0) return '';
    return isValidRemoteUrl(url) ? '' : 'Not a URL git can use as a remote.';
  });

  protected readonly canAdd = computed(
    () =>
      this.newName().trim().length > 0 &&
      this.newUrl().trim().length > 0 &&
      this.nameError().length === 0 &&
      this.urlError().length === 0 &&
      !this.busy(),
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.adding.set(false);
        this.newName.set('');
        this.newUrl.set('');
        return;
      }
      void this.currentRepo.listRemotesAction();
    });
  }

  /** `null` for remotes that are not on a known hosting provider. */
  protected webUrl(remote: RemoteInfo): string | null {
    return parseRemoteUrl(remote.fetch_url)?.webUrl ?? null;
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected startAdd(): void {
    this.adding.set(true);
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.newName.set('');
    this.newUrl.set('');
  }

  protected onNameInput(event: Event): void {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  protected onUrlInput(event: Event): void {
    this.newUrl.set((event.target as HTMLInputElement).value);
  }

  protected async onAdd(): Promise<void> {
    if (!this.canAdd()) return;
    await this.currentRepo.addRemoteAction(this.newName().trim(), this.newUrl().trim());
    this.cancelAdd();
  }

  protected async onFetch(remote: RemoteInfo, prune: boolean): Promise<void> {
    this.fetching.set(remote.name);
    try {
      await this.currentRepo.fetchAction({ remote: remote.name, prune });
    } finally {
      this.fetching.set(null);
    }
  }

  protected async onRename(remote: RemoteInfo): Promise<void> {
    const name = await this.dialogs.prompt({
      title: `Rename ${remote.name}`,
      label: 'New name',
      initialValue: remote.name,
      confirmLabel: 'Rename',
    });
    if (name === null || name === remote.name) return;
    if (!isValidRemoteName(name)) return;
    await this.currentRepo.renameRemoteAction(remote.name, name);
  }

  protected async onEditUrl(remote: RemoteInfo): Promise<void> {
    const url = await this.dialogs.prompt({
      title: `URL of ${remote.name}`,
      label: 'Fetch and push URL',
      initialValue: remote.fetch_url,
      confirmLabel: 'Save URL',
      validate: (value) =>
        isValidRemoteUrl(value) ? null : 'Not a URL git can use as a remote.',
    });
    if (url === null || url === remote.fetch_url) return;
    await this.currentRepo.setRemoteUrlAction(remote.name, url);
  }

  protected async onRemove(remote: RemoteInfo): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: `Remove ${remote.name}`,
      body: `Removes the remote and its remote-tracking branches. ${remote.fetch_url} is not touched.`,
      confirmLabel: 'Remove remote',
      tone: 'danger',
      skippable: true,
    });
    if (!confirmed) return;
    await this.currentRepo.removeRemoteAction(remote.name);
  }

  protected async onCopyUrl(url: string): Promise<void> {
    await this.clipboard.writeText(url);
  }

  protected async onOpenWeb(url: string): Promise<void> {
    await this.currentRepo.openUrl(url);
  }

  protected async openRowMenu(event: MouseEvent, remote: RemoteInfo): Promise<void> {
    event.preventDefault();
    const web = this.webUrl(remote);
    const items: MenuItem[] = [
      {
        id: 'fetch',
        label: `Fetch ${remote.name}`,
        icon: 'lucideCloudDownload',
        run: () => void this.onFetch(remote, false),
      },
      {
        id: 'prune',
        label: 'Fetch and prune',
        icon: 'lucideRefreshCw',
        run: () => void this.onFetch(remote, true),
      },
      {
        id: 'rename',
        label: 'Rename…',
        icon: 'lucidePencil',
        separatorBefore: true,
        run: () => void this.onRename(remote),
      },
      {
        id: 'edit-url',
        label: 'Edit URL…',
        icon: 'lucideLink',
        run: () => void this.onEditUrl(remote),
      },
      {
        id: 'copy-fetch',
        label: 'Copy fetch URL',
        icon: 'lucideCopy',
        run: () => void this.onCopyUrl(remote.fetch_url),
      },
      {
        id: 'copy-push',
        label: 'Copy push URL',
        icon: 'lucideCopy',
        disabled: remote.push_url === remote.fetch_url,
        disabledReason: 'Same as the fetch URL',
        run: () => void this.onCopyUrl(remote.push_url),
      },
      {
        id: 'web',
        label: 'Open on the web',
        icon: 'lucideExternalLink',
        disabled: web === null,
        disabledReason: 'Not a GitHub, GitLab or Bitbucket remote',
        run: () => {
          if (web) void this.onOpenWeb(web);
        },
      },
      {
        id: 'remove',
        label: 'Remove…',
        icon: 'lucideTrash2',
        tone: 'danger',
        separatorBefore: true,
        run: () => void this.onRemove(remote),
      },
    ];
    await this.menu.open(items, event.currentTarget as HTMLElement);
  }
}
