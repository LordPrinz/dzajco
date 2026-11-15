// The state behind the toasts, kept apart from the DOM so it can be tested without a browser.

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

/** How long each variant stays, in ms. Errors stay until closed: they may need reading twice. */
export const TOAST_DURATION: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 5000,
  error: null,
};

/** More than this and the oldest toast makes room. */
export const MAX_TOASTS = 3;

export interface Shown {
  list: Toast[];
  /** The toast now on screen for this message: a new one, or the identical one already shown. */
  toast: Toast;
  /** Ids pushed out to stay within `max`. */
  evicted: number[];
  /** False when an identical toast was already showing; its timer should restart instead. */
  added: boolean;
}

/**
 * Adds a toast to the end of `list`. Repeating a message that is still on screen (a double click
 * on "copy") reuses that toast instead of stacking a second one.
 */
export function showToast(list: readonly Toast[], next: Toast, max: number = MAX_TOASTS): Shown {
  const same = list.find((t) => t.variant === next.variant && t.message === next.message);
  if (same) return { list: [...list], toast: same, evicted: [], added: false };
  const all = [...list, next];
  const over = Math.max(0, all.length - max);
  return {
    list: all.slice(over),
    toast: next,
    evicted: all.slice(0, over).map((t) => t.id),
    added: true,
  };
}

export function dismissToast(list: readonly Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}
