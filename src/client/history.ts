// The history page: lists the links this browser created (`links-history` in localStorage, the v2
// shape) and deletes the ones saved with their secret key. All text goes in through textContent.

import {
  buildDeleteRequest,
  canDelete,
  deleteOutcome,
  HISTORY_KEY,
  type HistoryEntry,
  isExpired,
  parseHistory,
  removeEntry,
  shortUrl,
  statsPath,
  visibleEntries,
} from "../shared/history";
import { pageLocale, pageText } from "./lib/lang";
import { toast } from "./lib/toast";

const text = pageText();

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" };

function load(): HistoryEntry[] {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY));
  } catch {
    return [];
  }
}

function save(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Blocked or full storage: the page still works for this visit.
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleString(pageLocale(), DATE_FORMAT);
}

function meta(label: string, value: string): HTMLElement {
  const row = el("p", "history__meta");
  row.append(el("span", "history__meta-label", `${label}: `), document.createTextNode(value));
  return row;
}

interface Page {
  list: HTMLElement;
  empty: HTMLElement;
}

function copyButton(value: string): HTMLButtonElement {
  const button = el("button", "button button--ghost button--small", text.copy.button);
  button.type = "button";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = text.copy.done;
      toast(text.copy.toast, "success");
    } catch {
      button.textContent = text.copy.failed;
      toast(text.copy.failedToast, "error");
    }
    setTimeout(() => {
      button.textContent = text.copy.button;
    }, 2000);
  });
  return button;
}

function confirmDelete(short: string, opener: HTMLElement): Promise<boolean> {
  const dialog = el("dialog", "confirm");
  dialog.setAttribute("closedby", "any");
  dialog.setAttribute("aria-labelledby", "confirm-title");
  const title = el("h2", "confirm__title", text.history.confirmTitle);
  title.id = "confirm-title";
  const actions = el("div", "confirm__actions");
  const cancel = el("button", "button button--ghost button--small", text.history.cancel);
  cancel.type = "button";
  cancel.autofocus = true;
  cancel.addEventListener("click", () => dialog.close("cancel"));
  const confirm = el("button", "button button--danger button--small", text.history.delete);
  confirm.type = "button";
  confirm.addEventListener("click", () => dialog.close("confirm"));
  actions.append(cancel, confirm);
  dialog.append(title, el("p", "confirm__body", text.history.confirmBody(short)), actions);
  document.body.append(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      dialog.remove();
      opener.focus();
      resolve(dialog.returnValue === "confirm");
    });
    dialog.showModal();
  });
}

async function remove(
  entry: HistoryEntry,
  item: HTMLElement,
  button: HTMLButtonElement,
  page: Page,
) {
  const request = buildDeleteRequest(entry);
  if (!request) return;
  if (!(await confirmDelete(shortUrl(location.origin, entry.id), button))) return;
  button.disabled = true;
  let status = 0;
  try {
    status = (await fetch(request.path, request.init)).status;
  } catch {
    // A network error is handled like any other failure below.
  }
  const outcome = deleteOutcome(status);
  if (outcome === "removed") {
    save(removeEntry(load(), entry.id));
    item.remove();
    toast(text.history.deleted(entry.id), "success");
    if (page.list.children.length === 0) page.empty.hidden = false;
    return;
  }
  button.disabled = false;
  const messages = {
    rate_limited: text.history.rateLimited,
    key_rejected: text.history.keyRejected,
    failed: text.history.deleteFailed,
  } as const;
  toast(messages[outcome], "error");
}

function render(entry: HistoryEntry, page: Page): HTMLElement {
  const item = el("li", "history__item");
  const short = shortUrl(location.origin, entry.id);

  const link = el("a", "history__short", short);
  link.href = short;
  item.append(link);

  item.append(meta(text.history.target, entry.url));
  if (entry.createdAt !== "") item.append(meta(text.history.created, formatDate(entry.createdAt)));
  item.append(
    meta(
      text.history.expires,
      entry.expire === "never" ? text.history.never : formatDate(entry.expire),
    ),
  );

  const actions = el("div", "history__actions");
  actions.append(copyButton(short));
  const stats = el("a", "button button--ghost button--small", text.history.stats);
  stats.href = statsPath(entry.id);
  actions.append(stats);
  if (canDelete(entry)) {
    const del = el("button", "button button--danger button--small", text.history.delete);
    del.type = "button";
    del.setAttribute("aria-label", text.history.deleteLabel(entry.id));
    del.addEventListener("click", () => remove(entry, item, del, page));
    actions.append(del);
  } else {
    actions.append(el("span", "history__readonly", text.history.readOnly));
  }
  item.append(actions);
  return item;
}

function init(): void {
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  if (!list || !empty) return;
  const page: Page = { list, empty };

  // Expired links are gone from the service already; v2 dropped them from the history too.
  const now = Date.now();
  const all = load();
  const live = all.filter((entry) => !isExpired(entry, now));
  if (live.length !== all.length) save(live);

  list.replaceChildren(...visibleEntries(live).map((entry) => render(entry, page)));
  empty.hidden = live.length > 0;
  document.getElementById("history-loading")?.remove();
}

init();
