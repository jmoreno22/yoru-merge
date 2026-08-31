import { Injectable, inject, type WritableSignal } from '@angular/core';
import {
  AUTH_REQUIRED_TOAST,
  isAuthErrorMessage,
  messageFromUnknown,
} from '../git-auth-error';
import { TauriGitService } from '../tauri-git.service';
import { ToastService } from '../toast.service';

export interface RunOptions {
  /**
   * Flags raised while the action runs. If any is already set the action is
   * skipped — this is what keeps a second click from racing the first.
   */
  busy?: readonly WritableSignal<boolean>[];
  /** Signal that receives the message when the action throws. */
  errorSignal?: WritableSignal<string | null>;
  /** Context prefix for the failure toast, e.g. `Push failed`. */
  failure?: string;
  /** Toast shown when the action completes without throwing. */
  success?: string;
}

/**
 * Shared plumbing for the domain op services: the IPC bridge, the toast
 * surface, and one guarded runner so every mutating action behaves the same
 * (busy flag, error signal, user-readable toast).
 */
@Injectable({ providedIn: 'root' })
export class OpsRunner {
  readonly git = inject(TauriGitService);
  readonly toast = inject(ToastService);

  async run<T>(
    action: () => Promise<T>,
    fallback: T,
    options: RunOptions = {},
  ): Promise<T> {
    const busy = options.busy ?? [];
    if (busy.some((flag) => flag())) return fallback;
    for (const flag of busy) flag.set(true);
    options.errorSignal?.set(null);
    try {
      const result = await action();
      if (options.success) this.toast.success(options.success);
      return result;
    } catch (error: unknown) {
      this.reportError(error, options.failure, options.errorSignal);
      return fallback;
    } finally {
      for (const flag of busy) flag.set(false);
    }
  }

  /**
   * Turns any thrown value into a user-readable message: stores it in
   * `errorSignal` when given and raises a toast. Auth failures collapse into a
   * single de-duplicated toast that explains what to configure.
   */
  reportError(
    error: unknown,
    failure?: string,
    errorSignal?: WritableSignal<string | null>,
  ): string {
    const message = messageFromUnknown(error);
    errorSignal?.set(message);
    if (isAuthErrorMessage(message)) {
      this.toast.show({
        kind: 'error',
        message: AUTH_REQUIRED_TOAST,
        key: 'git-auth',
        timeoutMs: 10000,
      });
    } else {
      this.toast.show({
        kind: 'error',
        message: failure ? `${failure}: ${message}` : message,
      });
    }
    return message;
  }
}
