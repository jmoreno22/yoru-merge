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
] as const;

export type WritableConfigKey = (typeof WRITABLE_CONFIG_KEYS)[number];
