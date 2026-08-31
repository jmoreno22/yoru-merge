/**
 * Viewport clamping for floating menus. Pure maths, no DOM — the context menu
 * measures its panel and hands the numbers over, which keeps the geometry
 * unit-testable.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Distance kept between a menu and the window edge. */
export const MENU_VIEWPORT_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Places a root menu at `anchor`, flipping it left/up when it would overflow
 * and clamping to the viewport when it is too large to flip.
 */
export function clampMenuPosition(
  anchor: Point,
  menu: Size,
  viewport: Size,
  margin: number = MENU_VIEWPORT_MARGIN,
): Point {
  const maxX = viewport.width - margin - menu.width;
  const maxY = viewport.height - margin - menu.height;

  let x = anchor.x;
  if (x > maxX) {
    x = anchor.x - menu.width;
  }

  let y = anchor.y;
  if (y > maxY) {
    y = anchor.y - menu.height;
  }

  return { x: clamp(x, margin, maxX), y: clamp(y, margin, maxY) };
}

/**
 * Places a submenu beside its parent item: to the right by default, flipped to
 * the left when the right side has no room. The 4 px overlap keeps the pointer
 * inside the menu while travelling diagonally towards the submenu.
 */
export function clampSubmenuPosition(
  item: Bounds,
  menu: Size,
  viewport: Size,
  margin: number = MENU_VIEWPORT_MARGIN,
): Point {
  const overlap = 4;
  const maxX = viewport.width - margin - menu.width;
  const maxY = viewport.height - margin - menu.height;

  let x = item.right - overlap;
  if (x > maxX) {
    x = item.left - menu.width + overlap;
  }

  const y = item.top - overlap;

  return { x: clamp(x, margin, maxX), y: clamp(y, margin, maxY) };
}
