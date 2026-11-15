// Toasts: short feedback in the live regions that the layout renders on every page. Errors go to
// an assertive region (`role="alert"`), success and info to a polite one (`role="status"`).
// Classes only, no inline styles, so the CSP stays as it is. Text goes in through textContent.

import { pageText } from "./lang";
import {
  dismissToast,
  showToast,
  TOAST_DURATION,
  type Toast,
  type ToastVariant,
} from "./toast-queue";

/** How long the leave animation runs; reduced motion skips it. */
const LEAVE_MS = 200;
/** Long enough for a screen reader to notice the text was cleared before it comes back. */
export const REANNOUNCE_MS = 100;

interface Shown {
  node: HTMLElement;
  message: HTMLElement;
  /** Where focus goes if the toast is closed while focus is inside it. */
  returnFocus: HTMLElement | null;
}

let toasts: Toast[] = [];
let nextId = 1;
const shown = new Map<number, Shown>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function region(variant: ToastVariant): HTMLElement | null {
  return document.getElementById(variant === "error" ? "toasts-alert" : "toasts-status");
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

/** Focus goes back where it came from, or to the main content, never to <body>. */
function restoreFocus(target: HTMLElement | null): void {
  if (target?.isConnected) {
    target.focus();
    return;
  }
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  main.tabIndex = -1;
  main.focus();
}

function dismiss(id: number): void {
  stopTimer(id);
  toasts = dismissToast(toasts, id);
  const entry = shown.get(id);
  shown.delete(id);
  if (!entry) return;
  if (entry.node.contains(document.activeElement)) restoreFocus(entry.returnFocus);
  if (reducedMotion()) {
    entry.node.remove();
    return;
  }
  entry.node.classList.add("toast--leaving");
  setTimeout(() => entry.node.remove(), LEAVE_MS);
}

function render(toast: Toast, closeLabel: string): Shown["node"] {
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
  /** Where focus returns when the toast closes; defaults to whatever had focus when it opened. */
  returnFocus?: HTMLElement | null;
}

/**
 * Shows `message` as a toast. A message that is still visible is not stacked again: its timer
 * restarts and its text is cleared and set again, so screen readers announce it a second time.
 */
export function toast(
  message: string,
  variant: ToastVariant = "info",
  { closeLabel = pageText().toastClose, returnFocus }: ToastOptions = {},
): void {
  const target = region(variant);
  if (!target) return;
  const result = showToast(toasts, { id: nextId++, variant, message });
  toasts = result.list;
  for (const id of result.evicted) dismiss(id);
  const active = document.activeElement;
  const opener = active instanceof HTMLElement && active !== document.body ? active : null;
  if (result.added) {
    const node = render(result.toast, closeLabel);
    shown.set(result.toast.id, {
      node,
      message: node.querySelector<HTMLElement>(".toast__message") ?? node,
      returnFocus: returnFocus ?? opener,
    });
    target.append(node);
  } else {
    const entry = shown.get(result.toast.id);
    if (entry) {
      entry.message.textContent = "";
      setTimeout(() => {
        entry.message.textContent = message;
      }, REANNOUNCE_MS);
    }
  }
  startTimer(result.toast);
}
