import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { YoruTooltip } from '../../ui';
import { WorkspaceTabs } from '../workspace-tabs/workspace-tabs';

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

  constructor() {
    void this.syncMaximized();
    // The icon has to follow window snapping and drags, not just our clicks.
    const unlisten = this.withWindow((w) =>
      w.onResized(() => void this.syncMaximized()),
    );
    inject(DestroyRef).onDestroy(() => void unlisten.then((off) => off?.()));
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
