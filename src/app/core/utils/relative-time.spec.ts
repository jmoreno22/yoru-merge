import { describe, expect, it } from 'vitest';
import { absoluteTime, relativeTime, toEpochMs } from './relative-time';

const NOW = Date.parse('2026-08-29T12:00:00Z');

describe('toEpochMs', () => {
  it('parses ISO 8601 strings', () => {
    expect(toEpochMs('2026-08-29T12:00:00Z')).toBe(NOW);
  });

  it('treats small numbers as Unix seconds', () => {
    expect(toEpochMs(NOW / 1000)).toBe(NOW);
  });

  it('treats large numbers as milliseconds', () => {
    expect(toEpochMs(NOW)).toBe(NOW);
  });

  it('parses numeric strings as Unix seconds', () => {
    expect(toEpochMs(String(NOW / 1000))).toBe(NOW);
  });

  it('returns null for unparseable input', () => {
    expect(toEpochMs('not a date')).toBeNull();
    expect(toEpochMs('')).toBeNull();
    expect(toEpochMs(Number.NaN)).toBeNull();
  });
});

describe('relativeTime', () => {
  it('collapses the last minute into "just now"', () => {
    expect(relativeTime(NOW - 5_000, NOW)).toBe('just now');
  });

  it('reads future timestamps as "just now" instead of negatives', () => {
    expect(relativeTime(NOW + 30_000, NOW)).toBe('just now');
  });

  it('singularises the first unit', () => {
    expect(relativeTime(NOW - 60_000, NOW)).toBe('1 minute ago');
  });

  it('scales through the units', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2 days ago');
    expect(relativeTime(NOW - 14 * 86_400_000, NOW)).toBe('2 weeks ago');
    expect(relativeTime(NOW - 60 * 86_400_000, NOW)).toBe('2 months ago');
    expect(relativeTime(NOW - 800 * 86_400_000, NOW)).toBe('2 years ago');
  });

  it('returns an empty string for unparseable input', () => {
    expect(relativeTime('nope', NOW)).toBe('');
  });
});

describe('absoluteTime', () => {
  it('formats as a sortable local timestamp', () => {
    expect(absoluteTime(new Date(2026, 7, 29, 14, 3))).toBe('2026-08-29 14:03');
  });

  it('returns an empty string for unparseable input', () => {
    expect(absoluteTime('nope')).toBe('');
  });
});
