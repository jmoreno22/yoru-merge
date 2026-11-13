import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  type NeonCue,
  NeonSignService,
} from '../../../core/services/neon-sign.service';
import { motionAllowed } from '../../../core/services/view-transition';
import { YoruTooltip } from '../../ui';
import { WorkspaceTabs } from '../workspace-tabs/workspace-tabs';

/** Current running through the sign, letter by letter. */
const SURGE_LETTER: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.3, offset: 0.3 },
  { opacity: 1 },
];
const SURGE_PLATE: Keyframe[] = [
  { opacity: 0.85, transform: 'scale(1)' },
  { opacity: 1, transform: 'scale(1.3)', offset: 0.35 },
  { opacity: 0.85, transform: 'scale(1)' },
];
/** A brownout: the whole sign stutters at once. */
const FALTER_LETTER: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.2, offset: 0.1 },
  { opacity: 0.9, offset: 0.2 },
  { opacity: 0.25, offset: 0.34 },
  { opacity: 1, offset: 0.46 },
  { opacity: 0.55, offset: 0.62 },
  { opacity: 1 },
];
const FALTER_PLATE: Keyframe[] = [
  { opacity: 0.85 },
  { opacity: 0.15, offset: 0.1 },
  { opacity: 0.75, offset: 0.2 },
  { opacity: 0.2, offset: 0.34 },
  { opacity: 0.85, offset: 0.46 },
  { opacity: 0.45, offset: 0.62 },
  { opacity: 0.85 },
];

/**
 * The custom titlebar: wordmark, repository tabs and window controls.
 *
 * The window is undecorated (`decorations: false`), so dragging and the
 * double-click maximise come from Tauri's own `data-tauri-drag-region`
 * handling — adding a second `dblclick` listener here would toggle twice.
 */
@Component({
  selector: 'app-titlebar',
  imports: [NgIcon, WorkspaceTabs, YoruTooltip],
  templateUrl: './titlebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'titlebar',
    class:
      'flex h-[var(--titlebar-h)] shrink-0 items-stretch border-b border-[var(--app-border)] bg-[var(--app-surface)]',
    'data-tauri-drag-region': '',
  },
})
export class Titlebar {
  protected readonly maximized = signal(false);
  protected readonly focused = signal(true);
  protected readonly wordmark = [...'YoruMerge'];
  private readonly sign = viewChild.required<ElementRef<HTMLElement>>('sign');

  constructor() {
    void this.syncMaximized();
    // The icon has to follow window snapping and drags, not just our clicks.
    const unlisten = this.withWindow((w) =>
      w.onResized(() => void this.syncMaximized()),
    );
    const unlistenFocus = this.withWindow((w) =>
      w.onFocusChanged(({ payload }) => this.focused.set(payload)),
    );
    inject(DestroyRef).onDestroy(() => {
      void unlisten.then((off) => off?.());
      void unlistenFocus.then((off) => off?.());
    });

    const neon = inject(NeonSignService);
    effect(() => {
      const cue = neon.cue();
      if (cue) untracked(() => this.react(cue.kind));
    });
  }

  protected async onMinimize(): Promise<void> {
    await this.withWindow((w) => w.minimize());
  }

  protected async onToggleMaximize(): Promise<void> {
    await this.withWindow((w) => w.toggleMaximize());
    await this.syncMaximized();
  }

  protected async onClose(): Promise<void> {
    await this.withWindow((w) => w.close());
  }

  /**
   * One-shot reactions played over the sign's CSS loop: a script animation
   * wins over a CSS one while it runs, and the loop resumes where it was.
   */
  private react(cue: NeonCue): void {
    if (!motionAllowed()) return;
    const sign = this.sign().nativeElement;
    const plate = sign.querySelector<HTMLElement>('.yoru-neon-plate');
    const letters = sign.querySelectorAll<HTMLElement>('.yoru-neon-letter');
    if (cue === 'surge') {
      letters.forEach((letter, index) => {
        letter.animate(SURGE_LETTER, {
          duration: 420,
          delay: index * 45,
          easing: 'ease-out',
        });
      });
      plate?.animate(SURGE_PLATE, { duration: 900, easing: 'ease-out' });
      return;
    }
    for (const letter of letters) letter.animate(FALTER_LETTER, { duration: 700 });
    plate?.animate(FALTER_PLATE, { duration: 700 });
  }

  private async syncMaximized(): Promise<void> {
    const value = await this.withWindow((w) => w.isMaximized());
    if (value !== null) this.maximized.set(value);
  }

  /**
   * Every window call is optional: opening the dev server in a plain browser
   * has no Tauri bridge, and a titlebar that throws would take the shell down
   * with it.
   */
  private async withWindow<T>(
    run: (window: ReturnType<typeof getCurrentWindow>) => Promise<T>,
  ): Promise<T | null> {
    try {
      return await run(getCurrentWindow());
    } catch {
      return null;
    }
  }
}
