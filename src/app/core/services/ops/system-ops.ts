import { Injectable, inject } from '@angular/core';
import { PreferencesService } from '../preferences.service';
import { OpsRunner } from './ops-runner';

/** Handing a path to the OS: file manager, terminal, editor. */
@Injectable({ providedIn: 'root' })
export class SystemOps {
  private readonly ops = inject(OpsRunner);
  private readonly prefs = inject(PreferencesService);

  /** Reveals a file in the OS file manager, or opens a directory. */
  async reveal(target: string): Promise<void> {
    await this.ops.run(() => this.ops.git.openInFileManager(target), undefined, {
      failure: 'Could not open the file manager',
    });
  }

  /** Uses the configured terminal, falling back to the OS default. */
  async openTerminal(dir: string): Promise<void> {
    const terminal = this.prefs.terminal().trim();
    await this.ops.run(
      () => this.ops.git.openInTerminal(dir, terminal.length > 0 ? terminal : null),
      undefined,
      { failure: 'Could not open a terminal' },
    );
  }

  /**
   * Opens a web URL in the default browser — the "open on remote" actions.
   * Build the URL with the helpers in `core/utils/remote-url`.
   */
  async openUrl(url: string): Promise<void> {
    if (url.trim().length === 0) return;
    await this.ops.run(() => this.ops.git.openUrl(url), undefined, {
      failure: 'Could not open the link',
    });
  }

  /** Uses the configured editor, falling back to the OS default. */
  async openEditor(target: string): Promise<void> {
    const editor = this.prefs.externalEditor().trim();
    await this.ops.run(
      () => this.ops.git.openInEditor(target, editor.length > 0 ? editor : null),
      undefined,
      { failure: 'Could not open the editor' },
    );
  }
}
