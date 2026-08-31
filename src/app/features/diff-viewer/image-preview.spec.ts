import { describe, expect, it } from 'vitest';
import { type ImageDiffContext, imageMimeType, imageSides } from './image-preview';

const COMMIT: ImageDiffContext = { kind: 'commit', sha: 'a1b2c3d' };
const UNSTAGED: ImageDiffContext = { kind: 'working', staged: false };
const STAGED: ImageDiffContext = { kind: 'working', staged: true };

describe('imageMimeType', () => {
  it('maps every extension the viewer previews', () => {
    expect(imageMimeType('a/b/logo.png')).toBe('image/png');
    expect(imageMimeType('photo.JPG')).toBe('image/jpeg');
    expect(imageMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(imageMimeType('anim.gif')).toBe('image/gif');
    expect(imageMimeType('shot.webp')).toBe('image/webp');
    expect(imageMimeType('old.bmp')).toBe('image/bmp');
    expect(imageMimeType('favicon.ico')).toBe('image/x-icon');
    expect(imageMimeType('icon.svg')).toBe('image/svg+xml');
  });

  it('reads the extension off a Windows path', () => {
    expect(imageMimeType('src\\assets\\logo.png')).toBe('image/png');
  });

  it('returns null for anything else', () => {
    expect(imageMimeType('src/app.ts')).toBeNull();
    expect(imageMimeType('README')).toBeNull();
    expect(imageMimeType('.png')).toBeNull();
  });
});

describe('imageSides', () => {
  it('has nothing to read without a diff context', () => {
    expect(imageSides({ kind: 'none' }, 'modified')).toBeNull();
  });

  it('compares a commit against its first parent', () => {
    expect(imageSides(COMMIT, 'modified')).toEqual({
      before: { kind: 'rev', rev: 'a1b2c3d^' },
      after: { kind: 'rev', rev: 'a1b2c3d' },
    });
  });

  it('compares an unstaged change against the index', () => {
    expect(imageSides(UNSTAGED, 'modified')).toEqual({
      before: { kind: 'index' },
      after: { kind: 'workdir' },
    });
  });

  it('compares a staged change against HEAD', () => {
    expect(imageSides(STAGED, 'modified')).toEqual({
      before: { kind: 'rev', rev: 'HEAD' },
      after: { kind: 'index' },
    });
  });

  it('drops the side the change does not have', () => {
    expect(imageSides(COMMIT, 'added')?.before).toBeNull();
    expect(imageSides(COMMIT, 'added')?.after).toEqual({ kind: 'rev', rev: 'a1b2c3d' });
    expect(imageSides(UNSTAGED, 'deleted')?.after).toBeNull();
    expect(imageSides(UNSTAGED, 'deleted')?.before).toEqual({ kind: 'index' });
  });

  it('keeps both sides of a rename', () => {
    const sides = imageSides(COMMIT, 'renamed');
    expect(sides?.before).not.toBeNull();
    expect(sides?.after).not.toBeNull();
  });
});
