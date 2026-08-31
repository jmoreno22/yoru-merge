import { describe, expect, it } from 'vitest';
import {
  branchUrl,
  commitUrl,
  parseRemoteUrl,
  pullRequestUrl,
  type RemoteRef,
} from './remote-url';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

function parse(url: string): RemoteRef {
  const parsed = parseRemoteUrl(url);
  if (!parsed) throw new Error(`expected ${url} to parse`);
  return parsed;
}

describe('parseRemoteUrl', () => {
  it('parses scp-like SSH remotes', () => {
    expect(parse('git@github.com:jhoan/yoru-merge.git')).toMatchObject({
      provider: 'github',
      host: 'github.com',
      owner: 'jhoan',
      repo: 'yoru-merge',
      webUrl: 'https://github.com/jhoan/yoru-merge',
    });
  });

  it('parses https remotes with and without the .git suffix', () => {
    expect(parse('https://gitlab.com/group/sub/app.git').owner).toBe('group/sub');
    expect(parse('https://gitlab.com/group/sub/app').repo).toBe('app');
  });

  it('parses ssh:// remotes with a port', () => {
    expect(parse('ssh://git@bitbucket.org:22/team/repo.git')).toMatchObject({
      provider: 'bitbucket',
      owner: 'team',
      repo: 'repo',
    });
  });

  it('detects self-hosted instances by hostname', () => {
    expect(parse('https://gitlab.acme.dev/team/app.git').provider).toBe('gitlab');
    expect(parse('https://git.acme.dev/team/app.git').provider).toBe('unknown');
  });

  it('rejects what it cannot turn into a browse URL', () => {
    expect(parseRemoteUrl('')).toBeNull();
    expect(parseRemoteUrl('/srv/git/repo.git')).toBeNull();
    expect(parseRemoteUrl('https://github.com/onlyowner')).toBeNull();
  });
});

describe('url builders', () => {
  it('builds GitHub URLs', () => {
    const remote = parse('git@github.com:jhoan/yoru-merge.git');
    expect(commitUrl(remote, SHA)).toBe(
      `https://github.com/jhoan/yoru-merge/commit/${SHA}`,
    );
    expect(branchUrl(remote, 'feat/x')).toBe(
      'https://github.com/jhoan/yoru-merge/tree/feat%2Fx',
    );
    expect(pullRequestUrl(remote, 'feat/x')).toBe(
      'https://github.com/jhoan/yoru-merge/compare/feat%2Fx?expand=1',
    );
  });

  it('builds GitLab URLs with the /-/ infix', () => {
    const remote = parse('https://gitlab.com/team/app.git');
    expect(commitUrl(remote, SHA)).toBe(`https://gitlab.com/team/app/-/commit/${SHA}`);
    expect(branchUrl(remote, 'main')).toBe('https://gitlab.com/team/app/-/tree/main');
    expect(pullRequestUrl(remote, 'main')).toContain('/-/merge_requests/new?');
  });

  it('builds Bitbucket URLs', () => {
    const remote = parse('https://bitbucket.org/team/app.git');
    expect(commitUrl(remote, SHA)).toBe(
      `https://bitbucket.org/team/app/commits/${SHA}`,
    );
    expect(branchUrl(remote, 'main')).toBe('https://bitbucket.org/team/app/src/main');
    expect(pullRequestUrl(remote, 'main')).toBe(
      'https://bitbucket.org/team/app/pull-requests/new?source=main',
    );
  });
});
