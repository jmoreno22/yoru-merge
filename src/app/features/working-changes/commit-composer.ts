import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { ToastService } from '../../core/services/toast.service';
import { CONVENTIONAL_TYPES } from '../../core/utils/conventional-commit';
import { shortSha } from '../../core/utils/short-sha';
import {
  ContextMenuService,
  KeyboardShortcutsService,
  type MenuItem,
  YoruButton,
  YoruDialog,
  YoruKbd,
  YoruSwitch,
} from '../../shared/ui';
import { CommitComposerFocus } from './commit-composer-focus.service';
import {
  amendWarning,
  buildCommitMessage,
  type CommitDraft,
  commitMenuItems,
  commitReadiness,
  countDiffStats,
  draftFromMessage,
  headerLength,
  isDraftEmpty,
  recentScopes,
  SUBJECT_MAX,
  SUBJECT_WARN,
  subjectStatus,
} from './commit-message';

/** How many messages the session keeps for the "recent" menu. */
const RECENT_LIMIT = 10;

/** Commits offered when picking the target of a `fixup!`. */
const FIXUP_CHOICES = 15;

/**
 * Fetching the whole staged diff just to count lines is only reasonable while
 * the change set is small; past this the summary drops the +/− figures.
 */
const MAX_STATS_FILES = 400;

type CommitMode = 'commit' | 'commit-push' | 'commit-tag' | 'commit-fixup';

/**
 * The commit composer: conventional-commit fields, the four commit toggles and
 * the split Commit button.
 *
 * Always mounted, even with a clean tree — an amend needs no staged file.
 */
@Component({
  selector: 'app-commit-composer',
  imports: [NgIcon, YoruButton, YoruDialog, YoruKbd, YoruSwitch],
  templateUrl: './commit-composer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex shrink-0 flex-col gap-2 border-t border-[var(--app-border)] ' +
      'bg-[var(--app-surface-raised)] p-3',
  },
})
export class CommitComposer {
  private readonly service = inject(CurrentRepoService);
  private readonly git = inject(TauriGitService);
  private readonly menu = inject(ContextMenuService);
  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly toasts = inject(ToastService);
  private readonly focusRequests = inject(CommitComposerFocus);

  private readonly subjectInput =
    viewChild<ElementRef<HTMLInputElement>>('subjectInput');
  /** The split button's caret, reused to anchor the fixup picker. */
  private menuAnchor: HTMLElement | null = null;
  private remotesRequestedFor: string | null = null;

  protected readonly types = CONVENTIONAL_TYPES;
  protected readonly subjectWarn = SUBJECT_WARN;
  protected readonly subjectMax = SUBJECT_MAX;
  /** Position of the 50-character tick on a 0–72 ruler. */
  protected readonly warnTickPercent = (SUBJECT_WARN / SUBJECT_MAX) * 100;

  protected readonly type = signal<string>('');
  protected readonly scope = signal<string>('');
  protected readonly breaking = signal<boolean>(false);
  protected readonly subject = signal<string>('');
  protected readonly body = signal<string>('');

  protected readonly amend = signal<boolean>(false);
  protected readonly signoff = signal<boolean>(false);
  protected readonly noVerify = signal<boolean>(false);

  /** Session-only history; there is no preference slot for it yet. */
  private readonly recentMessages = signal<readonly string[]>([]);

  protected readonly tagDialogOpen = signal<boolean>(false);
  protected readonly tagName = signal<string>('');
  protected readonly tagMessage = signal<string>('');

  private readonly stagedStats = signal<{
    additions: number;
    deletions: number;
  } | null>(null);

  protected readonly draft = computed<CommitDraft>(() => ({
    type: this.type(),
    scope: this.scope(),
    breaking: this.breaking(),
    subject: this.subject(),
    body: this.body(),
  }));

  protected readonly headerLength = computed(() => headerLength(this.draft()));
  protected readonly subjectState = computed(() => subjectStatus(this.headerLength()));
  protected readonly rulerPercent = computed(() =>
    Math.min(100, (this.headerLength() / SUBJECT_MAX) * 100),
  );

  protected readonly stagedCount = this.service.stagedCount;
  protected readonly busy = this.service.stagingBusy;

  protected readonly readiness = computed(() =>
    commitReadiness({
      hasRepo: this.service.isOpen(),
      busy: this.busy(),
      amend: this.amend(),
      stagedCount: this.stagedCount(),
      subject: this.subject(),
    }),
  );

  protected readonly gpgSign = computed(() => this.service.config()?.gpg_sign ?? false);

  /**
   * The toggle mirrors `commit.gpgsign`; git decides, not the composer, so it
   * is read-only either way and always says why.
   */
  protected readonly gpgHint = computed(() =>
    this.gpgSign()
      ? 'commit.gpgsign is on for this repository'
      : 'Not configured — turn on commit.gpgsign in Settings',
  );

  protected readonly hasRemote = computed(() => this.service.remotes().length > 0);

  protected readonly scopeOptions = computed(() =>
    recentScopes(this.service.commits().map((commit) => commit.message)),
  );

  private readonly currentBranchInfo = computed(() => {
    const name = this.service.currentBranch();
    if (!name) return null;
    return this.service.branches()?.local.find((b) => b.name === name) ?? null;
  });

  protected readonly hasUpstream = computed(
    () =>
      this.currentBranchInfo()?.upstream !== null &&
      this.currentBranchInfo()?.upstream !== undefined,
  );

  /** Non-blocking: an amend of an already-pushed HEAD needs a force push. */
  protected readonly amendWarning = computed(() =>
    amendWarning({
      amend: this.amend(),
      upstream: this.currentBranchInfo()?.upstream ?? null,
      ahead: this.currentBranchInfo()?.ahead ?? 0,
    }),
  );

  protected readonly hasRecent = computed(() => this.recentMessages().length > 0);

  protected readonly stats = this.stagedStats.asReadonly();

  /** "3 staged · +48 −12"; the counts drop out on very large change sets. */
  protected readonly summaryText = computed(() => {
    const base = `${this.stagedCount()} staged`;
    const stats = this.stats();
    return stats === null ? base : `${base} · +${stats.additions} −${stats.deletions}`;
  });

  protected readonly counterClass = computed(() => {
    switch (this.subjectState()) {
      case 'error':
        return 'text-git-deleted';
      case 'warn':
        return 'text-git-modified';
      default:
        return 'text-[var(--app-text-faint)]';
    }
  });

  protected readonly rulerClass = computed(() => {
    switch (this.subjectState()) {
      case 'error':
        return 'bg-git-deleted';
      case 'warn':
        return 'bg-git-modified';
      default:
        return 'bg-accent/60';
    }
  });

  protected readonly commitLabel = computed(() => (this.amend() ? 'Amend' : 'Commit'));

  constructor() {
    const off = this.shortcuts.register({
      id: 'working-changes.commit',
      combo: 'mod+enter',
      label: 'Commit staged changes',
      allowInInputs: true,
      when: () => this.readiness().canCommit,
      run: () => void this.commit('commit'),
    });
    inject(DestroyRef).onDestroy(off);

    effect(() => {
      if (!this.focusRequests.requested()) return;
      const input = this.subjectInput();
      if (!input) return;
      this.focusRequests.consume();
      // The requester is usually the command palette, and a closing dialog
      // hands focus back to whatever opened it. A task boundary puts the caret
      // in the composer after that restore rather than before it.
      setTimeout(() => input.nativeElement.focus());
    });

    // `gpg_sign` is only read here, and nothing else in the refresh set loads
    // the repo config.
    effect(() => {
      if (this.service.isOpen() && this.service.config() === null) {
        void this.service.loadConfigAction();
      }
    });

    // "Commit & push" must know whether a remote exists; nothing else in the
    // refresh set lists them, and re-reading on every change would loop.
    effect(() => {
      const repo = this.service.repo();
      if (!repo || this.remotesRequestedFor === repo.path) return;
      this.remotesRequestedFor = repo.path;
      void this.service.listRemotesAction();
    });

    effect((onCleanup) => {
      const repo = this.service.repo();
      const signature = this.stagedSignature();
      if (!repo || signature.length === 0) {
        this.stagedStats.set(null);
        return;
      }
      if (this.stagedCount() > MAX_STATS_FILES) {
        this.stagedStats.set(null);
        return;
      }
      const timer = setTimeout(async () => {
        try {
          const diff = await this.git.getDiff(repo.path, null, true);
          this.stagedStats.set(countDiffStats(diff));
        } catch {
          // A failing diff must not take the composer down with it.
          this.stagedStats.set(null);
        }
      }, 250);
      onCleanup(() => clearTimeout(timer));
    });
  }

  private readonly stagedSignature = computed(() =>
    (this.service.changes()?.staged ?? [])
      .map((file) => `${file.status}:${file.path}`)
      .join('\0'),
  );

  protected onTypeClick(type: string): void {
    this.type.update((current) => (current === type ? '' : type));
  }

  protected onScopeInput(event: Event): void {
    this.scope.set((event.target as HTMLInputElement).value);
  }

  protected onSubjectInput(event: Event): void {
    this.subject.set((event.target as HTMLInputElement).value);
  }

  protected onBodyInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.body.set(textarea.value);
    this.autoGrow(textarea);
  }

  protected onTagNameInput(event: Event): void {
    this.tagName.set((event.target as HTMLInputElement).value);
  }

  protected onTagMessageInput(event: Event): void {
    this.tagMessage.set((event.target as HTMLInputElement).value);
  }

  /**
   * Amend pre-fills from HEAD, but never over something already typed; turning
   * it back off leaves the message alone.
   */
  protected async onAmendChange(checked: boolean): Promise<void> {
    this.amend.set(checked);
    if (!checked || !isDraftEmpty(this.draft())) return;

    const message = await this.service.getHeadMessage();
    if (message.length === 0 || !isDraftEmpty(this.draft())) return;
    this.applyDraft(draftFromMessage(message));
  }

  protected async openCommitMenu(event: MouseEvent): Promise<void> {
    const items = commitMenuItems({
      amend: this.amend(),
      hasRemote: this.hasRemote(),
      hasUpstream: this.hasUpstream(),
      hasCommits: this.service.commits().length > 0,
    });
    this.menuAnchor = event.currentTarget as HTMLElement;
    const choice = await this.menu.open(items, this.menuAnchor);
    if (choice) await this.commit(choice as CommitMode);
  }

  protected async openRecentMenu(event: MouseEvent): Promise<void> {
    const messages = this.recentMessages();
    const items: MenuItem[] = messages.map((message, index) => ({
      id: String(index),
      label: message.split('\n', 1)[0] ?? message,
      icon: 'lucideHistory',
    }));
    const choice = await this.menu.open(items, event.currentTarget as HTMLElement);
    if (choice === null) return;
    const message = messages[Number(choice)];
    if (message) this.applyDraft(draftFromMessage(message));
  }

  protected async commit(mode: CommitMode): Promise<void> {
    if (!this.readiness().canCommit) return;

    if (mode === 'commit-fixup') {
      await this.commitFixup();
      return;
    }

    const draft = this.draft();
    // An amend with an empty composer keeps HEAD's message, by design.
    const message =
      this.amend() && isDraftEmpty(draft) ? '' : buildCommitMessage(draft);
    const sha = await this.runCommit(message);
    if (sha === null) return;

    if (mode === 'commit-push') {
      await this.service.pushAction({ setUpstream: !this.hasUpstream() });
      return;
    }
    if (mode === 'commit-tag') this.tagDialogOpen.set(true);
    this.announceCommit(sha);
  }

  /** The commit itself is silent; the toast exists to offer the push. */
  private announceCommit(sha: string): void {
    this.toasts.show({
      kind: 'success',
      message: `Committed ${shortSha(sha)}`,
      key: 'commit-created',
      action: this.hasRemote()
        ? {
            label: this.hasUpstream() ? 'Push' : 'Push (set upstream)',
            run: () => {
              void this.service.pushAction({
                setUpstream: !this.hasUpstream(),
              });
            },
          }
        : undefined,
    });
  }

  protected async confirmTag(): Promise<void> {
    const name = this.tagName().trim();
    if (name.length === 0) return;
    const message = this.tagMessage().trim();
    await this.service.createTagAction(name, null, message.length > 0 ? message : null);
    this.closeTagDialog();
  }

  protected closeTagDialog(): void {
    this.tagDialogOpen.set(false);
    this.tagName.set('');
    this.tagMessage.set('');
  }

  private async commitFixup(): Promise<void> {
    const commits = this.service.commits().slice(0, FIXUP_CHOICES);
    if (commits.length === 0) return;

    const items: MenuItem[] = commits.map((commit) => ({
      id: commit.sha,
      label: `${shortSha(commit.sha)}  ${commit.message.split('\n', 1)[0] ?? ''}`,
      icon: 'lucideGitCommitHorizontal',
    }));
    const choice = await this.menu.open(
      items,
      this.menuAnchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    );
    if (choice === null) return;

    const target = commits.find((commit) => commit.sha === choice);
    if (!target) return;
    const subject = target.message.split('\n', 1)[0]?.trim() ?? '';
    await this.runCommit(`fixup! ${subject}`);
  }

  private async runCommit(message: string): Promise<string | null> {
    const sha = await this.service.createCommit(message, this.amend(), {
      signoff: this.signoff(),
      noVerify: this.noVerify(),
    });
    // A failure keeps the composer as it was so the user can retry.
    if (sha === null) return null;

    if (message.trim().length > 0) this.remember(message);
    this.applyDraft({
      type: '',
      scope: '',
      breaking: false,
      subject: '',
      body: '',
    });
    this.amend.set(false);
    this.subjectInput()?.nativeElement.focus();
    return sha;
  }

  private remember(message: string): void {
    this.recentMessages.update((messages) =>
      [message, ...messages.filter((m) => m !== message)].slice(0, RECENT_LIMIT),
    );
  }

  private applyDraft(draft: CommitDraft): void {
    this.type.set(draft.type);
    this.scope.set(draft.scope);
    this.breaking.set(draft.breaking);
    this.subject.set(draft.subject);
    this.body.set(draft.body);
  }

  private autoGrow(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }
}
