import type { DragPayload } from '../../../core/services/drag-payload.service';
import { shortSha } from '../../../core/utils';
import type { MenuItem } from '../../ui';

/** Everything the drop menu needs to know about the repository around it. */
export interface DropMenuContext {
  readonly currentBranch: string | null;
}

const DETACHED = 'HEAD is detached — check out a branch first';

/**
 * True when dropping `source` on `target` leads somewhere.
 *
 * The drag directive asks before lighting a row up, so an impossible gesture
 * never gets an affordance promising an action the menu cannot offer.
 */
export function canDrop(source: DragPayload, target: DragPayload): boolean {
  // A remote-tracking ref cannot be moved, merged into or reset.
  if (target.type === 'branch' && target.isRemote) return false;
  if (source.type === 'branch' && target.type === 'commit') {
    // Only the branch HEAD is on can be moved to another commit.
    return source.isCurrent;
  }
  return true;
}

/**
 * The actions a completed drop offers, with labels describing what will
 * actually run.
 *
 * The labels are the point: "Merge A into B" checks B out first and says so,
 * and "Rebase A onto B" moves A rather than whatever HEAD happens to be on.
 */
export function dropMenuItems(
  source: DragPayload,
  target: DragPayload,
  context: DropMenuContext,
): MenuItem[] {
  if (source.type === 'branch' && target.type === 'branch') {
    return branchOntoBranch(source, target.name, context);
  }
  if (source.type === 'branch' && target.type === 'commit') {
    return moveCurrentBranch(source.name, target.sha);
  }
  if (source.type === 'commit' && target.type === 'branch') {
    const items = [cherryPickItem(source.sha, target.name)];
    if (target.name === context.currentBranch) {
      items.push(...moveCurrentBranch(target.name, source.sha));
    }
    return items;
  }
  if (source.type === 'commit' && target.type === 'commit') {
    return [cherryPickItem(source.sha, context.currentBranch)];
  }
  return [];
}

function branchOntoBranch(
  source: Extract<DragPayload, { type: 'branch' }>,
  target: string,
  context: DropMenuContext,
): MenuItem[] {
  return [
    {
      id: 'merge',
      label:
        target === context.currentBranch
          ? `Merge ${source.name} into ${target}`
          : `Switch to ${target}, then merge ${source.name}`,
      icon: 'lucideGitMerge',
      tone: 'primary',
    },
    {
      id: 'rebase',
      label: `Rebase ${source.name} onto ${target}`,
      icon: 'lucideGitPullRequestArrow',
      disabled: source.isRemote,
      disabledReason: 'A remote-tracking branch cannot be rebased',
    },
  ];
}

/** Reset and interactive rebase both rewrite the branch HEAD is on. */
function moveCurrentBranch(branch: string, sha: string): MenuItem[] {
  const short = shortSha(sha);
  return [
    {
      id: 'reset',
      label: `Reset ${branch} to ${short}`,
      icon: 'lucideRotateCcw',
      separatorBefore: true,
      children: [
        { id: 'reset-soft', label: 'Soft — keep the index and the working tree' },
        { id: 'reset-mixed', label: 'Mixed — keep the working tree only' },
        {
          id: 'reset-hard',
          label: 'Hard — discard every uncommitted change',
          tone: 'danger',
        },
      ],
    },
    {
      id: 'interactive-rebase',
      label: `Interactive rebase from ${short}…`,
      icon: 'lucideScissors',
    },
  ];
}

function cherryPickItem(sha: string, branch: string | null): MenuItem {
  const short = shortSha(sha);
  return {
    id: 'cherry-pick',
    label: branch ? `Cherry-pick ${short} onto ${branch}` : `Cherry-pick ${short}`,
    icon: 'lucideCherry',
    tone: 'primary',
    disabled: branch === null,
    disabledReason: DETACHED,
  };
}
