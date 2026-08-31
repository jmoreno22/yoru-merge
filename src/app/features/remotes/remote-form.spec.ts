import { describe, expect, it } from 'vitest';
import { isValidRemoteName, isValidRemoteUrl } from './remote-form';

describe('isValidRemoteName', () => {
  it('accepts the names git accepts', () => {
    expect(isValidRemoteName('origin')).toBe(true);
    expect(isValidRemoteName('up-stream')).toBe(true);
    expect(isValidRemoteName('fork.2')).toBe(true);
  });

  it('rejects empty, spaced, slashed and .lock names', () => {
    expect(isValidRemoteName('')).toBe(false);
    expect(isValidRemoteName('   ')).toBe(false);
    expect(isValidRemoteName('my remote')).toBe(false);
    expect(isValidRemoteName('team/fork')).toBe(false);
    expect(isValidRemoteName('-origin')).toBe(false);
    expect(isValidRemoteName('origin.lock')).toBe(false);
  });
});

describe('isValidRemoteUrl', () => {
  it('accepts every transport git supports', () => {
    expect(isValidRemoteUrl('https://github.com/user/repo.git')).toBe(true);
    expect(isValidRemoteUrl('ssh://git@host:22/team/repo.git')).toBe(true);
    expect(isValidRemoteUrl('git://host/user/repo.git')).toBe(true);
    expect(isValidRemoteUrl('git@github.com:user/repo.git')).toBe(true);
    expect(isValidRemoteUrl('file:///home/jhoan/repos/yoru')).toBe(true);
    expect(isValidRemoteUrl('C:\\repos\\yoru')).toBe(true);
    expect(isValidRemoteUrl('/home/jhoan/repos/yoru')).toBe(true);
  });

  it('rejects incomplete or malformed URLs', () => {
    expect(isValidRemoteUrl('')).toBe(false);
    expect(isValidRemoteUrl('github.com/user/repo')).toBe(false);
    expect(isValidRemoteUrl('https://github.com')).toBe(false);
    expect(isValidRemoteUrl('https://host/user repo.git')).toBe(false);
    expect(isValidRemoteUrl('git@github.com:')).toBe(false);
  });
});
