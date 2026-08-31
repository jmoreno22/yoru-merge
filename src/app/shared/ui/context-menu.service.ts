import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import type { MenuAnchor, MenuItem } from './context-menu.model';
import type { Point } from './menu-position';
import { YoruContextMenu } from './yoru-context-menu';

/** Gap between an anchor element and the menu opened under it. */
const ANCHOR_GAP = 4;

function toPoint(anchor: MenuAnchor): Point {
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + ANCHOR_GAP };
  }
  return { x: anchor.x, y: anchor.y };
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
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  private ref: ComponentRef<YoruContextMenu> | null = null;
  private settle: ((id: string | null) => void) | null = null;

  open(items: readonly MenuItem[], anchor: MenuAnchor): Promise<string | null> {
    // A second menu replaces the first; the caller waiting on the old one gets null.
    this.close();

    const ref = createComponent(YoruContextMenu, {
      environmentInjector: this.environmentInjector,
    });
    ref.setInput('items', items);
    ref.setInput('anchor', toPoint(anchor));

    return new Promise<string | null>((resolve) => {
      this.ref = ref;
      this.settle = resolve;

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
    this.ref = null;
    this.settle = null;

    if (ref) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    settle?.(id);
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
