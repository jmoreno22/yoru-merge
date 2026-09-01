/** Git config values surfaced in Settings (output of `get_repo_config`). */
export interface RepoConfig {
  user_name: string | null;
  user_email: string | null;
  global_user_name: string | null;
  global_user_email: string | null;
  pull_rebase: boolean | null;
  gpg_sign: boolean;
  signing_format: string | null;
  default_branch: string | null;
  autocrlf: string | null;
  /**
   * `yoru.ai`: the per-repository AI opt-out. `null` when unset (allowed),
   * `false` when this repository refuses to have its diffs sent to a provider.
   */
  ai_enabled: boolean | null;
}

/** Keys `set_config_value` accepts; anything else is rejected by the backend. */
export const WRITABLE_CONFIG_KEYS = [
  'user.name',
  'user.email',
  'pull.rebase',
  'commit.gpgsign',
  'gpg.format',
  'init.defaultBranch',
  'core.autocrlf',
  'fetch.prune',
  'yoru.ai',
] as const;

export type WritableConfigKey = (typeof WRITABLE_CONFIG_KEYS)[number];
