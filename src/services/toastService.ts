
// Lightweight global toast system — replaces alert() calls across the app

type ToastType = 'success' | 'error' | 'info';
type ToastListener = (message: string, type: ToastType) => void;

let listener: ToastListener | null = null;

export const toastService = {
  subscribe(fn: ToastListener) { listener = fn; },
  unsubscribe() { listener = null; },

  success(message: string) { listener?.(message, 'success'); },
  error(message: string) { listener?.(message, 'error'); },
  info(message: string) { listener?.(message, 'info'); },

  /** Drop-in replacement for alert() — shows as error toast */
  alert(message: string) { listener?.(message, 'error'); },
};
