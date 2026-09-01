// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runThemeTransition } from './view-transition';

// `lib.dom` now ships `startViewTransition` with a stricter signature, so the
// test double overrides it through Omit instead of extending Document.
type DocumentWithTransition = Omit<Document, 'startViewTransition'> & {
  startViewTransition?: (callback: () => void) => unknown;
};

const doc = document as unknown as DocumentWithTransition;

function setMatchMedia(reduced: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  doc.startViewTransition = undefined;
  document.documentElement.removeAttribute('data-animations');
  vi.restoreAllMocks();
});

describe('runThemeTransition', () => {
  it('routes the change through the API when one is available', () => {
    setMatchMedia(false);
    const start = vi.fn((callback: () => void) => {
      callback();
      return {};
    });
    doc.startViewTransition = start;

    const apply = vi.fn();
    runThemeTransition(apply);

    expect(start).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
  });

  /** WebKitGTK, which is what Tauri ships on Linux, has no such API. */
  it('applies the change directly when the engine has no View Transitions', () => {
    setMatchMedia(false);
    doc.startViewTransition = undefined;

    const apply = vi.fn();
    runThemeTransition(apply);

    expect(apply).toHaveBeenCalledOnce();
  });

  it('skips the transition when animations are switched off', () => {
    setMatchMedia(false);
    const start = vi.fn();
    doc.startViewTransition = start;
    document.documentElement.dataset['animations'] = 'off';

    const apply = vi.fn();
    runThemeTransition(apply);

    expect(start).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it('skips the transition when the OS asks for reduced motion', () => {
    setMatchMedia(true);
    const start = vi.fn();
    doc.startViewTransition = start;
    document.documentElement.dataset['animations'] = 'on';

    const apply = vi.fn();
    runThemeTransition(apply);

    expect(start).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it('applies the change exactly once on every path', () => {
    for (const [hasApi, animations, reduced] of [
      [true, 'on', false],
      [true, 'off', false],
      [true, 'on', true],
      [false, 'on', false],
    ] as const) {
      setMatchMedia(reduced);
      doc.startViewTransition = hasApi
        ? (callback: () => void) => {
            callback();
            return {};
          }
        : undefined;
      document.documentElement.dataset['animations'] = animations;

      const apply = vi.fn();
      runThemeTransition(apply);
      expect(
        apply,
        `api=${hasApi} animations=${animations} reduced=${reduced}`,
      ).toHaveBeenCalledOnce();
    }
  });
});
