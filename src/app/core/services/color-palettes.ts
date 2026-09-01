/**
 * Full surface palettes.
 *
 * A palette is a different axis from the accent: the accent repoints one
 * colour, a palette replaces every surface and text tone. Kept as data rather
 * than as static CSS blocks so a palette loaded at runtime — a file the user
 * supplies — can go through exactly the same path as a built-in one: build the
 * token record, hand it to `AppearanceService`.
 *
 * Every text tone in every palette clears WCAG AA (4.5:1) against all four of
 * that palette's own surfaces in that mode. The ratios were measured, not
 * eyeballed; a new palette has to be held to the same bar, which is what
 * `color-palettes.spec.ts` checks.
 */

/** The theme-aware surface contract. Names match the `--app-*` tokens. */
export interface PaletteSurfaces {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly panel: string;
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textFaint: string;
  readonly conflictText: string;
  readonly shadowPanel: string;
}

export interface ColorPalette {
  readonly id: string;
  readonly label: string;
  /** One-line description for the settings picker. */
  readonly description: string;
  readonly light: PaletteSurfaces;
  readonly dark: PaletteSurfaces;
}

export const COLOR_PALETTES: readonly ColorPalette[] = [
  {
    id: 'yoru',
    label: 'Yoru Night',
    description: 'The default: deep blue surfaces under neon accents.',
    light: {
      bg: '#f7faff',
      surface: '#ffffff',
      surfaceRaised: '#eef4ff',
      panel: '#e3ecfb',
      border: '#b9c8e8',
      text: '#101426',
      textMuted: '#465a7f',
      textFaint: '#546889',
      conflictText: '#b0116a',
      shadowPanel: '0 18px 50px rgb(24 45 90 / 0.14)',
    },
    dark: {
      bg: '#050712',
      surface: '#080b18',
      surfaceRaised: '#12162a',
      panel: '#1a2038',
      border: '#252d4a',
      text: '#f4f8ff',
      textMuted: '#afc8f7',
      textFaint: '#7e93b8',
      conflictText: '#ff4fb8',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.45)',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral blue-grey. The sober option for a shared screen.',
    light: {
      bg: '#f8fafc',
      surface: '#ffffff',
      surfaceRaised: '#f1f5f9',
      panel: '#e2e8f0',
      border: '#cbd5e1',
      text: '#0f172a',
      textMuted: '#475569',
      textFaint: '#4f6178',
      conflictText: '#b01243',
      shadowPanel: '0 18px 50px rgb(15 23 42 / 0.12)',
    },
    dark: {
      bg: '#0b0f16',
      surface: '#111826',
      surfaceRaised: '#1b2432',
      panel: '#253040',
      border: '#334155',
      text: '#f1f5f9',
      textMuted: '#cbd5e1',
      textFaint: '#94a3b8',
      conflictText: '#ff6b91',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.5)',
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Warm and low-glare, closer to a printed page.',
    light: {
      bg: '#fbf9f4',
      surface: '#ffffff',
      surfaceRaised: '#f5f1e8',
      panel: '#ece5d8',
      border: '#d6cdb9',
      text: '#2a2418',
      textMuted: '#5c5340',
      textFaint: '#6b6250',
      conflictText: '#a3123c',
      shadowPanel: '0 18px 50px rgb(74 66 50 / 0.14)',
    },
    dark: {
      bg: '#17150f',
      surface: '#1e1b14',
      surfaceRaised: '#29251b',
      panel: '#363024',
      border: '#4a4232',
      text: '#f5f1e8',
      textMuted: '#d6cdb9',
      textFaint: '#a89d85',
      conflictText: '#ff7a96',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.55)',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'The arctic palette: cool, desaturated, even-toned.',
    light: {
      bg: '#eceff4',
      surface: '#ffffff',
      surfaceRaised: '#e5e9f0',
      panel: '#d8dee9',
      border: '#c2ccd9',
      text: '#2e3440',
      textMuted: '#434c5e',
      textFaint: '#4c566a',
      conflictText: '#a3123c',
      shadowPanel: '0 18px 50px rgb(46 52 64 / 0.14)',
    },
    dark: {
      bg: '#242933',
      surface: '#2e3440',
      surfaceRaised: '#3b4252',
      panel: '#434c5e',
      border: '#4c566a',
      text: '#eceff4',
      textMuted: '#d8dee9',
      textFaint: '#b9c2d0',
      conflictText: '#ffa9bd',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.45)',
    },
  },
  {
    id: 'solarized',
    label: 'Solarized',
    description: 'Ethan Schoonover’s fixed-lightness classic.',
    light: {
      bg: '#fdf6e3',
      surface: '#ffffff',
      surfaceRaised: '#f5efdc',
      panel: '#eee8d5',
      border: '#d9d2bf',
      text: '#073642',
      textMuted: '#4d6570',
      textFaint: '#4f666f',
      conflictText: '#a5142c',
      shadowPanel: '0 18px 50px rgb(7 54 66 / 0.14)',
    },
    dark: {
      bg: '#002b36',
      surface: '#073642',
      surfaceRaised: '#0b3f4c',
      panel: '#0f4655',
      border: '#1a5766',
      text: '#eee8d5',
      textMuted: '#b0bdbd',
      textFaint: '#a2afaf',
      conflictText: '#ff9dad',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.5)',
    },
  },
];

export const DEFAULT_PALETTE_ID = 'yoru';

/** Falls back to the default rather than throwing: the id comes off disk. */
export function findPalette(id: string): ColorPalette {
  return (
    COLOR_PALETTES.find((palette) => palette.id === id) ??
    (COLOR_PALETTES[0] as ColorPalette)
  );
}

/** The `--app-*` tokens for one palette in one resolved theme. */
export function paletteTokens(
  palette: ColorPalette,
  mode: 'light' | 'dark',
): Record<string, string> {
  const surfaces = mode === 'dark' ? palette.dark : palette.light;
  return {
    '--app-bg': surfaces.bg,
    '--app-surface': surfaces.surface,
    '--app-surface-raised': surfaces.surfaceRaised,
    '--app-panel': surfaces.panel,
    '--app-border': surfaces.border,
    '--app-text': surfaces.text,
    '--app-text-muted': surfaces.textMuted,
    '--app-text-faint': surfaces.textFaint,
    '--app-conflict-text': surfaces.conflictText,
    '--app-shadow-panel': surfaces.shadowPanel,
  };
}
