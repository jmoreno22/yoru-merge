import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { relativeTime, shortSha } from '../../../core/utils';
import { ClipboardService, YoruTooltip } from '../../ui';

/** How often "fetched 4 minutes ago" is recomputed. */
const CLOCK_TICK_MS = 30_000;

/** Dot colour per activity level; the label repeats the state as words. */
const ACTIVITY_COLOR: Readonly<Record<string, string>> = {
  watching: 'var(--color-git-added)',
  busy: 'var(--color-git-modified)',
  missing: 'var(--color-git-conflict)',
  idle: 'var(--app-text-faint)',
};

const STATE_LABEL: Readonly<Record<string, string>> = {
  merging: 'merging',
  rebasing: 'rebasing',
  cherry_picking: 'cherry-picking',
  reverting: 'reverting',
  bisecting: 'bisecting',
};

/**
 * The 26 px footer: what branch you are on, how far it has drifted from its
 * upstream, what the app is doing right now, and which git it is driving.
 */
@Component({
  selector: 'app-status-bar',
  imports: [NgIcon, YoruTooltip],
  templateUrl: './status-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'status-bar',
    class:
      'flex h-[var(--statusbar-h)] shrink-0 items-center gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-y-sm text-[var(--app-text-muted)]',
  },
})
export class StatusBar {
  protected readonly repo = inject(CurrentRepoService);
  private readonly prefs = inject(PreferencesService);
  private readonly clipboard = inject(ClipboardService);

  protected readonly gitVersion = signal('');

  /** Wall clock the relative labels depend on, so they age on screen. */
  private readonly now = signal(Date.now());

  /** Set when a fetch finishes; the facade keeps no such timestamp. */
  private readonly lastFetchAt = signal<number | null>(null);
  private wasFetching = false;

  protected readonly upstream = computed(
    () =>
      this.repo.branches()?.local.find((b) => b.name === this.repo.currentBranch())
        ?.upstream ?? null,
  );

  /** Empty on an unborn branch, which is the one case with no commit at all. */
  protected readonly headSha = computed(() => {
    const sha = this.repo.repoState().head_sha;
    return sha.length > 0 ? shortSha(sha) : null;
  });

  /**
   * Detached HEAD lives here rather than in the refs panel: the panel can be
   * closed, and the state bar is the one strip that is always on screen. While
   * a sequencer is running the banner already says what is going on, so the
   * chip would only add noise.
   */
  protected readonly detached = computed(() => {
    const state = this.repo.repoState();
    return state.head_detached && state.state === 'clean';
  });

  protected readonly changeCount = computed(
    () =>
      this.repo.stagedCount() + this.repo.unstagedCount() + this.repo.conflictCount(),
  );

  protected readonly sequencerLabel = computed(() => {
    const state = this.repo.repoState();
    if (state.state === 'clean') return null;
    const base = STATE_LABEL[state.state] ?? state.state;
    return state.state === 'rebasing' &&
      state.rebase_step !== null &&
      state.rebase_total !== null
      ? `${base} ${state.rebase_step}/${state.rebase_total}`
      : base;
  });

  protected readonly fetchedAgo = computed(() => {
    const at = this.lastFetchAt();
    return at === null ? null : relativeTime(at, this.now());
  });

  protected readonly fetching = computed(() => this.repo.fetchProgress() !== null);

  /** 0–100; a phase that reports no total simply sits at zero. */
  protected readonly fetchPercent = computed<number>(() => {
    const progress = this.repo.fetchProgress();
    if (!progress) return 0;
    if (progress.done || progress.phase === 'done') return 100;
    const total = progress.total ?? 0;
    const current = progress.current ?? 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  });

  /**
   * The watcher light, with what the app is doing folded in: a running command
   * outranks the watcher because it is the reason the view is about to change.
   * The word is rendered too — the dot's colour never carries the state alone.
   */
  protected readonly activity = computed<{
    label: string;
    level: 'watching' | 'busy' | 'missing' | 'idle';
  }>(() => {
    if (this.repo.notFound())
      return { label: 'Repository folder is missing', level: 'missing' };
    if (this.repo.busy()) return { label: 'Working', level: 'busy' };
    if (this.repo.watcherActive()) return { label: 'Watching', level: 'watching' };
    return { label: 'Not watching', level: 'idle' };
  });

  protected readonly activityColor = computed(
    () => ACTIVITY_COLOR[this.activity().level],
  );

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);

    effect(() => {
      const fetching = this.repo.isFetching();
      if (this.wasFetching && !fetching) this.lastFetchAt.set(Date.now());
      this.wasFetching = fetching;
    });

    // One round-trip per session: the git binary cannot change under us.
    void this.repo.gitVersionAction().then((version) => this.gitVersion.set(version));

    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async onCopySha(): Promise<void> {
    const sha = this.repo.repoState().head_sha;
    if (sha) await this.clipboard.writeText(sha);
  }

  protected onShowChanges(): void {
    this.prefs.setRailView('changes');
  }
}
