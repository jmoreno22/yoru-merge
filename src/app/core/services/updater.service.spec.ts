import { DestroyRef, Injector } from '@angular/core';
import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';
import { UpdaterService } from './updater.service';

const tauri = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn() }));

vi.mock('@tauri-apps/plugin-updater', () => ({ check: tauri.check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: tauri.relaunch }));

/**
 * An `Update` whose download the test drives event by event: the fake resolves
 * only when `finish` is called, so the intermediate percentages are readable.
 */
function pendingUpdate(date?: string) {
  const control = {
    emit: (_event: DownloadEvent) => {},
    finish: () => {},
    fail: (_error: unknown) => {},
  };
  const update = {
    version: '1.1.0',
    currentVersion: '1.0.0',
    body: '  Fixes the graph.  ',
    date,
    close: () => Promise.resolve(),
    downloadAndInstall: (onEvent: (event: DownloadEvent) => void) =>
      new Promise<void>((resolve, reject) => {
        control.emit = onEvent;
        control.finish = resolve;
        control.fail = reject;
      }),
  };
  return { update, control };
}

function createUpdater(): { updater: UpdaterService; toasts: ToastService } {
  const toasts = new ToastService();
  const injector = Injector.create({
    providers: [
      { provide: ToastService, useValue: toasts },
      { provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
      { provide: UpdaterService, useClass: UpdaterService, deps: [] },
    ],
  });
  return { updater: injector.get(UpdaterService), toasts };
}

describe('UpdaterService', () => {
  beforeEach(() => {
    // The constructor arms the boot check and the six-hour timer.
    vi.useFakeTimers();
    tauri.check.mockReset();
    tauri.relaunch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the release a check found, keeping the day of its date', async () => {
    tauri.check.mockResolvedValue(
      pendingUpdate('2026-08-30 10:00:00.000 +00:00:00').update,
    );
    const { updater } = createUpdater();

    await updater.checkForUpdates(false);

    expect(updater.state()).toBe('available');
    expect(updater.info()).toEqual({
      version: '1.1.0',
      currentVersion: '1.0.0',
      notes: 'Fixes the graph.',
      date: '2026-08-30',
    });
  });

  it('has no date to show when the release carries none', async () => {
    tauri.check.mockResolvedValue(pendingUpdate().update);
    const { updater } = createUpdater();

    await updater.checkForUpdates(false);

    expect(updater.info()?.date).toBeNull();
  });

  it('says nothing about being up to date unless the check was asked for', async () => {
    tauri.check.mockResolvedValue(null);
    const { updater, toasts } = createUpdater();

    await updater.checkForUpdates(false);
    expect(updater.state()).toBe('idle');
    expect(toasts.toasts()).toHaveLength(0);

    await updater.checkForUpdates(true);
    expect(updater.state()).toBe('idle');
    expect(toasts.toasts()[0]?.message).toContain('latest version');
  });

  it('swallows a failed background check', async () => {
    tauri.check.mockRejectedValue(new Error('no updater endpoint'));
    const { updater, toasts } = createUpdater();

    await updater.checkForUpdates(false);

    expect(updater.state()).toBe('idle');
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('reports a failed check the user started', async () => {
    tauri.check.mockRejectedValue(new Error('no updater endpoint'));
    const { updater, toasts } = createUpdater();

    await updater.checkForUpdates(true);

    expect(updater.state()).toBe('error');
    expect(toasts.toasts()[0]?.level).toBe('error');
    expect(toasts.toasts()[0]?.message).toContain('no updater endpoint');
  });

  it('keeps offering a known release when a later check fails', async () => {
    tauri.check.mockResolvedValue(pendingUpdate().update);
    const { updater } = createUpdater();
    await updater.checkForUpdates(false);

    tauri.check.mockRejectedValue(new Error('offline'));
    await updater.checkForUpdates(true);

    expect(updater.state()).toBe('available');
    expect(updater.info()?.version).toBe('1.1.0');
  });

  it('turns the download events into a percentage of the release size', async () => {
    const { update, control } = pendingUpdate();
    tauri.check.mockResolvedValue(update);
    const { updater } = createUpdater();
    await updater.checkForUpdates(false);

    const running = updater.downloadAndInstall();
    expect(updater.state()).toBe('downloading');

    control.emit({ event: 'Started', data: { contentLength: 200 } });
    expect(updater.progress()).toBe(0);

    control.emit({ event: 'Progress', data: { chunkLength: 50 } });
    expect(updater.progress()).toBe(25);

    control.emit({ event: 'Progress', data: { chunkLength: 150 } });
    expect(updater.progress()).toBe(100);

    control.emit({ event: 'Finished' });
    control.finish();
    await running;

    expect(updater.state()).toBe('ready');
    expect(updater.progress()).toBe(100);
  });

  it('stays indeterminate while the release size is unknown', async () => {
    const { update, control } = pendingUpdate();
    tauri.check.mockResolvedValue(update);
    const { updater } = createUpdater();
    await updater.checkForUpdates(false);

    const running = updater.downloadAndInstall();
    control.emit({ event: 'Started', data: {} });
    expect(updater.progress()).toBeNull();

    control.emit({ event: 'Progress', data: { chunkLength: 50 } });
    expect(updater.progress()).toBeNull();

    control.emit({ event: 'Finished' });
    control.finish();
    await running;

    expect(updater.state()).toBe('ready');
    expect(updater.progress()).toBeNull();
  });

  it('offers the download again after it fails', async () => {
    const { update, control } = pendingUpdate();
    tauri.check.mockResolvedValue(update);
    const { updater, toasts } = createUpdater();
    await updater.checkForUpdates(false);

    const running = updater.downloadAndInstall();
    control.fail(new Error('connection reset'));
    await running;

    expect(updater.state()).toBe('available');
    expect(updater.progress()).toBeNull();
    expect(toasts.toasts()[0]?.message).toContain('connection reset');
  });

  it('relaunches only once the update is installed', async () => {
    const { update, control } = pendingUpdate();
    tauri.check.mockResolvedValue(update);
    const { updater } = createUpdater();
    await updater.checkForUpdates(false);

    await updater.restart();
    expect(tauri.relaunch).not.toHaveBeenCalled();

    const running = updater.downloadAndInstall();
    control.emit({ event: 'Finished' });
    control.finish();
    await running;

    await updater.restart();
    expect(tauri.relaunch).toHaveBeenCalledOnce();
  });
});
