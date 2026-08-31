import { describe, expect, it } from 'vitest';
import { folderNameFromUrl, isValidCloneUrl, joinPath } from './clone-url';

describe('isValidCloneUrl', () => {
  it('accepts the shapes git accepts', () => {
    expect(isValidCloneUrl('https://github.com/user/repo.git')).toBe(true);
    expect(isValidCloneUrl('http://host.local/team/repo')).toBe(true);
    expect(isValidCloneUrl('ssh://git@github.com:22/user/repo.git')).toBe(true);
    expect(isValidCloneUrl('git://host/user/repo.git')).toBe(true);
    expect(isValidCloneUrl('file:///home/jhoan/repos/yoru')).toBe(true);
    expect(isValidCloneUrl('git@github.com:user/repo.git')).toBe(true);
    expect(isValidCloneUrl('C:/repos/yoru')).toBe(true);
    expect(isValidCloneUrl('/home/jhoan/repos/yoru')).toBe(true);
  });

  it('rejects incomplete or malformed sources', () => {
    expect(isValidCloneUrl('')).toBe(false);
    expect(isValidCloneUrl('   ')).toBe(false);
    expect(isValidCloneUrl('github.com/user/repo')).toBe(false);
    expect(isValidCloneUrl('https://github.com')).toBe(false);
    expect(isValidCloneUrl('https://github.com/user repo.git')).toBe(false);
    expect(isValidCloneUrl('git@github.com:')).toBe(false);
    expect(isValidCloneUrl('repo')).toBe(false);
  });
});

describe('folderNameFromUrl', () => {
  it('derives the folder git would create', () => {
    expect(folderNameFromUrl('https://github.com/user/repo.git')).toBe('repo');
    expect(folderNameFromUrl('git@github.com:user/repo.git')).toBe('repo');
    expect(folderNameFromUrl('ssh://git@host:22/team/sub/repo')).toBe('repo');
    expect(folderNameFromUrl('https://github.com/user/repo/')).toBe('repo');
    expect(folderNameFromUrl('C:\\repos\\yoru-merge')).toBe('yoru-merge');
    expect(folderNameFromUrl('')).toBe('');
  });

  it('keeps a dot that is not the .git suffix', () => {
    expect(folderNameFromUrl('https://github.com/user/repo.js.git')).toBe('repo.js');
  });
});

describe('joinPath', () => {
  it('keeps the separator style of the parent', () => {
    expect(joinPath('C:\\repos', 'yoru')).toBe('C:\\repos\\yoru');
    expect(joinPath('/home/jhoan/repos/', 'yoru')).toBe('/home/jhoan/repos/yoru');
    expect(joinPath('', 'yoru')).toBe('yoru');
  });
});
