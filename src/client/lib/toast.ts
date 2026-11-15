// Toasts: short feedback in the `#toasts` live region that the layout renders on every page.
// Classes only, no inline styles, so the CSP stays as it is. Text goes in through textContent.

import {
  dismissToast,
  showToast,
  TOAST_DURATION,
  type Toast,
  type ToastVariant,
} from "./toast-queue";

/** How long the leave animation runs; reduced motion skips it. */
const LEAVE_MS = 200;

let toasts: Toast[] = [];
let nextId = 1;
const nodes = new Map<number, HTMLElement>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function region(): HTMLElement {
  const existing = document.getElementById("toasts");
  if (existing) return existing;
  // Pages always carry the region; this only covers a page rendered without it.
  const created = document.createElement("div");
  created.id = "toasts";
  created.className = "toasts";
  created.setAttribute("aria-live", "polite");
  document.body.append(created);
  return created;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stopTimer(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

function startTimer(toast: Toast): void {
  stopTimer(toast.id);
  const ms = TOAST_DURATION[toast.variant];
  if (ms === null) return;
  timers.set(
    toast.id,
    setTimeout(() => dismiss(toast.id), ms),
  );
}

function dismiss(id: number): void {
  stopTimer(id);
  toasts = dismissToast(toasts, id);
  const node = nodes.get(id);
  nodes.delete(id);
  if (!node) return;
  // Focus would be lost with the node; hand it back to the page.
  if (node.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  if (reducedMotion()) {
    node.remove();
    return;
  }
  node.classList.add("toast--leaving");
  setTimeout(() => node.remove(), LEAVE_MS);
}

function render(toast: Toast, closeLabel: string): HTMLElement {
  const item = document.createElement("div");
  item.className = `toast toast--${toast.variant}`;
  const text = document.createElement("p");
  text.className = "toast__message";
  text.textContent = toast.message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", closeLabel);
  close.textContent = "×";
  close.addEventListener("click", () => dismiss(toast.id));
  item.append(text, close);
  // A toast the visitor is reading or about to close does not vanish under the pointer.
  item.addEventListener("mouseenter", () => stopTimer(toast.id));
  item.addEventListener("focusin", () => stopTimer(toast.id));
  item.addEventListener("mouseleave", () => startTimer(toast));
  item.addEventListener("focusout", () => startTimer(toast));
  return item;
}

/** Closes every toast of `variant`, e.g. the errors of a form that is being sent again. */
export function dismissAll(variant: ToastVariant): void {
  for (const t of toasts) if (t.variant === variant) dismiss(t.id);
}

export interface ToastOptions {
  /** Accessible name of the close button. */
  closeLabel?: string;
}

/** Shows `message` as a toast; repeating a message that is still visible restarts its timer. */
export function toast(
  message: string,
  variant: ToastVariant = "info",
  { closeLabel = "Zamknij" }: ToastOptions = {},
): void {
  const shown = showToast(toasts, { id: nextId++, variant, message });
  toasts = shown.list;
  for (const id of shown.evicted) dismiss(id);
  if (shown.added) {
    const node = render(shown.toast, closeLabel);
    nodes.set(shown.toast.id, node);
    region().append(node);
  }
  startTimer(shown.toast);
}
