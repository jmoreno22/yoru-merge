import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** The working-tree side a chip names; `null` for a commit diff. */
export type DiffSourceSide = 'staged' | 'unstaged' | null;

/**
 * What a strip says about the one file it shows, beyond its path. A host that
 * names the file itself — the diff workspace — takes these so the diff does
 * not have to repeat them in a head of its own.
 */
export interface DiffSourceFacts {
  /** The status as a word: the colour alone never carries it. */
  readonly status: string;
  readonly statusIcon: string;
  /** Text colour utility of the status, e.g. `text-git-added-ink`. */
  readonly statusClass: string;
  readonly oldPath: string | null;
  readonly lfs: boolean;
  /** `null` for a binary file, which has no line counts. */
  readonly stats: { readonly additions: number; readonly deletions: number } | null;
}

/**
 * The head of a diff strip: the source chip, an optional detail, the path with
 * its directory faint and its file name strong, and — when the host passes
 * them — the file's status, rename, LFS marker and line counts. Shared so the
 * diff viewer and the diff workspace name the same patch the same way.
 */
@Component({
  selector: 'yoru-diff-source',
  imports: [NgIcon],
  templateUrl: './yoru-diff-source.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 items-center gap-2' },
})
export class YoruDiffSource {
  readonly chip = input.required<string>();
  readonly side = input<DiffSourceSide>(null);
  /** Sits between chip and path — the workspace puts the sha and subject here. */
  readonly detail = input<string>('');
  /** Split on the last slash; a value without one is all basename. */
  readonly path = input.required<string>();
  /** `title` of the path span when the full text is longer than `path`. */
  readonly pathTitle = input<string>('');
  readonly facts = input<DiffSourceFacts | null>(null);
  readonly chipTestId = input<string | null>(null);
  readonly pathTestId = input<string | null>(null);

  protected readonly parts = computed(() => {
    const path = this.path();
    const slash = path.lastIndexOf('/');
    return {
      dirname: slash < 0 ? '' : path.slice(0, slash + 1),
      basename: slash < 0 ? path : path.slice(slash + 1),
      title: this.pathTitle() === '' ? path : this.pathTitle(),
    };
  });
}
