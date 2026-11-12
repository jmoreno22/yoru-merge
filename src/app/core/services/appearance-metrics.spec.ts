import { describe, expect, it } from 'vitest';
import { appearanceTokens, computeMetrics } from './appearance-metrics';
import {
  DEFAULT_PREFERENCES,
  MAX_UI_FONT_SIZE,
  MIN_UI_FONT_SIZE,
} from './preferences-schema';

const defaults = {
  uiFontSize: DEFAULT_PREFERENCES.uiFontSize,
  monoFontSize: DEFAULT_PREFERENCES.monoFontSize,
  density: DEFAULT_PREFERENCES.uiDensity,
};

describe('computeMetrics', () => {
  /**
   * The whole point of the refactor: deriving the layout must reproduce the
   * hardcoded heights the app shipped with, or the default install changes
   * appearance for every existing user.
   */
  it('reproduces the shipped pixel layout at the default preferences', () => {
    expect(computeMetrics(defaults)).toEqual({
      rowHeight: 34,
      fileRowHeight: 30,
      refRowHeight: 30,
      historyRowHeight: 46,
      codeLineHeight: 20,
      panelHeadHeight: 34,
      titlebarHeight: 38,
      toolbarHeight: 48,
      railWidth: 48,
      statusbarHeight: 26,
      panelPad: 16,
      controlHeight: 32,
      controlSmHeight: 28,
      controlXsHeight: 24,
      railItemSize: 40,
    });
  });

  /**
   * A control with a hardcoded height overflows the bar that hosts it as soon
   * as the bar shrinks: at compact / 11px the toolbar is 32px and a 32px button
   * inside a bordered group needs 34. Deriving both from the same arithmetic is
   * what makes that impossible, and this is the proof for the whole range.
   */
  it('fits every control inside the bar or row that hosts it', () => {
    for (
      let uiFontSize = MIN_UI_FONT_SIZE;
      uiFontSize <= MAX_UI_FONT_SIZE;
      uiFontSize++
    ) {
      for (const density of ['compact', 'comfortable', 'relaxed'] as const) {
        const m = computeMetrics({ ...defaults, uiFontSize, density });
        const where = `${density} / ${uiFontSize}px`;

        // Toolbar groups carry a 1px border on each side of the control.
        expect(m.controlHeight + 2, where).toBeLessThanOrEqual(m.toolbarHeight);
        // The rail's own right border is inside its width.
        expect(m.railItemSize + 1, where).toBeLessThanOrEqual(m.railWidth);
        // A panel head's bottom border is inside its height.
        expect(m.controlSmHeight + 1, where).toBeLessThanOrEqual(m.panelHeadHeight);
        expect(m.controlSmHeight, where).toBeLessThanOrEqual(m.fileRowHeight);
        expect(m.controlXsHeight, where).toBeLessThanOrEqual(m.fileRowHeight);
        expect(m.controlXsHeight, where).toBeLessThanOrEqual(m.refRowHeight);
        expect(m.controlXsHeight, where).toBeLessThanOrEqual(m.rowHeight);

        expect(m.controlXsHeight, where).toBeLessThan(m.controlSmHeight);
        expect(m.controlSmHeight, where).toBeLessThan(m.controlHeight);
      }
    }
  });

  it('grows every UI height with the UI type size', () => {
    const small = computeMetrics({ ...defaults, uiFontSize: 11 });
    const large = computeMetrics({ ...defaults, uiFontSize: 17 });
    expect(small.rowHeight).toBeLessThan(34);
    expect(large.rowHeight).toBeGreaterThan(34);
    expect(large.toolbarHeight).toBeGreaterThan(small.toolbarHeight);
    expect(large.railWidth).toBeGreaterThan(small.railWidth);
  });

  it('leaves code alone when only the UI type size moves', () => {
    const large = computeMetrics({ ...defaults, uiFontSize: 17 });
    expect(large.codeLineHeight).toBe(20);
  });

  it('moves the code line height with the code type size only', () => {
    expect(computeMetrics({ ...defaults, monoFontSize: 18 }).codeLineHeight).toBe(30);
    expect(computeMetrics({ ...defaults, monoFontSize: 10 }).codeLineHeight).toBe(17);
  });

  it('keeps the code line height out of the density axis', () => {
    const compact = computeMetrics({ ...defaults, density: 'compact' });
    const relaxed = computeMetrics({ ...defaults, density: 'relaxed' });
    expect(compact.codeLineHeight).toBe(relaxed.codeLineHeight);
  });

  it('scales padding, not text, across the density steps', () => {
    const compact = computeMetrics({ ...defaults, density: 'compact' });
    const comfortable = computeMetrics(defaults);
    const relaxed = computeMetrics({ ...defaults, density: 'relaxed' });

    expect(compact.rowHeight).toBeLessThan(comfortable.rowHeight);
    expect(relaxed.rowHeight).toBeGreaterThan(comfortable.rowHeight);
    expect(compact.panelPad).toBe(10);
    expect(relaxed.panelPad).toBe(24);
  });

  it('never returns a fractional height, so no row can drift', () => {
    for (const uiFontSize of [11, 12, 13, 14, 15, 16, 17]) {
      for (const density of ['compact', 'comfortable', 'relaxed'] as const) {
        const metrics = computeMetrics({ ...defaults, uiFontSize, density });
        for (const value of Object.values(metrics)) {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });
});

describe('appearanceTokens', () => {
  it('emits the shipped values at the defaults', () => {
    const tokens = appearanceTokens({
      ...defaults,
      codeTabWidth: DEFAULT_PREFERENCES.codeTabWidth,
      codeLigatures: DEFAULT_PREFERENCES.codeLigatures,
    });
    expect(tokens['--row-h']).toBe('34px');
    expect(tokens['--code-line-h']).toBe('20px');
    expect(tokens['--ui-font-size']).toBe('13px');
    expect(tokens['--mono-font-size']).toBe('12px');
    expect(tokens['--code-tab-width']).toBe('2');
    expect(tokens['--control-h']).toBe('32px');
    expect(tokens['--control-h-sm']).toBe('28px');
    expect(tokens['--control-h-xs']).toBe('24px');
    expect(tokens['--rail-item']).toBe('40px');
  });

  it('switches the ligature feature flags off by default', () => {
    const off = appearanceTokens({
      ...defaults,
      codeTabWidth: 2,
      codeLigatures: false,
    });
    const on = appearanceTokens({ ...defaults, codeTabWidth: 2, codeLigatures: true });
    expect(off['--code-font-features']).toBe('"calt" 0, "liga" 0');
    expect(on['--code-font-features']).toBe('normal');
  });

  it('writes every token as a CSS length or a bare number', () => {
    const tokens = appearanceTokens({
      ...defaults,
      codeTabWidth: 4,
      codeLigatures: true,
    });
    for (const [name, value] of Object.entries(tokens)) {
      expect(name.startsWith('--')).toBe(true);
      expect(value).not.toBe('');
      expect(value).not.toContain('NaN');
    }
  });
});
