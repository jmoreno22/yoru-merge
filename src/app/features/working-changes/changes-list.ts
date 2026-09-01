import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { AppearanceService } from '../../core/services/appearance.service';
import { type MenuAnchor, YoruSectionHeader } from '../../shared/ui';
import type { ChangeRow, SectionId } from './changes-tree';
import { FileRowItem } from './file-row';
import { type ClickModifiers, nextIndex } from './selection';

/**
 * Default file-row height, matching `--file-row-h` and the CDK `itemSize` at
 * the default preferences. The live value comes from `AppearanceService`.
 */
export const FILE_ROW_HEIGHT = 30;

export interface RowSelectEvent {
  readonly path: string;
  readonly modifiers: ClickModifiers;
}

export interface RowMenuEvent {
  readonly path: string;
  readonly anchor: MenuAnchor;
}

/**
 * One section of the working tree: header, then a virtual-scrolled list of
 * files (and folders in tree mode).
 *
 * The component owns navigation and focus; selection itself lives in the panel
 * so a bulk action can read one selection instead of three.
 */
@Component({
  selector: 'app-changes-list',
  imports: [ScrollingModule, NgIcon, YoruSectionHeader, FileRowItem],
  templateUrl: './changes-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' },
})
export class ChangesList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appearance = inject(AppearanceService);

  readonly section = input.required<SectionId>();
  readonly label = input.required<string>();
  readonly rows = input.required<readonly ChangeRow[]>();
  readonly count = input<number>(0);
  readonly selectedPaths = input<ReadonlySet<string>>(new Set<string>());
  readonly activePath = input<string | null>(null);
  /** Path the diff viewer is currently showing, if it belongs here. */
  readonly diffPath = input<string | null>(null);
  readonly emptyHint = input<string>('');
  /** Extra classes for the header, so conflicts can carry the sakura tone. */
  readonly headerClass = input<string>('');
  /**
   * Caps the viewport at N rows instead of letting it fill the column. Used by
   * the conflicts section, which must not push the other two off screen.
   */
  readonly maxVisibleRows = input<number | null>(null);

  readonly rowSelect = output<RowSelectEvent>();
  readonly rowActivate = output<string>();
  readonly rowPrimary = output<string>();
  readonly rowDiscard = output<string>();
  readonly rowResolve = output<string>();
  readonly rowMenu = output<RowMenuEvent>();
  readonly folderToggle = output<string>();
  readonly activeChange = output<string>();
  readonly selectAllRequested = output<void>();

  protected readonly rowHeight = this.appearance.fileRowHeight;

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  /**
   * Roving tabindex target. With nothing selected the first row takes it, or
   * the list would be unreachable with the keyboard until it is clicked.
   */
  protected readonly tabbablePath = computed<string | null>(
    () => this.activePath() ?? this.rows()[0]?.path ?? null,
  );

  /**
   * Fixed viewport height for a capped list, `null` when the list fills what
   * it is given. The template drops `flex-1` when this is set: a `flex-basis`
   * of 0 would beat the height and collapse the viewport to nothing inside a
   * content-sized column.
   */
  protected readonly viewportHeight = computed<number | null>(() => {
    const max = this.maxVisibleRows();
    if (max === null) return null;
    return Math.min(this.rows().length, max) * this.rowHeight();
  });

  constructor() {
    afterNextRender(() => this.markWrapperPresentational());
  }

  protected trackRow(_index: number, row: ChangeRow): string {
    return row.path;
  }

  protected isSelected(path: string): boolean {
    return this.selectedPaths().has(path);
  }

  protected onRowClick(path: string, event: MouseEvent): void {
    this.rowSelect.emit({
      path,
      modifiers: { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey },
    });
  }

  protected onRowMenu(path: string, event: MouseEvent): void {
    event.preventDefault();
    // The keyboard menu key reports no coordinates: anchor to the row instead.
    const element = event.currentTarget as HTMLElement;
    const anchor: MenuAnchor =
      event.detail === 0 && event.clientX === 0
        ? element
        : { x: event.clientX, y: event.clientY };
    this.rowMenu.emit({ path, anchor });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const path = target?.getAttribute('data-path');
    // A button inside the row handles its own keys.
    if (!path) return;

    const rows = this.rows();
    const row = rows.find((candidate) => candidate.path === path);
    if (!row) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.selectAllRequested.emit();
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        this.moveTo(
          nextIndex(
            rows.map((candidate) => candidate.path),
            path,
            event.key === 'ArrowDown' ? 1 : -1,
          ),
          event.shiftKey,
        );
        break;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        this.moveTo(event.key === 'Home' ? 0 : rows.length - 1, event.shiftKey);
        break;
      }
      case 'ArrowRight':
        if (row.kind === 'folder' && row.collapsed) {
          event.preventDefault();
          this.folderToggle.emit(row.path);
        }
        break;
      case 'ArrowLeft':
        if (row.kind === 'folder' && !row.collapsed) {
          event.preventDefault();
          this.folderToggle.emit(row.path);
        }
        break;
      case ' ':
        event.preventDefault();
        if (row.kind === 'folder') this.folderToggle.emit(row.path);
        else this.rowPrimary.emit(row.path);
        break;
      case 'Enter':
        event.preventDefault();
        if (row.kind === 'folder') this.folderToggle.emit(row.path);
        else this.rowActivate.emit(row.path);
        break;
      case 'Delete':
        if (row.kind === 'file') {
          event.preventDefault();
          this.rowDiscard.emit(row.path);
        }
        break;
      default:
        break;
    }
  }

  private moveTo(index: number, extend: boolean): void {
    const row = this.rows()[index];
    if (!row) return;

    if (row.kind === 'folder') this.activeChange.emit(row.path);
    else {
      this.rowSelect.emit({
        path: row.path,
        modifiers: { ctrl: false, shift: extend },
      });
    }
    this.focusPath(row.path);
  }

  private focusPath(path: string): void {
    const element = this.findRow(path);
    if (element) {
      element.focus();
      return;
    }
    const index = this.rows().findIndex((row) => row.path === path);
    if (index < 0) return;
    this.viewport()?.scrollToIndex(index);
    // The viewport renders the row on the next frame; focus it once it exists.
    setTimeout(() => this.findRow(path)?.focus(), 0);
  }

  private findRow(path: string): HTMLElement | null {
    const rows = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-path]');
    for (const element of rows) {
      if (element.getAttribute('data-path') === path) return element;
    }
    return null;
  }

  /**
   * The CDK inserts a wrapper `<div>` between the viewport and the rows, which
   * would leave the options without an owning listbox in the a11y tree.
   */
  private markWrapperPresentational(): void {
    const wrapper = this.viewport()
      ?.getElementRef()
      .nativeElement.querySelector('.cdk-virtual-scroll-content-wrapper');
    wrapper?.setAttribute('role', 'presentation');
  }
}
