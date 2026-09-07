import type { TauriGitService } from '../app/core/services/tauri-git.service';

export interface TauriGitCall {
  readonly command: string;
  readonly args: readonly unknown[];
}

export interface TauriGitStub {
  /** Stands in for the real service in a `TestBed` provider. */
  readonly service: TauriGitService;
  /** Every command the component asked for, in order. */
  readonly calls: readonly TauriGitCall[];
  /** Command name → the value its call resolves with; edit it between steps. */
  readonly responses: Record<string, unknown>;
}

/**
 * Properties the runtime probes on any object it is handed: Angular calls
 * `ngOnDestroy` on a provider while tearing the injector down, and `await`
 * reads `then`. Neither is a command, so the proxy answers `undefined` and
 * lets both probes conclude the stub does not implement them.
 */
const PROBED_PROPERTIES = new Set(['ngOnDestroy', 'then']);

/**
 * `TauriGitService` is the app's only typed `invoke` wrapper, and each of its
 * methods is the camelCase spelling of the snake_case command it invokes, so a
 * spec can stub the whole IPC boundary by command name. A command with no
 * entry in `responses` rejects rather than resolving `undefined`, so a missing
 * stub surfaces as a missing stub instead of as a null-ish value deep inside
 * the component.
 */
export function createTauriGitStub(
  responses: Record<string, unknown> = {},
): TauriGitStub {
  const calls: TauriGitCall[] = [];

  const service = new Proxy({} as TauriGitService, {
    get(_target, property) {
      if (typeof property !== 'string' || PROBED_PROPERTIES.has(property)) {
        return undefined;
      }
      const command = property.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

      return (...args: unknown[]) => {
        calls.push({ command, args });
        return Object.hasOwn(responses, command)
          ? Promise.resolve(responses[command])
          : Promise.reject(new Error(`No canned response for '${command}'.`));
      };
    },
  });

  return { service, calls, responses };
}
