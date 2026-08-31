import {
  ApplicationRef,
  computed,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  branchUrl,
  parseRemoteUrl,
  pullRequestUrl,
  validateRefName,
} from '../../../core/utils';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import {
  ClipboardService,
  ContextMenuService,
  type MenuAnchor,
  type MenuItem,
} from '../../ui';
import { CheckoutFlow } from './checkout-flow.service';
import { CompareDialog } from './compare-dialog';
import { openOverlay } from './overlay';
import {
  localBranchMenu,
  type RefsMenuContext,
  remoteBranchMenu,
  stashMenu,
  tagMenu,
} from './refs-menus';
import {
  type RefsBranchNode,
  type RefsNode,
  type RefsStashNode,
  type RefsTagNode,
  remoteOf,
  shortRemoteName,
} from './refs-tree';

/**
 * Every action a ref row can perform, so the sidebar component is left with the
 * tree and the keyboard. Each menu id maps to exactly one facade call.
 */
@Injectable({ providedIn: 'root' })
export class RefsActions {
  private readonly repo = inject(CurrentRepoService);
  private readonly menu = inject(ContextMenuService);
  private readonly dialogs = inject(DialogsService);
  private readonly flow = inject(CheckoutFlow);
  private readonly clipboard = inject(ClipboardService);
  private readonly toast = inject(ToastService);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  /**
   * Configured remotes when `git remote` has answered, and the prefixes of the
   * remote refs until then — a menu must never be empty because a list is late.
   */
  readonly remoteNames = computed<string[]>(() => {
    const configured = this.repo.remotes().map((remote) => remote.name);
    if (configured.length > 0) return configured;
    const derived = new Set(
      (this.repo.branches()?.remote ?? []).map((branch) => remoteOf(branch.name)),
    );
    return [...derived].sort();
  });

  /** The remote whose URL "Copy web URL" resolves against. */
  private readonly webRemote = computed(() => {
    const remotes = this.repo.remotes();
    const preferred = remotes.find((remote) => remote.name === 'origin') ?? remotes[0];
    return preferred ? parseRemoteUrl(preferred.fetch_url) : null;
  });

  /** Names a new branch or tag would collide with. */
  private readonly takenNames = computed<string[]>(() => [
    ...(this.repo.branches()?.local ?? []).map((branch) => branch.name),
    ...this.repo.tags().map((tag) => tag.name),
  ]);

  // ── entry points ────────────────────────────────────────────────────────

  async openMenu(node: RefsNode, anchor: MenuAnchor): Promise<void> {
    const items = this.menuFor(node);
    if (items.length === 0) return;
    const choice = await this.menu.open(items, anchor);
    if (choice !== null) await this.run(node, choice);
  }

  /** Space and double-click: check the ref out. */
  async activate(node: RefsNode): Promise<void> {
    switch (node.kind) {
      case 'branch':
        await this.flow.checkout(node.branch.name, node.remote !== null);
        break;
      case 'tag':
        await this.repo.checkoutCommitAction(node.tag.name);
        break;
      case 'stash':
        await this.repo.stashApplyAction(node.stash.index, false);
        break;
      default:
        break;
    }
  }

  /** Enter: move the history to what the ref points at. */
  async navigate(node: RefsNode): Promise<void> {
    switch (node.kind) {
      case 'branch':
        await this.repo.navigateToSha(node.branch.sha);
        break;
      case 'tag':
        await this.repo.navigateToSha(node.tag.sha);
        break;
      case 'stash':
        await this.showStash(node);
        break;
      default:
        break;
    }
  }

  /** Delete key. */
  async remove(node: RefsNode): Promise<void> {
    switch (node.kind) {
      case 'branch':
        await (node.remote === null
          ? this.deleteLocal(node.branch.name, false)
          : this.deleteOnRemote(node));
        break;
      case 'tag':
        await this.deleteTag(node.tag.name);
        break;
      case 'stash':
        await this.dropStash(node);
        break;
      default:
        break;
    }
  }

  /** F2 — only a local branch can be renamed. */
  async rename(node: RefsNode): Promise<void> {
    if (node.kind !== 'branch' || node.remote !== null) return;
    const name = await this.dialogs.prompt({
      title: `Rename ${node.branch.name}`,
      label: 'New name',
      initialValue: node.branch.name,
      confirmLabel: 'Rename',
      validate: (value) =>
        validateRefName(
          value,
          this.takenNames().filter((taken) => taken !== node.branch.name),
        ),
    });
    if (name) await this.repo.renameBranchAction(node.branch.name, name);
  }

  async copyName(node: RefsNode): Promise<void> {
    const name = nameOf(node);
    if (!name) return;
    await this.clipboard.writeText(name);
    this.toast.success(`Copied ${name}.`, 2000);
  }

  /** The panel's "new branch" action, also reachable from a branch row. */
  async createBranch(startPoint: string | null): Promise<void> {
    const name = await this.dialogs.prompt({
      title: startPoint ? `Create branch from ${startPoint}` : 'Create branch',
      label: 'Branch name',
      hint: startPoint ? undefined : 'Starts at HEAD',
      confirmLabel: 'Create and switch',
      validate: (value) => validateRefName(value, this.takenNames()),
    });
    if (!name) return;
    await this.repo.createBranchAction(name, { startPoint, checkout: true });
  }

  // ── menus ───────────────────────────────────────────────────────────────

  private menuContext(): RefsMenuContext {
    return {
      currentBranch: this.repo.currentBranch(),
      remotes: this.remoteNames(),
      hasWebUrl: this.webRemote() !== null,
      canOpenPullRequest: (this.webRemote()?.provider ?? 'unknown') !== 'unknown',
    };
  }

  private menuFor(node: RefsNode): MenuItem[] {
    switch (node.kind) {
      case 'branch':
        return node.remote === null
          ? localBranchMenu(node.branch, this.menuContext())
          : remoteBranchMenu(node.branch, node.remote, this.menuContext());
      case 'tag':
        return tagMenu(node.tag, this.menuContext());
      case 'stash':
        return stashMenu(node.stash);
      default:
        return [];
    }
  }

  private run(node: RefsNode, choice: string): Promise<void> {
    switch (node.kind) {
      case 'branch':
        return node.remote === null
          ? this.runLocalBranch(node, choice)
          : this.runRemoteBranch(node, choice);
      case 'tag':
        return this.runTag(node, choice);
      case 'stash':
        return this.runStash(node, choice);
      default:
        return Promise.resolve();
    }
  }

  // ── local branch ────────────────────────────────────────────────────────

  private async runLocalBranch(node: RefsBranchNode, choice: string): Promise<void> {
    const { branch } = node;
    const current = this.repo.currentBranch();
    const upstreamRemote = branch.upstream ? remoteOf(branch.upstream) : 'origin';

    if (choice.startsWith('push-upstream:')) {
      const remote = choice.slice('push-upstream:'.length);
      await this.repo.pushAction({
        remote,
        branch: branch.name,
        setUpstream: true,
      });
      return;
    }

    switch (choice) {
      case 'checkout':
        await this.flow.checkout(branch.name);
        break;
      case 'merge':
        await this.repo.mergeBranchAction(branch.name);
        break;
      case 'rebase':
        if (current) await this.repo.rebaseBranchAction(current, branch.name);
        break;
      case 'compare':
        if (current) await this.compare(current, branch.name);
        break;
      case 'push':
        await this.repo.pushAction({
          remote: upstreamRemote,
          branch: branch.name,
        });
        break;
      case 'pull':
        await this.repo.pullAction();
        break;
      case 'fast-forward':
        await this.repo.fastForwardAction(branch.name);
        break;
      case 'set-upstream':
        await this.setUpstream(node);
        break;
      case 'unset-upstream':
        await this.repo.setUpstreamAction(branch.name, null);
        break;
      case 'create-from':
        await this.createBranch(branch.name);
        break;
      case 'rename':
        await this.rename(node);
        break;
      case 'copy-name':
        await this.copyName(node);
        break;
      case 'copy-url':
        await this.copyWebUrl(branch.name);
        break;
      case 'create-pull-request':
        await this.openPullRequest(branch.name);
        break;
      case 'delete-local':
        await this.deleteLocal(branch.name, false);
        break;
      case 'delete-force':
        await this.deleteLocal(branch.name, true);
        break;
      case 'delete-both':
        await this.deleteLocalAndRemote(node);
        break;
      default:
        break;
    }
  }

  private async setUpstream(node: RefsBranchNode): Promise<void> {
    const remote = this.remoteNames()[0] ?? 'origin';
    const upstream = await this.dialogs.prompt({
      title: `Set upstream for ${node.branch.name}`,
      label: 'Upstream ref',
      hint: 'For example origin/main',
      initialValue: node.branch.upstream ?? `${remote}/${node.branch.name}`,
      confirmLabel: 'Set upstream',
      // An upstream is a remote ref, so only the syntax rules apply — it is
      // supposed to name something that already exists elsewhere.
      validate: (value) => validateRefName(value),
    });
    if (upstream) await this.repo.setUpstreamAction(node.branch.name, upstream);
  }

  private async deleteLocal(name: string, force: boolean): Promise<void> {
    const confirmed = await this.confirmDanger({
      title: force ? `Force delete ${name}` : `Delete ${name}`,
      body: force
        ? `${name} is deleted even if its commits are not merged anywhere, and commits only reachable from it become unreachable.`
        : `${name} is deleted. git refuses if it still has unmerged commits.`,
      confirmLabel: force ? 'Force delete' : 'Delete branch',
      doubleConfirm: force,
    });
    if (confirmed) await this.repo.deleteBranchAction(name, force);
  }

  private async deleteLocalAndRemote(node: RefsBranchNode): Promise<void> {
    const upstream = node.branch.upstream;
    if (!upstream) return;
    const remote = remoteOf(upstream);
    const remoteBranch = shortRemoteName(upstream);
    const confirmed = await this.confirmDanger({
      title: `Delete ${node.branch.name} locally and on ${remote}`,
      body: `Both ${node.branch.name} and ${remote}/${remoteBranch} are deleted. Everyone else loses the branch on their next fetch.`,
      confirmLabel: 'Delete both',
      doubleConfirm: true,
    });
    if (!confirmed) return;
    if (await this.repo.deleteBranchAction(node.branch.name, false)) {
      await this.repo.deleteRemoteBranchAction(remote, remoteBranch);
    }
  }

  // ── remote branch ───────────────────────────────────────────────────────

  private async runRemoteBranch(node: RefsBranchNode, choice: string): Promise<void> {
    const full = node.branch.name;
    const remote = node.remote ?? remoteOf(full);
    const short = shortRemoteName(full);
    const current = this.repo.currentBranch();

    switch (choice) {
      case 'checkout-tracking':
        await this.flow.checkout(full, true);
        break;
      case 'merge':
        await this.repo.mergeBranchAction(full);
        break;
      case 'rebase':
        if (current) await this.repo.rebaseBranchAction(current, full);
        break;
      case 'compare':
        if (current) await this.compare(current, full);
        break;
      case 'fetch':
        await this.repo.fetchAction({ remote });
        break;
      case 'copy-name':
        await this.copyName(node);
        break;
      case 'copy-url':
        await this.copyWebUrl(short);
        break;
      case 'delete-remote':
        await this.deleteOnRemote(node);
        break;
      default:
        break;
    }
  }

  private async deleteOnRemote(node: RefsBranchNode): Promise<void> {
    const remote = node.remote ?? remoteOf(node.branch.name);
    const short = shortRemoteName(node.branch.name);
    const confirmed = await this.confirmDanger({
      title: `Delete ${short} on ${remote}`,
      body: `${short} is deleted on ${remote} and everyone else loses it on their next fetch. Local branches are left untouched.`,
      confirmLabel: 'Delete on remote',
      doubleConfirm: true,
    });
    if (confirmed) await this.repo.deleteRemoteBranchAction(remote, short);
  }

  // ── tags ────────────────────────────────────────────────────────────────

  private async runTag(node: RefsTagNode, choice: string): Promise<void> {
    const { tag } = node;

    if (choice.startsWith('push-tag:')) {
      await this.repo.pushTagAction(choice.slice('push-tag:'.length), tag.name);
      return;
    }
    if (choice.startsWith('delete-remote:')) {
      const remote = choice.slice('delete-remote:'.length);
      const confirmed = await this.confirmDanger({
        title: `Delete tag ${tag.name} on ${remote}`,
        body: `The tag is deleted on ${remote}. The local tag stays.`,
        confirmLabel: 'Delete on remote',
      });
      if (confirmed) await this.repo.deleteRemoteTagAction(remote, tag.name);
      return;
    }

    switch (choice) {
      case 'checkout':
        await this.repo.checkoutCommitAction(tag.name);
        break;
      case 'navigate':
        await this.repo.navigateToSha(tag.sha);
        break;
      case 'create-branch':
        await this.createBranch(tag.name);
        break;
      case 'copy-name':
        await this.copyName(node);
        break;
      case 'delete-local':
        await this.deleteTag(tag.name);
        break;
      default:
        break;
    }
  }

  private async deleteTag(name: string): Promise<void> {
    const confirmed = await this.confirmDanger({
      title: `Delete tag ${name}`,
      body: 'The local tag is deleted. A tag already pushed stays on the remote.',
      confirmLabel: 'Delete tag',
    });
    if (confirmed) await this.repo.deleteTagAction(name);
  }

  // ── stashes ─────────────────────────────────────────────────────────────

  private async runStash(node: RefsStashNode, choice: string): Promise<void> {
    const { index } = node.stash;
    switch (choice) {
      case 'pop':
        await this.repo.stashApplyAction(index, true);
        break;
      case 'apply':
        await this.repo.stashApplyAction(index, false);
        break;
      case 'show':
        await this.showStash(node);
        break;
      case 'branch':
        await this.branchFromStash(node);
        break;
      case 'drop':
        await this.dropStash(node);
        break;
      default:
        break;
    }
  }

  private async showStash(node: RefsStashNode): Promise<void> {
    const diff = await this.repo.stashShowAction(node.stash.index);
    if (diff.length === 0) {
      this.toast.info(`stash@{${node.stash.index}} has nothing to show.`);
      return;
    }
    this.repo.diffText.set(diff);
    // A stash entry is a real commit, so `commit` is the honest source even
    // though `DiffSource` has no variant that would label the viewer "stash".
    this.repo.diffSource.set({ kind: 'commit', sha: node.stash.sha });
  }

  private async branchFromStash(node: RefsStashNode): Promise<void> {
    const name = await this.dialogs.prompt({
      title: `Branch from stash@{${node.stash.index}}`,
      label: 'Branch name',
      hint: 'The stash is applied on the new branch and dropped',
      confirmLabel: 'Create branch',
      validate: (value) => validateRefName(value, this.takenNames()),
    });
    if (name) await this.repo.stashBranchAction(node.stash.index, name);
  }

  private async dropStash(node: RefsStashNode): Promise<void> {
    const confirmed = await this.confirmDanger({
      title: `Drop stash@{${node.stash.index}}`,
      body: `"${node.stash.message}" is deleted. There is no undo.`,
      confirmLabel: 'Drop stash',
    });
    if (confirmed) await this.repo.stashDropAction(node.stash.index);
  }

  // ── shared helpers ──────────────────────────────────────────────────────

  /**
   * Opened on the body rather than from a template: the menu that asked for it
   * is already gone, and so may be the row it belonged to.
   */
  private async compare(base: string, head: string): Promise<void> {
    const result = await this.repo.compareRefsAction(base, head);
    if (!result) return;
    await openOverlay<CompareDialog, void>(
      this.appRef,
      this.environmentInjector,
      CompareDialog,
      (ref, settle) => {
        ref.setInput('request', { base, head, result });
        ref.instance.closed.subscribe(() => settle());
      },
    );
  }

  private async openPullRequest(branch: string): Promise<void> {
    const remote = this.webRemote();
    if (!remote || remote.provider === 'unknown') return;
    await this.repo.openUrl(pullRequestUrl(remote, branch));
  }

  private async copyWebUrl(branch: string): Promise<void> {
    const remote = this.webRemote();
    if (!remote) return;
    const url = branchUrl(remote, branch);
    await this.clipboard.writeText(url);
    this.toast.success('Copied the web URL.', 2000);
  }

  /** Every destructive ref action goes through the one app confirmation. */
  private confirmDanger(request: DangerRequest): Promise<boolean> {
    return this.dialogs.confirm({
      ...request,
      tone: 'danger',
      skippable: true,
    });
  }
}

/** What a destructive ref action asks before it runs. */
interface DangerRequest {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly doubleConfirm?: boolean;
}

/** The text "Copy name" puts on the clipboard for each kind of row. */
function nameOf(node: RefsNode): string | null {
  switch (node.kind) {
    case 'branch':
      return node.branch.name;
    case 'tag':
      return node.tag.name;
    case 'stash':
      return `stash@{${node.stash.index}}`;
    default:
      return null;
  }
}
