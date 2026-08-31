import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AboutDialog } from '../about/about-dialog';
import { CloneRepoDialog } from '../clone/clone-repo-dialog';
import { CommandPalette } from '../command-palette/command-palette';
import { MergeBranchDialog } from '../merge/merge-branch-dialog';
import { MergeResolver } from '../merge/merge-resolver';
import { RemotesManager } from '../remotes/remotes-manager';
import { SettingsDialog } from '../settings/settings-dialog';
import { SettingsDialogService } from '../settings/settings-dialog.service';
import { ConfirmDialog } from './confirm-dialog';
import { DialogsService } from './dialogs.service';
import { PromptDialog } from './prompt-dialog';
import { StashOptionsDialog } from './stash-options-dialog';
import { UpdateDialog } from './update-dialog';

/**
 * The single mounting point for every application dialog and for the command
 * palette. Mount it once in the shell: features raise dialogs through
 * `DialogsService`, `SettingsDialogService` and `CommandPaletteService`, so no
 * surface has to host a sibling's modal.
 *
 * The palette is always rendered — it registers its own shortcut — while the
 * rest are created on open so each one starts from a clean state.
 */
@Component({
  selector: 'app-dialog-host',
  imports: [
    ConfirmDialog,
    PromptDialog,
    CloneRepoDialog,
    RemotesManager,
    MergeBranchDialog,
    MergeResolver,
    AboutDialog,
    SettingsDialog,
    StashOptionsDialog,
    UpdateDialog,
    CommandPalette,
  ],
  templateUrl: './dialog-host.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DialogHost {
  protected readonly dialogs = inject(DialogsService);
  protected readonly settings = inject(SettingsDialogService);
}
