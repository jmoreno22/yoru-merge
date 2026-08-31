import type { RailView } from '../../../core/services/preferences-schema';
import type { YoruIconName } from '../../icons';
import type { RefsSectionId } from '../sidebar/refs-tree';

export type RailItemId =
  | 'changes'
  | 'history'
  | 'refs'
  | 'remotes'
  | 'tags'
  | 'stashes'
  | 'reflog';

export interface RailItem {
  readonly id: RailItemId;
  readonly label: string;
  readonly icon: YoruIconName;
  /** Centre view the item selects; `null` means it only toggles the panel. */
  readonly view: RailView | null;
  /** Refs-panel section the item opens, when it maps to one. */
  readonly section: RefsSectionId | null;
  /** Combo registered for the item, shown in its tooltip. */
  readonly shortcut: string | null;
}

/**
 * The icon rail, top to bottom.
 *
 * Only three items own a centre view; Remotes, Tags and Stashes are refs-panel
 * destinations, so they open the panel on their section and leave the history
 * where it is rather than pretending to be four more centre views.
 */
export const RAIL_ITEMS: readonly RailItem[] = [
  {
    id: 'changes',
    label: 'Changes',
    icon: 'lucideFileDiff',
    view: 'changes',
    section: null,
    shortcut: 'mod+1',
  },
  {
    id: 'history',
    label: 'History',
    icon: 'lucideGitCommitHorizontal',
    view: 'history',
    section: null,
    shortcut: 'mod+2',
  },
  {
    id: 'refs',
    label: 'Refs panel',
    icon: 'lucidePanelLeft',
    view: null,
    section: null,
    shortcut: 'mod+b',
  },
  {
    id: 'remotes',
    label: 'Remotes',
    icon: 'lucideGlobe',
    view: 'history',
    section: 'remote',
    shortcut: null,
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: 'lucideTags',
    view: 'history',
    section: 'tags',
    shortcut: null,
  },
  {
    id: 'stashes',
    label: 'Stashes',
    icon: 'lucideArchive',
    view: 'history',
    section: 'stashes',
    shortcut: null,
  },
  {
    id: 'reflog',
    label: 'Reflog',
    icon: 'lucideHistory',
    view: 'reflog',
    section: null,
    shortcut: 'mod+3',
  },
];

/**
 * Whether the rail paints the item as current.
 *
 * Refs is a toggle, so it follows the panel; the section shortcuts light up
 * only while the panel is open, otherwise three items would look active at
 * once on the history view.
 */
export function isRailItemActive(
  item: RailItem,
  view: RailView,
  refsPanelOpen: boolean,
): boolean {
  if (item.id === 'refs') return refsPanelOpen;
  if (item.section !== null) return false;
  return item.view === view;
}
