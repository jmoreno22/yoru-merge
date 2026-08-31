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
import { lucideChevronRight } from '@ng-icons/lucide';
import { formatCombo } from './combo';
import type { MenuItem } from './context-menu.model';
import { clampMenuPosition, clampSubmenuPosition, type Point } from './menu-position';

let nextMenuId = 0;

/** How long a typeahead buffer survives between keystrokes. */
const TYPEAHEAD_TIMEOUT_MS = 600;

/** Off-screen parking spot used until the panel has been measured. */
const OFFSCREEN: Point = { x: -9999, y: -9999 };

/**
 * The floating panel behind `ContextMenuService`. Not meant to be placed in a
 * template directly: call `ContextMenuService.open(items, anchor)` instead.
 */
@Component({
  selector: 'yoru-context-menu',
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideChevronRight })],
  templateUrl: './yoru-context-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoruContextMenu {
  readonly items = input.required<readonly MenuItem[]>();
  readonly anchor = input.required<Point>();

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

  private typeahead = '';
  private typeaheadAt = 0;

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

  protected itemClass(item: MenuItem, active: boolean): string {
    const base =
      'flex w-full items-start gap-2 px-2.5 py-1 text-left text-[13px] leading-[20px] transition-colors';
    if (item.disabled) {
      return `${base} cursor-not-allowed text-[var(--app-text-faint)]`;
    }
    const tone =
      item.tone === 'danger'
        ? 'text-git-deleted'
        : item.tone === 'primary'
          ? 'text-neon-cyan'
          : 'text-[var(--app-text)]';
    const highlight = active ? 'bg-neon-cyan/10' : 'hover:bg-neon-cyan/10';
    return `${base} ${tone} ${highlight}`;
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
    if (inSubmenu) {
      this.submenuActiveIndex.set(index);
      return;
    }
    this.activeIndex.set(index);
    const item = this.items()[index];
    if (item?.children?.length && !item.disabled) {
      this.openSubmenu(index);
    } else if (this.submenuOwner() !== null) {
      this.closeSubmenu();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
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
    this.position.set(
      clampMenuPosition(
        this.anchor(),
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }

  private containsTarget(target: Node): boolean {
    if (this.panel().nativeElement.contains(target)) return true;
    const submenu = this.submenuPanel()?.nativeElement;
    return submenu ? submenu.contains(target) : false;
  }
}
