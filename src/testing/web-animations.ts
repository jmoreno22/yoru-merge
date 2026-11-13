export interface AnimateCall {
  readonly target: Element;
  readonly keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  readonly options: number | KeyframeAnimationOptions | undefined;
}

export interface WebAnimationsStub {
  /** Every `animate()` call, in order. */
  readonly calls: readonly AnimateCall[];
  /** Puts back whatever `Element.prototype.animate` was. */
  restore(): void;
}

/**
 * jsdom has no Web Animations API, and the one-shot flourishes — the
 * composer's commit sweep, the titlebar's neon cues — play through
 * `Element.animate`. The stand-in records each call and hands back an
 * animation that never runs, so a spec can assert what was played.
 */
export function installWebAnimations(): WebAnimationsStub {
  const calls: AnimateCall[] = [];
  const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(
      this: Element,
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ): Animation {
      calls.push({ target: this, keyframes, options });
      return { cancel: () => {}, finish: () => {} } as unknown as Animation;
    },
  });

  return {
    calls,
    restore() {
      if (previous) Object.defineProperty(Element.prototype, 'animate', previous);
      else Reflect.deleteProperty(Element.prototype, 'animate');
    },
  };
}
