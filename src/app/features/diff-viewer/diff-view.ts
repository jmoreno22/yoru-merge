import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { MenuItem } from '../../shared/ui';
import {
  ClipboardService,
  ContextMenuService,
  YoruButton,
  YoruEmptyState,
  YoruSkeleton,
} from '../../shared/ui';
import type {
  DiffActionKind,
  DiffHunkAction,
  DiffLayout,
  DiffLineAction,
  StageTarget,
} from './diff-actions';
import {
  type DiffFileModel,
  type DiffFileStatus,
  type DiffLine,
  isLfsPointer,
  OVERSIZED_DIFF_SENTINEL,
  parseUnifiedDiff,
} from './diff-parse';
import {
  collapseContext,
  ignoreWhitespace,
  splitRowChanged,
  toSplitRows,
  toUnifiedRows,
  UNLIMITED_CONTEXT,
  unifiedRowChanged,
} from './diff-view-model';
import { Highlighter } from './highlighter';
import { ImageDiff } from './image-diff';
import { type ImageDiffContext, type ImageSides, imageSides } from './image-preview';
import { type HighlightLanguage, isImagePath, languageFor } from './language-map';
import { type LineSelection, selectLine, selectModeFor } from './line-selection';

/** Patches past this size are not rendered until the user insists. */
const HARD_LIMIT_BYTES = 1_500_000;

/** Above this, a file is shown as plain text: highlighting it is not worth it. */
const HIGHLIGHT_LIMIT_BYTES = 200_000;

/** Files longer than this open collapsed, so a big commit stays navigable. */
const COLLAPSE_THRESHOLD_LINES = 400;

/** Rough count of rows painted while the patch is still being parsed. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Rows added to the DOM per frame while a patch is being inserted. */
const CHUNK_ROWS = 300;

const NO_SELECTION: ReadonlySet<string> = new Set();

/** Stable id of one rendered line; the keyboard handler rebuilds it by hand. */
function lineId(
  fileIndex: number,
  hunkIndex: number,
  side: string,
  bodyIndex: number,
): string {
  return `l-${fileIndex}-${hunkIndex}-${side}-${bodyIndex}`;
}

/**
 * One line of the rendered patch.
 *
 * The highlighted HTML is produced on first read instead of when the row is
 * built, so a patch only pays for the lines the template actually paints —
 * building the rows of a 50-file commit no longer highlights all of them.
 */
class RenderedCell {
  private cached: string | null = null;

  constructor(
    readonly line: DiffLine,
    readonly id: string,
    readonly selectable: boolean,
    private readonly highlighter: Highlighter,
    private readonly language: HighlightLanguage | null,
  ) {}

  get html(): string {
    this.cached ??= this.highlighter.line(this.line.text, this.language);
    return this.cached;
  }
}

type RenderedRow =
  | { readonly kind: 'gap'; readonly id: string; readonly count: number }
  | { readonly kind: 'line'; readonly id: string; readonly cell: RenderedCell }
  | {
      readonly kind: 'pair';
      readonly id: string;
      readonly left: RenderedCell | null;
      readonly right: RenderedCell | null;
    };

interface RenderedHunk {
  readonly index: number;
  readonly header: string;
  readonly section: string;
  readonly additions: number;
  readonly deletions: number;
  readonly rows: readonly RenderedRow[];
  readonly domId: string;
  readonly selectable: readonly number[];
}

interface RenderedFile {
  readonly index: number;
  readonly path: string;
  readonly dirname: string;
  readonly basename: string;
  readonly oldPath: string | null;
  readonly status: DiffFileStatus;
  readonly binary: boolean;
  readonly image: boolean;
  /** Set when the image can be previewed; `null` falls back to the notice. */
  readonly imageSides: ImageSides | null;
  readonly lfs: boolean;
  readonly additions: number;
  readonly deletions: number;
  readonly lineCount: number;
  /** Digits the widest line number needs, so every row's gutter lines up. */
  readonly numberWidth: number;
  readonly expanded: boolean;
  readonly hunks: readonly RenderedHunk[];
}

/**
 * Width of the line-number gutter, in digits.
 *
 * Each row is its own CSS grid, so the gutter has to be sized per file rather
 * than by the widest row. The last line of every hunk carries that hunk's
 * highest numbers, which makes this O(hunks) instead of O(lines).
 */
function gutterDigits(file: DiffFileModel): number {
  let max = 0;
  for (const hunk of file.hunks) {
    const last = hunk.lines[hunk.lines.length - 1];
    if (!last) continue;
    max = Math.max(max, last.oldNumber ?? 0, last.newNumber ?? 0);
  }
  return Math.max(3, String(max).length);
}

/** Totals the host panel shows in its header. */
export interface DiffSummary {
  readonly files: number;
  readonly additions: number;
  readonly deletions: number;
}

const STATUS_LABEL: Readonly<Record<DiffFileStatus, string>> = {
  added: 'Added',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
  copied: 'Copied',
};

const STATUS_ICON: Readonly<Record<DiffFileStatus, string>> = {
  added: 'lucideFilePlus',
  deleted: 'lucideFileMinus',
  modified: 'lucideFileDiff',
  renamed: 'lucideFile',
  copied: 'lucideFile',
};

const STATUS_CLASS: Readonly<Record<DiffFileStatus, string>> = {
  added: 'text-git-added',
  deleted: 'text-git-deleted',
  modified: 'text-git-modified',
  renamed: 'text-git-renamed',
  copied: 'text-git-renamed',
};

/**
 * Renders one unified patch.
 *
 * The component owns nothing but the patch text: the diff panel, the file
 * history panel and anything else that has a diff string can drop it in. Every
 * git action is emitted upwards; no command is issued from here.
 *
 * The patch is parsed by `diff-parse`, never by a rendering library, because
 * the hunk ordinals and body positions this template attaches to its rows are
 * the same ones `stage_hunks` and `buildLinePatch` address. Parsing happens off
 * the render pass (`setTimeout`) so a large commit does not freeze the panel.
 */
@Component({
  selector: 'app-diff-view',
  imports: [ImageDiff, NgIcon, YoruButton, YoruEmptyState, YoruSkeleton],
  templateUrl: './diff-view.html',
  styleUrl: './diff-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Highlighted code is written through `[innerHTML]`, so its `.hljs-*` spans
  // never carry Angular's encapsulation attribute. Every rule in the stylesheet
  // is scoped under `app-diff-view` instead.
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'block h-full min-h-0',
    '[class.dv-wrap]': 'wordWrap()',
  },
})
export class DiffView {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clipboard = inject(ClipboardService);
  private readonly menu = inject(ContextMenuService);

  /** The unified patch to render. */
  readonly text = input<string>('');
  readonly layout = input<DiffLayout>('unified');
  readonly ignoreWhitespace = input<boolean>(false);
  readonly wordWrap = input<boolean>(false);
  /** Context rows kept around a change; `Infinity` shows the whole patch. */
  readonly contextLines = input<number>(UNLIMITED_CONTEXT);
  /** What the patch compares, so an image can be read from both sides. */
  readonly imageContext = input<ImageDiffContext>({ kind: 'none' });
  /** Set to enable staging affordances; `null` renders a read-only patch. */
  readonly stageTarget = input<StageTarget | null>(null);
  /** Disables the actions while a stage/unstage round trip is in flight. */
  readonly busy = input<boolean>(false);

  readonly hunkAction = output<DiffHunkAction>();
  readonly lineAction = output<DiffLineAction>();
  readonly openFile = output<string>();
  readonly revealFile = output<string>();

  private readonly parsed = signal<readonly DiffFileModel[]>([]);
  private highlighter = new Highlighter();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly parsing = signal(false);

  /** Cleared with the patch: an override only makes sense for what is shown. */
  private readonly fileOverrides = linkedSignal<string, Map<string, boolean>>({
    source: () => this.text(),
    computation: () => new Map(),
  });

  private readonly expandedGaps = linkedSignal<string, ReadonlySet<string>>({
    source: () => this.text(),
    computation: () => new Set<string>(),
  });

  private readonly selection = linkedSignal<string, LineSelection | null>({
    source: () => this.text(),
    computation: () => null,
  });

  private readonly showOversized = linkedSignal<string, boolean>({
    source: () => this.text(),
    computation: () => false,
  });

  protected readonly activeLineId = signal<string | null>(null);

  private readonly hunkCursor = signal(-1);

  protected readonly oversized = computed(
    () => this.text().length > HARD_LIMIT_BYTES && !this.showOversized(),
  );

  protected readonly unreadable = computed(
    () => this.text() === OVERSIZED_DIFF_SENTINEL,
  );

  protected readonly sizeMb = computed(() =>
    (this.text().length / (1024 * 1024)).toFixed(1),
  );

  protected readonly interactive = computed(() => this.stageTarget() !== null);

  /** Line selection needs one column of lines to anchor to. */
  protected readonly canSelectLines = computed(
    () => this.interactive() && this.layout() === 'unified',
  );

  protected readonly selectedCount = computed(
    () => this.selection()?.indexes.length ?? 0,
  );

  /**
   * Ids of the selected lines.
   *
   * A row asks a set instead of scanning the selection: with a whole hunk
   * selected, the per-row scan was quadratic in the number of rows painted.
   */
  protected readonly selectedIds = computed<ReadonlySet<string>>(() => {
    const selection = this.selection();
    if (selection === null) return NO_SELECTION;
    return new Set(
      selection.indexes.map((bodyIndex) =>
        lineId(selection.fileIndex, selection.hunkIndex, 'u', bodyIndex),
      ),
    );
  });

  protected readonly files = computed<readonly RenderedFile[]>(() => {
    const parsed = this.parsed();
    const overrides = this.fileOverrides();
    const gaps = this.expandedGaps();
    const split = this.layout() === 'split';
    const skipWhitespace = this.ignoreWhitespace();
    const context = this.contextLines();
    const imageContext = this.imageContext();

    return parsed.map((file) => {
      const expanded =
        overrides.get(file.path) ?? file.lineCount <= COLLAPSE_THRESHOLD_LINES;
      const slash = file.path.lastIndexOf('/');
      const language =
        file.raw.length > HIGHLIGHT_LIMIT_BYTES ? null : languageFor(file.path);
      const image = isImagePath(file.path);

      return {
        index: file.index,
        path: file.path,
        dirname: slash < 0 ? '' : file.path.slice(0, slash + 1),
        basename: slash < 0 ? file.path : file.path.slice(slash + 1),
        oldPath: file.oldPath,
        status: file.status,
        binary: file.binary,
        image,
        imageSides: image ? imageSides(imageContext, file.status) : null,
        lfs: isLfsPointer(file.raw),
        additions: file.additions,
        deletions: file.deletions,
        lineCount: file.lineCount,
        numberWidth: gutterDigits(file),
        expanded,
        hunks: expanded
          ? file.hunks.map((hunk) => {
              const lines = skipWhitespace ? ignoreWhitespace(hunk.lines) : hunk.lines;
              return {
                index: hunk.index,
                header: hunk.header,
                section: hunk.section,
                additions: hunk.additions,
                deletions: hunk.deletions,
                domId: `hunk-${file.index}-${hunk.index}`,
                // Built from the lines actually painted: with whitespace
                // ignored some changes are shown as context and must not be
                // reachable by a click or an arrow key.
                selectable: lines
                  .filter((line) => line.kind !== 'context')
                  .map((line) => line.bodyIndex),
                rows: split
                  ? this.buildSplitRows(
                      file,
                      hunk.index,
                      lines,
                      context,
                      gaps,
                      language,
                    )
                  : this.buildUnifiedRows(
                      file,
                      hunk.index,
                      lines,
                      context,
                      gaps,
                      language,
                    ),
              };
            })
          : [],
      };
    });
  });

  /** Rows the whole patch would paint, counting one per file header. */
  private readonly totalRows = computed(() => {
    let total = 0;
    for (const file of this.files()) {
      total += 1;
      for (const hunk of file.hunks) total += hunk.rows.length;
    }
    return total;
  });

  /**
   * The prefix of `files()` that is allowed into the DOM, in rows.
   *
   * `Infinity` once the whole patch is on screen, so nothing the user does
   * afterwards — expanding a gap, a file, switching layout — is ever clipped.
   */
  private readonly renderBudget = signal(Number.POSITIVE_INFINITY);

  /**
   * What the template paints: `files()` cut to the current budget.
   *
   * A patch arrives a chunk per frame instead of all at once, so the frame the
   * skeleton disappears costs one chunk rather than the whole diff. Files whose
   * hunks are all still beyond the budget are left out entirely — a header with
   * an empty `hunks` reads as "no textual changes" in the template.
   */
  protected readonly visibleFiles = computed<readonly RenderedFile[]>(() => {
    const files = this.files();
    let left = this.renderBudget();
    if (!Number.isFinite(left)) return files;

    const out: RenderedFile[] = [];
    for (const file of files) {
      if (left <= 0) break;
      left -= 1;

      const hunks: RenderedHunk[] = [];
      let clipped = false;
      for (const hunk of file.hunks) {
        if (hunk.rows.length > left) {
          if (left > 0) hunks.push({ ...hunk, rows: hunk.rows.slice(0, left) });
          left = 0;
          clipped = true;
          break;
        }
        hunks.push(hunk);
        left -= hunk.rows.length;
      }

      if (clipped && hunks.length === 0) break;
      out.push(clipped ? { ...file, hunks } : file);
    }
    return out;
  });

  protected readonly isEmpty = computed(
    () => !this.parsing() && this.parsed().length === 0,
  );

  /** Totals of the patch on screen, for the host panel's header. */
  readonly summary = computed<DiffSummary>(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of this.parsed()) {
      additions += file.additions;
      deletions += file.deletions;
    }
    return { files: this.parsed().length, additions, deletions };
  });

  /** Hunks currently on screen (collapsed files contribute none). */
  readonly hunkTotal = computed(() =>
    this.files().reduce((total, file) => total + file.hunks.length, 0),
  );

  /** 1-based position of the hunk `goToNextHunk` last moved to; 0 = none. */
  readonly hunkPosition = computed(() => this.hunkCursor() + 1);

  constructor() {
    effect((onCleanup) => {
      const text = this.text();
      this.parsed.set([]);
      this.hunkCursor.set(-1);

      if (text === '' || text === OVERSIZED_DIFF_SENTINEL) {
        this.parsing.set(false);
        return;
      }
      if (text.length > HARD_LIMIT_BYTES && !this.showOversized()) {
        this.parsing.set(false);
        return;
      }

      // Off the render pass: a megabyte of patch takes long enough to parse
      // that doing it inline drops frames on every file the user clicks.
      this.parsing.set(true);
      let frame = 0;

      const grow = (): void => {
        const budget = this.renderBudget() + CHUNK_ROWS;
        if (budget >= this.totalRows()) {
          this.renderBudget.set(Number.POSITIVE_INFINITY);
          return;
        }
        this.renderBudget.set(budget);
        frame = requestAnimationFrame(grow);
      };

      const handle = setTimeout(() => {
        this.highlighter = new Highlighter();
        this.renderBudget.set(CHUNK_ROWS);
        this.parsed.set(parseUnifiedDiff(text));
        this.parsing.set(false);
        frame = requestAnimationFrame(grow);
      });
      onCleanup(() => {
        clearTimeout(handle);
        cancelAnimationFrame(frame);
        this.parsing.set(false);
      });
    });
  }

  // ── row building ────────────────────────────────────────────────────────

  private cell(
    fileIndex: number,
    hunkIndex: number,
    side: string,
    line: DiffLine,
    language: HighlightLanguage | null,
  ): RenderedCell {
    return new RenderedCell(
      line,
      lineId(fileIndex, hunkIndex, side, line.bodyIndex),
      line.kind !== 'context',
      this.highlighter,
      language,
    );
  }

  private buildUnifiedRows(
    file: DiffFileModel,
    hunkIndex: number,
    lines: readonly DiffLine[],
    context: number,
    gaps: ReadonlySet<string>,
    language: HighlightLanguage | null,
  ): RenderedRow[] {
    const collapsed = collapseContext(toUnifiedRows(lines), unifiedRowChanged, context);
    const out: RenderedRow[] = [];

    const line = (source: DiffLine): RenderedRow => {
      const cell = this.cell(file.index, hunkIndex, 'u', source, language);
      return { kind: 'line', id: cell.id, cell };
    };

    for (const entry of collapsed) {
      if (entry.kind === 'row') {
        out.push(line(entry.row.line));
        continue;
      }
      const first = entry.rows[0]?.line.bodyIndex ?? 0;
      const id = `g-${file.index}-${hunkIndex}-${first}`;
      if (gaps.has(id)) {
        for (const row of entry.rows) out.push(line(row.line));
      } else {
        out.push({ kind: 'gap', id, count: entry.count });
      }
    }
    return out;
  }

  private buildSplitRows(
    file: DiffFileModel,
    hunkIndex: number,
    lines: readonly DiffLine[],
    context: number,
    gaps: ReadonlySet<string>,
    language: HighlightLanguage | null,
  ): RenderedRow[] {
    const collapsed = collapseContext(toSplitRows(lines), splitRowChanged, context);
    const out: RenderedRow[] = [];

    const pair = (row: { left: DiffLine | null; right: DiffLine | null }) => {
      const left = row.left
        ? this.cell(file.index, hunkIndex, 'l', row.left, language)
        : null;
      const right = row.right
        ? this.cell(file.index, hunkIndex, 'r', row.right, language)
        : null;
      return {
        kind: 'pair',
        id: left?.id ?? right?.id ?? '',
        left,
        right,
      } satisfies RenderedRow;
    };

    for (const entry of collapsed) {
      if (entry.kind === 'row') {
        out.push(pair(entry.row));
        continue;
      }
      const head = entry.rows[0];
      const first = head?.left?.bodyIndex ?? head?.right?.bodyIndex ?? 0;
      const id = `g-${file.index}-${hunkIndex}-${first}`;
      if (gaps.has(id)) {
        for (const row of entry.rows) out.push(pair(row));
      } else {
        out.push({ kind: 'gap', id, count: entry.count });
      }
    }
    return out;
  }

  // ── template helpers ────────────────────────────────────────────────────

  protected statusLabel(status: DiffFileStatus): string {
    return STATUS_LABEL[status];
  }

  protected statusIcon(status: DiffFileStatus): string {
    return STATUS_ICON[status];
  }

  protected statusClass(status: DiffFileStatus): string {
    return STATUS_CLASS[status];
  }

  protected hunkHasSelection(fileIndex: number, hunkIndex: number): boolean {
    const selection = this.selection();
    return (
      selection !== null &&
      selection.fileIndex === fileIndex &&
      selection.hunkIndex === hunkIndex
    );
  }

  /** Label of the primary hunk action, which depends on the side shown. */
  protected primaryLabel(): string {
    return this.stageTarget()?.staged ? 'Unstage hunk' : 'Stage hunk';
  }

  protected primaryKind(): DiffActionKind {
    return this.stageTarget()?.staged ? 'unstage' : 'stage';
  }

  // ── user actions ────────────────────────────────────────────────────────

  protected toggleFile(file: RenderedFile): void {
    this.fileOverrides.update((current) => {
      const next = new Map(current);
      next.set(file.path, !file.expanded);
      return next;
    });
  }

  protected expandGap(id: string): void {
    this.expandedGaps.update((current) => new Set(current).add(id));
  }

  protected revealAll(): void {
    this.showOversized.set(true);
  }

  protected onLineClick(
    event: MouseEvent,
    fileIndex: number,
    hunkIndex: number,
    hunk: RenderedHunk,
    cell: RenderedCell,
  ): void {
    if (!this.canSelectLines() || !cell.selectable) return;
    this.selection.set(
      selectLine(
        this.selection(),
        { fileIndex, hunkIndex, bodyIndex: cell.line.bodyIndex },
        selectModeFor(event),
        hunk.selectable,
      ),
    );
    this.activeLineId.set(cell.id);
  }

  /**
   * Arrow keys walk the changed lines of a hunk, Space toggles the one under
   * the cursor and Shift extends from the anchor — the listbox pattern, so a
   * line selection is reachable without a mouse.
   */
  protected onHunkKeydown(
    event: KeyboardEvent,
    fileIndex: number,
    hunk: RenderedHunk,
  ): void {
    if (!this.canSelectLines() || hunk.selectable.length === 0) return;

    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;

    if (step !== 0) {
      event.preventDefault();
      const current = this.cursorIndex(fileIndex, hunk);
      const next = Math.min(hunk.selectable.length - 1, Math.max(0, current + step));
      const bodyIndex = hunk.selectable[next] as number;
      this.activeLineId.set(lineId(fileIndex, hunk.index, 'u', bodyIndex));
      this.selection.set(
        selectLine(
          this.selection(),
          { fileIndex, hunkIndex: hunk.index, bodyIndex },
          event.shiftKey ? 'range' : 'replace',
          hunk.selectable,
        ),
      );
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      const current = this.cursorIndex(fileIndex, hunk);
      const bodyIndex = hunk.selectable[Math.max(0, current)] as number;
      event.preventDefault();
      this.selection.set(
        selectLine(
          this.selection(),
          { fileIndex, hunkIndex: hunk.index, bodyIndex },
          'toggle',
          hunk.selectable,
        ),
      );
      return;
    }

    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.selection.set({
        fileIndex,
        hunkIndex: hunk.index,
        anchor: hunk.selectable[0] as number,
        indexes: [...hunk.selectable],
      });
      return;
    }

    if (event.key === 'Escape' && this.selection() !== null) {
      event.preventDefault();
      event.stopPropagation();
      this.selection.set(null);
    }
  }

  private cursorIndex(fileIndex: number, hunk: RenderedHunk): number {
    const active = this.activeLineId();
    const prefix = `l-${fileIndex}-${hunk.index}-u-`;
    if (active?.startsWith(prefix)) {
      const bodyIndex = Number(active.slice(prefix.length));
      const found = hunk.selectable.indexOf(bodyIndex);
      if (found >= 0) return found;
    }
    return 0;
  }

  /**
   * Row menu: copy, plus whatever staging the current side allows.
   *
   * Per-row buttons would add three controls to every line of a patch that can
   * already be tens of thousands of lines long, so the row-level actions live
   * here and the hunk-level ones stay visible in the hunk header.
   */
  protected async onRowContextMenu(
    event: MouseEvent,
    fileIndex: number,
    hunk: RenderedHunk,
    cell: RenderedCell,
  ): Promise<void> {
    event.preventDefault();
    const target = this.stageTarget();
    const selected = this.hunkHasSelection(fileIndex, hunk.index)
      ? this.selectedCount()
      : 0;
    const items: MenuItem[] = [
      {
        id: 'copy-line',
        label: 'Copy line',
        icon: 'lucideCopy',
        run: () => void this.copyLine(cell),
      },
      {
        id: 'copy-hunk',
        label: 'Copy hunk',
        icon: 'lucideClipboard',
        run: () => void this.copyHunk(fileIndex, hunk.index),
      },
    ];

    if (target) {
      const noun = selected === 1 ? '1 line' : `${selected} lines`;
      items.push({
        id: 'primary-hunk',
        label: this.primaryLabel(),
        icon: target.staged ? 'lucideMinus' : 'lucidePlus',
        separatorBefore: true,
        disabled: this.busy(),
        run: () => this.runHunkAction(this.primaryKind(), fileIndex, hunk.index),
      });
      items.push({
        id: 'primary-lines',
        label: target.staged ? `Unstage ${noun}` : `Stage ${noun}`,
        icon: 'lucideRows3',
        disabled: this.busy() || selected === 0,
        disabledReason: selected === 0 ? 'Select lines first' : undefined,
        run: () => this.runLineAction(this.primaryKind()),
      });
      if (!target.staged) {
        items.push({
          id: 'discard-hunk',
          label: 'Discard hunk…',
          icon: 'lucideRotateCcw',
          tone: 'danger',
          separatorBefore: true,
          disabled: this.busy(),
          run: () => this.runHunkAction('discard', fileIndex, hunk.index),
        });
        items.push({
          id: 'discard-lines',
          label: `Discard ${noun}…`,
          icon: 'lucideRotateCcw',
          tone: 'danger',
          disabled: this.busy() || selected === 0,
          disabledReason: selected === 0 ? 'Select lines first' : undefined,
          run: () => this.runLineAction('discard'),
        });
      }
    }

    await this.menu.open(items, { x: event.clientX, y: event.clientY });
  }

  protected runHunkAction(
    kind: DiffActionKind,
    fileIndex: number,
    hunkIndex: number,
  ): void {
    const target = this.stageTarget();
    const file = this.parsed()[fileIndex];
    if (!target || !file) return;
    this.hunkAction.emit({
      kind,
      file: target.file,
      hunkIndex,
      fileDiff: file.raw,
    });
  }

  protected runLineAction(kind: DiffActionKind): void {
    const selection = this.selection();
    const target = this.stageTarget();
    if (!selection || !target) return;
    const file = this.parsed()[selection.fileIndex];
    if (!file) return;
    this.lineAction.emit({
      kind,
      file: target.file,
      hunkIndex: selection.hunkIndex,
      fileDiff: file.raw,
      lines: selection.indexes,
    });
    this.selection.set(null);
  }

  protected clearSelection(): void {
    this.selection.set(null);
  }

  protected async copyHunk(fileIndex: number, hunkIndex: number): Promise<void> {
    const hunk = this.parsed()[fileIndex]?.hunks[hunkIndex];
    if (!hunk) return;
    const body = hunk.lines.map((line) => line.text).join('\n');
    await this.clipboard.writeText(`${hunk.header}\n${body}`);
  }

  protected async copyLine(cell: RenderedCell): Promise<void> {
    await this.clipboard.writeText(cell.line.text);
  }

  protected async copyPath(path: string): Promise<void> {
    await this.clipboard.writeText(path);
  }

  // ── hunk navigation (driven by the host panel) ──────────────────────────

  goToNextHunk(): void {
    this.moveHunk(1);
  }

  goToPreviousHunk(): void {
    this.moveHunk(-1);
  }

  private moveHunk(step: number): void {
    const ids: string[] = [];
    for (const file of this.files()) {
      for (const hunk of file.hunks) ids.push(hunk.domId);
    }
    if (ids.length === 0) return;

    const cursor = this.hunkCursor();
    const next = Math.min(ids.length - 1, Math.max(0, cursor + step));
    const target = cursor < 0 && step < 0 ? 0 : next;
    const id = ids[target];
    if (!id) return;

    const element = this.host.nativeElement.querySelector<HTMLElement>(
      `[data-hunk="${id}"]`,
    );
    // A hunk whose chunk has not been inserted yet has no element: leave the
    // cursor where it is rather than counting a move that did not happen.
    if (!element) return;
    this.hunkCursor.set(target);
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.focus({ preventScroll: true });
  }
}
