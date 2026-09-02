import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import type { InteractiveRebaseDialog } from './interactive-rebase-dialog';

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
 *
 * It is also the only thing in the app that pulls in `@angular/cdk/drag-drop`,
 * so the component arrives through a dynamic import: 55 KB nobody pays for
 * until they reorder a todo list. `open()` stays synchronous and returns before
 * the dialog exists, which is why a stale chunk has to be discarded.
 */
@Injectable({ providedIn: 'root' })
export class InteractiveRebaseService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly toast = inject(ToastService);

  private ref: ComponentRef<InteractiveRebaseDialog> | null = null;

  /** Bumped by every open and close, so a chunk that lands late is dropped. */
  private generation = 0;

  /** `fromSha` is included in the plan; the rebase base is its parent. */
  open(fromSha: string): void {
    this.close();
    const generation = this.generation;

    void import('./interactive-rebase-dialog')
      .then(({ InteractiveRebaseDialog }) => {
        if (generation !== this.generation) return;

        const ref = createComponent(InteractiveRebaseDialog, {
          environmentInjector: this.environmentInjector,
        });
        ref.setInput('fromSha', fromSha);
        ref.instance.closed.subscribe(() => this.close());

        this.ref = ref;
        this.appRef.attachView(ref.hostView);
        document.body.appendChild(ref.location.nativeElement as HTMLElement);
      })
      .catch(() => {
        // Nothing awaits `open()`, so a chunk that never arrives would leave
        // the user with a menu entry that silently does nothing.
        if (generation !== this.generation) return;
        this.toast.error('Could not open the interactive rebase editor.');
      });
  }

  close(): void {
    this.generation += 1;
    const ref = this.ref;
    this.ref = null;
    if (!ref) return;
    this.appRef.detachView(ref.hostView);
    ref.destroy();
  }
}
