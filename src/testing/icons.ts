import type { Provider } from '@angular/core';
import { provideYoruIcons } from '../app/shared/icons';

/**
 * The icon set every component rendering an `<ng-icon>` needs.
 *
 * The application registers it once in `app.config.ts`, which no `TestBed`
 * goes through: without it each icon renders empty and the runner logs one
 * «No icon named lucideX was found» per name.
 */
export function provideTestIcons(): Provider[] {
  return provideYoruIcons();
}
