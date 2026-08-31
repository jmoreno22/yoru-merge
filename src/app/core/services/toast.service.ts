import { Injectable, signal } from '@angular/core';

export type ToastLevel = 'success' | 'info' | 'warning' | 'error';

/** Optional button rendered inside a toast (e.g. "Retry", "Open settings"). */
export interface ToastAction {
  readonly label: string;
  readonly run: () => void | Promise<void>;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly level: ToastLevel;
  readonly action?: ToastAction;
  /** Dedupe key: a new toast with the same key replaces the pending one. */
  readonly key?: string;
}

export interface ToastInput {
  kind: ToastLevel;
  message: string;
  action?: ToastAction;
  key?: string;
  /** Auto-dismiss delay; `0` keeps the toast until dismissed by hand. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 4000;
const ERROR_TIMEOUT_MS = 6000;
/** Toasts with an action need long enough for the user to reach the button. */
const ACTION_TIMEOUT_MS = 10000;

/** Signal-based toast notifications, rendered by the toast host component. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Returns the toast id so callers can dismiss it early. */
  show(input: ToastInput): number {
    const existing = input.key
      ? this._toasts().find((t) => t.key === input.key)
      : undefined;
    const id = existing?.id ?? this.nextId++;
    const toast: Toast = {
      id,
      message: input.message,
      level: input.kind,
      action: input.action,
      key: input.key,
    };

    this._toasts.update((list) =>
      existing ? list.map((t) => (t.id === id ? toast : t)) : [...list, toast],
    );

    this.clearTimer(id);
    const timeout = input.timeoutMs ?? defaultTimeout(input);
    if (timeout > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), timeout),
      );
    }
    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    for (const id of this.timers.keys()) this.clearTimer(id);
    this._toasts.set([]);
  }

  success(message: string, timeoutMs?: number): number {
    return this.show({ kind: 'success', message, timeoutMs });
  }

  info(message: string, timeoutMs?: number): number {
    return this.show({ kind: 'info', message, timeoutMs });
  }

  warning(message: string, timeoutMs?: number): number {
    return this.show({ kind: 'warning', message, timeoutMs });
  }

  error(message: string, timeoutMs?: number): number {
    return this.show({ kind: 'error', message, timeoutMs });
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(id);
  }
}

function defaultTimeout(input: ToastInput): number {
  if (input.action) return ACTION_TIMEOUT_MS;
  return input.kind === 'error' ? ERROR_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}
