import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { PullMode } from '../../../core/models';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { ThemeService } from '../../../core/services/theme.service';
import { type Toast, ToastService } from '../../../core/services/toast.service';
import { UpdaterService } from '../../../core/services/updater.service';
import { parseRemoteUrl, pullRequestUrl, validateRefName } from '../../../core/utils';
import { CommandPaletteService } from '../../../features/command-palette/command-palette.service';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import { SettingsDialogService } from '../../../features/settings/settings-dialog.service';
import type { YoruIconName } from '../../icons';
import {
  ClipboardService,
  ContextMenuService,
  KeyboardShortcutsService,
  type MenuItem,
  YoruButton,
  YoruKbd,
  YoruTooltip,
} from '../../ui';

/** How many notifications the bell keeps. */
const HISTORY_LIMIT = 20;

/** Longest notification label the bell menu shows before eliding. */
const HISTORY_LABEL_MAX = 72;

/** What the update pill shows; `null` keeps it out of the toolbar. */
interface UpdatePill {
  readonly icon: YoruIconName;
  readonly label: string;
  readonly aria: string;
}

const TOAST_ICON: Readonly<Record<Toast['level'], YoruIconName>> = {
  success: 'lucideCircleCheck',
  info: 'lucideInfo',
  warning: 'lucideTriangleAlert',
  error: 'lucideCircleX',
};

/**
 * The action toolbar: remote and branch clusters on the left, the command bar
 * in the middle, repository status and app-level controls on the right.
 *
 * Every dropdown is a {@link ContextMenuService} menu, so the toolbar keeps no
 * open/close state of its own and a menu can never survive the click that
 * should have dismissed it.
 */
@Component({
  selector: 'app-toolbar',
  imports: [NgIcon, YoruButton, YoruKbd, YoruTooltip],
  templateUrl: './toolbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'toolbar',
    class:
      'flex h-[var(--toolbar-h)] shrink-0 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3',
  },
})
export class Toolbar {
  protected readonly repo = inject(CurrentRepoService);
  private readonly theme = inject(ThemeService);
  private readonly toasts = inject(ToastService);
  private readonly updater = inject(UpdaterService);
  private readonly dialogs = inject(DialogsService);
  private readonly settings = inject(SettingsDialogService);
  private readonly palette = inject(CommandPaletteService);
  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  protected readonly isOpen = this.repo.isOpen;
  protected readonly currentBranch = this.repo.currentBranch;
  protected readonly aheadBehind = this.repo.aheadBehind;

  /** Remote work is in flight; the three remote buttons wait for each other. */
  protected readonly remoteBusy = computed(
    () => this.repo.isFetching() || this.repo.remoteBusy(),
  );

  protected readonly hasRemotes = computed(() => this.repo.remotes().length > 0);

  /** Fetch, pull and push have nowhere to go without a remote configured. */
  protected readonly remoteDisabled = computed(
    () => !this.isOpen() || !this.hasRemotes(),
  );

  protected readonly remoteDisabledReason = computed(() =>
    this.isOpen() && !this.hasRemotes() ? 'No remotes configured' : null,
  );

  protected readonly upstream = computed(
    () =>
      this.repo.branches()?.local.find((b) => b.name === this.currentBranch())
        ?.upstream ?? null,
  );

  protected readonly themeIcon = computed<YoruIconName>(() =>
    this.theme.resolved() === 'dark' ? 'lucideMoon' : 'lucideSun',
  );

  protected readonly themeLabel = computed(() => {
    const mode = this.theme.current();
    const label = mode === 'system' ? `system (${this.theme.resolved()})` : mode;
    return `Theme: ${label} — click to cycle`;
  });

  protected readonly updatePill = computed<UpdatePill | null>(() => {
    const version = this.updater.info()?.version ?? '';
    switch (this.updater.state()) {
      case 'available':
        return {
          icon: 'lucideDownload',
          label: 'Update available',
          aria: `Version ${version} available — review and install`,
        };
      case 'downloading': {
        const percent = this.updater.progress();
        const label = percent === null ? 'Downloading…' : `Downloading… ${percent}%`;
        return { icon: 'lucideCloudDownload', label, aria: `${label} — show progress` };
      }
      case 'ready':
        return {
          icon: 'lucideRefreshCw',
          label: 'Restart to update',
          aria: `Version ${version} installed — restart to apply`,
        };
      default:
        return null;
    }
  });

  // ── notification history (the bell) ──────────────────────────────────────

  private readonly history = signal<readonly Toast[]>([]);
  private readonly seen = signal(0);

  protected readonly unread = computed(() =>
    Math.max(0, this.history().length - this.seen()),
  );

  constructor() {
    effect(() => {
      const live = this.toasts.toasts();
      if (live.length === 0) return;
      this.history.update((previous) => {
        const known = new Set(previous.map((toast) => toast.id));
        const added = live.filter((toast) => !known.has(toast.id));
        if (added.length === 0) return previous;
        return [...added.reverse(), ...previous].slice(0, HISTORY_LIMIT);
      });
    });

    const offs = [
      this.shortcuts.register({
        id: 'remote.fetch',
        combo: 'mod+shift+f',
        label: 'Fetch',
        when: () => !this.remoteDisabled(),
        run: () => void this.fetch({}),
      }),
      this.shortcuts.register({
        id: 'remote.pull',
        combo: 'mod+shift+d',
        label: 'Pull',
        when: () => !this.remoteDisabled(),
        run: () => void this.pull({}),
      }),
      this.shortcuts.register({
        id: 'remote.push',
        combo: 'mod+shift+u',
        label: 'Push',
        when: () => !this.remoteDisabled(),
        run: () => void this.push({}),
      }),
    ];
    inject(DestroyRef).onDestroy(() => {
      for (const off of offs) off();
    });
  }

  // ── remote cluster ───────────────────────────────────────────────────────

  protected async onFetch(): Promise<void> {
    await this.fetch({});
  }

  protected async onFetchMenu(event: MouseEvent): Promise<void> {
    await this.openMenu(event, [
      {
        id: 'fetch',
        label: 'Fetch origin',
        icon: 'lucideCloudDownload',
        run: () => void this.fetch({}),
      },
      {
        id: 'fetch-all',
        label: 'Fetch all remotes',
        icon: 'lucideGlobe',
        run: () => void this.fetch({ remote: null }),
      },
      {
        id: 'fetch-prune',
        label: 'Fetch all remotes and prune',
        icon: 'lucideRefreshCw',
        run: () => void this.fetch({ remote: null, prune: true }),
      },
      {
        id: 'fetch-tags',
        label: 'Fetch (include tags)',
        icon: 'lucideTags',
        separatorBefore: true,
        run: () => void this.fetch({ tags: true }),
      },
    ]);
  }

  protected async onPull(): Promise<void> {
    await this.pull({});
  }

  protected async onPullMenu(event: MouseEvent): Promise<void> {
    await this.openMenu(event, [
      {
        id: 'merge',
        label: 'Pull (merge)',
        icon: 'lucideGitMerge',
        run: () => void this.pull({ mode: 'merge' }),
      },
      {
        id: 'rebase',
        label: 'Pull (rebase)',
        icon: 'lucideGitPullRequestArrow',
        run: () => void this.pull({ mode: 'rebase' }),
      },
      {
        id: 'ff',
        label: 'Pull (fast-forward only)',
        icon: 'lucideArrowDown',
        run: () => void this.pull({ mode: 'ff_only' }),
      },
      {
        id: 'autostash',
        label: 'Pull with autostash',
        icon: 'lucideArchive',
        separatorBefore: true,
        run: () => void this.pull({ autostash: true }),
      },
    ]);
  }

  protected async onPush(): Promise<void> {
    await this.push({});
  }

  protected async onPushMenu(event: MouseEvent): Promise<void> {
    const branch = this.currentBranch();
    await this.openMenu(event, [
      {
        id: 'push',
        label: 'Push',
        icon: 'lucideCloudUpload',
        run: () => void this.push({}),
      },
      {
        id: 'upstream',
        label: 'Push and set upstream',
        icon: 'lucideLink',
        disabled: branch === null,
        disabledReason: 'HEAD is detached',
        run: () => void this.push({ setUpstream: true }),
      },
      {
        id: 'tags',
        label: 'Push tags',
        icon: 'lucideTags',
        run: () => void this.push({ tags: true }),
      },
      {
        id: 'force',
        label: 'Force push (with lease)…',
        icon: 'lucideTriangleAlert',
        tone: 'danger',
        separatorBefore: true,
        run: () => void this.forcePush(),
      },
    ]);
  }

  // ── branch cluster ───────────────────────────────────────────────────────

  protected async onBranchMenu(event: MouseEvent): Promise<void> {
    const branches = this.repo.branches()?.local ?? [];
    const current = this.currentBranch();
    const items: MenuItem[] = [
      {
        id: 'new',
        label: 'New branch…',
        icon: 'lucideGitBranchPlus',
        tone: 'primary',
        run: () => void this.createBranch(),
      },
      ...branches.map<MenuItem>((branch, index) => ({
        id: `checkout:${branch.name}`,
        label: branch.name,
        icon: 'lucideGitBranch',
        separatorBefore: index === 0,
        disabled: branch.name === current,
        disabledReason: 'Already checked out',
        run: () => void this.repo.checkoutBranchAction(branch.name),
      })),
    ];
    await this.openMenu(event, items);
  }

  protected onMerge(): void {
    this.dialogs.openMerge();
  }

  protected async onStashMenu(event: MouseEvent): Promise<void> {
    const stashes = this.repo.stashes();
    await this.openMenu(event, [
      {
        id: 'stash',
        label: 'Stash changes',
        icon: 'lucideArchive',
        run: () => void this.repo.stashSaveAction('', { includeUntracked: true }),
      },
      {
        id: 'stash-message',
        label: 'Stash with message…',
        icon: 'lucidePencil',
        run: () => void this.stashWithMessage(),
      },
      {
        id: 'stash-options',
        label: 'Stash with options…',
        icon: 'lucideSettings2',
        run: () => this.dialogs.openStashOptions(),
      },
      {
        id: 'pop',
        label: 'Pop latest stash',
        icon: 'lucideUndo2',
        separatorBefore: true,
        disabled: stashes.length === 0,
        disabledReason: 'There is nothing stashed',
        run: () => void this.repo.stashApplyAction(0, true),
      },
    ]);
  }

  // ── right-hand controls ──────────────────────────────────────────────────

  protected onOpenPalette(): void {
    this.palette.open();
  }

  protected onOpenSettings(): void {
    this.settings.open();
  }

  protected onUpdate(): void {
    this.dialogs.openUpdate();
  }

  protected onToggleTheme(): void {
    this.theme.cycle();
  }

  protected async onCopyBranch(): Promise<void> {
    const branch = this.currentBranch();
    if (branch) await this.clipboard.writeText(branch);
  }

  protected async onBell(event: MouseEvent): Promise<void> {
    const entries = this.history();
    this.seen.set(entries.length);
    const items: MenuItem[] =
      entries.length === 0
        ? [
            {
              id: 'empty',
              label: 'No notifications yet',
              disabled: true,
              disabledReason: 'Fetches, pushes and errors are listed here',
            },
          ]
        : [
            ...entries.map<MenuItem>((toast, index) => ({
              id: `toast:${toast.id}:${index}`,
              label: elide(toast.message),
              icon: TOAST_ICON[toast.level],
              run: () => void this.clipboard.writeText(toast.message),
            })),
            {
              id: 'clear',
              label: 'Clear notifications',
              icon: 'lucideTrash2',
              separatorBefore: true,
              run: () => {
                this.history.set([]);
                this.seen.set(0);
              },
            },
          ];
    await this.openMenu(event, items);
  }

  // ── action bodies ────────────────────────────────────────────────────────

  /**
   * Fetch quietly and report it here instead: the toast is worth showing
   * mainly when it can also offer the pull the user now needs.
   */
  private async fetch(options: {
    remote?: string | null;
    prune?: boolean;
    tags?: boolean;
  }): Promise<void> {
    if (this.remoteDisabled() || this.remoteBusy()) return;
    const done = await this.repo.fetchAction({ ...options, silent: true });
    if (!done) return;
    const behind = this.aheadBehind().behind;
    if (behind === 0) {
      this.toasts.show({
        kind: 'success',
        message: 'Fetched — already up to date.',
        key: 'fetch-result',
      });
      return;
    }
    this.toasts.show({
      kind: 'success',
      message: `Fetched · ${behind} new ${behind === 1 ? 'commit' : 'commits'} upstream.`,
      key: 'fetch-result',
      action: { label: 'Pull', run: () => this.pull({}) },
    });
  }

  private async pull(options: { mode?: PullMode; autostash?: boolean }): Promise<void> {
    if (this.remoteDisabled() || this.remoteBusy()) return;
    const result = await this.repo.pullAction(options);
    if (result?.kind === 'auth_required') this.offerAuthSettings();
  }

  private async push(options: {
    force?: boolean;
    setUpstream?: boolean;
    tags?: boolean;
  }): Promise<void> {
    if (this.remoteDisabled() || this.remoteBusy()) return;
    const result = await this.repo.pushAction(options);
    if (result?.kind === 'auth_required') {
      this.offerAuthSettings();
      return;
    }
    if (result?.kind === 'success') await this.offerPullRequest();
  }

  private async forcePush(): Promise<void> {
    const branch = this.currentBranch() ?? 'HEAD';
    const confirmed = await this.dialogs.confirm({
      title: 'Force push',
      body: `Force pushing ${branch} rewrites the remote branch. --force-with-lease refuses if the remote moved since your last fetch, but anyone who already pulled it will have to reset.`,
      confirmLabel: 'Force push',
      tone: 'danger',
      doubleConfirm: true,
    });
    if (!confirmed) return;
    await this.push({ force: true });
  }

  private async createBranch(): Promise<void> {
    const taken = (this.repo.branches()?.local ?? []).map((branch) => branch.name);
    const name = await this.dialogs.prompt({
      title: 'Create branch',
      label: 'Branch name',
      placeholder: 'feat/graph',
      confirmLabel: 'Create',
      validate: (value) => validateRefName(value, taken),
    });
    if (name === null) return;
    await this.repo.createBranchAction(name, { checkout: true });
  }

  private async stashWithMessage(): Promise<void> {
    const message = await this.dialogs.prompt({
      title: 'Stash changes',
      label: 'Message',
      placeholder: 'wip: graph lanes',
      confirmLabel: 'Stash',
    });
    if (message === null) return;
    await this.repo.stashSaveAction(message, { includeUntracked: true });
  }

  /** Replaces the auth toast the facade raised, adding the way to fix it. */
  private offerAuthSettings(): void {
    this.toasts.show({
      kind: 'error',
      message: 'Authentication failed. Check the credentials for this remote.',
      key: 'git-auth',
      action: { label: 'Open settings', run: () => this.settings.open('git') },
    });
  }

  private async offerPullRequest(): Promise<void> {
    const branch = this.currentBranch();
    if (!branch) return;
    if (this.repo.remotes().length === 0) await this.repo.listRemotesAction();
    const remotes = this.repo.remotes();
    const origin = remotes.find((remote) => remote.name === 'origin') ?? remotes[0];
    const parsed = origin ? parseRemoteUrl(origin.fetch_url) : null;
    if (!parsed) return;
    const url = pullRequestUrl(parsed, branch);
    this.toasts.show({
      kind: 'info',
      message: `Ready to open a pull request for ${branch}.`,
      key: 'push-pr',
      action: { label: 'Create pull request', run: () => this.repo.openUrl(url) },
    });
  }

  private async openMenu(event: MouseEvent, items: readonly MenuItem[]): Promise<void> {
    await this.menu.open(items, event.currentTarget as HTMLElement);
  }
}

/** Keeps a long error readable as one menu row. */
function elide(text: string): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > HISTORY_LABEL_MAX
    ? `${single.slice(0, HISTORY_LABEL_MAX - 1)}…`
    : single;
}
