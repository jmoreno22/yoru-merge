// @vitest-environment jsdom
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestIcons } from '../../../testing/icons';
import { TEST_REPO } from '../../../testing/repo-fixtures';
import { createTauriGitStub } from '../../../testing/tauri-git-stub';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { TauriGitService } from '../../core/services/tauri-git.service';
import { ImageDiff } from './image-diff';
import type { ImageSides } from './image-preview';

/** jsdom has no IntersectionObserver; every observed element is on screen. */
class VisibleObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(): void {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }
  disconnect(): void {}
}

const ONLY_AFTER = (rev: string): ImageSides => ({
  before: null,
  after: { kind: 'rev', rev },
});

@Component({
  imports: [ImageDiff],
  template: `<app-image-diff file="logo.png" oldFile="logo.png" [sides]="sides()" />`,
})
class Host {
  readonly sides = signal<ImageSides>(ONLY_AFTER('first'));
}

interface Pending {
  resolve(value: string): void;
  reject(reason: unknown): void;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.tick();
}

describe('ImageDiff loading', () => {
  let fixture: ComponentFixture<Host>;
  let pending: Pending[];
  const previousObserver = globalThis.IntersectionObserver;

  afterEach(() => {
    globalThis.IntersectionObserver = previousObserver;
  });

  beforeEach(async () => {
    globalThis.IntersectionObserver =
      VisibleObserver as unknown as typeof IntersectionObserver;
    pending = [];
    const stub = createTauriGitStub();
    Object.defineProperty(stub.responses, 'get_file_base64', {
      enumerable: true,
      get: () =>
        new Promise<string>((resolve, reject) => pending.push({ resolve, reject })),
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTestIcons(),
        { provide: TauriGitService, useValue: stub.service },
      ],
    });
    TestBed.inject(CurrentRepoService).repo.set(TEST_REPO);
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await settle();
  });

  function image(): string | null {
    return fixture.nativeElement.querySelector('img')?.getAttribute('src') ?? null;
  }

  it('keeps the newer image when an older load answers last', async () => {
    fixture.componentInstance.sides.set(ONLY_AFTER('second'));
    await settle();
    expect(pending).toHaveLength(2);

    pending[1]?.resolve('U0VDT05E');
    await settle();
    pending[0]?.resolve('RklSU1Q=');
    await settle();

    expect(image()).toBe('data:image/png;base64,U0VDT05E');
  });

  it('shows the backend message when the read rejects with a string', async () => {
    pending[0]?.reject('fatal: path not in tree');
    await settle();

    const error = fixture.nativeElement.querySelector(
      '[data-testid="image-diff-error"]',
    );
    expect(error?.textContent).toContain(
      'Image preview failed: fatal: path not in tree',
    );
    expect(error?.textContent).not.toContain('Resource');
  });
});
