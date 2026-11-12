import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  Injector,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronRight } from '@ng-icons/lucide';
import { formatCombo } from './combo';
import type { MenuHeader, MenuItem } from './context-menu.model';
import {
  type Bounds,
  clampMenuPosition,
  clampSubmenuPosition,
  type Point,
  placeAnchoredMenu,
} from './menu-position';

let nextMenuId = 0;

/** How long a typeahead buffer survives between keystrokes. */
const TYPEAHEAD_TIMEOUT_MS = 600;

/**
 * How long an open submenu survives the pointer landing on a sibling item. The
 * straight line from a parent item to its submenu crosses the items below it,
 * and without the grace period the first one crossed would close the submenu
 * the pointer is heading for.
 */
const SUBMENU_GRACE_MS = 200;

/** Off-screen parking spot used until the panel has been measured. */
const OFFSCREEN: Point = { x: -9999, y: -9999 };

/**
 * The floating panel behind `ContextMenuService`. Not meant to be placed in a
 * template directly: call `ContextMenuService.open(items, anchor)` instead.
 */
@Component({
  selector: 'yoru-context-menu',
  imports: [NgIcon, NgTemplateOutlet],
  viewProviders: [provideIcons({ lucideCheck, lucideChevronRight })],
  templateUrl: './yoru-context-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoruContextMenu {
  readonly items = input.required<readonly MenuItem[]>();
  /** A point for a pointer menu, the opener's box for a dropdown. */
  readonly anchor = input.required<Point | Bounds>();
  readonly header = input<MenuHeader | null>(null);

  readonly selected = output<string>();
  readonly dismissed = output<void>();

  private readonly injector = inject(Injector);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly submenuPanel = viewChild<ElementRef<HTMLElement>>('submenuPanel');
  private readonly itemElements = viewChildren<ElementRef<HTMLElement>>('menuItem');

  protected readonly uid = `yoru-menu-${nextMenuId++}`;
  protected readonly position = signal<Point>(OFFSCREEN);
  protected readonly submenuPosition = signal<Point>(OFFSCREEN);
  protected readonly activeIndex = signal(-1);
  protected readonly submenuActiveIndex = signal(-1);
  protected readonly submenuOwner = signal<string | null>(null);

  protected readonly submenuItems = computed<readonly MenuItem[]>(() => {
    const owner = this.submenuOwner();
    if (owner === null) return [];
    return this.items().find((item) => item.id === owner)?.children ?? [];
  });

  protected readonly panelClass =
    'neon-scroll yoru-fade-in fixed z-[var(--z-dropdown)] max-h-[70vh] ' +
    'max-w-[min(28rem,calc(100vw-1rem))] overflow-y-auto rounded-sm border ' +
    'border-[var(--app-border)] bg-[var(--app-surface-raised)] py-1 shadow-panel ' +
    'outline-none';

  private typeahead = '';
  private typeaheadAt = 0;
  private hoverIntent: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.placeRoot();
      this.panel().nativeElement.focus();
    });

    const destroyRef = inject(DestroyRef);
    const dismiss = (): void => this.dismissed.emit();
    const onPointerDown = (event: Event): void => {
      const target = event.target as Node | null;
      if (target && this.containsTarget(target)) return;
      dismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('contextmenu', onPointerDown, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);

    destroyRef.onDestroy(() => {
      this.cancelHoverIntent();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('contextmenu', onPointerDown, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    });
  }

  protected shortcutTokens(combo: string): string[] {
    return formatCombo(combo);
  }

  protected roleOf(item: MenuItem): 'menuitem' | 'menuitemcheckbox' {
    return item.checked === undefined ? 'menuitem' : 'menuitemcheckbox';
  }

  /**
   * An item is a row: it takes the row height, so a menu is as dense as the
   * list it was opened from. No hover variant and no transition on purpose —
   * the highlight is the active index alone, which is what lets it stay on the
   * parent of an open submenu while the pointer crosses the items below.
   */
  protected itemClass(item: MenuItem, active: boolean): string {
    const base =
      'flex min-h-[var(--file-row-h)] w-full items-center gap-2 px-2.5 py-0.5 ' +
      'text-left text-y-base leading-tight';
    if (item.disabled) {
      return `${base} cursor-not-allowed text-[var(--app-text-faint)]`;
    }
    if (item.tone === 'danger') {
      return `${base} text-git-deleted-ink ${active ? 'bg-git-deleted/10' : ''}`;
    }
    const tone = item.tone === 'primary' ? 'text-accent-ink' : 'text-[var(--app-text)]';
    return `${base} ${tone} ${active ? 'bg-accent/10' : ''}`;
  }

  protected onItemClick(item: MenuItem, index: number, inSubmenu: boolean): void {
    if (item.disabled) return;
    if (!inSubmenu && item.children?.length) {
      this.openSubmenu(index);
      return;
    }
    this.selected.emit(item.id);
  }

  protected onItemHover(index: number, inSubmenu: boolean): void {
    this.cancelHoverIntent();
    if (inSubmenu) {
      this.submenuActiveIndex.set(index);
      return;
    }

    const owner = this.submenuOwner();
    if (owner !== null && this.items()[index]?.id !== owner) {
      this.hoverIntent = setTimeout(() => {
        this.hoverIntent = null;
        this.activateRootItem(index);
      }, SUBMENU_GRACE_MS);
      return;
    }
    this.activateRootItem(index);
  }

  /** The pointer reached the submenu: whatever it crossed on the way is moot. */
  protected cancelHoverIntent(): void {
    if (this.hoverIntent === null) return;
    clearTimeout(this.hoverIntent);
    this.hoverIntent = null;
  }

  private activateRootItem(index: number): void {
    this.activeIndex.set(index);
    const item = this.items()[index];
    if (item?.children?.length && !item.disabled) {
      this.openSubmenu(index);
    } else if (this.submenuOwner() !== null) {
      this.closeSubmenu();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    this.cancelHoverIntent();
    const inSubmenu = this.submenuOwner() !== null;
    const list = inSubmenu ? this.submenuItems() : this.items();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(list, inSubmenu, 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(list, inSubmenu, -1);
        return;
      case 'Home':
        event.preventDefault();
        this.setActive(inSubmenu, this.firstEnabled(list, 0, 1));
        return;
      case 'End':
        event.preventDefault();
        this.setActive(inSubmenu, this.firstEnabled(list, list.length - 1, -1));
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const index = inSubmenu ? this.submenuActiveIndex() : this.activeIndex();
        const item = list[index];
        if (item) this.onItemClick(item, index, inSubmenu);
        return;
      }
      case 'ArrowRight': {
        if (inSubmenu) return;
        const index = this.activeIndex();
        const item = this.items()[index];
        if (item?.children?.length && !item.disabled) {
          event.preventDefault();
          this.openSubmenu(index);
        }
        return;
      }
      case 'ArrowLeft':
        if (inSubmenu) {
          event.preventDefault();
          this.closeSubmenu();
        }
        return;
      case 'Escape':
        event.preventDefault();
        if (inSubmenu) {
          this.closeSubmenu();
        } else {
          this.dismissed.emit();
        }
        return;
      case 'Tab':
        event.preventDefault();
        this.dismissed.emit();
        return;
      default:
        break;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      this.applyTypeahead(event.key, list, inSubmenu);
    }
  }

  private applyTypeahead(
    char: string,
    list: readonly MenuItem[],
    inSubmenu: boolean,
  ): void {
    const now = Date.now();
    this.typeahead =
      now - this.typeaheadAt > TYPEAHEAD_TIMEOUT_MS
        ? char.toLowerCase()
        : this.typeahead + char.toLowerCase();
    this.typeaheadAt = now;

    const match = list.findIndex(
      (item) => !item.disabled && item.label.toLowerCase().startsWith(this.typeahead),
    );
    if (match >= 0) this.setActive(inSubmenu, match);
  }

  private moveActive(
    list: readonly MenuItem[],
    inSubmenu: boolean,
    step: number,
  ): void {
    if (list.length === 0) return;
    let index = inSubmenu ? this.submenuActiveIndex() : this.activeIndex();
    for (let i = 0; i < list.length; i++) {
      index = (index + step + list.length) % list.length;
      if (!list[index]?.disabled) {
        this.setActive(inSubmenu, index);
        return;
      }
    }
  }

  private firstEnabled(list: readonly MenuItem[], from: number, step: number): number {
    for (let i = from; i >= 0 && i < list.length; i += step) {
      if (!list[i]?.disabled) return i;
    }
    return -1;
  }

  private setActive(inSubmenu: boolean, index: number): void {
    if (index < 0) return;
    if (inSubmenu) {
      this.submenuActiveIndex.set(index);
    } else {
      this.activeIndex.set(index);
    }
  }

  private openSubmenu(index: number): void {
    const item = this.items()[index];
    if (!item?.children?.length) return;

    this.activeIndex.set(index);
    this.submenuOwner.set(item.id);
    this.submenuActiveIndex.set(this.firstEnabled(item.children, 0, 1));

    const itemRect = this.itemElements()[index]?.nativeElement.getBoundingClientRect();
    afterNextRender(
      () => {
        const panel = this.submenuPanel()?.nativeElement;
        if (!panel || !itemRect) return;
        this.submenuPosition.set(
          clampSubmenuPosition(
            itemRect,
            { width: panel.offsetWidth, height: panel.offsetHeight },
            { width: window.innerWidth, height: window.innerHeight },
          ),
        );
        panel.focus();
      },
      { injector: this.injector },
    );
  }

  private closeSubmenu(): void {
    this.submenuOwner.set(null);
    this.submenuActiveIndex.set(-1);
    this.submenuPosition.set(OFFSCREEN);
    this.panel().nativeElement.focus();
  }

  private placeRoot(): void {
    const panel = this.panel().nativeElement;
    const anchor = this.anchor();
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    this.position.set(
      'left' in anchor
        ? placeAnchoredMenu(anchor, size, viewport)
        : clampMenuPosition(anchor, size, viewport),
    );
  }

  private containsTarget(target: Node): boolean {
    if (this.panel().nativeElement.contains(target)) return true;
    const submenu = this.submenuPanel()?.nativeElement;
    return submenu ? submenu.contains(target) : false;
  }
}
