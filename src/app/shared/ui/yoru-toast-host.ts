import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideInfo,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import {
  type Toast,
  type ToastLevel,
  ToastService,
} from '../../core/services/toast.service';
import type { YoruIconName } from '../icons';

const ICONS: Readonly<Record<ToastLevel, YoruIconName>> = {
  success: 'lucideCircleCheck',
  info: 'lucideInfo',
  warning: 'lucideTriangleAlert',
  error: 'lucideCircleX',
};

const TONES: Readonly<Record<ToastLevel, string>> = {
  success: 'text-git-added',
  info: 'text-accent-ink',
  warning: 'text-git-modified',
  error: 'text-git-deleted',
};

/**
 * Renders `ToastService.toasts()` bottom-right. Mount once, in the app shell.
 */
@Component({
  selector: 'yoru-toast-host',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideCircleCheck,
      lucideInfo,
      lucideTriangleAlert,
      lucideCircleX,
      lucideX,
    }),
  ],
  templateUrl: './yoru-toast-host.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2',
  },
})
export class YoruToastHost {
  private readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;

  protected iconFor(level: ToastLevel): YoruIconName {
    return ICONS[level];
  }

  protected toneFor(level: ToastLevel): string {
    return TONES[level];
  }

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }

  /** Running the action closes the toast — it has served its purpose. */
  protected runAction(toast: Toast): void {
    this.service.dismiss(toast.id);
    void toast.action?.run();
  }
}
