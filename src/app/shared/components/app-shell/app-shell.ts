import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
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
