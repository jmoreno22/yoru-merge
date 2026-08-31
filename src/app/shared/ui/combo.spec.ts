import { describe, expect, it } from 'vitest';
import { formatCombo, matchesCombo, normalizeEventKey, parseCombo } from './combo';

function event(
  key: string,
  modifiers: Partial<{
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  }> = {},
) {
  return {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    altKey: modifiers.alt ?? false,
    shiftKey: modifiers.shift ?? false,
    metaKey: modifiers.meta ?? false,
  };
}

describe('parseCombo', () => {
  it('maps mod to ctrl on Windows and Linux', () => {
    expect(parseCombo('mod+enter')).toEqual({
      key: 'enter',
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    });
  });

  it('accepts every modifier and is case-insensitive', () => {
    expect(parseCombo('Ctrl+Alt+Shift+Meta+P')).toEqual({
      key: 'p',
      ctrl: true,
      alt: true,
      shift: true,
      meta: true,
    });
  });

  it('resolves key aliases', () => {
    expect(parseCombo('esc').key).toBe('escape');
    expect(parseCombo('mod+up').key).toBe('arrowup');
    expect(parseCombo('pgdn').key).toBe('pagedown');
  });

  it('handles the literal plus key', () => {
    expect(parseCombo('mod++')).toEqual({
      key: '+',
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    });
  });
});

describe('normalizeEventKey', () => {
  it('names the space bar', () => {
    expect(normalizeEventKey(' ')).toBe('space');
  });

  it('lower-cases shifted letters', () => {
    expect(normalizeEventKey('P')).toBe('p');
  });
});

describe('matchesCombo', () => {
  it('matches an exact combo', () => {
    expect(matchesCombo(event('Enter', { ctrl: true }), parseCombo('mod+enter'))).toBe(
      true,
    );
  });

  it('does not fire when an extra modifier is held', () => {
    const held = event('Enter', { ctrl: true, shift: true });
    expect(matchesCombo(held, parseCombo('mod+enter'))).toBe(false);
  });

  it('matches shifted letters through the normalised key', () => {
    const held = event('P', { ctrl: true, shift: true });
    expect(matchesCombo(held, parseCombo('mod+shift+p'))).toBe(true);
  });

  it('rejects a different key', () => {
    expect(matchesCombo(event('k', { ctrl: true }), parseCombo('mod+enter'))).toBe(
      false,
    );
  });
});

describe('formatCombo', () => {
  it('orders modifiers and spells out named keys', () => {
    expect(formatCombo('mod+shift+p')).toEqual(['Ctrl', 'Shift', 'P']);
    expect(formatCombo('mod+up')).toEqual(['Ctrl', 'Up']);
    expect(formatCombo('esc')).toEqual(['Esc']);
  });
});
