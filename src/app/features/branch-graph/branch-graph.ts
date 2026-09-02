import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { CommitInfo, EdgeType, GraphData } from '../../core/models';
import { AppearanceService } from '../../core/services/appearance.service';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ThemeService } from '../../core/services/theme.service';
import { CommitListLayout } from '../commit-list/commit-list-layout';
import { buildEdgeIndex, edgesInRange, type IndexedEdge } from './graph-edges';

/** Width of a single lane column in CSS pixels. */
const LANE_WIDTH = 16;
/** Commit-node circle radius in CSS pixels. */
const NODE_RADIUS = 4;
/** Radius of the outer ring drawn around the HEAD commit. */
const HEAD_RING_RADIUS = 7;
/** Stroke width of every edge polyline / Bézier curve. */
const EDGE_LINE_WIDTH = 1.75;
/** Stroke width of the unselected node ring. */
const NODE_RING_WIDTH = 1.5;
/** Stroke width of the selected-commit highlight ring. */
const SELECTED_RING_WIDTH = 2;
/** Extra rows kept above/below the viewport so curves are never clipped. */
const VISIBLE_BUFFER_ROWS = 2;
/** Alpha applied to lanes whose commits the current branch cannot reach. */
const OFF_BRANCH_ALPHA = 0.45;
/** Stroke width of the glow pass drawn under the lane HEAD sits on. */
const HEAD_GLOW_WIDTH = 6;
/** Alpha of that glow pass, relative to the alpha already on the context. */
const HEAD_GLOW_ALPHA = 0.3;
/** Final alpha of a dangling edge where it fades out. */
const EDGE_FADE_ALPHA = 0.25;
/** Horizontal slack around a lane centre that still counts as a hit. */
const HIT_TOLERANCE = 8;

/** Fallback palette, used only until the CSS custom properties resolve. */
const FALLBACK_LANES: readonly string[] = [
  '#00E5FF',
  '#9B5CFF',
  '#FF4FB8',
  '#35F2A2',
  '#FFD166',
  '#3B82FF',
];

interface HoverTarget {
  readonly row: number;
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Canvas renderer for the lane graph beside the commit list.
 *
 * Row indices in `GraphData` are absolute positions in the full history, so
 * the component paints row `n` at `n * rowHeight - scrollTop + graphTopOffset`
 * and needs no notion of which page a commit arrived in. The offset is what
 * keeps lanes aligned with their rows once the list draws a search box and a
 * column header above its own first row.
 */
@Component({
  selector: 'app-branch-graph',
  templateUrl: './branch-graph.html',
  styleUrl: './branch-graph.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'branch-graph',
    class: 'relative block h-full w-full overflow-hidden',
  },
})
export class BranchGraph {
  private readonly repo = inject(CurrentRepoService);
  private readonly theme = inject(ThemeService);
  private readonly layout = inject(CommitListLayout);
  private readonly appearance = inject(AppearanceService);
  private readonly prefs = inject(PreferencesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly graphData = input<GraphData | null>(null);
  readonly scrollTop = input<number>(0);
  /**
   * Row height override. `null` reads it from `AppearanceService`, which is
   * also what feeds the list's `itemSize` and the `--row-h` token — so a lane
   * cannot drift from its commit just because a caller forgot to pass it.
   */
  readonly rowHeight = input<number | null>(null);

  private readonly resolvedRowHeight = computed<number>(
    () => this.rowHeight() ?? this.appearance.rowHeight(),
  );

  /**
   * Pixels of chrome the commit list draws above its first row. `null` reads
   * it from `CommitListLayout`, which is what the list itself publishes.
   */
  readonly graphTopOffset = input<number | null>(null);

  /** Same idea at the bottom, where the list draws its "N of M loaded" strip. */
  readonly graphBottomOffset = input<number | null>(null);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly hover = signal<HoverTarget | null>(null);

  /** Lanes are hidden while a search filters the list: rows no longer align. */
  private readonly isSearchActive = this.repo.isSearchActive;

  protected readonly isEmpty = computed<boolean>(() => {
    if (this.isSearchActive()) return true;
    const data = this.graphData();
    return data === null || data.commits.length === 0;
  });

  /** Width the column needs to show every lane; bind it from the layout. */
  readonly preferredWidth = computed<number>(
    () => Math.max(1, this.graphData()?.max_lanes ?? 1) * LANE_WIDTH,
  );

  private readonly topOffset = computed<number>(
    () => this.graphTopOffset() ?? this.layout.chromeHeight(),
  );

  private readonly bottomOffset = computed<number>(
    () => this.graphBottomOffset() ?? this.layout.footerHeight(),
  );

  private readonly edgeIndex = computed(() =>
    buildEdgeIndex(this.graphData(), this.repo.historyTotal()),
  );

  /** Row → commit metadata the canvas needs but `GraphData` does not carry. */
  private readonly rowMeta = computed(() => this.repo.commits());

  /** Lane HEAD sits on, or `null` when HEAD is not in the loaded history. */
  private readonly headLane = computed<number | null>(() => {
    const data = this.graphData();
    if (!data) return null;
    const row = this.rowMeta().findIndex((commit) =>
      commit.refs.some((ref) => ref.ref_type === 'head'),
    );
    if (row < 0) return null;
    return data.commits[row]?.lane ?? null;
  });

  private readonly cssSize = signal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  private readonly dpr = signal<number>(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  );

  private rafHandle: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private dprCleanup: (() => void) | null = null;

  /** Palette + surface colours, re-read whenever the resolved theme flips. */
  private lanes: readonly string[] = FALLBACK_LANES;
  private surface = '#050712';
  private textColor = '#F4F8FF';

  constructor() {
    // Reading the tokens is a layout-forcing call, so it happens once per
    // theme rather than once per frame.
    effect(() => {
      this.theme.resolved();
      // Both palettes are token sets, so either one changing has to re-read the
      // colours exactly like a theme flip does — the surface palette included,
      // because the canvas paints its own background from --app-surface.
      this.prefs.graphPalette();
      this.prefs.colorPalette();
      this.readThemeColors();
      this.scheduleRender();
    });

    effect(() => {
      void this.graphData();
      void this.scrollTop();
      void this.resolvedRowHeight();
      void this.topOffset();
      void this.cssSize();
      void this.dpr();
      void this.repo.selectedCommitSha();
      void this.rowMeta();

      // The canvas only exists outside the empty state; reading the view
      // child here schedules a paint the moment it mounts.
      if (!this.canvasRef()) return;
      this.scheduleRender();
    });

    afterNextRender(() => {
      this.attachResizeObserver();
      this.attachDprListener();
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.dprCleanup?.();
      this.dprCleanup = null;
      if (this.rafHandle !== null) {
        cancelAnimationFrame(this.rafHandle);
        this.rafHandle = null;
      }
    });
  }

  // ── pointer ──────────────────────────────────────────────────────────────

  protected onPointerMove(event: PointerEvent): void {
    // A pointermove fires per pixel; writing the signal only when the pointed
    // row actually changes keeps a mouse sweep from re-rendering the tooltip.
    const hit = this.hitTest(event.offsetX, event.offsetY);
    if (!sameHoverTarget(this.hover(), hit)) this.hover.set(hit);
  }

  protected onPointerLeave(): void {
    this.hover.set(null);
  }

  protected onClick(event: MouseEvent): void {
    const hit = this.hitTest(event.offsetX, event.offsetY);
    if (hit) void this.repo.selectCommit(hit.sha);
  }

  /** The commit node under a canvas-relative point, if the pointer is on one. */
  private hitTest(x: number, y: number): HoverTarget | null {
    const data = this.graphData();
    if (!data) return null;
    const top = this.topOffset();
    if (y < top || y > this.cssSize().height - this.bottomOffset()) return null;
    const rowH = this.resolvedRowHeight();
    const row = Math.floor((y - top + this.scrollTop()) / rowH);
    const node = data.commits[row];
    if (!node) return null;
    const centerX = node.lane * LANE_WIDTH + LANE_WIDTH / 2;
    if (Math.abs(x - centerX) > HIT_TOLERANCE) return null;
    const commit: CommitInfo | undefined = this.rowMeta()[row];
    if (!commit) return null;
    return {
      row,
      sha: commit.sha,
      shortSha: commit.short_sha,
      subject: commit.message.split('\n')[0] ?? '',
      x: centerX,
      y: row * rowH - this.scrollTop() + this.topOffset() + rowH / 2,
    };
  }

  // ── lifecycle wiring ─────────────────────────────────────────────────────

  private attachResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const el = this.host.nativeElement;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const prev = this.cssSize();
        if (prev.width !== width || prev.height !== height) {
          this.cssSize.set({ width, height });
        }
      }
    });
    this.resizeObserver.observe(el);

    const rect = el.getBoundingClientRect();
    this.cssSize.set({ width: rect.width, height: rect.height });
  }

  /**
   * Watches `devicePixelRatio` by querying for exactly its current value: the
   * query stops matching the moment the window moves to a different monitor
   * or the user zooms, at which point we re-attach against the new ratio.
   */
  private attachDprListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.dprCleanup?.();
    const current = window.devicePixelRatio || 1;
    this.dpr.set(current);
    const mq = window.matchMedia(`(resolution: ${current}dppx)`);
    const handler = (): void => this.attachDprListener();
    mq.addEventListener('change', handler);
    this.dprCleanup = () => mq.removeEventListener('change', handler);
  }

  private readThemeColors(): void {
    if (typeof window === 'undefined') return;
    const styles = getComputedStyle(this.host.nativeElement);
    const lanes: string[] = [];
    for (let i = 1; i <= FALLBACK_LANES.length; i++) {
      const value = styles.getPropertyValue(`--graph-lane-${i}`).trim();
      lanes.push(value.length > 0 ? value : (FALLBACK_LANES[i - 1] ?? '#00E5FF'));
    }
    this.lanes = lanes;
    const surface = styles.getPropertyValue('--app-surface').trim();
    const text = styles.getPropertyValue('--app-text').trim();
    if (surface) this.surface = surface;
    if (text) this.textColor = text;
  }

  // ── render ───────────────────────────────────────────────────────────────

  private scheduleRender(): void {
    if (this.rafHandle !== null) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.render();
    });
  }

  private render(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const { width: cssW, height: cssH } = this.cssSize();
    if (cssW <= 0 || cssH <= 0) return;

    const dpr = this.dpr();
    const backingW = Math.max(1, Math.round(cssW * dpr));
    const backingH = Math.max(1, Math.round(cssH * dpr));
    if (canvasEl.width !== backingW) canvasEl.width = backingW;
    if (canvasEl.height !== backingH) canvasEl.height = backingH;
    const styleW = `${cssW}px`;
    const styleH = `${cssH}px`;
    if (canvasEl.style.width !== styleW) canvasEl.style.width = styleW;
    if (canvasEl.style.height !== styleH) canvasEl.style.height = styleH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const data = this.graphData();
    if (!data || data.commits.length === 0) return;

    const rowH = this.resolvedRowHeight();
    const offset = this.topOffset();
    const scrolled = this.scrollTop();
    const rowY = (row: number): number => row * rowH - scrolled + offset + rowH / 2;

    // Lanes belong to the scroll viewport only; the list's header and footer
    // sit outside it and a curve must not run across either of them.
    const bottom = Math.max(offset, cssH - this.bottomOffset());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, offset, cssW, bottom - offset);
    ctx.clip();

    const firstRow = Math.max(
      0,
      Math.floor((scrolled - offset) / rowH) - VISIBLE_BUFFER_ROWS,
    );
    const lastRow = Math.min(
      data.commits.length - 1,
      Math.ceil((scrolled - offset + cssH) / rowH) + VISIBLE_BUFFER_ROWS,
    );
    if (lastRow < firstRow) {
      ctx.restore();
      return;
    }

    const meta = this.rowMeta();
    const headLane = this.headLane();
    const selected = this.repo.selectedCommitSha();

    ctx.lineWidth = EDGE_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const edge of edgesInRange(this.edgeIndex(), firstRow, lastRow)) {
      this.drawEdge(ctx, edge, rowY, rowH, cssH, meta[edge.fromRow], headLane);
    }

    for (let row = firstRow; row <= lastRow; row++) {
      const node = data.commits[row];
      if (!node) continue;
      const commit = meta[row];
      const x = node.lane * LANE_WIDTH + LANE_WIDTH / 2;
      this.applyLaneStyle(ctx, commit);
      this.drawNode(
        ctx,
        x,
        rowY(row),
        this.laneColor(node.lane),
        commit?.sha === selected,
        commit?.refs.some((ref) => ref.ref_type === 'head') ?? false,
        node.lane === headLane,
      );
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private laneColor(lane: number): string {
    return this.lanes[lane % this.lanes.length] ?? FALLBACK_LANES[0] ?? '#00E5FF';
  }

  /** Off-branch lanes recede; the lane HEAD is on glows (see `strokeGlow`). */
  private applyLaneStyle(
    ctx: CanvasRenderingContext2D,
    commit: CommitInfo | undefined,
  ): void {
    ctx.globalAlpha = commit && !commit.on_current_branch ? OFF_BRANCH_ALPHA : 1;
  }

  private drawEdge(
    ctx: CanvasRenderingContext2D,
    edge: IndexedEdge,
    rowY: (row: number) => number,
    rowH: number,
    cssH: number,
    commit: CommitInfo | undefined,
    headLane: number | null,
  ): void {
    const fromX = edge.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
    const toX = edge.toLane * LANE_WIDTH + LANE_WIDTH / 2;
    const fromY = rowY(edge.fromRow);
    const color = this.laneColor(edge.fromLane);

    this.applyLaneStyle(ctx, commit);

    ctx.beginPath();
    if (edge.dangling) {
      // The parent is not in the walk, so the line stops just below the node
      // and dissolves rather than pretending to reach a row that exists.
      const toY = Math.min(cssH, fromY + rowH);
      const gradient = ctx.createLinearGradient(0, fromY, 0, toY);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, withAlpha(color, EDGE_FADE_ALPHA));
      ctx.strokeStyle = gradient;
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(fromX, toY);
    } else {
      ctx.strokeStyle = color;
      drawEdgePath(ctx, edge.type, fromX, fromY, toX, rowY(edge.toRow));
    }

    if (edge.fromLane === headLane) strokeGlow(ctx, EDGE_LINE_WIDTH);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private drawNode(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    selected: boolean,
    isHead: boolean,
    glow: boolean,
  ): void {
    if (glow) {
      // Only the outermost circle is glowed: a halo around the inner disc
      // would be painted over by the ring anyway.
      ctx.beginPath();
      ctx.arc(x, y, isHead ? HEAD_RING_RADIUS : NODE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      strokeGlow(ctx, NODE_RING_WIDTH);
    }

    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
    if (selected) {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = SELECTED_RING_WIDTH;
      ctx.strokeStyle = this.textColor;
      ctx.stroke();
    } else {
      ctx.fillStyle = isHead ? color : this.surface;
      ctx.fill();
      ctx.lineWidth = NODE_RING_WIDTH;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    if (isHead) {
      ctx.beginPath();
      ctx.arc(x, y, HEAD_RING_RADIUS, 0, Math.PI * 2);
      ctx.lineWidth = NODE_RING_WIDTH;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}

/**
 * Strokes the current path once as a wide translucent pass, under the real
 * stroke the caller is about to lay on top. `shadowBlur` would read the same
 * but costs a gaussian blur per stroke and per node, on every scroll frame.
 */
function strokeGlow(ctx: CanvasRenderingContext2D, restoreWidth: number): void {
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * HEAD_GLOW_ALPHA;
  ctx.lineWidth = HEAD_GLOW_WIDTH;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = restoreWidth;
}

/**
 * Lays the path for one edge onto an already-`beginPath()`ed context.
 *
 * Fork slides sideways first and then drops; merge drops first and then bends
 * into the target lane. Both bias their control points by half the horizontal
 * distance so a lane change reads as one deliberate bend.
 */
function drawEdgePath(
  ctx: CanvasRenderingContext2D,
  type: EdgeType,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  ctx.moveTo(fromX, fromY);
  switch (type) {
    case 'straight':
      ctx.lineTo(toX, toY);
      return;
    case 'fork': {
      const cp1x = fromX + (toX - fromX) * 0.5;
      ctx.bezierCurveTo(cp1x, fromY, toX, fromY, toX, toY);
      return;
    }
    case 'merge': {
      const cp2x = fromX + (toX - fromX) * 0.5;
      ctx.bezierCurveTo(fromX, toY, cp2x, toY, toX, toY);
      return;
    }
  }
}

/** Whether two hover targets point at the same node in the same place. */
function sameHoverTarget(a: HoverTarget | null, b: HoverTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.row === b.row && a.sha === b.sha && a.x === b.x && a.y === b.y;
}

/** `#RRGGBB` → `rgba(...)`; anything else is returned untouched. */
function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
