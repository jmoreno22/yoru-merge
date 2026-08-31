/** Which shas are selected and where a Shift range would start from. */
export interface CommitSelection {
  readonly anchor: string | null;
  readonly shas: readonly string[];
}

/**
 * `replace` = plain click, `toggle` = Ctrl/Cmd click, `extend` = Shift click.
 */
export type SelectionMode = 'replace' | 'toggle' | 'extend';

export const EMPTY_SELECTION: CommitSelection = { anchor: null, shas: [] };

/**
 * Applies one click to the current selection.
 *
 * `order` is the visible row order, which is what a Shift range means to the
 * user: everything between the anchor and the clicked row as drawn, never the
 * commit graph's own topology. A range keeps the anchor so dragging Shift up
 * and down grows and shrinks the same block instead of walking away from it.
 */
export function applySelection(
  current: CommitSelection,
  order: readonly string[],
  sha: string,
  mode: SelectionMode,
): CommitSelection {
  if (mode === 'replace') {
    return { anchor: sha, shas: [sha] };
  }

  if (mode === 'toggle') {
    const selected = new Set(current.shas);
    if (selected.has(sha)) {
      selected.delete(sha);
    } else {
      selected.add(sha);
    }
    return {
      anchor: sha,
      shas: order.filter((candidate) => selected.has(candidate)),
    };
  }

  const anchorIndex = current.anchor === null ? -1 : order.indexOf(current.anchor);
  const targetIndex = order.indexOf(sha);
  if (anchorIndex < 0 || targetIndex < 0) {
    return { anchor: sha, shas: [sha] };
  }
  const from = Math.min(anchorIndex, targetIndex);
  const to = Math.max(anchorIndex, targetIndex);
  return { anchor: current.anchor, shas: order.slice(from, to + 1) };
}

/**
 * Drops shas that are no longer on screen, e.g. after a search narrows the
 * list. Returns the same object when nothing changed so signal writes stay
 * cheap and do not retrigger effects.
 */
export function pruneSelection(
  current: CommitSelection,
  order: readonly string[],
): CommitSelection {
  const visible = new Set(order);
  const shas = current.shas.filter((sha) => visible.has(sha));
  const anchor =
    current.anchor !== null && visible.has(current.anchor) ? current.anchor : null;
  if (shas.length === current.shas.length && anchor === current.anchor) {
    return current;
  }
  return { anchor, shas };
}
