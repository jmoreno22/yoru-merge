import { computed, Injectable, inject, signal } from '@angular/core';
import { PreferencesService } from '../../core/services/preferences.service';
import type { DialogTone } from '../../shared/ui';

export interface ConfirmRequest {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: DialogTone;
  /**
   * Ask twice: the confirm button re-labels itself and only the second press
   * commits. For actions that rewrite someone else's history.
   */
  readonly doubleConfirm?: boolean;
  /**
   * Honour the `confirmDangerous` preference. When the user has turned
   * confirmations off, a skippable request resolves `true` without a dialog.
   */
  readonly skippable?: boolean;
}

export interface PromptRequest {
  readonly title: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly initialValue?: string;
  readonly hint?: string;
  readonly confirmLabel?: string;
  /**
   * Live validation of the trimmed value. Return the reason it is invalid —
   * shown under the input, and the confirm button stays disabled — or `null`
   * when it is fine. An empty field is never reported: it is already blocked.
   */
  readonly validate?: (value: string) => string | null;
}

/**
 * The application dialogs that any surface may open: the generic confirm and
 * prompt, plus the singletons (clone, remotes, merge, conflict resolver,
 * about).
 *
 * Components render them through `<app-dialog-host />`, which is mounted once
 * in the shell. Everything else — palette, toolbar, rail, repo manager — only
 * talks to this service, so no feature has to reach into a sibling to raise a
 * dialog.
 */
@Injectable({ providedIn: 'root' })
export class DialogsService {
  private readonly prefs = inject(PreferencesService);

  private readonly _confirm = signal<ConfirmRequest | null>(null);
  private readonly _prompt = signal<PromptRequest | null>(null);
  private confirmResolve: ((value: boolean) => void) | null = null;
  private promptResolve: ((value: string | null) => void) | null = null;

  readonly confirmRequest = this._confirm.asReadonly();
  readonly promptRequest = this._prompt.asReadonly();

  private readonly _cloneOpen = signal(false);
  private readonly _remotesOpen = signal(false);
  private readonly _mergeOpen = signal(false);
  private readonly _aboutOpen = signal(false);
  private readonly _stashOptionsOpen = signal(false);
  private readonly _updateOpen = signal(false);
  private readonly _resolverOpen = signal(false);
  private readonly _resolverFile = signal<string | null>(null);

  readonly cloneOpen = this._cloneOpen.asReadonly();
  readonly remotesOpen = this._remotesOpen.asReadonly();
  readonly mergeOpen = this._mergeOpen.asReadonly();
  readonly aboutOpen = this._aboutOpen.asReadonly();
  readonly stashOptionsOpen = this._stashOptionsOpen.asReadonly();
  readonly updateOpen = this._updateOpen.asReadonly();
  readonly resolverOpen = this._resolverOpen.asReadonly();
  /** File the resolver should select when it opens; `null` picks the first. */
  readonly resolverFile = this._resolverFile.asReadonly();

  /** True while any of these dialogs is on screen. */
  readonly anyOpen = computed(
    () =>
      this._confirm() !== null ||
      this._prompt() !== null ||
      this._cloneOpen() ||
      this._remotesOpen() ||
      this._mergeOpen() ||
      this._aboutOpen() ||
      this._stashOptionsOpen() ||
      this._updateOpen() ||
      this._resolverOpen(),
  );

  /** Resolves `true` when the user confirms, `false` on cancel or Escape. */
  confirm(request: ConfirmRequest): Promise<boolean> {
    if (request.skippable && !this.prefs.confirmDangerous()) {
      return Promise.resolve(true);
    }
    this.settleConfirm(false);
    this._confirm.set(request);
    return new Promise<boolean>((resolve) => {
      this.confirmResolve = resolve;
    });
  }

  /** Resolves with the trimmed text, or `null` when cancelled. */
  prompt(request: PromptRequest): Promise<string | null> {
    this.settlePrompt(null);
    this._prompt.set(request);
    return new Promise<string | null>((resolve) => {
      this.promptResolve = resolve;
    });
  }

  settleConfirm(value: boolean): void {
    const resolve = this.confirmResolve;
    this.confirmResolve = null;
    this._confirm.set(null);
    resolve?.(value);
  }

  settlePrompt(value: string | null): void {
    const resolve = this.promptResolve;
    this.promptResolve = null;
    this._prompt.set(null);
    resolve?.(value);
  }

  openClone(): void {
    this._cloneOpen.set(true);
  }

  closeClone(): void {
    this._cloneOpen.set(false);
  }

  openRemotes(): void {
    this._remotesOpen.set(true);
  }

  closeRemotes(): void {
    this._remotesOpen.set(false);
  }

  openMerge(): void {
    this._mergeOpen.set(true);
  }

  closeMerge(): void {
    this._mergeOpen.set(false);
  }

  openAbout(): void {
    this._aboutOpen.set(true);
  }

  closeAbout(): void {
    this._aboutOpen.set(false);
  }

  openStashOptions(): void {
    this._stashOptionsOpen.set(true);
  }

  closeStashOptions(): void {
    this._stashOptionsOpen.set(false);
  }

  openUpdate(): void {
    this._updateOpen.set(true);
  }

  closeUpdate(): void {
    this._updateOpen.set(false);
  }

  /** Opens the conflict resolver, optionally on a given file. */
  openMergeResolver(file?: string): void {
    this._resolverFile.set(file ?? null);
    this._resolverOpen.set(true);
  }

  closeMergeResolver(): void {
    this._resolverOpen.set(false);
    this._resolverFile.set(null);
  }
}
