import { Injectable, inject } from '@angular/core';
import { PreferencesService } from '../preferences.service';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';

/**
 * Drafting a commit message with the user's own AI CLI.
 *
 * Thin on purpose: the provider command, the diff budget and the timeout all
 * come from preferences, and everything that could go wrong is the backend's to
 * explain — this only decides whether there is anything to ask for.
 */
@Injectable({ providedIn: 'root' })
export class AiOps {
  private readonly ops = inject(OpsRunner);
  private readonly prefs = inject(PreferencesService);

  /**
   * Whether a draft can be requested at all: the feature is on, a provider is
   * configured, and this repository has not opted out via `yoru.ai`.
   *
   * The repository's own setting wins over the app preference, and the backend
   * checks it again — a promise kept only by a hidden button is not one.
   */
  isAvailable(state: RepoState): boolean {
    return (
      this.prefs.aiEnabled() &&
      this.prefs.aiProvider().trim().length > 0 &&
      state.config()?.ai_enabled !== false
    );
  }

  /**
   * Asks the provider for a message for whatever is staged.
   *
   * Returns `null` when it could not be produced; the failure has already been
   * reported as a toast by then, so the caller only has to leave the composer
   * as the user left it.
   */
  async draftCommitMessage(state: RepoState): Promise<string | null> {
    const repo = state.repo();
    if (!repo || !this.isAvailable(state)) return null;

    return this.ops.run(
      () =>
        this.ops.git.generateCommitMessage(repo.path, this.prefs.aiProvider().trim(), {
          instructions: this.prefs.aiInstructions(),
          maxDiffKb: this.prefs.aiMaxDiffKb(),
          timeoutSecs: this.prefs.aiTimeoutSeconds(),
        }),
      null,
      { busy: [state.aiBusy], failure: 'Could not draft a commit message' },
    );
  }
}
