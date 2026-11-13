import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { messageFromUnknown } from '../../core/services/git-auth-error';
import { YoruSpinner } from '../../shared/ui';
import { type FileSource, type ImageSides, imageMimeType } from './image-preview';

/**
 * Old and new contents of an image, side by side.
 *
 * The bytes come through the git facade rather than from disk, so a commit's
 * images are as previewable as the working tree's. Both sides are fetched only
 * once the file scrolls into view: a commit that touches an asset folder would
 * otherwise pull every blob in it before the user looks at any of them.
 *
 * Styling lives in `diff-view.css`, which is unencapsulated and owns every
 * `dv-` class inside the diff.
 */
@Component({
  selector: 'app-image-diff',
  imports: [NgIcon, YoruSpinner],
  templateUrl: './image-diff.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ImageDiff {
  private readonly repo = inject(CurrentRepoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Path of the new side; also the one that names the MIME type. */
  readonly file = input.required<string>();
  /** Path of the old side, which a rename makes different from `file`. */
  readonly oldFile = input.required<string>();
  readonly sides = input.required<ImageSides>();

  private readonly visible = signal(false);

  /** Stays idle until the file is on screen; a newer load discards an older one. */
  private readonly preview = resource({
    params: () => {
      if (!this.visible()) return undefined;
      const file = this.file();
      const mime = imageMimeType(file);
      if (!mime || !this.repo.repo()?.path) return undefined;
      return { file, oldFile: this.oldFile(), sides: this.sides(), mime };
    },
    loader: async ({ params: { file, oldFile, sides, mime } }) => {
      const [before, after] = await Promise.all([
        this.read(oldFile, sides.before, mime),
        this.read(file, sides.after, mime),
      ]);
      return { before, after };
    },
  });

  protected readonly beforeUrl = computed(() =>
    this.preview.hasValue() ? this.preview.value().before : null,
  );
  protected readonly afterUrl = computed(() =>
    this.preview.hasValue() ? this.preview.value().after : null,
  );
  protected readonly loading = this.preview.isLoading;

  // resource() wraps a non-Error rejection, and Tauri rejects with strings.
  protected readonly error = computed(() => {
    const error = this.preview.error();
    return error ? messageFromUnknown(error.cause ?? error) : null;
  });

  constructor() {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.visible.set(true);
      observer.disconnect();
    });
    observer.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private async read(
    file: string,
    source: FileSource | null,
    mime: string,
  ): Promise<string | null> {
    if (!source) return null;
    try {
      return this.toUrl(await this.repo.getFileBase64(file, source), file, mime);
    } catch (error: unknown) {
      // A conflicted path has no stage-0 entry, so the index cannot answer for
      // it; HEAD is the closest thing to "before" that always exists.
      if (source.kind !== 'index') throw error;
      const head: FileSource = { kind: 'rev', rev: 'HEAD' };
      return this.toUrl(await this.repo.getFileBase64(file, head), file, mime);
    }
  }

  private toUrl(base64: string, file: string, mime: string): string {
    if (base64 === '') throw new Error(`${file} could not be read.`);
    return `data:${mime};base64,${base64}`;
  }
}
