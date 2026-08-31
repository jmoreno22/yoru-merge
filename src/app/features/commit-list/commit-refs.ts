import type { RefInfo, RefType } from '../../core/models';

/** HEAD first, then local branches, remotes and finally tags. */
const REF_ORDER: Readonly<Record<RefType, number>> = {
  head: 0,
  branch: 1,
  remote: 2,
  tag: 3,
};

/** How many pills fit in a 34 px row before the "+N" chip takes over. */
export const MAX_REF_PILLS = 3;

export interface SplitRefs {
  readonly shown: readonly RefInfo[];
  readonly hidden: readonly RefInfo[];
}

/**
 * Orders the refs of a commit and splits them into the pills that fit and the
 * ones the "+N" chip stands for.
 *
 * `HEAD -> main` arrives as two refs with the same name, one `head` and one
 * `branch`. The HEAD pill already carries the branch name, so the duplicate
 * branch is dropped instead of spending one of the three slots on it.
 */
export function splitRefs(
  refs: readonly RefInfo[],
  max: number = MAX_REF_PILLS,
): SplitRefs {
  const headNames = new Set(
    refs.filter((ref) => ref.ref_type === 'head').map((ref) => ref.name),
  );
  const deduped = refs.filter(
    (ref) => !(ref.ref_type === 'branch' && headNames.has(ref.name)),
  );
  const sorted = [...deduped].sort(
    (a, b) =>
      REF_ORDER[a.ref_type] - REF_ORDER[b.ref_type] || a.name.localeCompare(b.name),
  );
  const limit = Math.max(0, max);
  return { shown: sorted.slice(0, limit), hidden: sorted.slice(limit) };
}

/** `tag: v1.2.0` — the tooltip line for one ref. */
export function describeRef(ref: RefInfo): string {
  return `${ref.ref_type}: ${ref.name}`;
}

/** True when this commit is the one HEAD points at. */
export function isHeadCommit(refs: readonly RefInfo[]): boolean {
  return refs.some((ref) => ref.ref_type === 'head');
}
