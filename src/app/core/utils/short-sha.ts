const DEFAULT_LENGTH = 7;

/**
 * Abbreviates a sha for display.
 *
 * Values that are not full object ids (a ref name, an already-short sha) are
 * returned untouched — truncating `main` to `main` is fine, truncating it to
 * `mai` is not.
 */
export function shortSha(sha: string, length = DEFAULT_LENGTH): string {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) return sha;
  return sha.slice(0, Math.max(1, length));
}

/** True for a full 40- or 64-character object id. */
export function isFullSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value) || /^[0-9a-f]{64}$/i.test(value);
}
