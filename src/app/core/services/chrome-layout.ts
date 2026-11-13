/**
 * Which piece of window chrome says what.
 *
 * The toolbar and the status bar both carried the branch, its upstream and the
 * ahead / behind counts, and the toolbar and the rail both a Settings button:
 * the same fact twice in one window. Each now has one owner, and a fallback
 * for when that owner is hidden — the toolbar can be switched off, and zen
 * hides it — so nothing is said twice and nothing drops out of the window.
 */
export interface ChromeState {
  readonly toolbarVisible: boolean;
}

export interface ChromeLayout {
  /** Where the current branch, its upstream and ahead / behind are shown. */
  readonly branch: 'toolbar' | 'status-bar';
  /** Where the Settings button lives. */
  readonly settings: 'toolbar' | 'rail';
}

export function chromeLayout(state: ChromeState): ChromeLayout {
  return state.toolbarVisible
    ? { branch: 'toolbar', settings: 'toolbar' }
    : { branch: 'status-bar', settings: 'rail' };
}
