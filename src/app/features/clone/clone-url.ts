/**
 * Clone source validation and destination-name derivation.
 *
 * Pure so the dialog can validate on every keystroke without touching git, and
 * so the accepted shapes are pinned by a spec instead of by a regex nobody
 * dares to change.
 */

/** `https://`, `http://`, `ssh://`, `git://`, `file://`. */
const WITH_SCHEME = /^(https?|ssh|git|file):\/\/(.+)$/i;
/** `git@github.com:owner/repo.git` — the shape ssh remotes are usually copied in. */
const SCP_LIKE = /^[\w.+-]+@[\w.-]+:(.+)$/;
const WINDOWS_PATH = /^[a-zA-Z]:[/\\].+/;
const POSIX_PATH = /^\/.+/;

/**
 * Whether git would accept `value` as a clone source.
 *
 * Local paths count: cloning a sibling checkout is a normal desktop workflow
 * and is what `file://` means anyway.
 */
export function isValidCloneUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || /\s/.test(url)) return false;

  const scheme = WITH_SCHEME.exec(url);
  if (scheme) {
    const rest = scheme[2] ?? '';
    // file:// carries only a path; every other scheme needs host + path.
    if ((scheme[1] ?? '').toLowerCase() === 'file') return rest.length > 0;
    return /^[^/]+\/.+/.test(rest);
  }

  const scp = SCP_LIKE.exec(url);
  if (scp) return (scp[1] ?? '').length > 0;

  return WINDOWS_PATH.test(url) || POSIX_PATH.test(url);
}

/**
 * The folder git itself would create for `value`: last path segment without
 * `.git`. Returns `''` when nothing sensible can be derived, so the caller can
 * leave the destination field alone.
 */
export function folderNameFromUrl(value: string): string {
  const url = value.trim().replace(/[/\\]+$/, '');
  if (url.length === 0) return '';
  const withoutQuery = url.split(/[?#]/)[0] ?? '';
  const segments = withoutQuery.split(/[/\\:]/).filter((s) => s.length > 0);
  const last = segments[segments.length - 1] ?? '';
  return last.replace(/\.git$/i, '');
}

/** Joins a parent folder and a repository name with the separator already in use. */
export function joinPath(parent: string, name: string): string {
  const base = parent.replace(/[/\\]+$/, '');
  if (base.length === 0) return name;
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  return `${base}${separator}${name}`;
}
