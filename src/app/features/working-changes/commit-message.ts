import {
  type ConventionalCommit,
  formatConventionalCommit,
  parseConventionalCommit,
} from '../../core/utils/conventional-commit';
import type { MenuItem } from '../../shared/ui';

/** Git's own convention: keep the subject under 50, never past 72. */
export const SUBJECT_WARN = 50;
export const SUBJECT_MAX = 72;

export type SubjectStatus = 'ok' | 'warn' | 'error';

/** What the composer is holding, before it becomes a message. */
export interface CommitDraft {
  readonly type: string;
  readonly scope: string;
  readonly breaking: boolean;
  readonly subject: string;
  readonly body: string;
}

export const EMPTY_DRAFT: CommitDraft = {
  type: '',
  scope: '',
  breaking: false,
  subject: '',
  body: '',
};

export function subjectStatus(length: number): SubjectStatus {
  if (length > SUBJECT_MAX) return 'error';
  if (length > SUBJECT_WARN) return 'warn';
  return 'ok';
}

/**
 * Length of the line git will store as the subject — the whole header, not
 * just what the user typed in the subject field: `feat(scope)!: ` counts.
 */
export function headerLength(draft: CommitDraft): number {
  return buildCommitMessage(draft).split('\n', 1)[0]?.length ?? 0;
}

/** Draft → commit message. Without a type it is left exactly as typed. */
export function buildCommitMessage(draft: CommitDraft): string {
  const subject = draft.subject.trim();
  const body = draft.body.trim();
  const type = draft.type.trim();

  if (type.length === 0) {
    return body.length > 0 ? `${subject}\n\n${body}` : subject;
  }

  const commit: ConventionalCommit = {
    type,
    scope: draft.scope.trim().length > 0 ? draft.scope.trim() : null,
    breaking: draft.breaking,
    subject,
    body,
  };
  return formatConventionalCommit(commit);
}

/**
 * The `feat(scope)!: ` git will store ahead of the subject, or `''` when no type
 * is picked and the subject is stored verbatim.
 *
 * Exists so the composer can show what the chips and the scope field actually
 * add: they sit above the subject input and their effect appears in neither.
 */
export function headerPrefix(draft: CommitDraft): string {
  const type = draft.type.trim();
  if (type.length === 0) return '';
  const scope = draft.scope.trim();
  return `${type}${scope.length > 0 ? `(${scope})` : ''}${draft.breaking ? '!' : ''}: `;
}

/** Message → draft, for Amend and for reusing a recent message. */
export function draftFromMessage(message: string): CommitDraft {
  const parsed = parseConventionalCommit(message);
  if (parsed) {
    return {
      type: parsed.type,
      scope: parsed.scope ?? '',
      breaking: parsed.breaking,
      subject: parsed.subject,
      body: parsed.body,
    };
  }

  const normalized = message.replace(/\r\n/g, '\n');
  const [subject = '', ...rest] = normalized.split('\n');
  return {
    ...EMPTY_DRAFT,
    subject: subject.trim(),
    body: rest.join('\n').replace(/^\n+/, '').trimEnd(),
  };
}

export function isDraftEmpty(draft: CommitDraft): boolean {
  return draft.subject.trim().length === 0 && draft.body.trim().length === 0;
}

/** Scopes the repository already uses, most recent first, for the datalist. */
export function recentScopes(messages: readonly string[], limit = 12): string[] {
  const scopes: string[] = [];
  for (const message of messages) {
    const scope = parseConventionalCommit(message)?.scope;
    if (!scope || scopes.includes(scope)) continue;
    scopes.push(scope);
    if (scopes.length >= limit) break;
  }
  return scopes;
}

/** Insertions / deletions of a unified diff, ignoring its file headers. */
export function countDiffStats(diff: string): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}

export interface CommitReadinessInput {
  readonly hasRepo: boolean;
  readonly busy: boolean;
  readonly amend: boolean;
  readonly stagedCount: number;
  readonly subject: string;
}

export interface CommitReadiness {
  readonly canCommit: boolean;
  /** Why the button is disabled — always shown, never left to guesswork. */
  readonly reason: string | null;
}

/**
 * An amend is allowed with nothing staged and an empty subject: the backend
 * keeps HEAD's message, which is how "amend to fix the author" is expressed.
 */
export function commitReadiness(input: CommitReadinessInput): CommitReadiness {
  if (!input.hasRepo) return { canCommit: false, reason: 'No repository open' };
  if (input.busy) return { canCommit: false, reason: 'Working…' };
  if (input.amend) return { canCommit: true, reason: null };
  if (input.stagedCount === 0) {
    return { canCommit: false, reason: 'Nothing staged' };
  }
  if (input.subject.trim().length === 0) {
    return { canCommit: false, reason: 'Write a subject' };
  }
  return { canCommit: true, reason: null };
}

export interface AmendWarningInput {
  readonly amend: boolean;
  /** Tracking branch of the current branch; `null` when it has none. */
  readonly upstream: string | null;
  readonly ahead: number;
}

/**
 * Warns that an amend would rewrite a commit the upstream already has.
 *
 * With nothing ahead of the upstream, HEAD is the commit the remote is on:
 * rewriting it makes the two histories diverge, and only a force push
 * reconciles them. Advisory only — the amend itself stays allowed.
 */
export function amendWarning(input: AmendWarningInput): string | null {
  if (!input.amend || input.upstream === null || input.ahead > 0) return null;
  return `HEAD is already on ${input.upstream} — amending will require a force push`;
}

export interface CommitMenuContext {
  readonly amend: boolean;
  readonly hasRemote: boolean;
  readonly hasUpstream: boolean;
  readonly hasCommits: boolean;
}

/** Items of the split button's caret menu. Ids are the action names. */
export function commitMenuItems(context: CommitMenuContext): MenuItem[] {
  return [
    {
      id: 'commit',
      label: context.amend ? 'Amend commit' : 'Commit',
      icon: 'lucideGitCommitHorizontal',
      tone: 'primary',
    },
    {
      id: 'commit-push',
      label: context.hasUpstream ? 'Commit & push' : 'Commit & push (set upstream)',
      icon: 'lucideCloudUpload',
      disabled: !context.hasRemote,
      disabledReason: 'This repository has no remote',
    },
    {
      id: 'commit-tag',
      label: 'Commit & create tag…',
      icon: 'lucideTag',
    },
    {
      id: 'commit-fixup',
      label: 'Commit as fixup! of…',
      icon: 'lucideScissors',
      separatorBefore: true,
      disabled: !context.hasCommits,
      disabledReason: 'No commits to fix up yet',
    },
  ];
}
