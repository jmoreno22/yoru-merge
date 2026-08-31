import { computed, Injectable, inject } from '@angular/core';
import type { RefInfo, ResetMode } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { ToastService } from '../../core/services/toast.service';
import { commitUrl, parseRemoteUrl, shortSha, validateRefName } from '../../core/utils';
import type { MenuAnchor } from '../../shared/ui';
import { ClipboardService, ContextMenuService } from '../../shared/ui';
import { InteractiveRebaseService } from '../commit-inspector/interactive-rebase.service';
import { DialogsService } from '../dialogs/dialogs.service';
import { buildCommitMenu } from './commit-menu';
import { CommitPromptService } from './commit-prompt.service';
import { isHeadCommit } from './commit-refs';

/** What the actions need to know about the commit they act on. */
interface CommitTarget {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly refs: readonly RefInfo[];
  readonly parents: readonly string[];
  readonly onCurrentBranch: boolean;
}

/**
 * Every commit action the list, the graph and the inspector can trigger.
 *
 * Living in a service rather than in the list component is what lets the
 * inspector's "More actions" button open the exact same menu, and keeps the
 * confirmation dialogs in one place instead of one copy per view.
 */
@Injectable({ providedIn: 'root' })
export class CommitActions {
  private readonly repo = inject(CurrentRepoService);
  private readonly menu = inject(ContextMenuService);
  private readonly dialogs = inject(DialogsService);
  private readonly prompts = inject(CommitPromptService);
  private readonly clipboard = inject(ClipboardService);
  private readonly toast = inject(ToastService);
  private readonly rebase = inject(InteractiveRebaseService);

  /** Names a new branch cannot take, so the dialog says no before git does. */
  private readonly takenNames = computed<string[]>(() => [
    ...(this.repo.branches()?.local ?? []).map((branch) => branch.name),
    ...this.repo.tags().map((tag) => tag.name),
  ]);

  /** Opens the full commit menu and runs whatever the user picks. */
  async openMenu(
    anchor: MenuAnchor,
    sha: string,
    selection: readonly string[],
  ): Promise<void> {
    const target = this.find(sha);
    if (!target) return;

    // The "open on remote" items need origin's URL, and nothing else in the
    // history views lists remotes.
    if (this.repo.remotes().length === 0) {
      await this.repo.listRemotesAction();
    }

    const choice = await this.menu.open(
      buildCommitMenu({
        shortSha: target.shortSha,
        isHead: isHeadCommit(target.refs),
        onCurrentBranch: target.onCurrentBranch,
        parentCount: target.parents.length,
        currentBranch: this.repo.currentBranch(),
        detachedHead: this.repo.repoState().head_detached,
        selectionCount: selection.length,
        hasRemoteUrl: this.webUrl(sha) !== null,
        sequencerActive: this.repo.sequencerActive(),
      }),
      anchor,
    );
    if (choice === null) return;
    await this.run(choice, sha, selection);
  }

  /** Runs one menu id. Public so the inspector's buttons can reuse it. */
  async run(id: string, sha: string, selection: readonly string[]): Promise<void> {
    const target = this.find(sha);
    if (!target) return;

    switch (id) {
      case 'inspect':
        await this.repo.selectCommit(sha);
        return;
      case 'checkout':
        await this.repo.checkoutCommitAction(sha);
        return;
      case 'branch':
        await this.createBranch(sha);
        return;
      case 'tag':
        await this.createTag(sha);
        return;
      case 'cherry-pick':
        await this.repo.cherryPickAction(sha);
        return;
      case 'revert':
        await this.revert(sha);
        return;
      case 'reset-soft':
        await this.reset(sha, 'soft');
        return;
      case 'reset-mixed':
        await this.reset(sha, 'mixed');
        return;
      case 'reset-hard':
        await this.reset(sha, 'hard');
        return;
      case 'rebase-interactive':
        this.rebase.open(sha);
        return;
      case 'squash-parent':
        await this.squashIntoParent(target);
        return;
      case 'edit-message':
        await this.editMessage(sha);
        return;
      case 'compare-head':
        await this.compare('HEAD', sha);
        return;
      case 'compare-selected':
        await this.compareSelected(selection);
        return;
      case 'copy-sha':
        await this.copy(sha, 'Commit SHA copied.');
        return;
      case 'copy-short-sha':
        await this.copy(target.shortSha, 'Short SHA copied.');
        return;
      case 'copy-message':
        await this.copy(this.fullMessage(target), 'Commit message copied.');
        return;
      case 'copy-url':
        await this.copyUrl(sha);
        return;
      case 'open-remote':
        await this.openRemote(sha);
        return;
    }
  }

  async createBranch(sha: string): Promise<void> {
    const name = await this.dialogs.prompt({
      title: `Create branch at ${shortSha(sha)}`,
      label: 'Branch name',
      placeholder: 'feature/my-work',
      confirmLabel: 'Create and check out',
      validate: (value) => validateRefName(value, this.takenNames()),
    });
    if (!name) return;
    await this.repo.createBranchAction(name, { startPoint: sha, checkout: true });
  }

  async createTag(sha: string): Promise<void> {
    const answer = await this.prompts.ask({
      title: `Create tag at ${shortSha(sha)}`,
      fields: [
        { key: 'name', label: 'Tag name', placeholder: 'v1.0.0', required: true },
        {
          key: 'message',
          label: 'Message',
          hint: 'A message creates an annotated tag; leave it empty for a lightweight one.',
          multiline: true,
        },
      ],
      confirmLabel: 'Create tag',
    });
    if (!answer) return;
    const message = answer['message']?.trim() ?? '';
    await this.repo.createTagAction(
      answer['name']?.trim() ?? '',
      sha,
      message.length > 0 ? message : null,
    );
  }

  async revert(sha: string): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Revert ${shortSha(sha)}`,
      body: 'A new commit undoing this one will be added on top of the current branch. Nothing is rewritten.',
      confirmLabel: 'Revert',
      skippable: true,
    });
    if (!ok) return;
    await this.repo.revertAction(sha);
  }

  async reset(sha: string, mode: ResetMode): Promise<void> {
    const branch = this.repo.currentBranch() ?? 'HEAD';
    const short = shortSha(sha);

    if (mode === 'hard') {
      const dirty = this.repo.stagedCount() + this.repo.unstagedCount();
      const ok = await this.dialogs.confirm({
        title: `Reset ${branch} to ${short}`,
        body: `${branch} will point at ${short} and every staged and unstaged change will be thrown away${dirty > 0 ? ` (${dirty} changed files)` : ''}.`,
        confirmLabel: 'Reset and discard',
        tone: 'danger',
        doubleConfirm: true,
      });
      if (!ok) return;
    } else {
      const body =
        mode === 'soft'
          ? `${branch} will point at ${short}; the index and the working tree keep everything.`
          : `${branch} will point at ${short}; the working tree keeps its changes but they become unstaged.`;
      const ok = await this.dialogs.confirm({
        title: `Reset ${branch} to ${short}`,
        body,
        confirmLabel: 'Reset',
        skippable: true,
      });
      if (!ok) return;
    }

    await this.repo.resetToCommitAction(sha, mode);
  }

  /** Replays the commit as a `fixup` onto its parent through a rebase todo. */
  async squashIntoParent(target: CommitTarget): Promise<void> {
    const parent = target.parents[0];
    if (!parent) return;
    const ok = await this.dialogs.confirm({
      title: `Squash ${target.shortSha} into its parent`,
      body: `"${target.subject}" is folded into ${shortSha(parent)}, keeping the parent's message. Every commit after it is rewritten.`,
      confirmLabel: 'Squash',
    });
    if (!ok) return;

    const base = `${parent}^`;
    const todo = await this.repo.rebaseTodoAction(base);
    if (todo.length === 0) {
      this.toast.error('Could not build a rebase plan for this commit.');
      return;
    }
    const entries = todo.map((entry) =>
      entry.sha === target.sha ? { ...entry, action: 'fixup' } : entry,
    );
    await this.repo.applyRebaseAction(base, entries);
  }

  /** Amends HEAD with a new message; the tree is left untouched. */
  async editMessage(sha: string): Promise<void> {
    const current = await this.repo.getHeadMessage();
    const answer = await this.prompts.ask({
      title: 'Edit commit message',
      body: `Amending ${shortSha(sha)}. The commit is rewritten, so it gets a new SHA.`,
      fields: [
        {
          key: 'message',
          label: 'Message',
          value: current,
          multiline: true,
          required: true,
        },
      ],
      confirmLabel: 'Amend commit',
      size: 'md',
    });
    if (!answer) return;
    await this.repo.createCommit(answer['message'] ?? '', true);
  }

  async compare(base: string, head: string): Promise<void> {
    const result = await this.repo.compareRefsAction(base, head);
    if (!result) return;
    const headLabel = shortSha(head);
    const baseLabel = shortSha(base);
    await this.prompts.ask({
      title: `${headLabel} compared with ${baseLabel}`,
      rows: [
        { label: `Ahead of ${baseLabel}`, value: `${result.ahead} commits` },
        { label: `Behind ${baseLabel}`, value: `${result.behind} commits` },
        {
          label: 'Merge base',
          value: result.merge_base ? shortSha(result.merge_base) : 'none in common',
        },
      ],
      confirmLabel: 'Close',
      cancelLabel: null,
    });
  }

  private async compareSelected(selection: readonly string[]): Promise<void> {
    const [first, second] = selection;
    if (!first || !second) return;
    // The list is newest first, so the second row is the older side.
    await this.compare(second, first);
  }

  private async copy(value: string, message: string): Promise<void> {
    await this.clipboard.writeText(value);
    this.toast.success(message);
  }

  private async copyUrl(sha: string): Promise<void> {
    const url = this.webUrl(sha);
    if (!url) return;
    await this.copy(url, 'Commit URL copied.');
  }

  private async openRemote(sha: string): Promise<void> {
    const url = this.webUrl(sha);
    if (!url) return;
    await this.repo.openUrl(url);
  }

  /** Browse URL for the commit, or `null` when no remote resolves to one. */
  private webUrl(sha: string): string | null {
    const remotes = this.repo.remotes();
    const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0];
    if (!origin) return null;
    const parsed = parseRemoteUrl(origin.fetch_url || origin.push_url);
    return parsed ? commitUrl(parsed, sha) : null;
  }

  /** Subject plus body when the inspector already holds the details. */
  private fullMessage(target: CommitTarget): string {
    const details = this.repo.commitDetails();
    if (details?.sha !== target.sha) return target.subject;
    return details.body.length > 0
      ? `${details.subject}\n\n${details.body}`
      : details.subject;
  }

  private find(sha: string): CommitTarget | null {
    const info =
      this.repo.commits().find((c) => c.sha === sha) ??
      this.repo.searchResults().find((c) => c.sha === sha);
    if (info) {
      return {
        sha,
        shortSha: info.short_sha,
        subject: info.message.split('\n')[0] ?? info.message,
        refs: info.refs,
        parents: info.parent_shas,
        onCurrentBranch: info.on_current_branch,
      };
    }
    const details = this.repo.commitDetails();
    if (details?.sha !== sha) return null;
    return {
      sha,
      shortSha: details.short_sha,
      subject: details.subject,
      refs: details.refs,
      parents: details.parents,
      onCurrentBranch: false,
    };
  }
}
