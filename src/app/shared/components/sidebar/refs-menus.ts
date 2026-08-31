import type { BranchInfo, StashEntry, TagInfo } from '../../../core/models';
import type { MenuItem } from '../../ui';

/** Everything the ref menus need to know about the repository around them. */
export interface RefsMenuContext {
  readonly currentBranch: string | null;
  /** Configured remote names, in the order `git remote` lists them. */
  readonly remotes: readonly string[];
  /** True when a browse URL can be derived from the first remote. */
  readonly hasWebUrl: boolean;
  /** True when that remote is a host whose pull-request form we can address. */
  readonly canOpenPullRequest: boolean;
}

const NO_REMOTES = 'This repository has no remotes';

/** `origin/feat/x` → `feat/x`; used for the ref name a remote expects. */
function withoutRemote(fullName: string, remote: string): string {
  return fullName.startsWith(`${remote}/`)
    ? fullName.slice(remote.length + 1)
    : fullName;
}

export function localBranchMenu(
  branch: BranchInfo,
  context: RefsMenuContext,
): MenuItem[] {
  const { currentBranch, remotes } = context;
  const isCurrent = branch.name === currentBranch;
  const target = currentBranch ?? 'HEAD';
  const notCurrentReason = 'Only the current branch can do this';

  return [
    {
      id: 'checkout',
      label: 'Checkout',
      icon: 'lucideGitBranch',
      tone: 'primary',
      disabled: isCurrent,
      disabledReason: 'Already on this branch',
    },
    {
      id: 'merge',
      label: `Merge ${branch.name} into ${target}`,
      icon: 'lucideGitMerge',
      separatorBefore: true,
      disabled: isCurrent || currentBranch === null,
      disabledReason: isCurrent
        ? 'A branch cannot be merged into itself'
        : 'HEAD is detached — check out a branch first',
    },
    {
      id: 'rebase',
      label: `Rebase ${target} onto ${branch.name}`,
      icon: 'lucideGitPullRequestArrow',
      disabled: isCurrent || currentBranch === null,
      disabledReason: isCurrent
        ? 'A branch cannot be rebased onto itself'
        : 'HEAD is detached — check out a branch first',
    },
    {
      id: 'compare',
      label: `Compare with ${target}…`,
      icon: 'lucideGitCompareArrows',
      disabled: isCurrent || currentBranch === null,
      disabledReason: isCurrent
        ? 'A branch is always identical to itself'
        : 'HEAD is detached — check out a branch first',
    },
    {
      id: 'push',
      label: 'Push',
      icon: 'lucideCloudUpload',
      separatorBefore: true,
      disabled: branch.upstream === null,
      disabledReason: 'No upstream yet — use Push and set upstream instead',
    },
    {
      id: 'push-upstream',
      label: 'Push and set upstream',
      icon: 'lucideLink',
      disabled: remotes.length === 0,
      disabledReason: NO_REMOTES,
      children: remotes.map((remote) => ({
        id: `push-upstream:${remote}`,
        label: `To ${remote}`,
      })),
    },
    {
      id: 'pull',
      label: 'Pull',
      icon: 'lucideCloudDownload',
      disabled: !isCurrent,
      disabledReason: notCurrentReason,
    },
    {
      id: 'fast-forward',
      label: 'Fast-forward to upstream',
      icon: 'lucideArrowUp',
      disabled: branch.upstream === null,
      disabledReason: 'This branch tracks no upstream',
    },
    {
      id: 'set-upstream',
      label: 'Set upstream…',
      icon: 'lucideLink',
      disabled: remotes.length === 0,
      disabledReason: NO_REMOTES,
    },
    {
      id: 'unset-upstream',
      label: 'Unset upstream',
      icon: 'lucideUnlink',
      disabled: branch.upstream === null,
      disabledReason: 'This branch tracks no upstream',
    },
    {
      id: 'create-from',
      label: `Create branch from ${branch.name}…`,
      icon: 'lucideGitBranchPlus',
      separatorBefore: true,
    },
    {
      id: 'create-pull-request',
      label: 'Create pull request',
      icon: 'lucideGitPullRequestArrow',
      disabled: !context.canOpenPullRequest,
      disabledReason: 'No GitHub, GitLab or Bitbucket remote',
    },
    {
      id: 'rename',
      label: 'Rename…',
      icon: 'lucidePencil',
      shortcut: 'f2',
    },
    {
      id: 'copy-name',
      label: 'Copy name',
      icon: 'lucideCopy',
      shortcut: 'mod+c',
    },
    {
      id: 'copy-url',
      label: 'Copy web URL',
      icon: 'lucideExternalLink',
      disabled: !context.hasWebUrl,
      disabledReason: 'No remote with a recognisable web URL',
    },
    {
      id: 'delete',
      label: 'Delete…',
      icon: 'lucideTrash2',
      tone: 'danger',
      separatorBefore: true,
      disabled: isCurrent,
      disabledReason: 'The current branch cannot be deleted',
      children: [
        { id: 'delete-local', label: 'Local branch', tone: 'danger' },
        {
          id: 'delete-force',
          label: 'Local branch (force, even if unmerged)',
          tone: 'danger',
        },
        {
          id: 'delete-both',
          label: 'Local and remote branch',
          tone: 'danger',
          disabled: branch.upstream === null,
          disabledReason: 'This branch tracks no upstream',
        },
      ],
    },
  ];
}

export function remoteBranchMenu(
  branch: BranchInfo,
  remote: string,
  context: RefsMenuContext,
): MenuItem[] {
  const target = context.currentBranch ?? 'HEAD';
  const detached = context.currentBranch === null;
  const detachedReason = 'HEAD is detached — check out a branch first';
  const short = withoutRemote(branch.name, remote);

  return [
    {
      id: 'checkout-tracking',
      label: `Checkout as ${short}`,
      icon: 'lucideGitBranch',
      tone: 'primary',
    },
    {
      id: 'merge',
      label: `Merge ${branch.name} into ${target}`,
      icon: 'lucideGitMerge',
      separatorBefore: true,
      disabled: detached,
      disabledReason: detachedReason,
    },
    {
      id: 'rebase',
      label: `Rebase ${target} onto ${branch.name}`,
      icon: 'lucideGitPullRequestArrow',
      disabled: detached,
      disabledReason: detachedReason,
    },
    {
      id: 'compare',
      label: `Compare with ${target}…`,
      icon: 'lucideGitCompareArrows',
      disabled: detached,
      disabledReason: detachedReason,
    },
    {
      id: 'fetch',
      label: `Fetch ${remote}`,
      icon: 'lucideCloudDownload',
      separatorBefore: true,
    },
    {
      id: 'copy-name',
      label: 'Copy name',
      icon: 'lucideCopy',
      shortcut: 'mod+c',
      separatorBefore: true,
    },
    {
      id: 'copy-url',
      label: 'Copy web URL',
      icon: 'lucideExternalLink',
      disabled: !context.hasWebUrl,
      disabledReason: 'No remote with a recognisable web URL',
    },
    {
      id: 'delete-remote',
      label: `Delete ${short} on ${remote}…`,
      icon: 'lucideTrash2',
      tone: 'danger',
      separatorBefore: true,
    },
  ];
}

export function tagMenu(tag: TagInfo, context: RefsMenuContext): MenuItem[] {
  const { remotes } = context;
  return [
    {
      id: 'checkout',
      label: 'Checkout (detached)',
      icon: 'lucideCircleDot',
      tone: 'primary',
    },
    {
      id: 'navigate',
      label: 'Go to commit',
      icon: 'lucideGitCommitHorizontal',
    },
    {
      id: 'create-branch',
      label: `Create branch from ${tag.name}…`,
      icon: 'lucideGitBranchPlus',
      separatorBefore: true,
    },
    {
      id: 'push-tag',
      label: 'Push tag',
      icon: 'lucideCloudUpload',
      disabled: remotes.length === 0,
      disabledReason: NO_REMOTES,
      children: remotes.map((remote) => ({
        id: `push-tag:${remote}`,
        label: `To ${remote}`,
      })),
    },
    {
      id: 'copy-name',
      label: 'Copy name',
      icon: 'lucideCopy',
      shortcut: 'mod+c',
      separatorBefore: true,
    },
    {
      id: 'delete',
      label: 'Delete…',
      icon: 'lucideTrash2',
      tone: 'danger',
      separatorBefore: true,
      children: [
        { id: 'delete-local', label: 'Local tag', tone: 'danger' },
        ...remotes.map((remote) => ({
          id: `delete-remote:${remote}`,
          label: `On ${remote}`,
          tone: 'danger' as const,
        })),
      ],
    },
  ];
}

export function stashMenu(stash: StashEntry): MenuItem[] {
  return [
    {
      id: 'pop',
      label: 'Pop (apply and drop)',
      icon: 'lucideArchive',
      tone: 'primary',
    },
    { id: 'apply', label: 'Apply (keep the entry)', icon: 'lucideCheck' },
    { id: 'show', label: 'Show diff', icon: 'lucideFileDiff' },
    {
      id: 'branch',
      label: 'Branch from stash…',
      icon: 'lucideGitBranchPlus',
      separatorBefore: true,
    },
    {
      id: 'drop',
      label: `Drop stash@{${stash.index}}…`,
      icon: 'lucideTrash2',
      tone: 'danger',
      separatorBefore: true,
    },
  ];
}
