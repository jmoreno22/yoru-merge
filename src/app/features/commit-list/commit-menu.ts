import type { MenuItem } from '../../shared/ui';

/** Everything the commit menu needs to decide labels and disabled reasons. */
export interface CommitMenuContext {
  readonly shortSha: string;
  /** True when HEAD points at this very commit. */
  readonly isHead: boolean;
  /** True when the commit is reachable from HEAD. */
  readonly onCurrentBranch: boolean;
  readonly parentCount: number;
  /** Branch HEAD is on, or `null` while detached. */
  readonly currentBranch: string | null;
  readonly detachedHead: boolean;
  /** How many rows the user has selected, this one included. */
  readonly selectionCount: number;
  /** True when `origin` resolves to a browsable https URL. */
  readonly hasRemoteUrl: boolean;
  /** True while the sequencer is mid-rebase / mid-merge. */
  readonly sequencerActive: boolean;
}

const REWRITE_HINT = 'Only commits on the current branch can be rewritten';
const SEQUENCER_HINT = 'Finish or abort the operation in progress first';
const NO_REMOTE_URL_HINT = 'The remote is not GitHub, GitLab or Bitbucket';

/** Why a rewrite that needs exactly one parent cannot run. */
function parentHint(parentCount: number): string | undefined {
  if (parentCount === 0) return 'The root commit has no parent';
  if (parentCount > 1) return 'A merge commit has no single parent';
  return undefined;
}

/**
 * The full right-click inventory for a commit row, also reused by the
 * inspector's "More actions" button.
 *
 * Items are never hidden: an action the commit cannot take is disabled with
 * the reason spelled out, so the menu is a stable map of what is possible
 * rather than a list that changes shape under the cursor.
 */
export function buildCommitMenu(ctx: CommitMenuContext): MenuItem[] {
  const target = ctx.currentBranch ?? 'HEAD';
  const rewriteBlocked = ctx.sequencerActive
    ? SEQUENCER_HINT
    : ctx.onCurrentBranch
      ? undefined
      : REWRITE_HINT;

  return [
    {
      id: 'inspect',
      label: 'Show in inspector',
      icon: 'lucideGitCommitHorizontal',
      tone: 'primary',
    },
    {
      id: 'checkout',
      label: 'Checkout commit (detached)',
      icon: 'lucideCircleDot',
      separatorBefore: true,
      disabled: ctx.sequencerActive,
      disabledReason: ctx.sequencerActive ? SEQUENCER_HINT : undefined,
    },
    {
      id: 'branch',
      label: 'Create branch here…',
      icon: 'lucideGitBranchPlus',
    },
    {
      id: 'tag',
      label: 'Create tag here…',
      icon: 'lucideTag',
    },
    {
      id: 'cherry-pick',
      label: `Cherry-pick onto ${target}`,
      icon: 'lucideCherry',
      separatorBefore: true,
      disabled: ctx.sequencerActive || ctx.onCurrentBranch,
      disabledReason: ctx.sequencerActive
        ? SEQUENCER_HINT
        : ctx.onCurrentBranch
          ? 'The commit is already on this branch'
          : undefined,
    },
    {
      id: 'revert',
      label: 'Revert…',
      icon: 'lucideUndo2',
      disabled: ctx.sequencerActive,
      disabledReason: ctx.sequencerActive ? SEQUENCER_HINT : undefined,
    },
    {
      id: 'reset',
      label: `Reset ${target} to here`,
      icon: 'lucideRotateCcw',
      tone: 'danger',
      separatorBefore: true,
      disabled: ctx.detachedHead || ctx.sequencerActive,
      disabledReason: ctx.sequencerActive
        ? SEQUENCER_HINT
        : ctx.detachedHead
          ? 'HEAD is detached — check out a branch first'
          : undefined,
      children: [
        { id: 'reset-soft', label: 'Soft — keep index and working tree' },
        { id: 'reset-mixed', label: 'Mixed — keep working tree' },
        {
          id: 'reset-hard',
          label: 'Hard — discard everything…',
          tone: 'danger',
        },
      ],
    },
    {
      id: 'rebase-interactive',
      label: 'Interactive rebase from here…',
      icon: 'lucideGitPullRequestArrow',
      separatorBefore: true,
      disabled: rewriteBlocked !== undefined || ctx.parentCount !== 1,
      disabledReason: rewriteBlocked ?? parentHint(ctx.parentCount),
    },
    {
      id: 'squash-parent',
      label: 'Squash into parent…',
      icon: 'lucideScissors',
      disabled: rewriteBlocked !== undefined || ctx.parentCount !== 1,
      disabledReason: rewriteBlocked ?? parentHint(ctx.parentCount),
    },
    {
      id: 'edit-message',
      label: 'Edit message…',
      icon: 'lucidePencil',
      disabled: !ctx.isHead || ctx.sequencerActive,
      disabledReason: ctx.sequencerActive
        ? SEQUENCER_HINT
        : ctx.isHead
          ? undefined
          : 'Only the tip commit can be amended',
    },
    {
      id: 'compare-head',
      label: 'Compare with HEAD',
      icon: 'lucideGitCompareArrows',
      separatorBefore: true,
      disabled: ctx.isHead,
      disabledReason: ctx.isHead ? 'This commit is HEAD' : undefined,
    },
    {
      id: 'compare-selected',
      label: 'Compare with selected',
      icon: 'lucideGitCompareArrows',
      disabled: ctx.selectionCount !== 2,
      disabledReason:
        ctx.selectionCount === 2 ? undefined : 'Select exactly two commits',
    },
    {
      id: 'copy-sha',
      label: 'Copy SHA',
      icon: 'lucideCopy',
      shortcut: 'mod+c',
      separatorBefore: true,
    },
    {
      id: 'copy-short-sha',
      label: `Copy short SHA (${ctx.shortSha})`,
      icon: 'lucideCopy',
    },
    { id: 'copy-message', label: 'Copy message', icon: 'lucideClipboard' },
    {
      id: 'open-remote',
      label: 'Open on remote',
      icon: 'lucideExternalLink',
      separatorBefore: true,
      disabled: !ctx.hasRemoteUrl,
      disabledReason: ctx.hasRemoteUrl ? undefined : NO_REMOTE_URL_HINT,
    },
    {
      id: 'copy-url',
      label: 'Copy commit URL',
      icon: 'lucideLink',
      disabled: !ctx.hasRemoteUrl,
      disabledReason: ctx.hasRemoteUrl ? undefined : NO_REMOTE_URL_HINT,
    },
  ];
}
