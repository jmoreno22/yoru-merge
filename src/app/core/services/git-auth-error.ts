export const AUTH_REQUIRED_TOAST =
  'Authentication required. Configure credentials in your system Git credential helper (Git Credential Manager/keychain), then retry.';

/**
 * Matches only the messages git itself prints when credentials are missing or
 * rejected. Keep it narrow: a broad match turns unrelated failures (a repo
 * whose path contains "credentials", say) into a misleading auth prompt.
 */
const AUTH_ERROR_PATTERN =
  /Authentication failed|could not read Username|Permission denied \(publickey\)|terminal prompts disabled|HTTP 401|HTTP 403|invalid credentials/i;

export function isAuthErrorMessage(message: string): boolean {
  return AUTH_ERROR_PATTERN.test(message);
}

export function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when `open_repo` failed because the path is gone or is not a repo. */
export function isRepoMissingMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('path does not exist') || lower.includes('not a git repository')
  );
}
