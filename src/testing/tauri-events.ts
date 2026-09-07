import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import type { RepoChangeKind } from '../app/core/models';

/**
 * Makes `listen` and `emit` of `@tauri-apps/api/event` work under jsdom.
 *
 * The backend watcher is the one input that does not come through the typed
 * `invoke` wrapper, so `TauriGitService` cannot stand in for it: the app
 * subscribes to `repo-changed` directly. `mockIPC` installs Tauri's own
 * in-page event bus in the window internals, which is what lets a spec emit
 * the event the watcher is waiting for (test-plan §Test data, component).
 *
 * Every other command keeps failing the way it does outside a Tauri window:
 * answering `undefined` would let a spec pass on a bridge call nobody stubbed.
 */
export function installTauriEventBridge(): void {
  mockIPC(
    (command: string) => {
      throw new Error(`No Tauri bridge for '${command}' in a component spec.`);
    },
    { shouldMockEvents: true },
  );
}

/** Delivers one backend `repo-changed` event to whoever subscribed. */
export function emitRepoChanged(path: string, kind: RepoChangeKind): Promise<void> {
  return emit('repo-changed', { path, kind });
}

/** Takes the bridge back out; call it from `afterEach`. */
export function restoreTauriEventBridge(): void {
  clearMocks();
}
