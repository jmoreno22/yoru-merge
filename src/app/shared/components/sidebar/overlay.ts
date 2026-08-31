import {
  type ApplicationRef,
  type ComponentRef,
  createComponent,
  type EnvironmentInjector,
  type Type,
} from '@angular/core';

/**
 * Mounts `component` on the document body and resolves once it settles.
 *
 * Ref dialogs are opened from a context menu, so they cannot live in the row's
 * template: the row is re-rendered — and sometimes gone — by the time the user
 * answers. `ContextMenuService` solves the same problem the same way.
 */
export function openOverlay<C, R>(
  appRef: ApplicationRef,
  environmentInjector: EnvironmentInjector,
  component: Type<C>,
  wire: (ref: ComponentRef<C>, settle: (result: R) => void) => void,
): Promise<R> {
  const ref = createComponent(component, { environmentInjector });
  return new Promise<R>((resolve) => {
    let settled = false;
    wire(ref, (result) => {
      if (settled) return;
      settled = true;
      appRef.detachView(ref.hostView);
      ref.destroy();
      resolve(result);
    });
    appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement as HTMLElement);
  });
}
