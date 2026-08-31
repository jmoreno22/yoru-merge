/**
 * Validation for the "add remote" form.
 *
 * Pure so the dialog can validate on every keystroke, and so the shapes git
 * accepts are pinned by a spec rather than by a regex nobody dares to touch.
 */

/** git refuses names with whitespace, `/`, or its ref punctuation. */
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const WITH_SCHEME = /^(https?|ssh|git|file):\/\/(.+)$/i;
const SCP_LIKE = /^[\w.+-]+@[\w.-]+:(.+)$/;
const WINDOWS_PATH = /^[a-zA-Z]:[/\\].+/;
const POSIX_PATH = /^\/.+/;

export function isValidRemoteName(value: string): boolean {
  const name = value.trim();
  return name.length > 0 && REMOTE_NAME.test(name) && !name.endsWith('.lock');
}

/** Whether git would accept `value` as a remote URL. Local paths count. */
export function isValidRemoteUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || /\s/.test(url)) return false;

  const scheme = WITH_SCHEME.exec(url);
  if (scheme) {
    const rest = scheme[2] ?? '';
    if ((scheme[1] ?? '').toLowerCase() === 'file') return rest.length > 0;
    return /^[^/]+\/.+/.test(rest);
  }

  const scp = SCP_LIKE.exec(url);
  if (scp) return (scp[1] ?? '').length > 0;

  return WINDOWS_PATH.test(url) || POSIX_PATH.test(url);
}
