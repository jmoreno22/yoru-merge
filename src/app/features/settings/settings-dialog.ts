import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import type { PullMode, WritableConfigKey } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import type { ThemeMode } from '../../core/services/theme.service';
import { ThemeService } from '../../core/services/theme.service';
import type { RemoteProvider } from '../../core/utils';
import { parseRemoteUrl } from '../../core/utils';
import type { SegmentedOption } from '../../shared/ui';
import {
  KeyboardShortcutsService,
  YoruDialog,
  YoruField,
  YoruKbd,
  YoruSegmented,
  YoruSwitch,
} from '../../shared/ui';
import { AboutPanel } from '../about/about-panel';
import {
  CUSTOM_PRESET_ID,
  commandForPresetId,
  customCommandError,
  EDITOR_PRESETS,
  lacksDirPlaceholder,
  presetIdForCommand,
  TERMINAL_PRESETS,
} from './integration-presets';
import type { SettingsSection } from './settings-dialog.service';
import { SETTINGS_SECTIONS, SettingsDialogService } from './settings-dialog.service';

type ConfigScope = 'global' | 'repo';

const PROVIDER_LABELS: Readonly<Record<RemoteProvider, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  unknown: 'unsupported host',
};

@Component({
  selector: 'app-settings-dialog',
  imports: [YoruDialog, YoruField, YoruKbd, YoruSegmented, YoruSwitch, AboutPanel],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'settings-dialog-host' },
})
export class SettingsDialog {
  private readonly settings = inject(SettingsDialogService);
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly theme = inject(ThemeService);
  private readonly shortcutsService = inject(KeyboardShortcutsService);
  protected readonly prefs = inject(PreferencesService);

  protected readonly sections = SETTINGS_SECTIONS;
  protected readonly open = this.settings.isOpen;
  protected readonly section = this.settings.section;

  private readonly navButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('navButton');

  // ── General ──────────────────────────────────────────────────────────────
  protected readonly densityOptions: readonly SegmentedOption[] = [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
  ];
  protected readonly pullModeOptions: readonly SegmentedOption[] = [
    { value: 'merge', label: 'Merge' },
    { value: 'rebase', label: 'Rebase' },
    { value: 'ff_only', label: 'Fast-forward' },
  ];

  // ── Appearance ───────────────────────────────────────────────────────────
  protected readonly themeOptions: readonly SegmentedOption[] = [
    { value: 'system', label: 'System', icon: 'lucideMonitor' },
    { value: 'dark', label: 'Dark', icon: 'lucideMoon' },
    { value: 'light', label: 'Light', icon: 'lucideSun' },
  ];
  protected readonly diffModeOptions: readonly SegmentedOption[] = [
    { value: 'unified', label: 'Unified', icon: 'lucideRows3' },
    { value: 'split', label: 'Split', icon: 'lucideColumns2' },
  ];
  protected readonly contextOptions: readonly SegmentedOption[] = [
    { value: '3', label: '3' },
    { value: '6', label: '6' },
    { value: '20', label: '20' },
  ];
  protected readonly themeMode = this.theme.current;
  protected readonly osTheme = this.theme.osTheme;

  // ── Git ──────────────────────────────────────────────────────────────────
  protected readonly scope = signal<ConfigScope>('global');
  protected readonly scopeOptions = computed<readonly SegmentedOption[]>(() => [
    { value: 'global', label: 'Global' },
    { value: 'repo', label: this.currentRepo.repo()?.name ?? 'This repository' },
  ]);
  protected readonly hasRepo = this.currentRepo.isOpen;
  protected readonly configBusy = this.currentRepo.configBusy;

  protected readonly autocrlfOptions: readonly SegmentedOption[] = [
    { value: '', label: 'Unset' },
    { value: 'true', label: 'true' },
    { value: 'input', label: 'input' },
    { value: 'false', label: 'false' },
  ];
  protected readonly signingFormatOptions: readonly SegmentedOption[] = [
    { value: 'openpgp', label: 'OpenPGP' },
    { value: 'x509', label: 'X.509' },
    { value: 'ssh', label: 'SSH' },
  ];

  private readonly activeConfig = computed(() =>
    this.scope() === 'repo'
      ? this.currentRepo.config()
      : this.currentRepo.globalConfig(),
  );

  protected readonly userName = computed(() => this.activeConfig()?.user_name ?? '');
  protected readonly userEmail = computed(() => this.activeConfig()?.user_email ?? '');
  /** Placeholder for the repository scope: what git falls back to. */
  protected readonly globalUserName = computed(
    () => this.currentRepo.globalConfig()?.global_user_name ?? '',
  );
  protected readonly globalUserEmail = computed(
    () => this.currentRepo.globalConfig()?.global_user_email ?? '',
  );
  protected readonly pullRebase = computed(
    () => this.activeConfig()?.pull_rebase === true,
  );
  protected readonly gpgSign = computed(() => this.activeConfig()?.gpg_sign === true);
  protected readonly signingFormat = computed(
    () => this.activeConfig()?.signing_format ?? 'openpgp',
  );
  protected readonly defaultBranch = computed(
    () => this.activeConfig()?.default_branch ?? '',
  );
  protected readonly autocrlf = computed(() => this.activeConfig()?.autocrlf ?? '');

  // ── Integrations ─────────────────────────────────────────────────────────
  protected readonly editorPresets = EDITOR_PRESETS;
  protected readonly terminalPresets = TERMINAL_PRESETS;
  protected readonly editorPresetId = computed(() =>
    presetIdForCommand(EDITOR_PRESETS, this.prefs.externalEditor()),
  );
  protected readonly terminalPresetId = computed(() =>
    presetIdForCommand(TERMINAL_PRESETS, this.prefs.terminal()),
  );
  /** Keeps the free-text field open while the user is typing an unknown command. */
  protected readonly editorCustom = signal(false);
  protected readonly terminalCustom = signal(false);

  protected readonly editorError = computed(() =>
    this.editorPresetId() === CUSTOM_PRESET_ID
      ? customCommandError(this.prefs.externalEditor())
      : '',
  );
  protected readonly terminalError = computed(() =>
    this.terminalPresetId() === CUSTOM_PRESET_ID
      ? customCommandError(this.prefs.terminal())
      : '',
  );
  protected readonly terminalHint = computed(() =>
    lacksDirPlaceholder(this.prefs.terminal())
      ? 'No {dir}: the terminal still opens in the repository folder.'
      : '{dir} is replaced with the repository root.',
  );

  /** Which hosting provider "open on remote" will use, read from origin. */
  protected readonly remoteProvider = computed(() => {
    const remotes = this.currentRepo.remotes();
    if (remotes.length === 0) return 'No remote configured.';
    const origin = remotes.find((remote) => remote.name === 'origin') ?? remotes[0];
    const parsed = origin ? parseRemoteUrl(origin.fetch_url) : null;
    if (!parsed)
      return `${origin?.name ?? 'origin'}: not a supported hosting provider.`;
    return `${origin?.name}: ${PROVIDER_LABELS[parsed.provider]} (${parsed.host}).`;
  });

  // ── Keyboard ─────────────────────────────────────────────────────────────
  protected readonly shortcuts = computed(() =>
    [...this.shortcutsService.shortcuts()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      void this.reloadConfig();
    });

    effect(() => {
      // A repository scope is meaningless once every tab is closed.
      if (!this.hasRepo() && this.scope() === 'repo') this.scope.set('global');
    });
  }

  protected close(): void {
    this.settings.close();
  }

  protected select(section: SettingsSection): void {
    this.settings.select(section);
  }

  protected onNavKeydown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = this.sections.findIndex((s) => s.id === this.section());
    const next = (index + step + this.sections.length) % this.sections.length;
    const target = this.sections[next];
    if (!target) return;
    this.select(target.id);
    this.navButtons()[next]?.nativeElement.focus();
  }

  // ── General ──────────────────────────────────────────────────────────────
  protected onDensity(value: string): void {
    this.prefs.setUiDensity(value === 'compact' ? 'compact' : 'comfortable');
  }

  protected onPullMode(value: string): void {
    this.prefs.setPullMode(value as PullMode);
  }

  protected onAutoFetch(event: Event): void {
    const raw = Number.parseInt((event.target as HTMLInputElement).value, 10);
    this.prefs.setAutoFetchMinutes(Number.isFinite(raw) ? raw : 0);
  }

  // ── Appearance ───────────────────────────────────────────────────────────
  protected onTheme(value: string): void {
    this.theme.set(value as ThemeMode);
  }

  protected onDiffMode(value: string): void {
    this.prefs.setDiffViewMode(value === 'split' ? 'split' : 'unified');
  }

  protected onContextLines(value: string): void {
    this.prefs.setDiffContextLines(Number.parseInt(value, 10));
  }

  // ── Git ──────────────────────────────────────────────────────────────────
  protected onScope(value: string): void {
    this.scope.set(value === 'repo' ? 'repo' : 'global');
  }

  protected onConfigInput(key: WritableConfigKey, event: Event): void {
    void this.write(key, (event.target as HTMLInputElement).value);
  }

  protected onConfigFlag(key: WritableConfigKey, value: boolean): void {
    void this.write(key, value ? 'true' : 'false');
  }

  protected onConfigChoice(key: WritableConfigKey, value: string): void {
    void this.write(key, value);
  }

  // ── Integrations ─────────────────────────────────────────────────────────
  protected onEditorPreset(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.editorCustom.set(id === CUSTOM_PRESET_ID);
    const command = commandForPresetId(EDITOR_PRESETS, id);
    if (command !== null) this.prefs.setExternalEditor(command);
  }

  protected onEditorCommand(event: Event): void {
    this.prefs.setExternalEditor((event.target as HTMLInputElement).value.trim());
  }

  protected onTerminalPreset(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.terminalCustom.set(id === CUSTOM_PRESET_ID);
    const command = commandForPresetId(TERMINAL_PRESETS, id);
    if (command !== null) this.prefs.setTerminal(command);
  }

  protected onTerminalCommand(event: Event): void {
    this.prefs.setTerminal((event.target as HTMLInputElement).value.trim());
  }

  // ── config plumbing ──────────────────────────────────────────────────────
  private async write(key: WritableConfigKey, raw: string | null): Promise<void> {
    const trimmed = raw?.trim() ?? '';
    const value = trimmed.length === 0 ? null : trimmed;
    if (this.scope() === 'global') {
      await this.currentRepo.setGlobalConfigAction(key, value);
    } else {
      await this.currentRepo.setConfigAction(key, value, false);
    }
    await this.reloadConfig();
  }

  private async reloadConfig(): Promise<void> {
    await Promise.allSettled([
      this.currentRepo.loadGlobalConfigAction(),
      this.hasRepo() ? this.currentRepo.loadConfigAction() : Promise.resolve(),
      this.hasRepo() ? this.currentRepo.listRemotesAction() : Promise.resolve(),
    ]);
  }
}
