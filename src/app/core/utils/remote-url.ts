export type RemoteProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

export interface RemoteRef {
  provider: RemoteProvider;
  host: string;
  /** Everything between the host and the repository name, may contain `/`. */
  owner: string;
  repo: string;
  /** Canonical `https://host/owner/repo` browse URL. */
  webUrl: string;
}

/**
 * Parses the three remote URL shapes git accepts.
 *
 *   `git@github.com:owner/repo.git`
 *   `ssh://git@github.com:22/owner/repo.git`
 *   `https://github.com/owner/repo.git`
 *
 * Returns `null` for anything else (local paths, unsupported transports).
 */
export function parseRemoteUrl(url: string): RemoteRef | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  const scpLike = /^[\w.-]+@([^:/]+):(.+)$/.exec(trimmed);
  const parts = scpLike
    ? { host: scpLike[1] ?? '', path: scpLike[2] ?? '' }
    : fromUrl(trimmed);
  if (!parts) return null;

  const segments = parts.path
    .replace(/\.git$/i, '')
    .split('/')
    .filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  const repo = segments[segments.length - 1] ?? '';
  const owner = segments.slice(0, -1).join('/');
  const host = parts.host.toLowerCase();

  return {
    provider: providerFor(host),
    host,
    owner,
    repo,
    webUrl: `https://${host}/${owner}/${repo}`,
  };
}

/** Browse URL for one commit. */
export function commitUrl(remote: RemoteRef, sha: string): string {
  switch (remote.provider) {
    case 'gitlab':
      return `${remote.webUrl}/-/commit/${sha}`;
    case 'bitbucket':
      return `${remote.webUrl}/commits/${sha}`;
    default:
      return `${remote.webUrl}/commit/${sha}`;
  }
}

/** Browse URL for a branch's file tree. */
export function branchUrl(remote: RemoteRef, branch: string): string {
  const ref = encodeURIComponent(branch);
  switch (remote.provider) {
    case 'gitlab':
      return `${remote.webUrl}/-/tree/${ref}`;
    case 'bitbucket':
      return `${remote.webUrl}/src/${ref}`;
    default:
      return `${remote.webUrl}/tree/${ref}`;
  }
}

/** URL that opens the "new pull/merge request" form for `branch`. */
export function pullRequestUrl(remote: RemoteRef, branch: string): string {
  const ref = encodeURIComponent(branch);
  switch (remote.provider) {
    case 'gitlab':
      return `${remote.webUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${ref}`;
    case 'bitbucket':
      return `${remote.webUrl}/pull-requests/new?source=${ref}`;
    default:
      return `${remote.webUrl}/compare/${ref}?expand=1`;
  }
}

function fromUrl(raw: string): { host: string; path: string } | null {
  try {
    const parsed = new URL(raw);
    if (!/^(https?|ssh|git):$/.test(parsed.protocol)) return null;
    return { host: parsed.hostname, path: parsed.pathname };
  } catch {
    return null;
  }
}

function providerFor(host: string): RemoteProvider {
  if (host.includes('github')) return 'github';
  if (host.includes('gitlab')) return 'gitlab';
  if (host.includes('bitbucket')) return 'bitbucket';
  return 'unknown';
}
