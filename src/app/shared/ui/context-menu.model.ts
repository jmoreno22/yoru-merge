import type { YoruIconName } from '../icons';

export interface MenuItem {
  /** Returned by `ContextMenuService.open()` when the item is chosen. */
  readonly id: string;
  readonly label: string;
  readonly icon?: YoruIconName;
  /**
   * Literal combo, rendered through `formatCombo` (e.g. `f2`). For a key the
   * surface that opened the menu handles itself; an application shortcut goes
   * in `shortcutId` instead.
   */
  readonly shortcut?: string;
  /**
   * Id of a registered shortcut. The menu shows whichever combo owns the id
   * when it opens, so a rebind cannot leave a stale key on the item.
   */
  readonly shortcutId?: string;
  readonly tone?: 'default' | 'danger' | 'primary';
  /**
   * The option currently in effect: `true` puts a check in the icon slot.
   * Give it to every member of the set, `false` included, so the unchecked
   * ones are announced as such.
   */
  readonly checked?: boolean;
  readonly disabled?: boolean;
  /** Shown under the label when disabled: never leave a dead item unexplained. */
  readonly disabledReason?: string;
  /** One level of submenu is supported, which covers every menu in the app. */
  readonly children?: readonly MenuItem[];
  readonly separatorBefore?: boolean;
  readonly run?: () => void | Promise<void>;
}

/** Where to open: an explicit viewport point, or below an element. */
export type MenuAnchor = { readonly x: number; readonly y: number } | HTMLElement;

/** Names what the menu acts on: the commit, the ref, the file. */
export interface MenuHeader {
  readonly title: string;
  readonly detail?: string;
  readonly icon?: YoruIconName;
}

export interface MenuOptions {
  readonly header?: MenuHeader;
  /**
   * The row a pointer menu acts on, kept highlighted while the menu is open.
   * Only needed where the row under the pointer cannot be recognised: an
   * option, a tree item, a tab or anything carrying `data-menu-target` is
   * found without it.
   */
  readonly target?: HTMLElement;
}
