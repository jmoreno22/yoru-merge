import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  untracked,
} from '@angular/core';
import type { ResetMode } from '../../../core/models';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import {
  type DragDropEvent,
  DragPayloadService,
} from '../../../core/services/drag-payload.service';
import { shortSha } from '../../../core/utils';
import { InteractiveRebaseService } from '../../../features/commit-inspector/interactive-rebase.service';
import { DialogsService } from '../../../features/dialogs/dialogs.service';
import { ContextMenuService } from '../../ui';
import { CheckoutFlow } from '../sidebar/checkout-flow.service';
import { dropMenuItems } from './drop-actions';

/**
 * Turns a completed drag-and-drop into the menu of what that gesture can do.
 *
 * It renders nothing of its own: the menu is the app's single
 * `ContextMenuService`, so a drop and a right-click look and behave the same.
 * The element exists only as the mount point that keeps this listener alive
 * for as long as the shell is on screen.
 */
@Component({
  selector: 'app-drop-action-menu',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropActionMenu {
  private readonly drags = inject(DragPayloadService);
  private readonly menu = inject(ContextMenuService);
  private readonly repo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly flow = inject(CheckoutFlow);
  private readonly interactiveRebase = inject(InteractiveRebaseService);

  constructor() {
    effect(() => {
      const drop = this.drags.pendingDrop();
      if (drop) untracked(() => void this.open(drop));
    });
  }

  private async open(drop: DragDropEvent): Promise<void> {
    try {
      const items = dropMenuItems(drop.source, drop.target, {
        currentBranch: this.repo.currentBranch(),
      });
      if (items.length === 0) return;
      const choice = await this.menu.open(items, {
        x: drop.event.clientX,
        y: drop.event.clientY,
      });
      if (choice !== null) await this.run(drop, choice);
    } finally {
      this.drags.clearPendingDrop();
    }
  }

  private async run(drop: DragDropEvent, choice: string): Promise<void> {
    const { source, target } = drop;

    if (choice === 'merge' && source.type === 'branch' && target.type === 'branch') {
      // The label promises the switch, so it has to happen before the merge —
      // git always merges into HEAD.
      if (await this.flow.ensureOn(target.name)) {
        await this.repo.mergeBranchAction(source.name);
      }
      return;
    }

    if (choice === 'rebase' && source.type === 'branch' && target.type === 'branch') {
      await this.repo.rebaseBranchAction(source.name, target.name);
      return;
    }

    if (choice === 'cherry-pick' && source.type === 'commit') {
      const branch = target.type === 'branch' ? target.name : this.repo.currentBranch();
      if (branch) await this.repo.cherryPickOntoAction(source.sha, branch);
      return;
    }

    const sha = commitSha(drop);
    const branch = currentBranchName(drop);
    if (sha === null || branch === null) return;

    if (choice === 'interactive-rebase') {
      this.interactiveRebase.open(sha);
      return;
    }
    const mode = resetMode(choice);
    if (mode !== null) await this.reset(sha, branch, mode);
  }

  private async reset(sha: string, branch: string, mode: ResetMode): Promise<void> {
    if (mode === 'hard') {
      const confirmed = await this.dialogs.confirm({
        title: `Reset ${branch} to ${shortSha(sha)}`,
        body: `${branch} moves to ${shortSha(sha)} and every uncommitted change in the working tree is discarded. There is no undo.`,
        confirmLabel: 'Hard reset',
        tone: 'danger',
        doubleConfirm: true,
        skippable: true,
      });
      if (!confirmed) return;
    }
    await this.repo.resetToCommitAction(sha, mode);
  }
}

/** The commit of a branch/commit pair, whichever side it was dropped from. */
function commitSha(drop: DragDropEvent): string | null {
  if (drop.source.type === 'commit' && drop.target.type === 'branch') {
    return drop.source.sha;
  }
  if (drop.source.type === 'branch' && drop.target.type === 'commit') {
    return drop.target.sha;
  }
  return null;
}

/** The branch of that same pair; reset and interactive rebase move it. */
function currentBranchName(drop: DragDropEvent): string | null {
  if (drop.source.type === 'branch') return drop.source.name;
  return drop.target.type === 'branch' ? drop.target.name : null;
}

function resetMode(choice: string): ResetMode | null {
  switch (choice) {
    case 'reset-soft':
      return 'soft';
    case 'reset-mixed':
      return 'mixed';
    case 'reset-hard':
      return 'hard';
    default:
      return null;
  }
}
