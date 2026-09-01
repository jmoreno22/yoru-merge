import { CdkTrapFocus } from '@angular/cdk/a11y';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { BranchInfo } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { SystemOps } from '../../core/services/ops';
import { PreferencesService } from '../../core/services/preferences.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { UpdaterService } from '../../core/services/updater.service';
import { WorkspaceStore } from '../../core/services/workspace.store';
import { shortSha } from '../../core/utils';
import type { YoruIconName } from '../../shared/icons';
import {
  ClipboardService,
  KeyboardShortcutsService,
  YoruEmptyState,
  YoruKbd,
} from '../../shared/ui';
import { InteractiveRebaseService } from '../commit-inspector/interactive-rebase.service';
import { DialogsService } from '../dialogs/dialogs.service';
import {
  SETTINGS_SECTIONS,
  SettingsDialogService,
} from '../settings/settings-dialog.service';
import { CommitComposerFocus } from '../working-changes/commit-composer-focus.service';
import { CommandPaletteService } from './command-palette.service';
import { buildPaletteCommands, type PaletteContext } from './palette-commands';
import {
  type PaletteMode,
  paletteHint,
  parsePaletteQuery,
  prefixForMode,
  pushRecent,
  rankPaletteItems,
} from './palette-modes';

const RECENTS_KEY = 'yoru.paletteRecents';
const MODE_ORDER: readonly PaletteMode[] = [
  'commands',
  'branches',
  'files',
  'commits',
  'settings',
];

/** One row of the palette, whatever mode produced it. */
interface PaletteItem {
  readonly id: string;
  readonly label: string;
  readonly icon: YoruIconName;
  readonly hint?: string;
  /** Combo of the registered shortcut, when the command has one. */
  readonly combo?: string;
  readonly run: () => void;
}

/**
 * Command palette: commands by default, and four prefixed modes — `>`
 * branches, `@` changed files, `#` commits, `:` settings.
 *
 * Shortcut hints come from `KeyboardShortcutsService`, never from a hardcoded
 * table, so a rebinding shows up here without touching this file.
 */
@Component({
  selector: 'app-command-palette',
  imports: [CdkTrapFocus, NgIcon, YoruKbd, YoruEmptyState],
  templateUrl: './command-palette.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents', 'data-testid': 'command-palette-host' },
})
export class CommandPalette {
  private readonly palette = inject(CommandPaletteService);
  private readonly repo = inject(CurrentRepoService);
  private readonly dialogs = inject(DialogsService);
  private readonly settings = inject(SettingsDialogService);
  private readonly shortcutsService = inject(KeyboardShortcutsService);
  private readonly theme = inject(ThemeService);
  private readonly prefs = inject(PreferencesService);
  private readonly workspace = inject(WorkspaceStore);
  private readonly clipboard = inject(ClipboardService);
  private readonly rebase = inject(InteractiveRebaseService);
  private readonly system = inject(SystemOps);
  private readonly toast = inject(ToastService);
  private readonly appearance = inject(AppearanceService);
  private readonly updater = inject(UpdaterService);
  private readonly composerFocus = inject(CommitComposerFocus);

  protected readonly open = this.palette.isOpen;
  protected readonly query = signal('');
  protected readonly highlighted = signal(0);

  private readonly recents = signal<readonly string[]>(readRecents());

  /**
   * Set by a command that needs a branch (rebase onto, checkout). While it is
   * set the palette stays open in branch mode and hands the pick to it.
   */
  private readonly branchAction = signal<{
    readonly label: string;
    readonly run: (branch: BranchInfo) => void;
  } | null>(null);

  protected readonly parsed = computed(() => parsePaletteQuery(this.query()));
  protected readonly mode = computed(() => this.parsed().mode);
  protected readonly hint = computed(() => paletteHint(this.mode()));
  protected readonly pendingLabel = computed(() => this.branchAction()?.label ?? '');

  private readonly context: PaletteContext = {
    repo: this.repo,
    dialogs: this.dialogs,
    settings: this.settings,
    theme: this.theme,
    prefs: this.prefs,
    workspace: this.workspace,
    clipboard: this.clipboard,
    rebase: this.rebase,
    system: this.system,
    toast: this.toast,
    appearance: this.appearance,
    updater: this.updater,
    composerFocus: this.composerFocus,
    pickBranch: (label, run) => {
      this.branchAction.set({ label, run });
      this.query.set(prefixForMode('branches'));
      this.highlighted.set(0);
    },
  };

  private readonly commandItems = computed<PaletteItem[]>(() => {
    const combos = new Map(
      this.shortcutsService.shortcuts().map((s) => [s.id, s.combo]),
    );
    return buildPaletteCommands(this.context)
      .filter((command) => command.when?.() !== false)
      .map((command) => ({
        id: command.id,
        label: command.label,
        icon: command.icon,
        hint: command.group,
        combo: combos.get(command.shortcutId ?? command.id),
        run: command.run,
      }));
  });

  private readonly branchItems = computed<PaletteItem[]>(() => {
    const list = this.repo.branches();
    if (!list) return [];
    const current = list.current;
    return [...list.local, ...list.remote].map((branch) => ({
      id: `branch:${branch.is_remote ? 'r' : 'l'}:${branch.name}`,
      label: branch.name,
      icon: (branch.is_remote
        ? 'lucideGlobe'
        : branch.name === current
          ? 'lucideCircleDot'
          : 'lucideGitBranch') as YoruIconName,
      hint: branch.upstream ?? (branch.is_remote ? 'remote' : 'local'),
      run: () => this.runBranch(branch),
    }));
  });

  private readonly fileItems = computed<PaletteItem[]>(() => {
    const changes = this.repo.changes();
    if (!changes) return [];
    const items: PaletteItem[] = [];
    for (const file of changes.staged) {
      items.push({
        id: `file:staged:${file.path}`,
        label: file.path,
        icon: 'lucideFileDiff',
        hint: 'staged',
        run: () => void this.repo.selectWorkingFile(file, true),
      });
    }
    for (const file of changes.unstaged) {
      items.push({
        id: `file:unstaged:${file.path}`,
        label: file.path,
        icon: 'lucideFileDiff',
        hint: 'unstaged',
        run: () => void this.repo.selectWorkingFile(file, false),
      });
    }
    for (const path of changes.untracked) {
      items.push({
        id: `file:untracked:${path}`,
        label: path,
        icon: 'lucideFilePlus',
        hint: 'untracked',
        run: () => void this.repo.selectWorkingFile(path, false),
      });
    }
    for (const path of changes.conflicted) {
      items.push({
        id: `file:conflict:${path}`,
        label: path,
        icon: 'lucideFileX',
        hint: 'conflicted',
        run: () => this.dialogs.openMergeResolver(path),
      });
    }
    return items;
  });

  private readonly commitItems = computed<PaletteItem[]>(() =>
    this.repo.searchResults().map((commit) => ({
      id: `commit:${commit.sha}`,
      label: commit.message,
      icon: 'lucideGitCommitHorizontal' as YoruIconName,
      hint: `${shortSha(commit.sha)} · ${commit.author_name}`,
      run: () => void this.repo.navigateToSha(commit.sha),
    })),
  );

  private readonly settingsItems = computed<PaletteItem[]>(() =>
    SETTINGS_SECTIONS.map((section) => ({
      id: `settings:${section.id}`,
      label: section.label,
      icon: 'lucideSettings2' as YoruIconName,
      hint: 'Settings',
      run: () => this.settings.open(section.id),
    })),
  );

  protected readonly items = computed<PaletteItem[]>(() => {
    const { mode, term } = this.parsed();
    // Commit results come ranked by git; re-sorting them locally would fight
    // the backend's own ordering.
    if (mode === 'commits') return this.commitItems();
    const source =
      mode === 'branches'
        ? this.branchItems()
        : mode === 'files'
          ? this.fileItems()
          : mode === 'settings'
            ? this.settingsItems()
            : this.commandItems();
    return rankPaletteItems(source, term, {
      getText: (item) => item.label,
      getId: (item) => item.id,
      recents: mode === 'commands' ? this.recents() : [],
      limit: 60,
    });
  });

  protected readonly active = computed(
    () => this.items()[Math.min(this.highlighted(), this.items().length - 1)] ?? null,
  );

  protected readonly searching = this.repo.isSearching;

  private readonly rows = viewChildren<ElementRef<HTMLElement>>('row');

  constructor() {
    effect(() => {
      this.rows()[this.highlighted()]?.nativeElement.scrollIntoView({
        block: 'nearest',
      });
    });

    const off = this.shortcutsService.register({
      id: 'palette.open',
      combo: 'mod+k',
      label: 'Open the command palette',
      allowInInputs: true,
      run: () => this.palette.toggle(),
    });
    inject(DestroyRef).onDestroy(off);

    effect(() => {
      if (this.open()) return;
      this.query.set('');
      this.highlighted.set(0);
      this.branchAction.set(null);
      // The commit mode drives the shared search state; leave it as we found it.
      this.repo.clearSearch();
    });

    effect(() => {
      const { mode, term } = this.parsed();
      if (!this.open() || mode !== 'commits') return;
      this.repo.searchCommitsAction(term);
    });
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.highlighted.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        this.move(1);
        break;
      case 'ArrowUp':
        this.move(-1);
        break;
      case 'Home':
        this.highlighted.set(0);
        break;
      case 'End':
        this.highlighted.set(Math.max(0, this.items().length - 1));
        break;
      case 'Tab':
        this.cycleMode(event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
        this.runActive();
        break;
      case 'Escape':
        this.close();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected select(index: number): void {
    this.highlighted.set(index);
    this.runActive();
  }

  protected close(): void {
    this.palette.close();
  }

  private move(step: number): void {
    const total = this.items().length;
    if (total === 0) return;
    this.highlighted.update((index) => (index + step + total) % total);
  }

  /** Tab walks the modes, keeping whatever the user already typed. */
  private cycleMode(step: number): void {
    const index = MODE_ORDER.indexOf(this.mode());
    const next = MODE_ORDER[(index + step + MODE_ORDER.length) % MODE_ORDER.length];
    if (!next) return;
    this.query.set(prefixForMode(next) + this.parsed().term);
    this.highlighted.set(0);
  }

  private runActive(): void {
    const item = this.active();
    if (!item) return;
    if (this.mode() === 'commands') this.remember(item.id);
    item.run();
    // A command that asked for a branch keeps the palette open on that list.
    if (this.branchAction() === null) this.close();
  }

  private runBranch(branch: BranchInfo): void {
    const pending = this.branchAction();
    this.branchAction.set(null);
    if (pending) {
      pending.run(branch);
      return;
    }
    void this.repo.checkoutBranchAction(branch.name, branch.is_remote);
  }

  private remember(id: string): void {
    const next = pushRecent(this.recents(), id);
    this.recents.set(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota: recents are a convenience, not state.
    }
  }
}

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}
