import { Injectable, signal } from '@angular/core';

export type SettingsSection =
  | 'general'
  | 'git'
  | 'appearance'
  | 'integrations'
  | 'ai'
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
  { id: 'ai', label: 'AI' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'about', label: 'About' },
];

/**
 * Open state for the settings dialog, so the toolbar, the icon rail and the
 * command palette can all raise it (optionally on a given section) without
 * owning the component.
 */
@Injectable({ providedIn: 'root' })
export class SettingsDialogService {
  private readonly _open = signal(false);
  private readonly _section = signal<SettingsSection>('general');

  readonly isOpen = this._open.asReadonly();
  readonly section = this._section.asReadonly();

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
