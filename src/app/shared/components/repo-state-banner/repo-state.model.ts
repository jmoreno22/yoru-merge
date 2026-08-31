import type { RepoStateInfo } from '../../../core/models';

/** What the banner shows and which buttons it is allowed to offer. */
export interface RepoStateBannerModel {
  readonly title: string;
  readonly hint: string;
  /** Which pair of facade calls Continue/Abort must use. */
  readonly driver: 'merge' | 'sequencer' | 'none';
  readonly canContinue: boolean;
  /** Reason Continue is unavailable, written next to the disabled button. */
  readonly continueBlockedReason: string | null;
  readonly canSkip: boolean;
  readonly canAbort: boolean;
  readonly canResolve: boolean;
}

const TITLES: Readonly<Record<Exclude<RepoStateInfo['state'], 'clean'>, string>> = {
  merging: 'Merging',
  rebasing: 'Rebasing',
  cherry_picking: 'Cherry-picking',
  reverting: 'Reverting',
  bisecting: 'Bisecting',
};

const SKIPPABLE: ReadonlySet<RepoStateInfo['state']> = new Set([
  'rebasing',
  'cherry_picking',
  'reverting',
]);

/**
 * True while git can drop the commit it is stuck on.
 *
 * `--skip` exists for rebase, cherry-pick and revert; a merge has no commit to
 * step over, so it only offers Continue and Abort.
 */
export function canSkipSequencer(state: RepoStateInfo['state']): boolean {
  return SKIPPABLE.has(state);
}

/**
 * Banner contents for the state git is parked in, or `null` when the tree is
 * clean.
 *
 * `merging` is driven by `mergeContinueAction`/`abortMergeAction` and the other
 * sequences by `continueSequencerAction`/`abortSequencerAction`, because the
 * sequencer dispatcher deliberately ignores a plain merge. Bisect gets no
 * buttons at all: nothing in the app drives it, so the hint says where to.
 */
export function repoStateBanner(
  state: RepoStateInfo,
  conflicts: number,
): RepoStateBannerModel | null {
  if (state.state === 'clean') return null;

  const title =
    state.state === 'rebasing' &&
    state.rebase_step !== null &&
    state.rebase_total !== null
      ? `Rebasing ${state.rebase_step} of ${state.rebase_total}`
      : TITLES[state.state];

  if (state.state === 'bisecting') {
    return {
      title,
      hint: 'Run git bisect reset in a terminal to end it.',
      driver: 'none',
      canContinue: false,
      continueBlockedReason: null,
      canSkip: false,
      canAbort: false,
      canResolve: false,
    };
  }

  const blocked = conflicts > 0;
  return {
    title,
    hint: blocked
      ? `${conflicts} ${conflicts === 1 ? 'file' : 'files'} still conflicted.`
      : 'No conflicts left.',
    driver: state.state === 'merging' ? 'merge' : 'sequencer',
    canContinue: !blocked,
    continueBlockedReason: blocked
      ? `Resolve ${conflicts} ${conflicts === 1 ? 'file' : 'files'} first`
      : null,
    canSkip: canSkipSequencer(state.state),
    canAbort: true,
    canResolve: blocked,
  };
}
