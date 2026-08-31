const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Accepts what the backend actually sends: an ISO 8601 string (`CommitInfo`)
 * or a Unix timestamp in seconds (`BlameLine.time`).
 */
export type TimeInput = string | number | Date;

/** Milliseconds since the epoch, or `null` when the value is unparseable. */
export function toEpochMs(input: TimeInput): number | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.getTime();
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    // Seconds vs milliseconds: anything below this threshold is seconds.
    return input < 1e11 ? input * SECOND : input;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  // A bare integer string is a Unix timestamp, not a year.
  if (/^\d+$/.test(trimmed)) return toEpochMs(Number(trimmed));
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Compact "3 hours ago" phrasing for commit lists.
 *
 * Future timestamps read as "just now": a clock skew of a few seconds between
 * committer and viewer is common and "in -2 seconds" helps nobody.
 */
export function relativeTime(input: TimeInput, now: number = Date.now()): string {
  const epoch = toEpochMs(input);
  if (epoch === null) return '';
  const delta = now - epoch;
  if (delta < 45 * SECOND) return 'just now';
  if (delta < HOUR) return plural(Math.round(delta / MINUTE), 'minute');
  if (delta < DAY) return plural(Math.round(delta / HOUR), 'hour');
  if (delta < WEEK) return plural(Math.round(delta / DAY), 'day');
  if (delta < MONTH) return plural(Math.round(delta / WEEK), 'week');
  if (delta < YEAR) return plural(Math.round(delta / MONTH), 'month');
  return plural(Math.round(delta / YEAR), 'year');
}

/** `2026-08-29 14:03` — stable, sortable, locale-independent. */
export function absoluteTime(input: TimeInput): string {
  const epoch = toEpochMs(input);
  if (epoch === null) return '';
  const d = new Date(epoch);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plural(value: number, unit: string): string {
  const n = Math.max(1, value);
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}
