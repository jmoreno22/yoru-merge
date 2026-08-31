/**
 * File path → highlight.js language.
 *
 * Detection is by extension only. highlight.js' `highlightAuto` walks every
 * registered grammar and is both slow and wrong often enough to be a liability
 * on a diff, where each line is highlighted on its own.
 */

/** Every grammar registered in `highlighter.ts`. */
export type HighlightLanguage =
  | 'bash'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'css'
  | 'diff'
  | 'dockerfile'
  | 'go'
  | 'ini'
  | 'java'
  | 'javascript'
  | 'json'
  | 'kotlin'
  | 'markdown'
  | 'plaintext'
  | 'powershell'
  | 'python'
  | 'rust'
  | 'scss'
  | 'sql'
  | 'typescript'
  | 'xml'
  | 'yaml';

const BY_EXTENSION: Readonly<Record<string, HighlightLanguage>> = {
  bash: 'bash',
  bat: 'powershell',
  c: 'c',
  cc: 'cpp',
  cjs: 'javascript',
  cmd: 'powershell',
  conf: 'ini',
  cs: 'csharp',
  css: 'css',
  cts: 'typescript',
  cxx: 'cpp',
  diff: 'diff',
  editorconfig: 'ini',
  gitconfig: 'ini',
  go: 'go',
  gradle: 'kotlin',
  h: 'c',
  hpp: 'cpp',
  htm: 'xml',
  html: 'xml',
  hxx: 'cpp',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  lock: 'yaml',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  patch: 'diff',
  properties: 'ini',
  ps1: 'powershell',
  psd1: 'powershell',
  psm1: 'powershell',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  sass: 'scss',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  svg: 'xml',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plaintext',
  vue: 'xml',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
};

/** Files whose whole name carries the language, extension or not. */
const BY_FILENAME: Readonly<Record<string, HighlightLanguage>> = {
  '.bashrc': 'bash',
  '.editorconfig': 'ini',
  '.gitattributes': 'ini',
  '.gitconfig': 'ini',
  '.gitignore': 'ini',
  '.gitmodules': 'ini',
  '.npmrc': 'ini',
  '.zshrc': 'bash',
  containerfile: 'dockerfile',
  dockerfile: 'dockerfile',
  makefile: 'bash',
};

/** Image extensions the viewer refuses to render as text. */
const IMAGE_EXTENSIONS = new Set([
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Language for a path, or `'plaintext'` when nothing matches.
 *
 * `Dockerfile.dev` and `foo.dockerfile` both resolve, and a dotfile such as
 * `.gitignore` is matched by its full name rather than by a bogus extension.
 */
export function languageFor(path: string): HighlightLanguage {
  const name = basename(path).toLowerCase();
  const exact = BY_FILENAME[name];
  if (exact) return exact;

  const ext = extension(path);
  if (ext === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';

  return BY_EXTENSION[ext] ?? 'plaintext';
}

/** True for the extensions a diff viewer can only show as an image. */
export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extension(path));
}
