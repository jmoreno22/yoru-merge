import { ApplicationRef, EnvironmentInjector, Injectable, inject } from '@angular/core';
import type { CheckoutResult } from '../../../core/models';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { type CheckoutChoice, CheckoutDirtyDialog } from './checkout-dirty-dialog';
import { openOverlay } from './overlay';

/**
 * Checkout with the dirty-tree question attached.
 *
 * `checkoutBranchAction` deliberately returns `would_overwrite` instead of
 * toasting it, because only the UI can offer the two ways out. Every path that
 * switches branches — a row, a menu item, a drop — goes through here so the
 * question is asked exactly once and always the same way.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlow {
  private readonly repo = inject(CurrentRepoService);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  async checkout(
    branch: string,
    createTracking = false,
  ): Promise<CheckoutResult | null> {
    const first = await this.repo.checkoutBranchAction(branch, createTracking, false);
    if (first?.kind !== 'would_overwrite') return first;

    const choice = await this.ask(branch, first.files);
    if (choice === 'cancel') return first;

    if (choice === 'stash') {
      const stashed = await this.repo.stashSaveAction(
        `WIP before switching to ${branch}`,
        { includeUntracked: true },
      );
      if (!stashed) return first;
      return this.repo.checkoutBranchAction(branch, createTracking, false);
    }
    return this.repo.checkoutBranchAction(branch, createTracking, true);
  }

  /** True when HEAD ends up on `branch`, including when it already was. */
  async ensureOn(branch: string): Promise<boolean> {
    if (this.repo.currentBranch() === branch) return true;
    const result = await this.checkout(branch);
    return result?.kind === 'success' || result?.kind === 'detached_head';
  }

  private ask(branch: string, files: readonly string[]): Promise<CheckoutChoice> {
    return openOverlay<CheckoutDirtyDialog, CheckoutChoice>(
      this.appRef,
      this.environmentInjector,
      CheckoutDirtyDialog,
      (ref, settle) => {
        ref.setInput('branch', branch);
        ref.setInput('files', files);
        ref.instance.chose.subscribe((choice: CheckoutChoice) => settle(choice));
      },
    );
  }
}
