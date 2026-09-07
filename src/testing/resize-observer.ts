interface Size {
  width: number;
  height: number;
}

export interface ResizeObserverStub {
  /** Delivers one entry to every observer watching `target`. */
  resize(target: Element, size: Size): void;
  /** Puts back whatever `globalThis.ResizeObserver` was. */
  restore(): void;
}

/**
 * jsdom has no `ResizeObserver`, and the components that measure their own box
 * create one from a render effect. Install the stand-in before the first
 * render and drive it from the spec: like the real thing, it fires nothing on
 * its own, not even on `observe()`.
 */
export function installResizeObserver(): ResizeObserverStub {
  const live = new Set<StubObserver>();
  const previous = globalThis.ResizeObserver;

  class StubObserver implements ResizeObserver {
    readonly targets = new Set<Element>();

    constructor(readonly callback: ResizeObserverCallback) {
      live.add(this);
    }

    observe(target: Element): void {
      this.targets.add(target);
    }

    unobserve(target: Element): void {
      this.targets.delete(target);
    }

    disconnect(): void {
      this.targets.clear();
      live.delete(this);
    }
  }

  globalThis.ResizeObserver = StubObserver;

  return {
    resize(target, size) {
      for (const observer of live) {
        if (observer.targets.has(target)) {
          observer.callback([entryFor(target, size)], observer);
        }
      }
    },
    restore() {
      live.clear();
      globalThis.ResizeObserver = previous;
    },
  };
}

function entryFor(target: Element, size: Size): ResizeObserverEntry {
  const box: readonly ResizeObserverSize[] = [
    { inlineSize: size.width, blockSize: size.height },
  ];

  return {
    target,
    contentRect: {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      width: size.width,
      height: size.height,
      toJSON: () => ({}),
    },
    borderBoxSize: box,
    contentBoxSize: box,
    devicePixelContentBoxSize: box,
  };
}
