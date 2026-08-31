import type { YoruIconName } from '../icons';

export interface MenuItem {
  /** Returned by `ContextMenuService.open()` when the item is chosen. */
  readonly id: string;
  readonly label: string;
  readonly icon?: YoruIconName;
  /** Combo string, rendered through `formatCombo` (e.g. `mod+shift+p`). */
  readonly shortcut?: string;
  readonly tone?: 'default' | 'danger' | 'primary';
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
