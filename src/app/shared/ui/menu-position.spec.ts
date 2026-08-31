import { describe, expect, it } from 'vitest';
import { clampMenuPosition, clampSubmenuPosition } from './menu-position';

const viewport = { width: 1000, height: 800 };

describe('clampMenuPosition', () => {
  it('keeps the anchor position when the menu fits', () => {
    expect(
      clampMenuPosition({ x: 100, y: 100 }, { width: 200, height: 300 }, viewport),
    ).toEqual({ x: 100, y: 100 });
  });

  it('flips left when the right edge would overflow', () => {
    const at = clampMenuPosition(
      { x: 950, y: 100 },
      { width: 200, height: 300 },
      viewport,
    );
    expect(at.x).toBe(750);
  });

  it('flips up when the bottom edge would overflow', () => {
    const at = clampMenuPosition(
      { x: 100, y: 700 },
      { width: 200, height: 300 },
      viewport,
    );
    expect(at.y).toBe(400);
  });

  it('clamps instead of flipping off-screen', () => {
    const at = clampMenuPosition(
      { x: 20, y: 20 },
      { width: 200, height: 790 },
      viewport,
    );
    expect(at).toEqual({ x: 20, y: 8 });
  });

  it('pins to the margin when the menu is larger than the viewport', () => {
    const at = clampMenuPosition(
      { x: 500, y: 500 },
      { width: 1200, height: 900 },
      viewport,
    );
    expect(at).toEqual({ x: 8, y: 8 });
  });
});

describe('clampSubmenuPosition', () => {
  const item = { left: 100, top: 200, right: 300, bottom: 224 };

  it('opens to the right of the parent item', () => {
    const at = clampSubmenuPosition(item, { width: 180, height: 120 }, viewport);
    expect(at).toEqual({ x: 296, y: 196 });
  });

  it('flips to the left when there is no room on the right', () => {
    const near = { left: 700, top: 200, right: 900, bottom: 224 };
    const at = clampSubmenuPosition(near, { width: 180, height: 120 }, viewport);
    expect(at.x).toBe(524);
  });

  it('pulls the submenu up when it would overflow the bottom', () => {
    const low = { left: 100, top: 760, right: 300, bottom: 784 };
    const at = clampSubmenuPosition(low, { width: 180, height: 200 }, viewport);
    expect(at.y).toBe(592);
  });
});
