import { describe, expect, it } from 'vitest';
import { chromeLayout } from './chrome-layout';

describe('chromeLayout', () => {
  it('lets the toolbar say the branch and hold Settings while it is on screen', () => {
    expect(chromeLayout({ toolbarVisible: true })).toEqual({
      branch: 'toolbar',
      settings: 'toolbar',
    });
  });

  // Hiding the toolbar — or zen, which hides it too — must not take the branch
  // or the way into Settings off the window.
  it('hands both down when the toolbar is hidden, so neither leaves the window', () => {
    expect(chromeLayout({ toolbarVisible: false })).toEqual({
      branch: 'status-bar',
      settings: 'rail',
    });
  });
});
