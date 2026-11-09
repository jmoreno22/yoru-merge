import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The working-tree side a chip names; `null` for a commit diff. */
export type DiffSourceSide = 'staged' | 'unstaged' | null;

/**
 * The head of a diff strip: the source chip, an optional detail, and the path
 * with its directory faint and its file name strong. Shared so the diff viewer
 * and the diff workspace name the same patch the same way.
 */
@Component({
  selector: 'yoru-diff-source',
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
