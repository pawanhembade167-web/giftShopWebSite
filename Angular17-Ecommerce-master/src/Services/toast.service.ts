import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export const TOAST_LIMIT = 4;
export const DEFAULT_TOAST_MS = 4000;
export const ERROR_TOAST_MS = 6000;

/**
 * Single place for action feedback. Messages stack in the corner, the newest last, and older
 * ones drop off once the limit is reached. Errors stay a little longer so they can be read.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string): number {
    return this.show(message, 'success');
  }

  error(message: string): number {
    return this.show(message, 'error', ERROR_TOAST_MS);
  }

  info(message: string): number {
    return this.show(message, 'info');
  }

  warning(message: string): number {
    return this.show(message, 'warning');
  }

  show(message: string, type: ToastType, durationMs = DEFAULT_TOAST_MS): number {
    const id = this.nextId++;
    const kept = this.toasts();
    const overflow = kept.slice(0, Math.max(0, kept.length + 1 - TOAST_LIMIT));
    overflow.forEach((toast) => this.clearTimer(toast.id));

    this.toasts.set([...kept.slice(overflow.length), { id, type, message }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), durationMs));
    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
