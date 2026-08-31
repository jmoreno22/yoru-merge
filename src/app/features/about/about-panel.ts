import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { getVersion } from '@tauri-apps/api/app';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { UpdaterService } from '../../core/services/updater.service';
import { ClipboardService, YoruButton } from '../../shared/ui';

/**
 * About content, shared by the standalone About dialog and the About section of
 * Settings so the version rows cannot drift apart.
 */
@Component({
  selector: 'app-about-panel',
  imports: [YoruButton],
  templateUrl: './about-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4', 'data-testid': 'about-panel' },
})
export class AboutPanel implements OnInit {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly clipboard = inject(ClipboardService);
  private readonly updater = inject(UpdaterService);

  protected readonly appVersion = signal('—');
  protected readonly gitVersion = signal('—');
  protected readonly platform = signal(readPlatform());

  /** A check run from here; `idle` alone cannot tell "up to date" from "never
   * checked", and the toast is easy to miss behind the dialog. */
  private readonly checked = signal(false);

  protected readonly checking = computed(() => this.updater.state() === 'checking');

  protected readonly updateStatus = computed(() => {
    const version = this.updater.info()?.version ?? '';
    switch (this.updater.state()) {
      case 'checking':
        return 'Checking for updates…';
      case 'available':
        return `Version ${version} is available.`;
      case 'downloading':
        return 'Downloading the update…';
      case 'ready':
        return `Version ${version} is installed — restart to apply.`;
      case 'error':
        return 'Could not check for updates.';
      default:
        return this.checked() ? 'YoruMerge is up to date.' : '';
    }
  });

  async ngOnInit(): Promise<void> {
    const [app, git] = await Promise.allSettled([
      getVersion(),
      this.currentRepo.gitVersionAction(),
    ]);
    if (app.status === 'fulfilled') this.appVersion.set(app.value);
    if (git.status === 'fulfilled' && git.value.length > 0) {
      this.gitVersion.set(git.value);
    } else {
      this.gitVersion.set('not found on PATH');
    }
  }

  protected async onCheckUpdates(): Promise<void> {
    this.checked.set(false);
    await this.updater.checkForUpdates(true);
    this.checked.set(true);
  }

  /** One paste-ready block for a bug report. */
  protected async copyDiagnostics(): Promise<void> {
    await this.clipboard.writeText(
      [
        `YoruMerge ${this.appVersion()}`,
        `git ${this.gitVersion()}`,
        this.platform(),
      ].join('\n'),
    );
  }
}

/**
 * `@tauri-apps/plugin-os` is not bundled, so the user agent is the only
 * platform signal available in the webview.
 */
function readPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown platform';
  const agent = navigator.userAgent;
  if (agent.includes('Windows')) return 'Windows';
  if (agent.includes('Linux')) return 'Linux';
  if (agent.includes('Mac OS')) return 'macOS';
  return agent;
}
