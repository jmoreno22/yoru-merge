import { describe, expect, it } from 'vitest';
import type { MenuItem } from '../../shared/ui';
import { refItemIndex, withRefItems } from './commit-menu';

const ITEMS: readonly MenuItem[] = [
  { id: 'inspect', label: 'Show in inspector' },
  { id: 'checkout', label: 'Checkout commit (detached)', separatorBefore: true },
];

describe('withRefItems', () => {
  it('leaves the menu alone when no ref points at the commit', () => {
    expect(withRefItems([], ITEMS)).toEqual(ITEMS);
  });

  it('lists the refs first, each opening its own menu', () => {
    const menu = withRefItems(
      [
        { name: 'develop', icon: 'lucideGitBranch' },
        { name: 'origin/develop', icon: 'lucideGlobe' },
      ],
      ITEMS,
    );
    expect(menu.map((item) => [item.id, item.label])).toEqual([
      ['ref:0', 'develop…'],
      ['ref:1', 'origin/develop…'],
      ['inspect', 'Show in inspector'],
      ['checkout', 'Checkout commit (detached)'],
    ]);
    expect(menu[2]?.separatorBefore).toBe(true);
  });
});

describe('refItemIndex', () => {
  it('reads back the ref an item stands for', () => {
    expect(refItemIndex('ref:1')).toBe(1);
  });

  it('ignores the commit actions', () => {
    expect(refItemIndex('reset-hard')).toBeNull();
    expect(refItemIndex('ref:x')).toBeNull();
  });
});
