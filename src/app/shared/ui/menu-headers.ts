import type { MenuHeader } from './context-menu.model';

/** Header of a menu acting on one commit: its short sha, then its subject. */
export function commitMenuHeader(shortSha: string, subject: string): MenuHeader {
  return { title: shortSha, detail: subject, icon: 'lucideGitCommitHorizontal' };
}

/**
 * Header of a menu acting on one file: the name first, because that is what a
 * row is recognised by, and the folder as the detail that can be cut short.
 */
export function fileMenuHeader(path: string): MenuHeader {
  const cut = path.lastIndexOf('/');
  return {
    title: path.slice(cut + 1),
    detail: cut > 0 ? path.slice(0, cut) : undefined,
    icon: 'lucideFileDiff',
  };
}
