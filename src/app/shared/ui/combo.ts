/**
 * Keyboard combo parsing for `KeyboardShortcutsService`. Pure functions so the
 * matching rules can be tested without a document.
 *
 * Grammar: `modifier+...+key`, case-insensitive. `mod` is Ctrl on the platforms
 * YoruMerge ships on (Windows and Linux); it exists so shortcut tables read the
 * same as the docs they are copied from.
 */

export interface ParsedCombo {
  /** Normalised key name, always lower case (`enter`, `k`, `arrowdown`, `space`). */
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

/** The parts of a `KeyboardEvent` matching needs. */
export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  del: 'delete',
  ins: 'insert',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  pgup: 'pageup',
  pgdn: 'pagedown',
  pagedn: 'pagedown',
  return: 'enter',
  plus: '+',
  minus: '-',
  comma: ',',
  period: '.',
  slash: '/',
};

const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  escape: 'Esc',
  delete: 'Del',
  enter: 'Enter',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  home: 'Home',
  end: 'End',
  insert: 'Ins',
};

/** Normalises a `KeyboardEvent.key` to the vocabulary `parseCombo` produces. */
export function normalizeEventKey(key: string): string {
  if (key === ' ' || key === 'Spacebar') return 'space';
  return key.toLowerCase();
}

export function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+');
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let key = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]?.trim() ?? '';
    if (part === '') {
      // An empty trailing segment is the literal plus key (`mod++`).
      if (i > 0) key = '+';
      continue;
    }
    switch (part) {
      case 'mod':
      case 'ctrl':
      case 'control':
        ctrl = true;
        break;
      case 'alt':
      case 'option':
        alt = true;
        break;
      case 'shift':
        shift = true;
        break;
      case 'meta':
      case 'cmd':
      case 'super':
        meta = true;
        break;
      default:
        key = KEY_ALIASES[part] ?? part;
        break;
    }
  }

  return { key, ctrl, alt, shift, meta };
}

/**
 * Exact match on every modifier — a shortcut bound to `mod+k` must not fire on
 * `mod+shift+k`, otherwise two shortcuts on the same key collide silently.
 */
export function matchesCombo(event: KeyEventLike, parsed: ParsedCombo): boolean {
  return (
    normalizeEventKey(event.key) === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift &&
    event.metaKey === parsed.meta
  );
}

/**
 * Display tokens for `<yoru-kbd>`, e.g. `mod+shift+p` becomes
 * `['Ctrl', 'Shift', 'P']`. Words rather than arrow glyphs: the same string has
 * to read correctly in the command palette, the shortcut table and a tooltip.
 */
export function formatCombo(combo: string): string[] {
  const parsed = parseCombo(combo);
  const tokens: string[] = [];
  if (parsed.ctrl) tokens.push('Ctrl');
  if (parsed.alt) tokens.push('Alt');
  if (parsed.shift) tokens.push('Shift');
  if (parsed.meta) tokens.push('Meta');
  if (parsed.key) {
    tokens.push(
      DISPLAY_NAMES[parsed.key] ??
        (parsed.key.length === 1
          ? parsed.key.toUpperCase()
          : parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1)),
    );
  }
  return tokens;
}
