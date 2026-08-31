import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import { CommitPrompt, type PromptResult, type PromptSpec } from './commit-prompt';

/**
 * Asks one multi-field question at a time from a dialog mounted on
 * `document.body`. Plain confirmations and single-value prompts go through
 * `DialogsService` instead — there is only one of each in the app.
 *
 * Mounting imperatively — the same way `ContextMenuService` works — keeps the
 * commit views free of a stack of `<yoru-dialog>` elements whose `open` flags
 * they would have to keep in sync, and means a menu action can await an answer
 * inline instead of splitting into a callback.
 */
@Injectable({ providedIn: 'root' })
export class CommitPromptService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  private ref: ComponentRef<CommitPrompt> | null = null;
  private settle: ((result: PromptResult) => void) | null = null;

  /** Resolves with the field values, or `null` when the user cancelled. */
  ask(spec: PromptSpec): Promise<PromptResult> {
    this.close();

    const ref = createComponent(CommitPrompt, {
      environmentInjector: this.environmentInjector,
    });
    ref.setInput('spec', spec);

    return new Promise<PromptResult>((resolve) => {
      this.ref = ref;
      this.settle = resolve;
      ref.instance.settled.subscribe((result: PromptResult) => this.finish(result));
      this.appRef.attachView(ref.hostView);
      document.body.appendChild(ref.location.nativeElement as HTMLElement);
    });
  }

  close(): void {
    this.finish(null);
  }

  private finish(result: PromptResult): void {
    const ref = this.ref;
    const settle = this.settle;
    this.ref = null;
    this.settle = null;
    if (ref) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    settle?.(result);
  }
}
