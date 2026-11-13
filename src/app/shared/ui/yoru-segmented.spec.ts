// @vitest-environment jsdom
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { type SegmentedOption, YoruSegmented } from './yoru-segmented';

const OPTIONS: readonly SegmentedOption[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

@Component({
  imports: [YoruSegmented],
  template: `<yoru-segmented [options]="options" [(value)]="value" ariaLabel="Mode" />`,
})
class Host {
  readonly options = OPTIONS;
  readonly value = signal('b');
}

describe('YoruSegmented keyboard', () => {
  let host: Host;
  let group: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    host = fixture.componentInstance;
    group = fixture.nativeElement.querySelector('[role="radiogroup"]');
  });

  function press(key: string): void {
    group.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    TestBed.tick();
  }

  it('selects and focuses the first option on Home and the last on End', () => {
    press('End');
    expect(host.value()).toBe('c');
    expect(document.activeElement?.textContent?.trim()).toBe('C');

    press('Home');
    expect(host.value()).toBe('a');
    expect(document.activeElement?.textContent?.trim()).toBe('A');
  });

  it('still wraps with the arrows', () => {
    press('ArrowRight');
    press('ArrowRight');
    expect(host.value()).toBe('a');
    press('ArrowUp');
    expect(host.value()).toBe('c');
  });
});
