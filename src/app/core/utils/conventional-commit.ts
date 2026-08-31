/** The types offered by the commit composer, in menu order. */
export const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const;

export type ConventionalType = (typeof CONVENTIONAL_TYPES)[number];

export interface ConventionalCommit {
  type: string;
  scope: string | null;
  /** `feat!:` or a `BREAKING CHANGE:` footer. */
  breaking: boolean;
  subject: string;
  /** Everything after the blank line following the subject. */
  body: string;
}

const HEADER = /^([a-zA-Z]+)(?:\(([^)]*)\))?(!)?:[ \t]*(.*)$/;

/**
 * Parses a Conventional Commits header. Returns `null` when the message does
 * not follow the convention — the composer then leaves it alone rather than
 * reformatting a plain message into something the author did not write.
 */
export function parseConventionalCommit(message: string): ConventionalCommit | null {
  const normalized = message.replace(/\r\n/g, '\n');
  const [header = '', ...rest] = normalized.split('\n');
  const match = HEADER.exec(header.trim());
  if (!match) return null;

  const body = rest.join('\n').replace(/^\n+/, '').trimEnd();
  const scope = match[2]?.trim() ?? '';

  return {
    type: (match[1] ?? '').toLowerCase(),
    scope: scope.length > 0 ? scope : null,
    breaking: match[3] === '!' || /^BREAKING[ -]CHANGE:/m.test(body),
    subject: (match[4] ?? '').trim(),
    body,
  };
}

/** Rebuilds a message from its parts; the inverse of `parseConventionalCommit`. */
export function formatConventionalCommit(commit: ConventionalCommit): string {
  const scope = commit.scope ? `(${commit.scope})` : '';
  const bang = commit.breaking ? '!' : '';
  const header = `${commit.type}${scope}${bang}: ${commit.subject}`.trim();
  const body = commit.body.trim();
  return body.length > 0 ? `${header}\n\n${body}` : header;
}

/** First line of a commit message, for one-line surfaces. */
export function commitSubject(message: string): string {
  return message.replace(/\r\n/g, '\n').split('\n', 1)[0]?.trim() ?? '';
}
