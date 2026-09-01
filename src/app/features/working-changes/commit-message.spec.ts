import { describe, expect, it } from 'vitest';
import { commitSubject } from '../../core/utils/conventional-commit';
import {
  amendWarning,
  buildCommitMessage,
  commitMenuItems,
  commitReadiness,
  countDiffStats,
  draftFromMessage,
  EMPTY_DRAFT,
  headerLength,
  headerPrefix,
  isDraftEmpty,
  recentScopes,
  SUBJECT_MAX,
  SUBJECT_WARN,
  subjectStatus,
} from './commit-message';

describe('subjectStatus', () => {
  it('warns past 50 and errors past 72', () => {
    expect(subjectStatus(SUBJECT_WARN)).toBe('ok');
    expect(subjectStatus(SUBJECT_WARN + 1)).toBe('warn');
    expect(subjectStatus(SUBJECT_MAX)).toBe('warn');
    expect(subjectStatus(SUBJECT_MAX + 1)).toBe('error');
  });
});

describe('headerPrefix', () => {
  it('is empty without a type, since the subject is then stored verbatim', () => {
    expect(headerPrefix(EMPTY_DRAFT)).toBe('');
    expect(headerPrefix({ ...EMPTY_DRAFT, subject: 'plain message' })).toBe('');
    // A scope with no type is not a header either.
    expect(headerPrefix({ ...EMPTY_DRAFT, scope: 'ai' })).toBe('');
  });

  it('carries the type, the scope and the breaking marker', () => {
    expect(headerPrefix({ ...EMPTY_DRAFT, type: 'feat' })).toBe('feat: ');
    expect(headerPrefix({ ...EMPTY_DRAFT, type: 'feat', scope: 'ai' })).toBe(
      'feat(ai): ',
    );
    expect(
      headerPrefix({ ...EMPTY_DRAFT, type: 'feat', scope: 'ai', breaking: true }),
    ).toBe('feat(ai)!: ');
    expect(headerPrefix({ ...EMPTY_DRAFT, type: 'fix', breaking: true })).toBe(
      'fix!: ',
    );
  });

  it('ignores whitespace the user is still typing', () => {
    expect(headerPrefix({ ...EMPTY_DRAFT, type: 'feat', scope: '  ai  ' })).toBe(
      'feat(ai): ',
    );
    expect(headerPrefix({ ...EMPTY_DRAFT, type: '  ' })).toBe('');
  });

  /** What it shows has to be what git will store, or it is worse than nothing. */
  it('agrees with buildCommitMessage', () => {
    for (const draft of [
      { ...EMPTY_DRAFT, type: 'feat', scope: 'ai', subject: 'draft messages' },
      { ...EMPTY_DRAFT, type: 'fix', breaking: true, subject: 'drop the old API' },
      { ...EMPTY_DRAFT, type: 'chore', subject: 'bump deps' },
    ]) {
      expect(commitSubject(buildCommitMessage(draft))).toBe(
        headerPrefix(draft) + draft.subject,
      );
    }
  });
});

describe('buildCommitMessage', () => {
  it('formats a conventional header', () => {
    expect(
      buildCommitMessage({
        ...EMPTY_DRAFT,
        type: 'feat',
        scope: 'composer',
        subject: 'add the 50/72 ruler',
      }),
    ).toBe('feat(composer): add the 50/72 ruler');
  });

  it('adds the breaking marker', () => {
    expect(
      buildCommitMessage({
        ...EMPTY_DRAFT,
        type: 'feat',
        breaking: true,
        subject: 'drop the old API',
      }),
    ).toBe('feat!: drop the old API');
  });

  it('separates the body with a blank line', () => {
    expect(
      buildCommitMessage({
        ...EMPTY_DRAFT,
        type: 'fix',
        subject: 'stop the crash',
        body: 'The watcher fired before the repo was open.',
      }),
    ).toBe('fix: stop the crash\n\nThe watcher fired before the repo was open.');
  });

  it('leaves a message without a type exactly as typed', () => {
    expect(buildCommitMessage({ ...EMPTY_DRAFT, subject: 'wip', body: 'notes' })).toBe(
      'wip\n\nnotes',
    );
  });
});

describe('headerLength', () => {
  it('counts the prefix, not just the subject field', () => {
    const draft = {
      ...EMPTY_DRAFT,
      type: 'feat',
      scope: 'composer',
      breaking: true,
      subject: 'x',
    };
    // "feat(composer)!: x"
    expect(headerLength(draft)).toBe(18);
    expect(subjectStatus(headerLength(draft))).toBe('ok');
  });

  it('reaches the error band once the header passes 72', () => {
    const draft = { ...EMPTY_DRAFT, type: 'refactor', subject: 'x'.repeat(70) };
    expect(subjectStatus(headerLength(draft))).toBe('error');
  });
});

describe('draftFromMessage', () => {
  it('round-trips a conventional message', () => {
    const message = 'fix(graph)!: keep lanes stable\n\nbody line';
    expect(buildCommitMessage(draftFromMessage(message))).toBe(message);
  });

  it('keeps a plain message in the subject and body', () => {
    expect(draftFromMessage('just a note\n\nmore')).toEqual({
      type: '',
      scope: '',
      breaking: false,
      subject: 'just a note',
      body: 'more',
    });
  });

  it('normalises CRLF', () => {
    expect(draftFromMessage('feat: a\r\n\r\nb').body).toBe('b');
  });
});

describe('isDraftEmpty', () => {
  it('ignores the type and scope', () => {
    expect(isDraftEmpty({ ...EMPTY_DRAFT, type: 'feat', scope: 'ui' })).toBe(true);
    expect(isDraftEmpty({ ...EMPTY_DRAFT, subject: 'x' })).toBe(false);
  });
});

describe('recentScopes', () => {
  it('keeps first-seen order and drops duplicates', () => {
    expect(
      recentScopes(['feat(ui): a', 'fix(core): b', 'feat(ui): c', 'chore: d']),
    ).toEqual(['ui', 'core']);
  });

  it('honours the limit', () => {
    expect(recentScopes(['feat(a): x', 'feat(b): y'], 1)).toEqual(['a']);
  });
});

describe('countDiffStats', () => {
  it('ignores the file headers', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,2 +1,2 @@',
      '-old',
      '+new',
      '+extra',
      ' context',
    ].join('\n');
    expect(countDiffStats(diff)).toEqual({ additions: 2, deletions: 1 });
  });

  it('returns zeros for an empty diff', () => {
    expect(countDiffStats('')).toEqual({ additions: 0, deletions: 0 });
  });
});

describe('commitReadiness', () => {
  const base = {
    hasRepo: true,
    busy: false,
    amend: false,
    stagedCount: 1,
    subject: 'x',
  };

  it('allows a normal commit', () => {
    expect(commitReadiness(base)).toEqual({ canCommit: true, reason: null });
  });

  it('explains every refusal', () => {
    expect(commitReadiness({ ...base, hasRepo: false }).reason).toBe(
      'No repository open',
    );
    expect(commitReadiness({ ...base, busy: true }).reason).toBe('Working…');
    expect(commitReadiness({ ...base, stagedCount: 0 }).reason).toBe('Nothing staged');
    expect(commitReadiness({ ...base, subject: '   ' }).reason).toBe('Write a subject');
  });

  it('allows an amend with nothing staged and no subject', () => {
    expect(
      commitReadiness({ ...base, amend: true, stagedCount: 0, subject: '' }).canCommit,
    ).toBe(true);
  });
});

describe('commitMenuItems', () => {
  const context = {
    amend: false,
    hasRemote: true,
    hasUpstream: true,
    hasCommits: true,
  };

  it('lists the four commit actions', () => {
    expect(commitMenuItems(context).map((item) => item.id)).toEqual([
      'commit',
      'commit-push',
      'commit-tag',
      'commit-fixup',
    ]);
  });

  it('announces the upstream that push will create', () => {
    expect(commitMenuItems({ ...context, hasUpstream: false })[1]?.label).toBe(
      'Commit & push (set upstream)',
    );
  });

  it('renames the first entry while amending', () => {
    expect(commitMenuItems({ ...context, amend: true })[0]?.label).toBe('Amend commit');
  });

  it('disables push without a remote and fixup without history', () => {
    const items = commitMenuItems({
      ...context,
      hasRemote: false,
      hasCommits: false,
    });
    expect(items[1]).toMatchObject({
      disabled: true,
      disabledReason: 'This repository has no remote',
    });
    expect(items[3]).toMatchObject({ disabled: true });
  });
});

describe('amendWarning', () => {
  const pushed = { amend: true, upstream: 'origin/main', ahead: 0 };

  it('warns when amending a HEAD the upstream already has', () => {
    expect(amendWarning(pushed)).toBe(
      'HEAD is already on origin/main — amending will require a force push',
    );
  });

  it('stays quiet while not amending', () => {
    expect(amendWarning({ ...pushed, amend: false })).toBeNull();
  });

  it('stays quiet on a branch with no upstream', () => {
    expect(amendWarning({ ...pushed, upstream: null })).toBeNull();
  });

  it('stays quiet while HEAD is still unpushed', () => {
    expect(amendWarning({ ...pushed, ahead: 1 })).toBeNull();
  });
});
