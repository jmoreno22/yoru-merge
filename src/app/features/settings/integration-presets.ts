/**
 * Editor and terminal presets for Settings › Integrations.
 *
 * The stored preference is always the command string, never a preset id: a
 * machine that once had Zed and now has Cursor keeps working, and a hand-typed
 * command survives a round-trip through the picker as "Custom".
 */

export interface CommandPreset {
  readonly id: string;
  readonly label: string;
  /** Empty for `system` (let the OS decide) and for `custom` (user supplies it). */
  readonly command: string;
}

/** Sentinel ids, meaningful to the UI rather than to git. */
export const SYSTEM_PRESET_ID = 'system';
export const CUSTOM_PRESET_ID = 'custom';

/** `open_in_editor` splits the command on whitespace and appends the target. */
export const EDITOR_PRESETS: readonly CommandPreset[] = [
  { id: SYSTEM_PRESET_ID, label: 'System default', command: '' },
  { id: 'vscode', label: 'VS Code', command: 'code' },
  { id: 'cursor', label: 'Cursor', command: 'cursor' },
  { id: 'zed', label: 'Zed', command: 'zed' },
  { id: 'sublime', label: 'Sublime Text', command: 'subl' },
  { id: 'vim', label: 'Vim', command: 'vim' },
  { id: CUSTOM_PRESET_ID, label: 'Custom…', command: '' },
];

/** `{dir}` is replaced with the repository root before the command is spawned. */
export const TERMINAL_PRESETS: readonly CommandPreset[] = [
  { id: SYSTEM_PRESET_ID, label: 'System default', command: '' },
  { id: 'wt', label: 'Windows Terminal', command: 'wt -d {dir}' },
  { id: 'powershell', label: 'PowerShell', command: 'powershell.exe -NoLogo' },
  { id: 'cmd', label: 'Command Prompt', command: 'cmd.exe /K' },
  {
    id: 'gnome',
    label: 'GNOME Terminal',
    command: 'gnome-terminal --working-directory={dir}',
  },
  { id: 'konsole', label: 'Konsole', command: 'konsole --workdir {dir}' },
  {
    id: 'alacritty',
    label: 'Alacritty',
    command: 'alacritty --working-directory {dir}',
  },
  { id: 'kitty', label: 'Kitty', command: 'kitty -d {dir}' },
  { id: CUSTOM_PRESET_ID, label: 'Custom…', command: '' },
];

/** Which preset a stored command corresponds to. */
export function presetIdForCommand(
  presets: readonly CommandPreset[],
  command: string,
): string {
  const value = command.trim();
  if (value.length === 0) return SYSTEM_PRESET_ID;
  const match = presets.find(
    (preset) => preset.command.length > 0 && preset.command === value,
  );
  return match?.id ?? CUSTOM_PRESET_ID;
}

/**
 * Command to store when a preset is picked. `null` means "keep what the user
 * already typed" — the only case is switching to Custom.
 */
export function commandForPresetId(
  presets: readonly CommandPreset[],
  id: string,
): string | null {
  if (id === CUSTOM_PRESET_ID) return null;
  return presets.find((preset) => preset.id === id)?.command ?? '';
}

/** Why a hand-written command cannot be used; empty when it is fine. */
export function customCommandError(command: string): string {
  return command.trim().length === 0 ? 'Enter a command, or pick a preset.' : '';
}

/**
 * True when a terminal command carries no `{dir}`. Not an error: the backend
 * also sets the working directory, so the terminal still opens in the right
 * place — but a user who expected an argument should be told.
 */
export function lacksDirPlaceholder(command: string): boolean {
  const value = command.trim();
  return value.length > 0 && !value.includes('{dir}');
}
