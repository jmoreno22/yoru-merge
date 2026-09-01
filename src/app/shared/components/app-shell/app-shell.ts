import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AppearanceService } from '../../../core/services/appearance.service';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../../core/services/preferences-schema';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkspaceStore } from '../../../core/services/workspace.store';
import { DialogHost } from '../../../features/dialogs/dialog-host';
import { SettingsDialogService } from '../../../features/settings/settings-dialog.service';
import { KeyboardShortcutsService, YoruToastHost } from '../../ui';
import { DropActionMenu } from '../drop-action-menu/drop-action-menu';
import { MainContent } from '../main-content/main-content';
import { Rail } from '../rail/rail';
import { StatusBar } from '../status-bar/status-bar';
import { Titlebar } from '../titlebar/titlebar';
import { Toolbar } from '../toolbar/toolbar';
import { WorkspaceActions } from './workspace-actions.service';

/**
 * The application frame: titlebar, toolbar, rail, workbench and status bar,
 * plus the three global overlay hosts.
 *
 * It owns the shortcuts that are not tied to a single surface; the rail and
 * the toolbar register their own, so every binding lives next to the code it
 * runs and the command palette can read the whole set back.
 */
@Component({
  selector: 'app-app-shell',
  imports: [
    DialogHost,
    DropActionMenu,
    MainContent,
    Rail,
    StatusBar,
    Titlebar,
    Toolbar,
    YoruToastHost,
  ],
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  protected readonly repo = inject(CurrentRepoService);
  protected readonly appearance = inject(AppearanceService);
  private readonly prefs = inject(PreferencesService);
  private readonly workspace = inject(WorkspaceStore);
  private readonly actions = inject(WorkspaceActions);
  private readonly settings = inject(SettingsDialogService);
  private readonly theme = inject(ThemeService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  constructor() {
    const manyTabs = () => this.workspace.workspaces().length > 1;
    const offs = [
      this.shortcuts.register({
        id: 'repo.open',
        combo: 'mod+o',
        label: 'Open repository…',
        run: () => void this.actions.openRepo(),
      }),
      // Two combos for "larger": `=` is the key US layouts put it on (and what
      // browsers use for zoom), `+` is a key of its own on Spanish and German
      // layouts, where `=` needs Shift and would never match.
      this.shortcuts.register({
        id: 'view.fontLarger',
        combo: 'mod+=',
        label: 'Increase interface font size',
        run: () => this.prefs.setUiFontSize(this.prefs.uiFontSize() + 1),
      }),
      this.shortcuts.register({
        id: 'view.fontLargerPlus',
        combo: 'mod++',
        label: 'Increase interface font size',
        run: () => this.prefs.setUiFontSize(this.prefs.uiFontSize() + 1),
      }),
      this.shortcuts.register({
        id: 'view.fontSmaller',
        combo: 'mod+-',
        label: 'Decrease interface font size',
        run: () => this.prefs.setUiFontSize(this.prefs.uiFontSize() - 1),
      }),
      this.shortcuts.register({
        id: 'view.fontReset',
        combo: 'mod+0',
        label: 'Reset font sizes',
        run: () => {
          this.prefs.setUiFontSize(DEFAULT_PREFERENCES.uiFontSize);
          this.prefs.setMonoFontSize(DEFAULT_PREFERENCES.monoFontSize);
        },
      }),
      this.shortcuts.register({
        id: 'view.zen',
        combo: 'mod+shift+z',
        label: 'Toggle zen mode',
        run: () => this.prefs.setZenMode(!this.prefs.zenMode()),
      }),
      this.shortcuts.register({
        id: 'repo.refresh',
        combo: 'f5',
        label: 'Refresh repository',
        when: () => this.repo.isOpen(),
        run: () => void this.repo.refreshAll(),
      }),
      this.shortcuts.register({
        id: 'tab.close',
        combo: 'mod+w',
        label: 'Close repository tab',
        when: () => this.repo.isOpen(),
        run: () => void this.repo.close(),
      }),
      this.shortcuts.register({
        id: 'tab.next',
        combo: 'mod+tab',
        label: 'Next tab',
        when: manyTabs,
        run: () => this.actions.moveTab(1),
      }),
      this.shortcuts.register({
        id: 'tab.previous',
        combo: 'mod+shift+tab',
        label: 'Previous tab',
        when: manyTabs,
        run: () => this.actions.moveTab(-1),
      }),
      this.shortcuts.register({
        id: 'app.settings',
        combo: 'mod+,',
        label: 'Settings…',
        run: () => this.settings.open(),
      }),
      this.shortcuts.register({
        id: 'view.theme',
        combo: 'mod+shift+t',
        label: 'Toggle theme',
        run: () => this.theme.cycle(),
      }),
    ];
    inject(DestroyRef).onDestroy(() => {
      for (const off of offs) off();
    });
  }
}
