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
import { AppearanceService } from '../../core/services/appearance.service';
import type { ColorPalette } from '../../core/services/color-palettes';
import { COLOR_PALETTES } from '../../core/services/color-palettes';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import type {
  AccentId,
  GraphPaletteId,
  InspectorPlacement,
  SidebarSide,
  UiDensity,
} from '../../core/services/preferences-schema';
import {
  MAX_MONO_FONT_SIZE,
  MAX_UI_FONT_SIZE,
  MIN_MONO_FONT_SIZE,
  MIN_UI_FONT_SIZE,
} from '../../core/services/preferences-schema';
import type { ThemeMode } from '../../core/services/theme.service';
import { ThemeService } from '../../core/services/theme.service';
import { runThemeTransition } from '../../core/services/view-transition';
import type { RemoteProvider } from '../../core/utils';
import { parseRemoteUrl } from '../../core/utils';
import type { SegmentedOption } from '../../shared/ui';
import {
  KeyboardShortcutsService,
  YoruDialog,
  YoruField,
  YoruKbd,
  YoruSegmented,
  YoruStepper,
  YoruSwitch,
} from '../../shared/ui';
import { AboutPanel } from '../about/about-panel';
import { COMMIT_COLUMNS, toggleColumn } from '../commit-list/commit-columns';
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
  imports: [
    YoruDialog,
    YoruField,
    YoruKbd,
    YoruSegmented,
    YoruStepper,
    YoruSwitch,
    AboutPanel,
  ],
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
  private readonly appearance = inject(AppearanceService);

  protected readonly sections = SETTINGS_SECTIONS;
  protected readonly open = this.settings.isOpen;
  protected readonly section = this.settings.section;

  private readonly navButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('navButton');

  // ── General ──────────────────────────────────────────────────────────────
  protected readonly densityOptions: readonly SegmentedOption[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'relaxed', label: 'Relaxed' },
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

  /** Type-size bounds, so the steppers cannot offer a value the schema clamps. */
  protected readonly minUiFontSize = MIN_UI_FONT_SIZE;
  protected readonly maxUiFontSize = MAX_UI_FONT_SIZE;
  protected readonly minMonoFontSize = MIN_MONO_FONT_SIZE;
  protected readonly maxMonoFontSize = MAX_MONO_FONT_SIZE;

  protected readonly tabWidthOptions: readonly SegmentedOption[] = [
    { value: '2', label: '2' },
    { value: '4', label: '4' },
    { value: '8', label: '8' },
  ];

  /**
   * Accent swatches. The colour is the fill tone, which is what the dot shows;
   * the text tone each preset switches to is a token, not a value the picker
   * needs to know.
   */
  protected readonly accentOptions: readonly {
    readonly id: AccentId;
    readonly label: string;
    readonly swatch: string;
  }[] = [
    { id: 'cyan', label: 'Cyan', swatch: 'var(--color-neon-cyan)' },
    { id: 'violet', label: 'Violet', swatch: 'var(--color-neon-violet)' },
    { id: 'sakura', label: 'Sakura', swatch: 'var(--color-sakura-500)' },
    { id: 'mint', label: 'Mint', swatch: 'var(--color-git-added)' },
    { id: 'crimson', label: 'Crimson', swatch: 'var(--color-crimson-500)' },
  ];

  protected readonly graphPaletteOptions: readonly SegmentedOption[] = [
    { value: 'yoru', label: 'Yoru' },
    { value: 'contrast', label: 'Contrast' },
    { value: 'colorblind', label: 'Colourblind' },
  ];

  protected readonly inspectorOptions: readonly SegmentedOption[] = [
    { value: 'right', label: 'Right', icon: 'lucideColumns2' },
    { value: 'bottom', label: 'Bottom', icon: 'lucideRows3' },
  ];

  protected readonly sidebarSideOptions: readonly SegmentedOption[] = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  protected readonly colorPalettes = COLOR_PALETTES;

  /**
   * Swatches for the palette cards, taken from the mode that is on screen —
   * previewing a light palette while the app is dark would be a lie.
   */
  protected paletteSwatches(palette: ColorPalette): readonly string[] {
    const surfaces = this.theme.resolved() === 'dark' ? palette.dark : palette.light;
    return [
      surfaces.bg,
      surfaces.surface,
      surfaces.panel,
      surfaces.border,
      surfaces.text,
    ];
  }

  protected readonly commitColumns = COMMIT_COLUMNS;

  protected isColumnVisible(id: string): boolean {
    return this.prefs.commitsColumns().includes(id);
  }

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
    this.prefs.setUiDensity(value as UiDensity);
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

  protected onTabWidth(value: string): void {
    this.prefs.setCodeTabWidth(Number.parseInt(value, 10));
  }

  protected onAccent(accent: AccentId): void {
    this.prefs.setAccent(accent);
  }

  protected onGraphPalette(value: string): void {
    this.prefs.setGraphPalette(value as GraphPaletteId);
  }

  protected onZen(on: boolean): void {
    this.appearance.setZen(on);
  }

  protected onColorPalette(id: string): void {
    // A palette swap repaints every surface, so it earns the sweep even more
    // than a light/dark flip does.
    runThemeTransition(() => this.prefs.setColorPalette(id));
  }

  protected onInspectorPlacement(value: string): void {
    this.prefs.setInspectorPlacement(value as InspectorPlacement);
  }

  protected onSidebarSide(value: string): void {
    this.prefs.setSidebarSide(value as SidebarSide);
  }

  protected onColumnToggle(id: string): void {
    this.prefs.setCommitsColumns(toggleColumn(this.prefs.commitsColumns(), id));
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
