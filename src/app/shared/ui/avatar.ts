/**
 * Deterministic author avatars: the same email always produces the same
 * initials and the same gradient, in every panel and across sessions.
 */

/** Gradient pairs drawn from the Yoru Night accent palette (DESIGN.md). */
const GRADIENTS: readonly (readonly [string, string])[] = [
  ['#00E5FF', '#3B82FF'],
  ['#9B5CFF', '#FF4FB8'],
  ['#35F2A2', '#00E5FF'],
  ['#FF6FBE', '#9B5CFF'],
  ['#FFD166', '#FF6FBE'],
  ['#3B82FF', '#9B5CFF'],
];

/** FNV-1a, 32 bit: small, stable, and good enough to spread names over 6 buckets. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface AvatarGradient {
  readonly from: string;
  readonly to: string;
}

export function avatarGradient(seed: string): AvatarGradient {
  const pair = GRADIENTS[hash(seed.trim().toLowerCase()) % GRADIENTS.length];
  return { from: pair?.[0] ?? '#00E5FF', to: pair?.[1] ?? '#9B5CFF' };
}

/**
 * One or two letters for a display name or an email address.
 * `Jane Doe` becomes `JD`, `jane.doe@x.com` becomes `JD`, `octocat` becomes `OC`.
 */
export function initialsFrom(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '?';

  const at = trimmed.indexOf('@');
  const base = at > 0 ? trimmed.slice(0, at) : trimmed;
  const words = base.split(/[\s._\-+]+/u).filter((w) => w.length > 0);

  if (words.length === 0) return '?';
  if (words.length === 1) {
    return (words[0] ?? '').slice(0, 2).toUpperCase();
  }
  return ((words[0]?.charAt(0) ?? '') + (words[1]?.charAt(0) ?? '')).toUpperCase();
}
