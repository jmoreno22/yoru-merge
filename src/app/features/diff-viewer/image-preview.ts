import type { DiffFileStatus } from './diff-parse';

/**
 * Where one side of an image preview reads its bytes from.
 *
 * Mirrors the `source` argument of the facade's `getFileBase64`.
 */
export type FileSource =
  | { readonly kind: 'workdir' }
  | { readonly kind: 'index' }
  | { readonly kind: 'rev'; readonly rev: string };

/** The patch on screen, as much of it as an image preview needs. */
export type ImageDiffContext =
  | { readonly kind: 'none' }
  | { readonly kind: 'commit'; readonly sha: string }
  | { readonly kind: 'working'; readonly staged: boolean };

/** The two sides to render; `null` on the side the change does not have. */
export interface ImageSides {
  readonly before: FileSource | null;
  readonly after: FileSource | null;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/**
 * MIME type for a path, or `null` when it is not an image this can preview.
 *
 * SVG is included: inside an `<img>` it renders as a static document, with
 * scripts and external references inert.
 */
export function imageMimeType(path: string): string | null {
  const name = path.replace(/\\/g, '/');
  const base = name.slice(name.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  return MIME_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * Which revisions the two sides of an image diff come from.
 *
 * Returns `null` when the patch has no context to read blobs from — the file
 * history panel and an empty panel both land there, and fall back to the
 * "binary file" notice.
 */
export function imageSides(
  context: ImageDiffContext,
  status: DiffFileStatus,
): ImageSides | null {
  if (context.kind === 'none') return null;

  const [before, after]: [FileSource, FileSource] =
    context.kind === 'commit'
      ? [
          { kind: 'rev', rev: `${context.sha}^` },
          { kind: 'rev', rev: context.sha },
        ]
      : context.staged
        ? [{ kind: 'rev', rev: 'HEAD' }, { kind: 'index' }]
        : [{ kind: 'index' }, { kind: 'workdir' }];

  return {
    before: status === 'added' ? null : before,
    after: status === 'deleted' ? null : after,
  };
}
