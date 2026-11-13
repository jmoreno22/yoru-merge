import { type Portal, PortalModule } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { EscapeRank } from '../../core/services/escape-layers';
import { EscapeLayersService } from '../../core/services/escape-layers.service';
import { shortSha } from '../../core/utils';
import {
  ClipboardService,
  ContextMenuService,
  type DiffSourceFacts,
  fileMenuHeader,
  KeyboardShortcutsService,
  type MenuItem,
  YoruButton,
  YoruDiffSource,
  YoruIconButton,
  YoruTooltip,
} from '../../shared/ui';

/**
 * The centre view while a diff is open at full width: a strip and a portal
 * outlet, nothing else. The strip is the diff's only header here — the viewer
 * draws none while it is hosted and the diff withholds its per-file head.
 *
 * The diff itself is rendered by the one `<app-diff-viewer>` of the app, whose
 * live element is moved in here through the outlet and back to the inspector on
 * close (ADR-0003) — so this component neither creates nor knows the viewer,
 * and offers no staging control of its own (AC-14). File order comes from the
 * list that owns the open gesture, through `DiffWorkspaceService`: nothing here
 * knows about trees, sides or the DOM of those lists.
 */
@Component({
  selector: 'app-diff-workspace',
  imports: [
    NgIcon,
    PortalModule,
    YoruButton,
    YoruDiffSource,
    YoruIconButton,
    YoruTooltip,
  ],
  templateUrl: './diff-workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'diff-workspace',
    class: 'flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg)]',
  },
})
export class DiffWorkspace {
  protected readonly workspace = inject(DiffWorkspaceService);
  private readonly repo = inject(CurrentRepoService);
  /** The strip's key hints come from the registry, never from prose. */
  protected readonly shortcuts = inject(KeyboardShortcutsService);

  private readonly menu = inject(ContextMenuService);
  private readonly clipboard = inject(ClipboardService);

  /** The live diff viewer element, handed over by the workbench shell. */
  readonly portal = input<Portal<unknown> | null>(null);

  /**
   * What the viewer knows about the file on screen — status, rename, line
   * counts — handed over by the same shell, so this component still does not
   * know the viewer.
   */
  readonly file = input<DiffSourceFacts | null>(null);

  protected readonly canPrev = this.workspace.canPrev;
  protected readonly canNext = this.workspace.canNext;

  protected readonly head = computed(() => {
    const current = this.workspace.current();
    if (!current) return null;
    const source = current.source;
    if (source.kind === 'working-tree') {
      const chip = source.side === 'staged' ? 'Staged' : 'Unstaged';
      return { chip, side: source.side, detail: '', path: current.file };
    }
    // The details of another commit, or none yet, must not be shown as this
    // commit's subject: the sha alone is always right.
    const details = this.repo.commitDetails();
    const subject = details?.sha === source.sha ? details.subject : '';
    const sha = shortSha(source.sha);
    return {
      chip: 'Commit',
      side: null,
      detail: subject === '' ? sha : `${sha} · ${subject}`,
      path: current.file,
    };
  });

  /**
   * What the viewer heading and the per-file head offered as buttons. Blame
   * and file history read the working tree, so a commit diff does not get
   * them here — the commit file list offers them at that commit.
   */
  protected async openFileMenu(
    event: MouseEvent,
    path: string,
    workingTree: boolean,
  ): Promise<void> {
    const items: MenuItem[] = [
      {
        id: 'copy-path',
        label: 'Copy path',
        icon: 'lucideCopy',
        run: () => void this.clipboard.writeText(path),
      },
      {
        id: 'editor',
        label: 'Open in editor',
        icon: 'lucideExternalLink',
        separatorBefore: true,
        run: () => void this.repo.openInEditor(path),
      },
      {
        id: 'reveal',
        label: 'Reveal in file manager',
        icon: 'lucideFolderOpen',
        run: () => void this.repo.revealInFileManager(path),
      },
    ];
    if (workingTree) {
      items.push(
        {
          id: 'blame',
          label: 'Blame',
          icon: 'lucideUser',
          separatorBefore: true,
          run: () => void this.repo.loadBlame(path),
        },
        {
          id: 'history',
          label: 'File history',
          icon: 'lucideHistory',
          run: () => void this.repo.loadFileHistory(path),
        },
      );
    }
    await this.menu.open(items, event.currentTarget as HTMLElement, {
      header: fileMenuHeader(path),
    });
  }

  constructor() {
    const escapeLayers = inject(EscapeLayersService);
    escapeLayers.bind(EscapeRank.diffWorkspace, this.workspace.isOpen, () =>
      this.workspace.close(),
    );
  }
}
