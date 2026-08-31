import { Injectable, inject, signal } from '@angular/core';
import type { RepoConfig, WritableConfigKey } from '../../models';
import type { RepoState } from '../workspace.store';
import { OpsRunner } from './ops-runner';

/**
 * Reading and writing the git config keys exposed in Settings.
 *
 * The global config is held here rather than on `RepoState`: Settings must
 * work with no repository open, and there is only one global config per user.
 */
@Injectable({ providedIn: 'root' })
export class ConfigOps {
  private readonly ops = inject(OpsRunner);

  private readonly _globalConfig = signal<RepoConfig | null>(null);
  private readonly _globalBusy = signal(false);

  readonly globalConfig = this._globalConfig.asReadonly();
  readonly globalBusy = this._globalBusy.asReadonly();

  /** Repository config (includes the global values as fallbacks). */
  async load(state: RepoState): Promise<void> {
    const repo = state.repo();
    if (!repo) return;
    const config = await this.ops.run(
      () => this.ops.git.getRepoConfig(repo.path),
      null,
      { busy: [state.configBusy], failure: 'Could not read the git config' },
    );
    if (config) state.config.set(config);
  }

  /** Global config only; works with no repository open. */
  async loadGlobal(): Promise<void> {
    const config = await this.ops.run(() => this.ops.git.getRepoConfig(), null, {
      busy: [this._globalBusy],
      failure: 'Could not read the global git config',
    });
    if (config) this._globalConfig.set(config);
  }

  /**
   * Writes one key. `global` targets the user's config instead of the repo's;
   * a `null` value unsets the key.
   */
  async set(
    state: RepoState,
    key: WritableConfigKey,
    value: string | null,
    global = false,
  ): Promise<boolean> {
    const repo = state.repo();
    if (!global && !repo) return false;
    const target = global ? null : (repo?.path ?? null);
    const ok = await this.ops.run(
      async () => {
        await this.ops.git.setConfigValue(target, key, value);
        return true;
      },
      false,
      { busy: [state.configBusy], failure: `Could not set ${key}` },
    );
    if (!ok) return false;
    if (repo) await this.load(state);
    if (global) await this.loadGlobal();
    return true;
  }

  /** Writes a global key with no repository open. */
  async setGlobal(key: WritableConfigKey, value: string | null): Promise<boolean> {
    const ok = await this.ops.run(
      async () => {
        await this.ops.git.setConfigValue(null, key, value);
        return true;
      },
      false,
      { busy: [this._globalBusy], failure: `Could not set ${key}` },
    );
    if (ok) await this.loadGlobal();
    return ok;
  }
}
