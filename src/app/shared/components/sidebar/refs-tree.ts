import type { BranchInfo, BranchList, StashEntry, TagInfo } from '../../../core/models';
import { fuzzyMatch, groupByPrefix } from '../../../core/utils';

export type RefsSectionId = 'local' | 'remote' | 'tags' | 'stashes';

/** Shared by every row: identity plus the ARIA a flattened tree has to carry. */
interface RefsNodeBase {
  readonly id: string;
  /** 0-based depth; the row indents by `level * 18px`. */
  readonly level: number;
  readonly posInSet: number;
  readonly setSize: number;
}

export interface RefsSectionNode extends RefsNodeBase {
  readonly kind: 'section';
  readonly section: RefsSectionId;
  readonly label: string;
  readonly count: number;
  readonly expanded: boolean;
}

export interface RefsFolderNode extends RefsNodeBase {
  readonly kind: 'folder';
  readonly section: RefsSectionId;
  /** Key the expanded state persists under. */
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly expanded: boolean;
  /** Remote whose branches this folder groups, or `null` for a prefix folder. */
  readonly remote: string | null;
}

export interface RefsBranchNode extends RefsNodeBase {
  readonly kind: 'branch';
  readonly branch: BranchInfo;
  /** Leaf name: the folder prefix is already carried by the parent row. */
  readonly label: string;
  readonly current: boolean;
  /** Remote the branch lives on, or `null` when it is local. */
  readonly remote: string | null;
}

export interface RefsTagNode extends RefsNodeBase {
  readonly kind: 'tag';
  readonly tag: TagInfo;
  readonly label: string;
}

export interface RefsStashNode extends RefsNodeBase {
  readonly kind: 'stash';
  readonly stash: StashEntry;
  readonly label: string;
}

export type RefsNode =
  | RefsSectionNode
  | RefsFolderNode
  | RefsBranchNode
  | RefsTagNode
  | RefsStashNode;

export interface RefsTreeInput {
  readonly branches: BranchList | null;
  readonly tags: readonly TagInfo[];
  readonly stashes: readonly StashEntry[];
  /** Fuzzy query; a non-empty filter force-expands everything that survives. */
  readonly filter: string;
  /** `PreferencesService.sidebarSections()` — `true` means collapsed. */
  readonly collapsed: Readonly<Record<string, boolean>>;
  /** Pref `showRemoteBranchesPerRemote`: one folder per remote. */
  readonly perRemoteFolders: boolean;
}

const SECTION_LABELS: Readonly<Record<RefsSectionId, string>> = {
  local: 'Local',
  remote: 'Remotes',
  tags: 'Tags',
  stashes: 'Stashes',
};

/** First run shows the local branches and nothing else, per the plan. */
const SECTION_DEFAULT_EXPANDED: Readonly<Record<RefsSectionId, boolean>> = {
  local: true,
  remote: false,
  tags: false,
  stashes: false,
};

/** A node plus the children that only exist while it is expanded. */
interface Draft {
  readonly build: (posInSet: number, setSize: number) => RefsNode;
  readonly expanded: boolean;
  readonly children: readonly Draft[];
}

/**
 * Flattens the refs of a repository into the single list the tree renders.
 *
 * Everything the sidebar shows is one `role="tree"`, so grouping, filtering and
 * collapsing all have to resolve here: the template only walks the result and
 * indents by `level`.
 */
export function buildRefsTree(input: RefsTreeInput): RefsNode[] {
  const query = input.filter.trim();
  const filtering = query.length > 0;
  const keep = (text: string): boolean =>
    !filtering || fuzzyMatch(query, text) !== null;

  const sections: Draft[] = [];
  const push = (section: RefsSectionId, children: readonly Draft[]): void => {
    // While filtering, a section with nothing left is noise rather than context.
    if (filtering && children.length === 0) return;
    const expanded = sectionExpanded(input, section, filtering);
    const count = countLeaves(children);
    sections.push({
      build: (posInSet, setSize) => ({
        kind: 'section',
        id: `section:${section}`,
        level: 0,
        posInSet,
        setSize,
        section,
        label: SECTION_LABELS[section],
        count,
        expanded,
      }),
      expanded,
      children,
    });
  };

  push('local', localDrafts(input, keep, filtering));
  push('remote', remoteDrafts(input, keep, filtering));
  push('tags', tagDrafts(input, keep));
  push('stashes', stashDrafts(input, keep));

  const nodes: RefsNode[] = [];
  flatten(sections, nodes);
  return nodes;
}

function flatten(drafts: readonly Draft[], out: RefsNode[]): void {
  drafts.forEach((draft, index) => {
    out.push(draft.build(index + 1, drafts.length));
    if (draft.expanded) flatten(draft.children, out);
  });
}

/** Leaves only: a folder must not inflate the count shown on its section. */
function countLeaves(drafts: readonly Draft[]): number {
  return drafts.reduce(
    (total, draft) =>
      total + (draft.children.length > 0 ? countLeaves(draft.children) : 1),
    0,
  );
}

function sectionExpanded(
  input: RefsTreeInput,
  section: RefsSectionId,
  filtering: boolean,
): boolean {
  if (filtering) return true;
  return section in input.collapsed
    ? !input.collapsed[section]
    : SECTION_DEFAULT_EXPANDED[section];
}

/** Prefix and remote folders default to open — the section already gates them. */
function folderExpanded(
  input: RefsTreeInput,
  key: string,
  filtering: boolean,
): boolean {
  if (filtering) return true;
  return key in input.collapsed ? !input.collapsed[key] : true;
}

function branchDraft(
  branch: BranchInfo,
  label: string,
  level: number,
  current: boolean,
  remote: string | null,
): Draft {
  return {
    build: (posInSet, setSize) => ({
      kind: 'branch',
      id: `branch:${remote === null ? 'local' : 'remote'}:${branch.name}`,
      level,
      posInSet,
      setSize,
      branch,
      label,
      current,
      remote,
    }),
    expanded: false,
    children: [],
  };
}

function localDrafts(
  input: RefsTreeInput,
  keep: (text: string) => boolean,
  filtering: boolean,
): Draft[] {
  const list = (input.branches?.local ?? []).filter(
    (branch) => !branch.is_remote && keep(branch.name),
  );
  const current = input.branches?.current ?? null;
  const { folders, flat } = groupByPrefix(list, (branch) => branch.name);

  const drafts: Draft[] = [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, branches]) => {
      const key = `folder:local:${prefix}`;
      const expanded = folderExpanded(input, key, filtering);
      const children = [...branches]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((branch) =>
          branchDraft(
            branch,
            branch.name.slice(prefix.length + 1),
            2,
            branch.name === current,
            null,
          ),
        );
      return {
        build: (posInSet: number, setSize: number): RefsNode => ({
          kind: 'folder',
          id: key,
          level: 1,
          posInSet,
          setSize,
          section: 'local',
          key,
          label: prefix,
          count: children.length,
          expanded,
          remote: null,
        }),
        expanded,
        children,
      };
    });

  const loose = [...flat]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((branch) =>
      branchDraft(branch, branch.name, 1, branch.name === current, null),
    );

  return [...drafts, ...loose];
}

function remoteDrafts(
  input: RefsTreeInput,
  keep: (text: string) => boolean,
  filtering: boolean,
): Draft[] {
  const list = (input.branches?.remote ?? []).filter(
    (branch) => branch.is_remote && keep(branch.name),
  );
  if (!input.perRemoteFolders) {
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((branch) =>
        branchDraft(branch, branch.name, 1, false, remoteOf(branch.name)),
      );
  }

  const { folders, flat } = groupByPrefix(list, (branch) => branch.name);
  // A remote ref without a `/` cannot be attributed to a remote; `origin` is
  // the only sensible home and matches what git prints for such refs.
  if (flat.length > 0) {
    folders.set('origin', [...(folders.get('origin') ?? []), ...flat]);
  }

  return [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([remote, branches]) => {
      const key = `folder:remote:${remote}`;
      const expanded = folderExpanded(input, key, filtering);
      const children = [...branches]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((branch) =>
          branchDraft(branch, shortRemoteName(branch.name), 2, false, remote),
        );
      return {
        build: (posInSet: number, setSize: number): RefsNode => ({
          kind: 'folder',
          id: key,
          level: 1,
          posInSet,
          setSize,
          section: 'remote',
          key,
          label: remote,
          count: children.length,
          expanded,
          remote,
        }),
        expanded,
        children,
      };
    });
}

function tagDrafts(input: RefsTreeInput, keep: (text: string) => boolean): Draft[] {
  return input.tags
    .filter((tag) => keep(tag.name))
    .map((tag) => ({
      build: (posInSet: number, setSize: number): RefsNode => ({
        kind: 'tag',
        id: `tag:${tag.name}`,
        level: 1,
        posInSet,
        setSize,
        tag,
        label: tag.name,
      }),
      expanded: false,
      children: [],
    }));
}

function stashDrafts(input: RefsTreeInput, keep: (text: string) => boolean): Draft[] {
  return input.stashes
    .filter((stash) => keep(stash.message))
    .map((stash) => ({
      build: (posInSet: number, setSize: number): RefsNode => ({
        kind: 'stash',
        id: `stash:${stash.index}`,
        level: 1,
        posInSet,
        setSize,
        stash,
        label: stashLabel(stash.message),
      }),
      expanded: false,
      children: [],
    }));
}

/** `origin/feat/x` → `origin`. */
export function remoteOf(fullName: string): string {
  const slash = fullName.indexOf('/');
  return slash === -1 ? 'origin' : fullName.slice(0, slash);
}

/** `origin/feat/x` → `feat/x`. */
export function shortRemoteName(fullName: string): string {
  const slash = fullName.indexOf('/');
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

/**
 * Drops the `WIP on <branch>: <sha>` preamble git writes for a stash saved
 * without a message, which would otherwise fill the whole row.
 */
export function stashLabel(message: string): string {
  const colon = message.indexOf(':');
  if (colon === -1 || colon === message.length - 1) return message;
  return message.slice(colon + 1).trim();
}
