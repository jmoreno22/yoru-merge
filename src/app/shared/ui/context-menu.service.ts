import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import type { MenuAnchor, MenuItem, MenuOptions } from './context-menu.model';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';
import type { Bounds, Point } from './menu-position';
import { YoruContextMenu } from './yoru-context-menu';

/** What a pointer menu takes for its row when the caller names no target. */
const ROW_SELECTOR =
  '[data-menu-target], [role="option"], [role="treeitem"], [role="tab"]';

function placementOf(anchor: MenuAnchor): Point | Bounds {
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  return { x: anchor.x, y: anchor.y };
}

function originOf(anchor: MenuAnchor): HTMLElement | null {
  if (anchor instanceof HTMLElement) return anchor;
  // Optional call: jsdom has no layout and therefore no elementFromPoint.
  const under = document.elementFromPoint?.(anchor.x, anchor.y);
  return under?.closest<HTMLElement>(ROW_SELECTOR) ?? null;
}

/**
 * Opens the one context menu the app is allowed to show at a time.
 *
 * ```ts
 * const choice = await this.menu.open(items, { x: event.clientX, y: event.clientY });
 * if (choice === 'delete') { ... }
 * ```
 *
 * Resolves with the chosen item id, or `null` when the menu was dismissed. If
 * an item carries `run`, it is invoked as well, so a menu can be either
 * data-driven or callback-driven.
 *
 * While the menu is open the element it came from carries `data-menu-open`,
 * which `styles.css` paints as the hover state: the button or the row stays
 * lit, so it is always visible what the menu acts on. Closing hands the focus
 * back to whatever held it, or a keyboard user would restart from the top of
 * the window after every menu.
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  private ref: ComponentRef<YoruContextMenu> | null = null;
  private settle: ((id: string | null) => void) | null = null;
  private origin: HTMLElement | null = null;
  private focused: HTMLElement | null = null;

  open(
    items: readonly MenuItem[],
    anchor: MenuAnchor,
    options: MenuOptions = {},
  ): Promise<string | null> {
    // A second menu replaces the first; the caller waiting on the old one gets null.
    this.close();

    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && active !== document.body ? active : null;
    const origin = options.target ?? originOf(anchor);

    const ref = createComponent(YoruContextMenu, {
      environmentInjector: this.environmentInjector,
    });
    ref.setInput('items', this.withCombos(items));
    ref.setInput('anchor', placementOf(anchor));
    ref.setInput('header', options.header ?? null);

    return new Promise<string | null>((resolve) => {
      this.ref = ref;
      this.settle = resolve;
      this.origin = origin;
      this.focused = focused;
      origin?.setAttribute('data-menu-open', '');

      ref.instance.selected.subscribe((id: string) => {
        const item = findItem(items, id);
        this.finish(id);
        // Errors surface as an unhandled rejection rather than dying silently.
        void item?.run?.();
      });
      ref.instance.dismissed.subscribe(() => this.finish(null));

      this.appRef.attachView(ref.hostView);
      document.body.appendChild(ref.location.nativeElement as HTMLElement);
    });
  }

  /** Closes any open menu, resolving its pending promise with `null`. */
  close(): void {
    this.finish(null);
  }

  private finish(id: string | null): void {
    const ref = this.ref;
    const settle = this.settle;
    const origin = this.origin;
    const focused = this.focused;
    this.ref = null;
    this.settle = null;
    this.origin = null;
    this.focused = null;

    if (ref) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    origin?.removeAttribute('data-menu-open');

    // Only when the panel took the focus with it: a click elsewhere that
    // dismissed the menu has already put the focus where the user wants it.
    const active = document.activeElement;
    if (focused?.isConnected && (active === null || active === document.body)) {
      focused.focus({ preventScroll: true });
    }
    settle?.(id);
  }

  private withCombos(items: readonly MenuItem[]): readonly MenuItem[] {
    const combos = new Map(
      this.shortcuts.shortcuts().map((shortcut) => [shortcut.id, shortcut.combo]),
    );
    const resolve = (item: MenuItem): MenuItem => {
      const combo = item.shortcutId ? combos.get(item.shortcutId) : undefined;
      if (combo === undefined && !item.children) return item;
      return {
        ...item,
        ...(combo === undefined ? {} : { shortcut: combo }),
        ...(item.children ? { children: item.children.map(resolve) } : {}),
      };
    };
    return items.map(resolve);
  }
}

function findItem(items: readonly MenuItem[], id: string): MenuItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children?.find((c) => c.id === id);
    if (child) return child;
  }
  return undefined;
}
