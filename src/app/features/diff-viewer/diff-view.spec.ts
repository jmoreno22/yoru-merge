// @vitest-environment jsdom
import { type ComponentRef, provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { TauriGitService } from '../../core/services/tauri-git.service';
import type { DiffHunkAction, DiffLineAction } from './diff-actions';
import { DiffView, RenderedCell } from './diff-view';
import { loadHighlightGrammars } from './highlighter';

/** Two hunks: three changed lines in the first, two in the second. */
const TWO_HUNKS = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,3 @@',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  '+const c = 4;',
  '@@ -20,2 +21,2 @@',
  ' const d = 1;',
  '-const e = 2;',
  '+const e = 3;',
  '',
].join('\n');

/** A small file, then one long enough that the chunked insert needs two frames. */
function twoFiles(longLines: number): string {
  const body = Array.from({ length: longLines }, (_, i) => `+line ${i};`);
  return [
    'diff --git a/small.ts b/small.ts',
    '--- a/small.ts',
    '+++ b/small.ts',
    '@@ -1,1 +1,2 @@',
    ' keep;',
    '+added;',
    'diff --git a/long.ts b/long.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/long.ts',
    `@@ -0,0 +1,${longLines} @@`,
    ...body,
    '',
  ].join('\n');
}

let frames: FrameRequestCallback[] = [];

/** Runs the animation frames queued so far; ones they queue wait for the next call. */
function flushFrame(): void {
  const queued = frames;
  frames = [];
  for (const frame of queued) frame(0);
}

/**
 * Ids of the cells whose row a refresh re-checked.
 *
 * Every refresh of a row evaluates its `[innerHTML]="cell.html"` binding, so
 * the getter is the probe for which hunks a change detection pass walked.
 */
let checked: string[] = [];
const htmlGetter = Object.getOwnPropertyDescriptor(RenderedCell.prototype, 'html')
  ?.get as (this: RenderedCell) => string;

describe('DiffView', () => {
  let fixture: ComponentFixture<DiffView>;
  let ref: ComponentRef<DiffView>;
  let host: HTMLElement;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushFrame();
    await fixture.whenStable();
  }

  async function render(text: string, staged = false): Promise<void> {
    ref.setInput('stageTarget', { file: 'src/a.ts', staged });
    ref.setInput('text', text);
    await settle();
    await settle();
  }

  const bodies = (): HTMLElement[] => [
    ...host.querySelectorAll<HTMLElement>('.dv-hunk-body'),
  ];
  const options = (hunk: number): HTMLElement[] => [
    ...(bodies()[hunk]?.querySelectorAll<HTMLElement>('.dv-row[role="option"]') ?? []),
  ];
  const selected = (): number => host.querySelectorAll('.dv-row.dv-sel').length;

  beforeEach(async () => {
    // Loaded up front: grammars landing mid-test rebuild every cell.
    await loadHighlightGrammars();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
      frames.push(frame);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    Element.prototype.scrollIntoView = () => {};
    checked = [];
    Object.defineProperty(RenderedCell.prototype, 'html', {
      configurable: true,
      get(this: RenderedCell) {
        checked.push(this.id);
        return htmlGetter.call(this);
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTestIcons(),
        { provide: TauriGitService, useValue: createTauriGitStub().service },
      ],
    });
    fixture = TestBed.createComponent(DiffView);
    ref = fixture.componentRef;
    host = fixture.nativeElement;
  });

  afterEach(() => {
    Object.defineProperty(RenderedCell.prototype, 'html', {
      configurable: true,
      get: htmlGetter,
    });
    vi.unstubAllGlobals();
  });

  it('a click selects a line and Shift-click extends it within the hunk', async () => {
    await render(TWO_HUNKS);

    options(0)[0]?.click();
    await fixture.whenStable();
    expect(selected()).toBe(1);

    options(0)[2]?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: true }),
    );
    await fixture.whenStable();
    expect(selected()).toBe(3);
    expect(host.querySelector('.dv-selection-bar')?.textContent).toContain(
      '3 lines selected',
    );
  });

  it('a line click re-checks only the rows of the hunk it lands in', async () => {
    await render(TWO_HUNKS);
    checked = [];

    options(1)[0]?.click();
    await fixture.whenStable();

    expect(selected()).toBe(1);
    expect(checked.length).toBeGreaterThan(0);
    expect(checked.every((id) => id.startsWith('l-0-1-'))).toBe(true);
  });

  it('a busy flip disables the hunk actions without re-checking any row', async () => {
    await render(TWO_HUNKS);
    checked = [];

    ref.setInput('busy', true);
    await fixture.whenStable();

    const stage = [...host.querySelectorAll<HTMLButtonElement>('.dv-hunk-head button')]
      .filter((button) => button.textContent?.trim() === 'Stage hunk')
      .map((button) => button.disabled);
    expect(stage).toEqual([true, true]);
    expect(checked).toEqual([]);
  });

  it('each chunk-growth frame leaves the files already inserted alone', async () => {
    ref.setInput('text', twoFiles(350));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();

    // The first chunk holds the small file whole and the long one clipped.
    expect(host.querySelectorAll('.dv-row').length).toBe(298);
    checked = [];

    flushFrame();
    await fixture.whenStable();

    expect(host.querySelectorAll('.dv-row').length).toBe(352);
    expect(checked.some((id) => id.startsWith('l-1-'))).toBe(true);
    expect(checked.some((id) => id.startsWith('l-0-'))).toBe(false);
  });

  it('the arrow keys walk the changed lines, Shift extends and Ctrl+A takes the hunk', async () => {
    await render(TWO_HUNKS);
    const body = bodies()[0] as HTMLElement;
    const key = (init: KeyboardEventInit): void => {
      body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    };

    key({ key: 'ArrowDown' });
    await fixture.whenStable();
    expect(selected()).toBe(1);
    expect(options(0)[1]?.getAttribute('tabindex')).toBe('0');

    key({ key: 'ArrowDown', shiftKey: true });
    await fixture.whenStable();
    expect(selected()).toBe(2);

    key({ key: 'a', ctrlKey: true });
    await fixture.whenStable();
    expect(selected()).toBe(3);
    expect(options(1).some((row) => row.classList.contains('dv-sel'))).toBe(false);
  });

  it('stages the selected lines and a whole hunk with the hunk it belongs to', async () => {
    await render(TWO_HUNKS);
    const lines: DiffLineAction[] = [];
    const hunks: DiffHunkAction[] = [];
    fixture.componentInstance.lineAction.subscribe((action) => lines.push(action));
    fixture.componentInstance.hunkAction.subscribe((action) => hunks.push(action));

    options(0)[1]?.click();
    await fixture.whenStable();
    [...host.querySelectorAll<HTMLButtonElement>('.dv-selection-bar button')]
      .find((button) => button.textContent?.trim() === 'Stage lines')
      ?.click();
    await fixture.whenStable();

    expect(
      lines.map(({ kind, hunkIndex, lines }) => ({ kind, hunkIndex, lines })),
    ).toEqual([{ kind: 'stage', hunkIndex: 0, lines: [2] }]);
    expect(selected()).toBe(0);

    const stageHunk = [
      ...host.querySelectorAll<HTMLButtonElement>('.dv-hunk-head button'),
    ].filter((button) => button.textContent?.trim() === 'Stage hunk');
    stageHunk[1]?.click();
    expect(hunks.map(({ kind, hunkIndex }) => ({ kind, hunkIndex }))).toEqual([
      { kind: 'stage', hunkIndex: 1 },
    ]);
  });

  it('next / previous hunk move focus between hunk heads', async () => {
    await render(TWO_HUNKS);
    const view = fixture.componentInstance;
    const heads = [...host.querySelectorAll<HTMLElement>('.dv-hunk-head')];

    view.goToNextHunk();
    view.goToNextHunk();
    expect(view.hunkPosition()).toBe(2);
    expect(document.activeElement).toBe(heads[1]);

    view.goToPreviousHunk();
    expect(view.hunkPosition()).toBe(1);
    expect(document.activeElement).toBe(heads[0]);
  });
});
