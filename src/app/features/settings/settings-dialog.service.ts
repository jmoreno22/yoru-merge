import { Injectable, signal } from '@angular/core';
import type { YoruIconName } from '../../shared/icons';

export type SettingsSection =
  | 'general'
  | 'git'
  | 'appearance'
  | 'layout'
  | 'diff'
  | 'integrations'
  | 'ai'
  | 'keyboard'
  | 'about';

export const SETTINGS_SECTIONS: readonly {
  readonly id: SettingsSection;
  readonly label: string;
  readonly icon: YoruIconName;
  readonly description: string;
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'lucideSettings2',
    description: 'Safety checks and background sync.',
  },
  {
    id: 'git',
    label: 'Git',
    icon: 'lucideGitBranch',
    description: 'Identity and defaults, written to git config.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'lucidePalette',
    description: 'Colour, type and motion.',
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: 'lucidePanelsTopLeft',
    description: 'Where panels sit and which chrome is shown.',
  },
  {
    id: 'diff',
    label: 'Diff & code',
    icon: 'lucideFileDiff',
    description: 'How diffs and code render.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: 'lucidePlug',
    description: 'Editor, terminal and hosting provider.',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: 'lucideSparkles',
    description:
      'Commit drafts from a CLI you already use, on your own subscription. YoruMerge talks to no AI service and stores no key.',
  },
  {
    id: 'keyboard',
    label: 'Keyboard',
    icon: 'lucideKeyboard',
    description: 'Every registered shortcut.',
  },
  {
    id: 'about',
    label: 'About',
    icon: 'lucideInfo',
    description: 'Version, platform and updates.',
  },
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
