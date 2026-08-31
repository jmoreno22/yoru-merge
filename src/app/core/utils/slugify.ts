/** Combining marks left behind by NFD normalisation. */
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Turns free text into a git-safe branch segment.
 *
 * Strips diacritics, lowercases, and collapses anything git refuses in a ref
 * name (spaces, `~^:?*[\`, `..`, `@{`) into single dashes. Slashes survive so
 * callers can pass `feat/some idea`.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/-{2,}/g, '-')
    .replace(/-?\/-?/g, '/')
    .replace(/^[-/]+/, '')
    .replace(/[-/]+$/, '');
}

/** `feat`, `add drag & drop` → `feat/add-drag-drop`, ready for a branch name. */
export function branchNameFrom(type: string, description: string): string {
  const prefix = slugify(type);
  const rest = slugify(description);
  if (prefix.length === 0) return rest;
  if (rest.length === 0) return prefix;
  return `${prefix}/${rest}`;
}
