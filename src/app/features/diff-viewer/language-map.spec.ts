import { describe, expect, it } from 'vitest';
import { isImagePath, languageFor } from './language-map';

describe('languageFor', () => {
  it('maps the common source extensions', () => {
    expect(languageFor('src/app/main.ts')).toBe('typescript');
    expect(languageFor('src/app/main.tsx')).toBe('typescript');
    expect(languageFor('scripts/build.mjs')).toBe('javascript');
    expect(languageFor('src-tauri/src/lib.rs')).toBe('rust');
    expect(languageFor('cmd/main.go')).toBe('go');
    expect(languageFor('App.kt')).toBe('kotlin');
    expect(languageFor('Program.cs')).toBe('csharp');
    expect(languageFor('include/vec.hpp')).toBe('cpp');
    expect(languageFor('query.sql')).toBe('sql');
  });

  it('maps markup, styles and data', () => {
    expect(languageFor('index.html')).toBe('xml');
    expect(languageFor('logo.svg')).toBe('xml');
    expect(languageFor('styles.scss')).toBe('scss');
    expect(languageFor('package.json')).toBe('json');
    expect(languageFor('ci.yml')).toBe('yaml');
    expect(languageFor('Cargo.toml')).toBe('ini');
  });

  it('recognises Dockerfiles by name and by extension', () => {
    expect(languageFor('Dockerfile')).toBe('dockerfile');
    expect(languageFor('build/Dockerfile.dev')).toBe('dockerfile');
    expect(languageFor('service.dockerfile')).toBe('dockerfile');
  });

  it('matches dotfiles by their full name', () => {
    expect(languageFor('.gitignore')).toBe('ini');
    expect(languageFor('deep/path/.editorconfig')).toBe('ini');
  });

  it('accepts Windows separators', () => {
    expect(languageFor('src\\app\\main.ts')).toBe('typescript');
  });

  it('is case insensitive on the extension', () => {
    expect(languageFor('README.MD')).toBe('markdown');
  });

  it('falls back to plaintext for anything unknown', () => {
    expect(languageFor('LICENSE')).toBe('plaintext');
    expect(languageFor('data.bin')).toBe('plaintext');
    expect(languageFor('')).toBe('plaintext');
  });
});

describe('isImagePath', () => {
  it('recognises the raster and vector formats a diff cannot show', () => {
    for (const path of ['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.webp', 'a.svg']) {
      expect(isImagePath(path)).toBe(true);
    }
  });

  it('leaves source files alone', () => {
    expect(isImagePath('src/icon.ts')).toBe(false);
    expect(isImagePath('png')).toBe(false);
  });
});
