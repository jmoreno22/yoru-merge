// @vitest-environment jsdom
import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import type { MenuItem } from './context-menu.model';
import { ContextMenuService } from './context-menu.service';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';

const ITEMS: readonly MenuItem[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'rename', label: 'Rename…' },
];

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = label;
  document.body.appendChild(element);
  return element;
}

function panels(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menu"]')];
}

function press(key: string): void {
  panels()[0]?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function hover(label: string): void {
  const item = [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    (candidate) => candidate.textContent?.includes(label),
  );
  if (!item) throw new Error(`No menu item labelled ${label}.`);
  item.dispatchEvent(new MouseEvent('mouseenter'));
}

describe('ContextMenuService', () => {
  let menu: ContextMenuService;
  let settle: () => Promise<void>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTestIcons()],
    });
    menu = TestBed.inject(ContextMenuService);
    const app = TestBed.inject(ApplicationRef);
    settle = async () => {
      app.tick();
      await Promise.resolve();
    };
  });

  afterEach(() => {
    menu.close();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('returns focus to the element that had it once the menu is dismissed', async () => {
    const row = button('feat/login');
    row.focus();

    const choice = menu.open(ITEMS, { x: 10, y: 10 });
    await settle();
    expect(document.activeElement).toBe(panels()[0]);

    press('Escape');
    expect(await choice).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('returns focus before a chosen item runs, so a dialog it opens can take over', async () => {
    const row = button('feat/login');
    row.focus();
    let focusedWhenRun: Element | null = null;

    void menu.open(
      [
        {
          id: 'go',
          label: 'Go',
          run: () => {
            focusedWhenRun = document.activeElement;
          },
        },
      ],
      { x: 10, y: 10 },
    );
    await settle();
    press('ArrowDown');
    press('Enter');

    expect(focusedWhenRun).toBe(row);
  });

  it('marks the element it was opened under for as long as it is open', async () => {
    const anchor = button('Fetch options');

    void menu.open(ITEMS, anchor);
    await settle();
    expect(anchor.hasAttribute('data-menu-open')).toBe(true);

    menu.close();
    expect(anchor.hasAttribute('data-menu-open')).toBe(false);
  });

  it('marks the row a pointer menu acts on', async () => {
    const row = button('a91c2ef');

    void menu.open(ITEMS, { x: 10, y: 10 }, { target: row });
    await settle();
    expect(row.hasAttribute('data-menu-open')).toBe(true);

    press('Escape');
    expect(row.hasAttribute('data-menu-open')).toBe(false);
  });

  it('names what it acts on in a header', async () => {
    void menu.open(
      ITEMS,
      { x: 10, y: 10 },
      {
        header: { title: 'a91c2ef', detail: 'Fix branch graph virtualization' },
      },
    );
    await settle();

    const header = document.querySelector('[data-testid="menu-header"]');
    expect(header?.textContent).toContain('a91c2ef');
    expect(header?.textContent).toContain('Fix branch graph virtualization');
    expect(panels()[0]?.getAttribute('aria-label')).toBe('a91c2ef');
  });

  it('shows the combo a registered shortcut currently owns', async () => {
    const off = TestBed.inject(KeyboardShortcutsService).register({
      id: 'remote.fetch',
      combo: 'mod+shift+f',
      label: 'Fetch',
      run: () => {},
    });

    void menu.open(
      [
        { id: 'fetch', label: 'Fetch origin', shortcutId: 'remote.fetch' },
        { id: 'prune', label: 'Fetch and prune', shortcutId: 'nobody.owns-this' },
      ],
      { x: 10, y: 10 },
    );
    await settle();

    const keys = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
      [...item.querySelectorAll('kbd')].map((kbd) => kbd.textContent?.trim()),
    );
    expect(keys[0]?.at(-1)).toBe('F');
    expect(keys[1]).toEqual([]);
    off();
  });

  it('checks the option in effect', async () => {
    void menu.open(
      [
        { id: 'merge', label: 'Pull (merge)', checked: true },
        { id: 'rebase', label: 'Pull (rebase)', checked: false },
        { id: 'autostash', label: 'Pull with autostash' },
      ],
      { x: 10, y: 10 },
    );
    await settle();

    const checkable = [...document.querySelectorAll('[role="menuitemcheckbox"]')];
    expect(checkable.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ]);
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
  });

  it('keeps a submenu open while the pointer crosses a sibling on its way to it', async () => {
    vi.useFakeTimers();
    void menu.open(
      [
        { id: 'push', label: 'Push', children: [{ id: 'origin', label: 'To origin' }] },
        { id: 'pull', label: 'Pull' },
      ],
      { x: 10, y: 10 },
    );
    await settle();

    hover('Push');
    await settle();
    expect(panels()).toHaveLength(2);

    hover('Pull');
    await settle();
    expect(panels()).toHaveLength(2);

    hover('To origin');
    vi.advanceTimersByTime(1000);
    await settle();
    expect(panels()).toHaveLength(2);

    hover('Pull');
    vi.advanceTimersByTime(1000);
    await settle();
    expect(panels()).toHaveLength(1);
  });
});
