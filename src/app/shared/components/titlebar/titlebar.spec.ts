// @vitest-environment jsdom
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgIcon } from '@ng-icons/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../../testing/icons';
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
  });

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
});
