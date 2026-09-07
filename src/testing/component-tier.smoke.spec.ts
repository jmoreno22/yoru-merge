// @vitest-environment jsdom
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { YoruSectionHeader } from '../app/shared/ui/yoru-section-header';

// Proves the unit runner can compile and render an Angular component (T15):
// a `templateUrl` template, signal inputs and OnPush change detection, none
// of which the pure-TS node tier can execute.
describe('component tier smoke', () => {
  it('renders a templateUrl component label and count in the DOM', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    const fixture = TestBed.createComponent(YoruSectionHeader);
    fixture.componentRef.setInput('label', 'Staged');
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Staged');
    expect(host.textContent).toContain('3');
  });
});
