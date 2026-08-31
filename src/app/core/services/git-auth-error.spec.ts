import { describe, expect, it } from 'vitest';
import {
  isAuthErrorMessage,
  isRepoMissingMessage,
  messageFromUnknown,
} from './git-auth-error';

describe('isAuthErrorMessage', () => {
  it('matches the messages git prints when credentials fail', () => {
    const messages = [
      'fatal: Authentication failed for https://github.com/acme/app.git',
      "could not read Username for 'https://github.com': terminal prompts disabled",
      'git@github.com: Permission denied (publickey).',
      'The requested URL returned error: HTTP 401',
      'remote: HTTP 403 forbidden',
      'invalid credentials',
    ];
    for (const message of messages) {
      expect(isAuthErrorMessage(message), message).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isAuthErrorMessage('AUTHENTICATION FAILED')).toBe(true);
  });

  it('does not fire on unrelated failures that merely mention credentials', () => {
    const messages = [
      'fatal: could not read Object',
      'error: cannot open /home/me/credentials/app/.git',
      'warning: no credential helper configured',
      'fatal: unable to access: SSL certificate problem',
      'error: pathspec permission denied',
    ];
    for (const message of messages) {
      expect(isAuthErrorMessage(message), message).toBe(false);
    }
  });
});

describe('isRepoMissingMessage', () => {
  it('matches both open_repo failure modes', () => {
    expect(isRepoMissingMessage('path does not exist')).toBe(true);
    expect(isRepoMissingMessage('fatal: not a git repository')).toBe(true);
  });

  it('ignores other failures', () => {
    expect(isRepoMissingMessage('permission denied')).toBe(false);
  });
});

describe('messageFromUnknown', () => {
  it('unwraps Error instances', () => {
    expect(messageFromUnknown(new Error('boom'))).toBe('boom');
  });

  it('stringifies anything else — Tauri rejects with plain strings', () => {
    expect(messageFromUnknown('fatal: nope')).toBe('fatal: nope');
    expect(messageFromUnknown(42)).toBe('42');
  });
});
