import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PRESET_ID,
  commandForPresetId,
  customCommandError,
  EDITOR_PRESETS,
  lacksDirPlaceholder,
  presetIdForCommand,
  SYSTEM_PRESET_ID,
  TERMINAL_PRESETS,
} from './integration-presets';

describe('presetIdForCommand', () => {
  it('maps an empty command to the system default', () => {
    expect(presetIdForCommand(EDITOR_PRESETS, '')).toBe(SYSTEM_PRESET_ID);
    expect(presetIdForCommand(EDITOR_PRESETS, '   ')).toBe(SYSTEM_PRESET_ID);
  });

  it('recognises a known preset', () => {
    expect(presetIdForCommand(EDITOR_PRESETS, 'code')).toBe('vscode');
    expect(presetIdForCommand(TERMINAL_PRESETS, 'kitty -d {dir}')).toBe('kitty');
  });

  it('falls back to custom for anything hand-written', () => {
    expect(presetIdForCommand(EDITOR_PRESETS, 'emacsclient -c')).toBe(CUSTOM_PRESET_ID);
  });
});

describe('commandForPresetId', () => {
  it('round-trips every preset that carries a command', () => {
    for (const presets of [EDITOR_PRESETS, TERMINAL_PRESETS]) {
      for (const preset of presets) {
        if (preset.command.length === 0) continue;
        const command = commandForPresetId(presets, preset.id);
        expect(command).toBe(preset.command);
        expect(presetIdForCommand(presets, preset.command)).toBe(preset.id);
      }
    }
  });

  it('clears the command for the system default', () => {
    expect(commandForPresetId(EDITOR_PRESETS, SYSTEM_PRESET_ID)).toBe('');
  });

  it('keeps the typed command when switching to custom', () => {
    expect(commandForPresetId(EDITOR_PRESETS, CUSTOM_PRESET_ID)).toBeNull();
  });

  it('treats an unknown id as the system default', () => {
    expect(commandForPresetId(EDITOR_PRESETS, 'nope')).toBe('');
  });
});

describe('customCommandError', () => {
  it('rejects a blank command', () => {
    expect(customCommandError('')).not.toBe('');
    expect(customCommandError('   ')).not.toBe('');
  });

  it('accepts anything else', () => {
    expect(customCommandError('emacsclient -c')).toBe('');
  });
});

describe('lacksDirPlaceholder', () => {
  it('flags a terminal command without {dir}', () => {
    expect(lacksDirPlaceholder('kitty')).toBe(true);
    expect(lacksDirPlaceholder('wt -d {dir}')).toBe(false);
  });

  it('says nothing about the system default', () => {
    expect(lacksDirPlaceholder('')).toBe(false);
  });
});
