import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { SettingsDialogService } from '../../../features/settings/settings-dialog.service';
import { KeyboardShortcutsService, YoruTooltip } from '../../ui';
import { isRailItemActive, RAIL_ITEMS, type RailItem } from './rail-views';

/**
 * The icon rail: it picks the centre view and opens the refs panel.
 *
 * Remotes, Tags and Stashes are refs-panel destinations rather than views of
 * their own — they expand their section in the panel and leave the history in
 * the centre, which is what the user was looking at anyway.
 */
@Component({
  selector: 'app-rail',
  imports: [NgIcon, YoruTooltip],
  templateUrl: './rail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'rail',
    class:
      'flex w-[var(--rail-w)] shrink-0 flex-col items-center border-r border-[var(--app-border)] bg-[var(--app-surface)] py-2',
  },
})
export class Rail {
  private readonly prefs = inject(PreferencesService);
  private readonly repo = inject(CurrentRepoService);
  private readonly settings = inject(SettingsDialogService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  protected readonly items = RAIL_ITEMS;
  protected readonly view = this.prefs.railView;
  protected readonly refsPanelOpen = this.prefs.refsPanelOpen;

  /** Everything the working tree would show in the Changes view. */
  protected readonly changesCount = computed(
    () =>
      this.repo.stagedCount() + this.repo.unstagedCount() + this.repo.conflictCount(),
  );

  constructor() {
    // `view.refsPanel` is the id the command palette already paints a combo
    // for, so the toggle keeps that name instead of `view.refs`.
    const offs = RAIL_ITEMS.flatMap((item) => {
      const combo = item.shortcut;
      if (combo === null) return [];
      return [
        this.shortcuts.register({
          id: item.id === 'refs' ? 'view.refsPanel' : `view.${item.id}`,
          combo,
          label: item.id === 'refs' ? 'Toggle refs panel' : `Show ${item.label}`,
          run: () => this.select(item),
        }),
      ];
    });
    inject(DestroyRef).onDestroy(() => {
      for (const off of offs) off();
    });
  }

  protected isActive(item: RailItem): boolean {
    return isRailItemActive(item, this.view(), this.refsPanelOpen());
  }

  protected badgeFor(item: RailItem): number {
    return item.id === 'changes' ? this.changesCount() : 0;
  }

  protected select(item: RailItem): void {
    if (item.id === 'refs') {
      this.prefs.setRefsPanelOpen(!this.refsPanelOpen());
      return;
    }
    if (item.view !== null) this.prefs.setRailView(item.view);
    if (item.section !== null) {
      this.prefs.setRefsPanelOpen(true);
      this.prefs.setSidebarSectionCollapsed(item.section, false);
    }
  }

  protected openSettings(): void {
    this.settings.open();
  }
}
