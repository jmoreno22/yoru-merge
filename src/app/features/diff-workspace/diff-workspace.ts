import { type Portal, PortalModule } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { DiffWorkspaceService } from '../../core/services/diff-workspace.service';
import { EscapeRank } from '../../core/services/escape-layers';
import { EscapeLayersService } from '../../core/services/escape-layers.service';
import { shortSha } from '../../core/utils';
import {
  KeyboardShortcutsService,
  YoruButton,
  YoruDiffSource,
  YoruTooltip,
} from '../../shared/ui';

/**
 * The centre view while a diff is open at full width: a strip and a portal
 * outlet, nothing else.
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
  imports: [PortalModule, YoruButton, YoruDiffSource, YoruTooltip],
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

  /** The live diff viewer element, handed over by the workbench shell (T8). */
  readonly portal = input<Portal<unknown> | null>(null);

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

  constructor() {
    const escapeLayers = inject(EscapeLayersService);
    escapeLayers.bind(EscapeRank.diffWorkspace, this.workspace.isOpen, () =>
      this.workspace.close(),
    );
  }
}
