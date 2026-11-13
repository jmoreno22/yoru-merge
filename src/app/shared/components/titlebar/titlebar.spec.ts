// @vitest-environment jsdom
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgIcon } from '@ng-icons/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../../testing/icons';
import { NeonSignService } from '../../../core/services/neon-sign.service';
import { YoruTooltip } from '../../ui';
import { Titlebar } from './titlebar';

const tauriWindow = vi.hoisted(() => ({
  onFocus: (_event: { payload: boolean }) => {},
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isMaximized: () => Promise.resolve(false),
    onResized: () => Promise.resolve(() => {}),
    onFocusChanged: (handler: (event: { payload: boolean }) => void) => {
      tauriWindow.onFocus = handler;
      return Promise.resolve(() => {});
    },
  }),
}));

describe('Titlebar wordmark', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTestIcons()],
    });
    // The tabs strip pulls in the whole repository state; it is not under test.
    TestBed.overrideComponent(Titlebar, {
      set: { imports: [NgIcon, YoruTooltip], schemas: [NO_ERRORS_SCHEMA] },
    });
    // jsdom has no Web Animations; the spy stands in and records each call.
    animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
  });

  afterEach(() => {
    delete document.documentElement.dataset['animations'];
  });

  let animate: ReturnType<typeof vi.fn>;

  async function render() {
    const fixture = TestBed.createComponent(Titlebar);
    await fixture.whenStable();
    return {
      fixture,
      wordmark: fixture.nativeElement.querySelector(
        '[data-testid="titlebar-wordmark"]',
      ) as HTMLElement,
    };
  }

  it('still reads YoruMerge, one letter per tube, each with its index', async () => {
    const { wordmark } = await render();
    const letters = [...wordmark.querySelectorAll<HTMLElement>('.yoru-neon-letter')];

    expect(wordmark.textContent?.trim()).toBe('YoruMerge');
    expect(letters.map((letter) => letter.style.getPropertyValue('--i'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
  });

  it('rests while the window is not focused and moves again when it is', async () => {
    const { fixture, wordmark } = await render();
    expect(wordmark.classList.contains('is-resting')).toBe(false);

    tauriWindow.onFocus({ payload: false });
    await fixture.whenStable();
    expect(wordmark.classList.contains('is-resting')).toBe(true);

    tauriWindow.onFocus({ payload: true });
    await fixture.whenStable();
    expect(wordmark.classList.contains('is-resting')).toBe(false);
  });

  it('runs current through the sign, letter by letter, when a remote operation lands', async () => {
    const { fixture } = await render();
    TestBed.inject(NeonSignService).surge();
    await fixture.whenStable();

    // Nine letters and the plate behind them.
    expect(animate).toHaveBeenCalledTimes(10);
    const delays = animate.mock.calls
      .slice(0, 9)
      .map(([, options]) => (options as KeyframeAnimationOptions).delay);
    expect(delays).toEqual([0, 45, 90, 135, 180, 225, 270, 315, 360]);
  });

  it('browns out the whole sign at once when one fails', async () => {
    const { fixture } = await render();
    TestBed.inject(NeonSignService).falter();
    await fixture.whenStable();

    expect(animate).toHaveBeenCalledTimes(10);
    expect(
      animate.mock.calls.every(
        ([, options]) => !(options as KeyframeAnimationOptions).delay,
      ),
    ).toBe(true);
  });

  it('holds still when the animations preference is off', async () => {
    document.documentElement.dataset['animations'] = 'off';
    const { fixture } = await render();
    TestBed.inject(NeonSignService).surge();
    await fixture.whenStable();

    expect(animate).not.toHaveBeenCalled();
  });
});
