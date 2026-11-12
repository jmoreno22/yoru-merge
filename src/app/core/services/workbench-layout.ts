import type { InspectorPlacement, RailView, SidebarSide } from './preferences-schema';

/**
 * What is where in the workbench, as data.
 *
 * `MainContent` owns the pixels — panel widths, the split, the drag — and
 * paints whatever this module returns. Which region sits on which side, what
 * the centre mounts and what the inspector stacks is decided here and nowhere
 * else, so moving or adding a panel is a change to this file and its spec, not
 * a hunt through template bindings.
 */

/** The outer row: the refs panel and the centre | inspector split. */
export type OuterRegion = 'refs' | 'split';

export type CentreBlockId = 'diff-workspace' | 'changes' | 'reflog' | 'history';

export type InspectorBlockId = 'commit' | 'diff' | 'blame' | 'file-history';

/**
 * How tall an inspector block is: `fill` takes what the others leave,
 * `collapsed` takes nothing, and anything else is a CSS `flex` shorthand for a
 * fixed share of the column.
 */
export type BlockSize = 'fill' | 'collapsed' | (string & {});

export interface CentreBlock {
  readonly id: CentreBlockId;
  /** Mounted but out of sight: the block keeps its state and its place. */
  readonly hidden: boolean;
}

export interface InspectorBlock {
  readonly id: InspectorBlockId;
  readonly size: BlockSize;
  /** A rule separates the block from the one above it. */
  readonly divided: boolean;
}

export interface WorkbenchState {
  readonly view: RailView;
  /** The diff workspace has taken the centre column. */
  readonly workspaceOpen: boolean;
  readonly refsVisible: boolean;
  readonly refsSide: SidebarSide;
  readonly inspectorPlacement: InspectorPlacement;
  readonly blameOpen: boolean;
  readonly fileHistoryOpen: boolean;
}

export interface WorkbenchLayout {
  /** The outer row, in visual order. */
  readonly outer: readonly OuterRegion[];
  /** Direction the centre and the inspector run in. */
  readonly axis: 'row' | 'column';
  /** What the centre column mounts, in DOM order. */
  readonly centre: readonly CentreBlock[];
  /** What the inspector column stacks, top to bottom. */
  readonly inspector: readonly InspectorBlock[];
}

/**
 * The share of the inspector column a stacked panel keeps, as a fixed basis
 * and not a growth proportion: a panel that grew would take a cut of every
 * pixel the commit block releases, and those belong to the commit file list
 * alone. The figures are the ones the 1.0.5 build gave them — 3/8 and 2/7 on
 * their own, 3/10 and 2/10 together.
 */
const STACKED_SHARE = {
  blame: { alone: '0 0 37.5%', paired: '0 0 30%' },
  'file-history': { alone: '0 0 28.6%', paired: '0 0 20%' },
} as const;

export function workbenchLayout(state: WorkbenchState): WorkbenchLayout {
  return {
    outer: outerRow(state),
    axis: state.inspectorPlacement === 'bottom' ? 'column' : 'row',
    centre: centreBlocks(state),
    inspector: inspectorBlocks(state),
  };
}

function outerRow(state: WorkbenchState): OuterRegion[] {
  if (!state.refsVisible) return ['split'];
  return state.refsSide === 'left' ? ['refs', 'split'] : ['split', 'refs'];
}

function centreBlocks(state: WorkbenchState): CentreBlock[] {
  if (!state.workspaceOpen) return [{ id: state.view, hidden: false }];

  const workspace: CentreBlock = { id: 'diff-workspace', hidden: false };
  // Changes owns the file order the workspace steps through and the composer
  // draft, so it stays mounted; History and Reflog are rebuilt on close.
  return state.view === 'changes'
    ? [workspace, { id: 'changes', hidden: true }]
    : [workspace];
}

function inspectorBlocks(state: WorkbenchState): InspectorBlock[] {
  const blocks: InspectorBlock[] = [];
  const workingTree = state.view === 'changes';

  // Changes has no commit to describe: the centre view owns the file lists.
  if (!workingTree) blocks.push({ id: 'commit', size: 'fill', divided: false });

  // Always present: the viewer is one element re-hosted through a portal, and
  // this is its home. It only has a height where the working tree reads its
  // diff inline; a commit diff is read in the workspace alone.
  const inline = workingTree && !state.workspaceOpen;
  blocks.push({ id: 'diff', size: inline ? 'fill' : 'collapsed', divided: inline });

  if (state.blameOpen) {
    blocks.push({
      id: 'blame',
      size: STACKED_SHARE.blame[state.fileHistoryOpen ? 'paired' : 'alone'],
      divided: true,
    });
  }
  if (state.fileHistoryOpen) {
    blocks.push({
      id: 'file-history',
      size: STACKED_SHARE['file-history'][state.blameOpen ? 'paired' : 'alone'],
      divided: true,
    });
  }
  return blocks;
}
