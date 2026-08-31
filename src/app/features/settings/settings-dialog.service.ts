import { effect, Injectable, inject, signal } from '@angular/core';
import { PreferencesService } from '../../core/services/preferences.service';

export type SettingsSection =
  | 'general'
  | 'git'
  | 'appearance'
  | 'integrations'
  | 'keyboard'
  | 'about';

export const SETTINGS_SECTIONS: readonly {
  readonly id: SettingsSection;
  readonly label: string;
}[] = [
  { id: 'general', label: 'General' },
  { id: 'git', label: 'Git' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'about', label: 'About' },
];

/**
 * Open state for the settings dialog, so the toolbar, the icon rail and the
 * command palette can all raise it (optionally on a given section) without
 * owning the component.
 *
 * It also carries the UI density to the document root: the density tokens are
 * global, and this is the one service guaranteed to exist for the whole session
 * whether or not the dialog has ever been opened.
 */
@Injectable({ providedIn: 'root' })
export class SettingsDialogService {
  private readonly prefs = inject(PreferencesService);

  private readonly _open = signal(false);
  private readonly _section = signal<SettingsSection>('general');

  readonly isOpen = this._open.asReadonly();
  readonly section = this._section.asReadonly();

  constructor() {
    effect(() => {
      const density = this.prefs.uiDensity();
      if (typeof document === 'undefined') return;
      document.documentElement.dataset['density'] = density;
    });
  }

  open(section: SettingsSection = 'general'): void {
    this._section.set(section);
    this._open.set(true);
  }

  close(): void {
    this._open.set(false);
  }

  select(section: SettingsSection): void {
    this._section.set(section);
  }
}
