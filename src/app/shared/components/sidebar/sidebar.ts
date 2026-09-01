import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../../core/services/current-repo.service';
import type { DragPayload } from '../../../core/services/drag-payload.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { shortSha } from '../../../core/utils';
import { DragDropDirective } from '../../directives/drag-drop.directive';
import { YoruButton, YoruEmptyState, YoruSectionHeader } from '../../ui';
import { RefsActions } from './refs-actions.service';
import { buildRefsTree, type RefsNode } from './refs-tree';

/** Tree indent per level, from the density spec. */
const INDENT_PX = 18;

/**
 * The refs panel: local branches, remotes, tags and stashes as one keyboard
 * tree.
 *
 * The whole panel is a single `role="tree"` with a roving tabindex — sections
 * and prefix folders are rows like any other, which is what makes one set of
 * arrow-key rules cover collapsing, navigating and reaching every ref.
 */
@Component({
  selector: 'app-sidebar',
  imports: [DragDropDirective, NgIcon, YoruButton, YoruEmptyState, YoruSectionHeader],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'sidebar',
    class: 'flex h-full min-w-0 flex-col overflow-hidden bg-[var(--app-surface)]',
  },
})
export class Sidebar {
  protected readonly service = inject(CurrentRepoService);
  protected readonly actions = inject(RefsActions);
  private readonly prefs = inject(PreferencesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly filter = signal('');

  /** Row the roving tabindex sits on; `null` until the user picks one. */
  private readonly focusedId = signal<string | null>(null);

  /** Bumped on every focus request so re-focusing the same row still works. */
  private readonly focusRequest = signal<{ id: string; seq: number } | null>(null);
  private focusSeq = 0;
  private lastFocusSeq = 0;

  protected readonly shortSha = shortSha;

  protected readonly nodes = computed<RefsNode[]>(() =>
    buildRefsTree({
      branches: this.service.branches(),
      tags: this.service.tags(),
      stashes: this.service.stashes(),
      filter: this.filter(),
      collapsed: this.prefs.sidebarSections(),
      perRemoteFolders: this.prefs.showRemoteBranchesPerRemote(),
    }),
  );

  /** Falls back to the first row when the remembered one no longer exists. */
  protected readonly activeId = computed<string | null>(() => {
    const nodes = this.nodes();
    const id = this.focusedId();
    if (id !== null && nodes.some((node) => node.id === id)) return id;
    return nodes[0]?.id ?? null;
  });

  protected readonly localCount = computed(
    () => this.service.branches()?.local.length ?? 0,
  );

  constructor() {
    // The ref menus need real remote names (push targets, web URLs); the
    // refresh cycle does not carry them.
    effect(() => {
      const repo = this.service.repo();
      if (!repo) return;
      untracked(() => void this.service.listRemotesAction());
    });

    afterRenderEffect(() => {
      const request = this.focusRequest();
      if (!request || request.seq === this.lastFocusSeq) return;
      this.lastFocusSeq = request.seq;
      this.rowElement(request.id)?.focus();
    });
  }

  // ── filter ──────────────────────────────────────────────────────────────

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected clearFilter(): void {
    this.filter.set('');
  }

  /** Down-arrow out of the filter box lands on the first row. */
  protected focusFirstRow(): void {
    const first = this.nodes()[0];
    if (first) this.focusRow(first.id);
  }

  // ── rows ────────────────────────────────────────────────────────────────

  protected indentPx(node: RefsNode): number {
    // Sections carry their own padding through `yoru-section-header`.
    return node.kind === 'section' ? 0 : 8 + node.level * INDENT_PX;
  }

  protected isExpandable(node: RefsNode): boolean {
    return node.kind === 'section' || node.kind === 'folder';
  }

  protected rowClass(node: RefsNode): string {
    const base =
      'flex w-full cursor-pointer select-none items-center transition-colors hover:bg-[var(--app-panel)]';
    if (node.kind === 'section') return base;
    const leaf = `${base} h-[var(--ref-row-h)] gap-1.5 pr-2 font-mono text-y-md`;
    // Weight, not colour: the marker icon and `aria-current` carry the state too.
    return node.kind === 'branch' && node.current
      ? `${leaf} font-semibold text-accent-ink`
      : `${leaf} text-[var(--app-text)]`;
  }

  protected payloadFor(node: RefsNode): DragPayload | null {
    if (node.kind !== 'branch') return null;
    return {
      type: 'branch',
      name: node.branch.name,
      isRemote: node.remote !== null,
      isCurrent: node.current,
    };
  }

  protected rowTitle(node: RefsNode): string {
    switch (node.kind) {
      case 'branch':
        return node.branch.upstream
          ? `${node.branch.name} tracks ${node.branch.upstream}`
          : node.branch.name;
      case 'tag':
        return node.tag.is_annotated
          ? `${node.tag.name} — annotated: ${node.tag.message ?? ''}`.trim()
          : node.tag.name;
      case 'stash':
        return `${node.stash.message} · ${node.stash.date}`;
      default:
        return node.label;
    }
  }

  /** Keeps the roving tabindex on whichever row actually holds focus. */
  protected onRowFocus(node: RefsNode): void {
    this.focusedId.set(node.id);
  }

  protected onClick(node: RefsNode, event: MouseEvent): void {
    this.focusedId.set(node.id);
    // A second click is a checkout, and `dblclick` handles it; navigating on
    // the first one costs nothing and needs no timer to disambiguate.
    if (event.detail > 1) return;
    if (this.isExpandable(node)) {
      this.toggle(node);
      return;
    }
    void this.actions.navigate(node);
  }

  protected onDoubleClick(node: RefsNode): void {
    if (this.isExpandable(node)) return;
    void this.actions.activate(node);
  }

  protected onContextMenu(node: RefsNode, event: MouseEvent): void {
    event.preventDefault();
    this.focusedId.set(node.id);
    void this.actions.openMenu(node, { x: event.clientX, y: event.clientY });
  }

  protected onCreateBranch(): void {
    void this.actions.createBranch(null);
  }

  // ── keyboard ────────────────────────────────────────────────────────────

  protected onKeydown(event: KeyboardEvent): void {
    const nodes = this.nodes();
    const index = nodes.findIndex((node) => node.id === this.activeId());
    const node = nodes[index];
    if (!node) return;

    if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
      void this.actions.copyName(node);
      event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    switch (event.key) {
      case 'ArrowDown':
        this.focusAt(index + 1);
        break;
      case 'ArrowUp':
        this.focusAt(index - 1);
        break;
      case 'Home':
        this.focusAt(0);
        break;
      case 'End':
        this.focusAt(nodes.length - 1);
        break;
      case 'ArrowRight':
        this.onForward(node, index);
        break;
      case 'ArrowLeft':
        this.onBack(node, index);
        break;
      // Enter mirrors the double click (check the ref out); Space mirrors the
      // single click (move the history to it).
      case 'Enter':
        if (this.isExpandable(node)) this.toggle(node);
        else void this.actions.activate(node);
        break;
      case ' ':
        if (this.isExpandable(node)) this.toggle(node);
        else void this.actions.navigate(node);
        break;
      case 'Delete':
        void this.actions.remove(node);
        break;
      case 'F2':
        void this.actions.rename(node);
        break;
      case 'ContextMenu':
        this.openMenuAtRow(node);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Right: open a closed row, otherwise step into it. */
  private onForward(node: RefsNode, index: number): void {
    if (!this.isExpandable(node)) return;
    if (!this.expanded(node)) {
      this.toggle(node);
      return;
    }
    this.focusAt(index + 1);
  }

  /** Left: close an open row, otherwise step out to its parent. */
  private onBack(node: RefsNode, index: number): void {
    if (this.isExpandable(node) && this.expanded(node)) {
      this.toggle(node);
      return;
    }
    const nodes = this.nodes();
    for (let i = index - 1; i >= 0; i--) {
      const candidate = nodes[i];
      if (candidate && candidate.level < node.level) {
        this.focusRow(candidate.id);
        return;
      }
    }
  }

  private openMenuAtRow(node: RefsNode): void {
    const element = this.rowElement(node.id);
    if (element) void this.actions.openMenu(node, element);
  }

  private focusAt(index: number): void {
    const nodes = this.nodes();
    const clamped = Math.min(Math.max(index, 0), nodes.length - 1);
    const node = nodes[clamped];
    if (node) this.focusRow(node.id);
  }

  private focusRow(id: string): void {
    this.focusedId.set(id);
    this.focusSeq += 1;
    this.focusRequest.set({ id, seq: this.focusSeq });
  }

  private rowElement(id: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(id)}"]`,
    );
  }

  // ── expanded state ──────────────────────────────────────────────────────

  protected expanded(node: RefsNode): boolean {
    return node.kind === 'section' || node.kind === 'folder' ? node.expanded : false;
  }

  private toggle(node: RefsNode): void {
    const key =
      node.kind === 'section' ? node.section : node.kind === 'folder' ? node.key : null;
    if (key === null) return;
    // The preference stores the collapsed flag, so it is the negation.
    this.prefs.setSidebarSectionCollapsed(key, this.expanded(node));
  }
}
