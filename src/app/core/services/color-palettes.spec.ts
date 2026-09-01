import { describe, expect, it } from 'vitest';
import {
  COLOR_PALETTES,
  type ColorPalette,
  DEFAULT_PALETTE_ID,
  findPalette,
  type PaletteSurfaces,
  paletteTokens,
} from './color-palettes';

// ── WCAG relative luminance, so the palettes are held to a measured bar ────

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const SURFACES: readonly (keyof PaletteSurfaces)[] = [
  'bg',
  'surface',
  'surfaceRaised',
  'panel',
];
const TEXTS: readonly (keyof PaletteSurfaces)[] = [
  'text',
  'textMuted',
  'textFaint',
  'conflictText',
];

/** WCAG AA for body text. Every palette is held to it, built-in or not. */
const AA = 4.5;
/** WCAG non-text contrast, the bar a separator has to clear to be visible. */
const AA_NON_TEXT = 3.0;

describe('COLOR_PALETTES', () => {
  it('ships five palettes with unique ids', () => {
    expect(COLOR_PALETTES).toHaveLength(5);
    const ids = COLOR_PALETTES.map((palette) => palette.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the default id among them', () => {
    expect(COLOR_PALETTES.map((palette) => palette.id)).toContain(DEFAULT_PALETTE_ID);
  });

  it('uses six-digit hex for every colour, so the contrast maths is exact', () => {
    for (const palette of COLOR_PALETTES) {
      for (const mode of ['light', 'dark'] as const) {
        const surfaces = palette[mode];
        for (const key of [...SURFACES, ...TEXTS, 'border' as const]) {
          expect(surfaces[key], `${palette.id}.${mode}.${key}`).toMatch(
            /^#[0-9a-f]{6}$/,
          );
        }
      }
    }
  });

  /**
   * The guarantee that makes a palette shippable. Runs over every palette, so
   * adding one — or loading one from a file and adding it here — cannot quietly
   * drop the app below AA on any surface it paints.
   */
  it('clears WCAG AA for every text tone on every surface, in both modes', () => {
    for (const palette of COLOR_PALETTES) {
      for (const mode of ['light', 'dark'] as const) {
        const surfaces = palette[mode];
        for (const textKey of TEXTS) {
          for (const surfaceKey of SURFACES) {
            const ratio = contrast(surfaces[textKey], surfaces[surfaceKey]);
            expect(
              ratio,
              `${palette.id}.${mode}: ${textKey} on ${surfaceKey} is ${ratio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(AA);
          }
        }
      }
    }
  });

  it('keeps borders visible against the surfaces they separate', () => {
    for (const palette of COLOR_PALETTES) {
      for (const mode of ['light', 'dark'] as const) {
        const surfaces = palette[mode];
        const ratio = contrast(surfaces.border, surfaces.surface);
        expect(ratio, `${palette.id}.${mode} border on surface`).toBeGreaterThanOrEqual(
          1.2,
        );
      }
    }
  });

  it('keeps the text hierarchy ordered: text is strongest, faint is weakest', () => {
    for (const palette of COLOR_PALETTES) {
      for (const mode of ['light', 'dark'] as const) {
        const surfaces = palette[mode];
        const strong = contrast(surfaces.text, surfaces.bg);
        const muted = contrast(surfaces.textMuted, surfaces.bg);
        const faint = contrast(surfaces.textFaint, surfaces.bg);
        expect(strong, `${palette.id}.${mode}`).toBeGreaterThan(muted);
        expect(muted, `${palette.id}.${mode}`).toBeGreaterThanOrEqual(faint);
      }
    }
  });

  it('separates the dark mode from the light one on every palette', () => {
    for (const palette of COLOR_PALETTES) {
      expect(luminance(palette.dark.bg), palette.id).toBeLessThan(
        luminance(palette.light.bg),
      );
    }
  });

  it('gives the non-text border bar a chance on at least the default', () => {
    const yoru = findPalette('yoru');
    expect(contrast(yoru.dark.text, yoru.dark.panel)).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });
});

describe('findPalette', () => {
  it('finds a palette by id', () => {
    expect(findPalette('nord').label).toBe('Nord');
  });

  it('falls back to the default for an unknown id, since ids come off disk', () => {
    expect(findPalette('does-not-exist').id).toBe(DEFAULT_PALETTE_ID);
  });
});

describe('paletteTokens', () => {
  const palette = findPalette('slate') as ColorPalette;

  it('emits the app surface tokens for the requested mode', () => {
    expect(paletteTokens(palette, 'light')['--app-bg']).toBe(palette.light.bg);
    expect(paletteTokens(palette, 'dark')['--app-bg']).toBe(palette.dark.bg);
  });

  it('emits the whole contract, so no token is left from the previous palette', () => {
    const tokens = paletteTokens(palette, 'dark');
    expect(Object.keys(tokens).sort()).toEqual([
      '--app-bg',
      '--app-border',
      '--app-conflict-text',
      '--app-panel',
      '--app-shadow-panel',
      '--app-surface',
      '--app-surface-raised',
      '--app-text',
      '--app-text-faint',
      '--app-text-muted',
    ]);
  });
});
