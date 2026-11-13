// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { SettingsDialogService } from '../settings/settings-dialog.service';
import { DialogHost } from './dialog-host';
import { DialogsService } from './dialogs.service';

/**
 * The deferred dialogs load their code on first open. `@defer (when …)` fires
 * once, so the second close is what proves the inner `@if` still unmounts them;
 * focus has to come back to the invoker each time.
 */
describe('DialogHost', () => {
  let fixture: ComponentFixture<DialogHost>;
  let host: HTMLElement;
  let invoker: HTMLButtonElement;

  /** Lets the lazy chunk resolve and the deferred view render. */
  async function until(found: () => boolean): Promise<void> {
    for (let i = 0; i < 50 && !found(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await fixture.whenStable();
    }
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTestIcons(),
        { provide: TauriGitService, useValue: createTauriGitStub().service },
      ],
    });
    invoker = document.createElement('button');
    document.body.append(invoker);
    fixture = TestBed.createComponent(DialogHost);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    invoker.remove();
  });

  const dialogs = (): DialogsService => TestBed.inject(DialogsService);
  const settings = (): SettingsDialogService => TestBed.inject(SettingsDialogService);

  const cases: ReadonlyArray<{
    readonly name: string;
    readonly selector: string;
    readonly open: () => void;
    readonly close: () => void;
  }> = [
    {
      name: 'about',
      selector: 'app-about-dialog',
      open: () => dialogs().openAbout(),
      close: () => dialogs().closeAbout(),
    },
    {
      name: 'clone',
      selector: 'app-clone-repo-dialog',
      open: () => dialogs().openClone(),
      close: () => dialogs().closeClone(),
    },
    {
      name: 'settings',
      selector: 'app-settings-dialog',
      open: () => settings().open(),
      close: () => settings().close(),
    },
  ];

  for (const dialog of cases) {
    it(`${dialog.name}: mounts on open, unmounts on close, twice, and gives focus back`, async () => {
      const mounted = (): boolean => host.querySelector(dialog.selector) !== null;
      expect(mounted()).toBe(false);

      for (let round = 0; round < 2; round++) {
        invoker.focus();
        dialog.open();
        await until(mounted);
        expect(mounted()).toBe(true);
        // jsdom has no layout, so the CDK trap finds nothing focusable to move
        // into: stand in for the user tabbing inside the dialog.
        host.querySelector<HTMLElement>(`${dialog.selector} button`)?.focus();
        expect(document.activeElement).not.toBe(invoker);

        dialog.close();
        await fixture.whenStable();
        expect(mounted()).toBe(false);
        expect(document.activeElement).toBe(invoker);
      }
    });
  }

  it('mounts the command palette once idle, before anyone opens it', async () => {
    const mounted = (): boolean => host.querySelector('app-command-palette') !== null;
    await until(mounted);
    expect(mounted()).toBe(true);
  });
});
