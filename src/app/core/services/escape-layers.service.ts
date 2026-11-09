import {
  DestroyRef,
  DOCUMENT,
  effect,
  Injectable,
  inject,
  type Signal,
} from '@angular/core';
import {
  createEscapeLayerRegistry,
  type EscapeLayerRegistry,
  type EscapeRankValue,
  type FocusedEditable,
  registerEscapeLayer,
  resolveEscape,
  unregisterEscapeLayer,
} from './escape-layers';

type EditableField = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/**
 * The one Escape listener in the app (ADR-0002).
 *
 * ```ts
 * escapeLayers.bind(EscapeRank.dialog, this.open, () => this.closed.emit());
 * ```
 *
 * Nothing else listens for Escape: a consumer registers a dismissal at its
 * rank and `escape-layers.ts` decides which layer the key belongs to, so a
 * component mounted later can never steal Escape from the layer above it.
 * Escape never appears in `KeyboardShortcutsService`, whose entries are
 * user-visible commands.
 */
@Injectable({ providedIn: 'root' })
export class EscapeLayersService {
  private readonly document = inject(DOCUMENT);

  private registry: EscapeLayerRegistry = createEscapeLayerRegistry();

  constructor() {
    this.document.addEventListener('keydown', this.onKeydown);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('keydown', this.onKeydown);
    });
  }

  /** Registers a layer and returns the function that removes it. */
  register(rank: EscapeRankValue, dismiss: () => void): () => void {
    const registered = registerEscapeLayer(this.registry, rank, dismiss);
    this.registry = registered.registry;
    return () => {
      this.registry = unregisterEscapeLayer(this.registry, registered.id);
    };
  }

  /**
   * Keeps a layer registered exactly while `isOpen()` holds, and drops it when
   * the caller is destroyed: a phantom layer would swallow Escape forever.
   * Call it from an injection context.
   */
  bind(rank: EscapeRankValue, isOpen: Signal<boolean>, dismiss: () => void): void {
    effect((onCleanup) => {
      if (!isOpen()) return;
      onCleanup(this.register(rank, dismiss));
    });
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.repeat || event.isComposing) return;
    // The context menu consumes Escape on its own element before the event
    // reaches here; dismissing a layer as well would close two things at once.
    if (event.defaultPrevented) return;

    const field = editableField(this.document.activeElement);
    const editable: FocusedEditable = field
      ? {
          hasContent: fieldValue(field).length > 0,
          clearsOnEscape: field.hasAttribute('data-escape-clears'),
        }
      : null;
    const resolution = resolveEscape(this.registry, editable);
    if (!resolution) return;

    // No dismissal is the built-in text-field rank, reached only by a field
    // carrying `data-escape-clears`: the content clears and the field keeps
    // focus, no layer closes.
    if (resolution.dismiss) {
      resolution.dismiss();
    } else if (field) {
      clearField(field);
    } else {
      return;
    }

    event.preventDefault();
  };
}

function editableField(active: Element | null): EditableField | null {
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return active;
  }
  if (active instanceof HTMLElement && active.isContentEditable) return active;
  return null;
}

function fieldValue(field: EditableField): string {
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
    ? field.value
    : (field.textContent ?? '');
}

function clearField(field: EditableField): void {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = '';
  } else {
    field.textContent = '';
  }
  // Every field in the app keeps its value in a signal fed by `(input)`; a
  // silent DOM write would leave the two disagreeing.
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
