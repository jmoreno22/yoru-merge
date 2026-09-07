import { describe, expect, it, vi } from 'vitest';
import {
  createEscapeLayerRegistry,
  EscapeRank,
  registerEscapeLayer,
  resolveEscape,
  unregisterEscapeLayer,
} from './escape-layers';

/**
 * Bit order (low to high) mirrors the AC-10 precedence so the mask value
 * itself already sorts combinations from none-open to all-open.
 */
const LAYERS = [
  { bit: 0, rank: EscapeRank.diffWorkspace },
  { bit: 1, rank: EscapeRank.stackedPanel },
  { bit: 2, rank: EscapeRank.lineSelection },
  { bit: 3, rank: EscapeRank.textField },
  { bit: 4, rank: EscapeRank.commandPalette },
  { bit: 5, rank: EscapeRank.dialog },
] as const;

const NON_TEXT_LAYERS = LAYERS.filter((layer) => layer.rank !== EscapeRank.textField);

describe('escape layer registry — AC-10 precedence matrix', () => {
  for (let mask = 0; mask < 64; mask++) {
    const present = LAYERS.filter((layer) => (mask & (1 << layer.bit)) !== 0);
    const expectedRank = present.length
      ? Math.max(...present.map((layer) => layer.rank))
      : null;

    it(`resolves rank ${expectedRank} for mask ${mask.toString(2).padStart(6, '0')}`, () => {
      let registry = createEscapeLayerRegistry();
      const dismissByRank = new Map<number, () => void>();

      for (const layer of NON_TEXT_LAYERS) {
        if ((mask & (1 << layer.bit)) === 0) continue;
        const dismiss = vi.fn();
        dismissByRank.set(layer.rank, dismiss);
        registry = registerEscapeLayer(registry, layer.rank, dismiss).registry;
      }

      const textFieldOpen = (mask & (1 << 3)) !== 0;
      const focusedEditable = textFieldOpen
        ? { hasContent: true, clearsOnEscape: true }
        : null;

      const resolution = resolveEscape(registry, focusedEditable);

      if (expectedRank === null) {
        expect(resolution).toBeNull();
        return;
      }

      expect(resolution?.rank).toBe(expectedRank);

      if (expectedRank === EscapeRank.textField) {
        expect(resolution?.dismiss).toBeNull();
      } else {
        expect(resolution?.dismiss).toBe(dismissByRank.get(expectedRank));
      }
    });
  }

  it('resolves the next rank down after the topmost layer unregisters', () => {
    let registry = createEscapeLayerRegistry();
    const dismissDialog = vi.fn();
    const dismissPalette = vi.fn();

    const dialog = registerEscapeLayer(registry, EscapeRank.dialog, dismissDialog);
    registry = dialog.registry;
    const palette = registerEscapeLayer(
      registry,
      EscapeRank.commandPalette,
      dismissPalette,
    );
    registry = palette.registry;

    expect(resolveEscape(registry, null)?.dismiss).toBe(dismissDialog);

    registry = unregisterEscapeLayer(registry, dialog.id);

    const resolution = resolveEscape(registry, null);
    expect(resolution?.rank).toBe(EscapeRank.commandPalette);
    expect(resolution?.dismiss).toBe(dismissPalette);
  });

  it('resolves ties within the same rank to the most recently registered layer', () => {
    let registry = createEscapeLayerRegistry();
    const dismissFirst = vi.fn();
    const dismissSecond = vi.fn();

    registry = registerEscapeLayer(
      registry,
      EscapeRank.stackedPanel,
      dismissFirst,
    ).registry;
    registry = registerEscapeLayer(
      registry,
      EscapeRank.stackedPanel,
      dismissSecond,
    ).registry;

    const resolution = resolveEscape(registry, null);
    expect(resolution?.rank).toBe(EscapeRank.stackedPanel);
    expect(resolution?.dismiss).toBe(dismissSecond);
  });
});

describe('escape layer registry — a focused field must opt in (T17, F-1)', () => {
  it('never resolves the text field when the field has no content, opted in or not', () => {
    const registry = createEscapeLayerRegistry();

    expect(
      resolveEscape(registry, { hasContent: false, clearsOnEscape: true }),
    ).toBeNull();
    expect(
      resolveEscape(registry, { hasContent: false, clearsOnEscape: false }),
    ).toBeNull();
  });

  it('falls through to the topmost open layer when the field has no content', () => {
    let registry = createEscapeLayerRegistry();
    const dismissLineSelection = vi.fn();
    registry = registerEscapeLayer(
      registry,
      EscapeRank.lineSelection,
      dismissLineSelection,
    ).registry;

    for (const clearsOnEscape of [true, false]) {
      const resolution = resolveEscape(registry, { hasContent: false, clearsOnEscape });
      expect(resolution?.rank).toBe(EscapeRank.lineSelection);
      expect(resolution?.dismiss).toBe(dismissLineSelection);
    }
  });

  it('resolves the diff workspace when only it is open and the field does not opt in', () => {
    let registry = createEscapeLayerRegistry();
    const dismissWorkspace = vi.fn();
    registry = registerEscapeLayer(
      registry,
      EscapeRank.diffWorkspace,
      dismissWorkspace,
    ).registry;

    const resolution = resolveEscape(registry, {
      hasContent: true,
      clearsOnEscape: false,
    });
    expect(resolution?.rank).toBe(EscapeRank.diffWorkspace);
    expect(resolution?.dismiss).toBe(dismissWorkspace);
  });

  it('resolves the line selection over the diff workspace when the field does not opt in', () => {
    let registry = createEscapeLayerRegistry();
    registry = registerEscapeLayer(
      registry,
      EscapeRank.diffWorkspace,
      vi.fn(),
    ).registry;
    const dismissLineSelection = vi.fn();
    registry = registerEscapeLayer(
      registry,
      EscapeRank.lineSelection,
      dismissLineSelection,
    ).registry;

    const resolution = resolveEscape(registry, {
      hasContent: true,
      clearsOnEscape: false,
    });
    expect(resolution?.rank).toBe(EscapeRank.lineSelection);
    expect(resolution?.dismiss).toBe(dismissLineSelection);
  });

  it('resolves null when nothing is open and the field does not opt in', () => {
    const registry = createEscapeLayerRegistry();

    expect(
      resolveEscape(registry, { hasContent: true, clearsOnEscape: false }),
    ).toBeNull();
  });

  it('F-18: a field that opts in still wins over an open line selection', () => {
    let registry = createEscapeLayerRegistry();
    registry = registerEscapeLayer(
      registry,
      EscapeRank.lineSelection,
      vi.fn(),
    ).registry;

    const resolution = resolveEscape(registry, {
      hasContent: true,
      clearsOnEscape: true,
    });
    expect(resolution?.rank).toBe(EscapeRank.textField);
    expect(resolution?.dismiss).toBeNull();
  });

  it('F-18: a field that opts in still loses to an open dialog', () => {
    let registry = createEscapeLayerRegistry();
    const dismissDialog = vi.fn();
    registry = registerEscapeLayer(registry, EscapeRank.dialog, dismissDialog).registry;

    const resolution = resolveEscape(registry, {
      hasContent: true,
      clearsOnEscape: true,
    });
    expect(resolution?.rank).toBe(EscapeRank.dialog);
    expect(resolution?.dismiss).toBe(dismissDialog);
  });
});
