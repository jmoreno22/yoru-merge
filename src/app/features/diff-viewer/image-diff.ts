import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
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

  protected readonly beforeUrl = signal<string | null>(null);
  protected readonly afterUrl = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  private readonly visible = signal(false);

  /** Guards against a slower earlier load painting over a newer one. */
  private attempt = 0;

  constructor() {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.visible.set(true);
      observer.disconnect();
    });
    observer.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());

    effect(() => {
      const file = this.file();
      const oldFile = this.oldFile();
      const sides = this.sides();
      if (!this.visible()) return;
      void this.load(file, oldFile, sides);
    });
  }

  private async load(file: string, oldFile: string, sides: ImageSides): Promise<void> {
    const attempt = ++this.attempt;
    const mime = imageMimeType(file);
    const repo = this.repo.repo()?.path;
    if (!mime || !repo) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const [before, after] = await Promise.all([
        this.read(oldFile, sides.before, mime),
        this.read(file, sides.after, mime),
      ]);
      if (attempt !== this.attempt) return;
      this.beforeUrl.set(before);
      this.afterUrl.set(after);
    } catch (error: unknown) {
      if (attempt !== this.attempt) return;
      this.beforeUrl.set(null);
      this.afterUrl.set(null);
      this.error.set(messageFromUnknown(error));
    } finally {
      if (attempt === this.attempt) this.loading.set(false);
    }
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
