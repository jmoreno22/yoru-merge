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
  /**
   * The git status tones as *text*. The fills (`--color-git-*`) are tuned for
   * dots, borders and tints; as type on a light surface the green and the
   * amber measure about 1.1:1.
   */
  readonly addedText: string;
  readonly modifiedText: string;
  readonly deletedText: string;
  readonly renamedText: string;
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
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
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
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff4d5e',
      renamedText: '#00e5ff',
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
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
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
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff6271',
      renamedText: '#00e5ff',
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
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
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
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff6675',
      renamedText: '#00e5ff',
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
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
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
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ffa6af',
      renamedText: '#00e5ff',
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
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
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
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff8a95',
      renamedText: '#00e5ff',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.5)',
    },
  },
  {
    id: 'yugure',
    label: 'Yugure',
    description: 'Twilight plum: violet-tinted surfaces, the hour before Yoru.',
    light: {
      bg: '#faf7ff',
      surface: '#ffffff',
      surfaceRaised: '#f3edfc',
      panel: '#e8def8',
      border: '#cdbde9',
      text: '#1d1530',
      textMuted: '#54467a',
      textFaint: '#5f5185',
      conflictText: '#a8106a',
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
      shadowPanel: '0 18px 50px rgb(45 25 80 / 0.14)',
    },
    dark: {
      bg: '#0e0a16',
      surface: '#140f1f',
      surfaceRaised: '#1e172d',
      panel: '#282039',
      border: '#3b2f52',
      text: '#f7f2ff',
      textMuted: '#d2c3ec',
      textFaint: '#a593c4',
      conflictText: '#ff6fc4',
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff6b7a',
      renamedText: '#00e5ff',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.5)',
    },
  },
  {
    id: 'matcha',
    label: 'Matcha',
    description: 'Deep green tea, calm for long review sessions.',
    light: {
      bg: '#f5f9f3',
      surface: '#ffffff',
      surfaceRaised: '#ecf3e9',
      panel: '#dfeada',
      border: '#bfd3b8',
      text: '#12211a',
      textMuted: '#43584b',
      textFaint: '#4f6457',
      conflictText: '#a3125e',
      addedText: '#0a6236',
      modifiedText: '#714c00',
      deletedText: '#a8142a',
      renamedText: '#00616f',
      shadowPanel: '0 18px 50px rgb(20 50 32 / 0.14)',
    },
    dark: {
      bg: '#07100c',
      surface: '#0b1611',
      surfaceRaised: '#13211a',
      panel: '#1b2c23',
      border: '#2b4235',
      text: '#eef7f1',
      textMuted: '#bfdac8',
      textFaint: '#8fb09b',
      conflictText: '#ff7ac8',
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff6b78',
      renamedText: '#00e5ff',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.5)',
    },
  },
  {
    id: 'sumi',
    label: 'Sumi',
    description: 'Ink: neutral graphite, near black but never black. Washi in light.',
    light: {
      bg: '#f6f6f3',
      surface: '#ffffff',
      surfaceRaised: '#eeeeea',
      panel: '#e3e3de',
      border: '#cbcbc4',
      text: '#19191b',
      textMuted: '#48484e',
      textFaint: '#57575e',
      conflictText: '#a8105e',
      addedText: '#0b6b3c',
      modifiedText: '#7a5200',
      deletedText: '#b3152a',
      renamedText: '#00697a',
      shadowPanel: '0 18px 50px rgb(25 25 27 / 0.14)',
    },
    dark: {
      bg: '#0b0b0d',
      surface: '#111114',
      surfaceRaised: '#1a1a1e',
      panel: '#242429',
      border: '#35353c',
      text: '#f2f2f4',
      textMuted: '#c9c9cf',
      textFaint: '#9b9ba4',
      conflictText: '#ff5cbf',
      addedText: '#35f2a2',
      modifiedText: '#ffd166',
      deletedText: '#ff5f6d',
      renamedText: '#00e5ff',
      shadowPanel: '0 24px 80px rgb(0 0 0 / 0.55)',
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
    '--app-added-text': surfaces.addedText,
    '--app-modified-text': surfaces.modifiedText,
    '--app-deleted-text': surfaces.deletedText,
    '--app-renamed-text': surfaces.renamedText,
    '--app-shadow-panel': surfaces.shadowPanel,
  };
}
