import { describe, expect, it } from 'vitest';
import { branchNameFrom, slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and dashes the separators', () => {
    expect(slugify('Add Drag & Drop')).toBe('add-drag-drop');
  });

  it('strips diacritics', () => {
    expect(slugify('Añadir búsqueda rápida')).toBe('anadir-busqueda-rapida');
  });

  it('keeps slashes so callers can pass a namespaced name', () => {
    expect(slugify('feat/new thing')).toBe('feat/new-thing');
  });

  it('collapses repeated separators', () => {
    expect(slugify('feat//  a __ b')).toBe('feat/a-b');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
    expect(slugify('/feat/')).toBe('feat');
  });

  it('drops characters git refuses in a ref name', () => {
    expect(slugify('fix: crash on ~^:?*[ input')).toBe('fix-crash-on-input');
  });

  it('returns an empty string when nothing survives', () => {
    expect(slugify('***')).toBe('');
  });
});

describe('branchNameFrom', () => {
  it('joins the type and the description with a slash', () => {
    expect(branchNameFrom('feat', 'Add drag & drop')).toBe('feat/add-drag-drop');
  });

  it('falls back to whichever half is non-empty', () => {
    expect(branchNameFrom('', 'quick fix')).toBe('quick-fix');
    expect(branchNameFrom('chore', '')).toBe('chore');
  });
});
