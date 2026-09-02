import { Injectable, inject } from '@angular/core';
import { OpsRunner } from './ops-runner';

/**
 * Handing a path to the OS: file manager, terminal, editor.
 *
 * Only the target travels. Which terminal and which editor to start are read
 * from the store by the backend, so nothing running here can pick the program.
 */
@Injectable({ providedIn: 'root' })
export class SystemOps {
  private readonly ops = inject(OpsRunner);

  /** Reveals a file in the OS file manager, or opens a directory. */
  async reveal(target: string): Promise<void> {
    await this.ops.run(() => this.ops.git.openInFileManager(target), undefined, {
      failure: 'Could not open the file manager',
    });
  }

  /** Uses the configured terminal, falling back to the OS default. */
  async openTerminal(dir: string): Promise<void> {
    await this.ops.run(() => this.ops.git.openInTerminal(dir), undefined, {
      failure: 'Could not open a terminal',
    });
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

  /**
   * Uses the configured editor. With none available the backend reveals the
   * file in its folder rather than handing it to the program its extension is
   * associated with.
   */
  async openEditor(target: string): Promise<void> {
    await this.ops.run(() => this.ops.git.openInEditor(target), undefined, {
      failure: 'Could not open the editor',
    });
  }
}
