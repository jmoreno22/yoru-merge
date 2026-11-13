import { describe, expect, it } from 'vitest';
import { OWN_WRITE_WINDOW_MS, watcherHoldMs } from './watcher-timing';

describe('watcherHoldMs', () => {
  const now = 50_000;

  it('lets a refresh run once the window after the last one has passed', () => {
    expect(watcherHoldMs(now, now - OWN_WRITE_WINDOW_MS, false)).toBe(0);
    expect(watcherHoldMs(now, 0, false)).toBe(0);
  });

  it('holds an event inside the window until the window ends', () => {
    expect(watcherHoldMs(now, now - 300, false)).toBe(OWN_WRITE_WINDOW_MS - 300);
    expect(watcherHoldMs(now, now, false)).toBe(OWN_WRITE_WINDOW_MS);
  });

  it('holds an event for a whole window while an operation runs', () => {
    expect(watcherHoldMs(now, 0, true)).toBe(OWN_WRITE_WINDOW_MS);
    expect(watcherHoldMs(now, now - 300, true)).toBe(OWN_WRITE_WINDOW_MS);
  });
});
