/**
 * Fixed Esc precedence (ADR-0002, AC-10): dialog outranks the command
 * palette, which outranks an opted-in text field with content, and so on down
 * to the diff workspace itself. Higher number wins.
 */
export const EscapeRank = {
  dialog: 6,
  commandPalette: 5,
  textField: 4,
  lineSelection: 3,
  stackedPanel: 2,
  diffWorkspace: 1,
} as const;

export type EscapeRankValue = (typeof EscapeRank)[keyof typeof EscapeRank];

export interface EscapeLayerEntry {
  readonly id: number;
  readonly rank: EscapeRankValue;
  readonly dismiss: () => void;
}

export type EscapeLayerRegistry = readonly EscapeLayerEntry[];

export type FocusedEditable = { hasContent: boolean; clearsOnEscape: boolean } | null;

export interface EscapeResolution {
  readonly rank: EscapeRankValue;
  readonly dismiss: (() => void) | null;
}

export function createEscapeLayerRegistry(): EscapeLayerRegistry {
  return [];
}

export function registerEscapeLayer(
  registry: EscapeLayerRegistry,
  rank: EscapeRankValue,
  dismiss: () => void,
): { registry: EscapeLayerRegistry; id: number } {
  const nextId = registry.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
  return {
    registry: [...registry, { id: nextId, rank, dismiss }],
    id: nextId,
  };
}

export function unregisterEscapeLayer(
  registry: EscapeLayerRegistry,
  id: number,
): EscapeLayerRegistry {
  return registry.filter((entry) => entry.id !== id);
}

export function resolveEscape(
  registry: EscapeLayerRegistry,
  focusedEditable: FocusedEditable,
): EscapeResolution | null {
  // Ties within a rank resolve to the most recently registered entry, so scan
  // registration order and let a later match overwrite an earlier one.
  let topmost: EscapeLayerEntry | null = null;
  for (const entry of registry) {
    if (!topmost || entry.rank >= topmost.rank) topmost = entry;
  }

  if (topmost && topmost.rank > EscapeRank.textField) {
    return { rank: topmost.rank, dismiss: topmost.dismiss };
  }

  // A field is a layer only where it opted in: Esc must not wipe a draft the
  // author never asked to be clearable (AC-15).
  if (focusedEditable?.hasContent && focusedEditable.clearsOnEscape) {
    return { rank: EscapeRank.textField, dismiss: null };
  }

  if (topmost) {
    return { rank: topmost.rank, dismiss: topmost.dismiss };
  }

  return null;
}
