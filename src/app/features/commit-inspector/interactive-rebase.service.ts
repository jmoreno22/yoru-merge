import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import { InteractiveRebaseDialog } from './interactive-rebase-dialog';

/**
 * Opens the interactive rebase editor from anywhere.
 *
 * ```ts
 * inject(InteractiveRebaseService).open(commit.sha);
 * ```
 *
 * The dialog is created on `document.body` rather than projected into a host
 * template, so a caller such as the sidebar drop menu does not depend on the
 * commit inspector being mounted at that moment.
 */
@Injectable({ providedIn: 'root' })
export class InteractiveRebaseService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  private ref: ComponentRef<InteractiveRebaseDialog> | null = null;

  /** `fromSha` is included in the plan; the rebase base is its parent. */
  open(fromSha: string): void {
    this.close();

    const ref = createComponent(InteractiveRebaseDialog, {
      environmentInjector: this.environmentInjector,
    });
    ref.setInput('fromSha', fromSha);
    ref.instance.closed.subscribe(() => this.close());

    this.ref = ref;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement as HTMLElement);
  }

  close(): void {
    const ref = this.ref;
    this.ref = null;
    if (!ref) return;
    this.appRef.detachView(ref.hostView);
    ref.destroy();
  }
}
