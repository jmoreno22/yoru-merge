/**
 * Client-side validation for a branch or tag name.
 *
 * git itself is the authority (`check-ref-format`), but the dialog has to say
 * no before the round-trip: a rejected name comes back as an opaque `fatal:`
 * line that means nothing to someone naming a branch.
 *
 * Returns the message to show, or `null` when the name is acceptable.
 */
export function validateRefName(
  value: string,
  taken: readonly string[] = [],
): string | null {
  const name = value.trim();
  if (name.length === 0) return null; // Empty is "not ready", not "wrong".
  if (/\s/.test(name)) return 'A ref name cannot contain spaces.';
  if (/[~^:?*[\\]/.test(name)) {
    return 'A ref name cannot contain ~ ^ : ? * [ or a backslash.';
  }
  if (name.includes('..')) return 'A ref name cannot contain "..".';
  if (name.includes('@{')) return 'A ref name cannot contain "@{".';
  if (name.startsWith('-')) return 'A ref name cannot start with a dash.';
  if (name.startsWith('/') || name.endsWith('/')) {
    return 'A ref name cannot start or end with a slash.';
  }
  if (name.includes('//')) return 'A ref name cannot contain an empty segment.';
  if (name.endsWith('.') || name.endsWith('.lock')) {
    return 'A ref name cannot end with "." or ".lock".';
  }
  if (name.split('/').some((segment) => segment.startsWith('.'))) {
    return 'No part of a ref name may start with a dot.';
  }
  if (taken.includes(name)) return `${name} already exists.`;
  return null;
}

/** True when the name is complete enough to submit. */
export function isRefNameSubmittable(
  value: string,
  taken: readonly string[] = [],
): boolean {
  return value.trim().length > 0 && validateRefName(value, taken) === null;
}
