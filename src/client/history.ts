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
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleString("pl-PL", DATE_FORMAT);
}

function meta(label: string, value: string): HTMLElement {
  const row = el("p", "history__meta");
  row.append(el("span", "history__meta-label", `${label}: `), document.createTextNode(value));
  return row;
}

interface Page {
  list: HTMLElement;
  empty: HTMLElement;
  status: HTMLElement;
}

function setStatus(page: Page, message: string): void {
  page.status.textContent = message;
}

function copyButton(value: string, page: Page): HTMLButtonElement {
  const button = el("button", "button button--ghost button--small", "Kopiuj");
  button.type = "button";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Skopiowano";
      setStatus(page, "Skopiowano do schowka");
    } catch {
      button.textContent = "Nie udało się";
    }
    setTimeout(() => {
      button.textContent = "Kopiuj";
    }, 2000);
  });
  return button;
}

async function remove(
  entry: HistoryEntry,
  item: HTMLElement,
  button: HTMLButtonElement,
  page: Page,
) {
  const request = buildDeleteRequest(entry);
  if (!request) return;
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
    setStatus(page, `Usunięto link ${entry.id}`);
    if (page.list.children.length === 0) page.empty.hidden = false;
    return;
  }
  button.disabled = false;
  const messages = {
    rate_limited: "Za dużo żądań. Spróbuj ponownie za minutę.",
    key_rejected: "Ten klucz nie pasuje do linku.",
    failed: "Nie udało się usunąć linku. Spróbuj ponownie.",
  } as const;
  setStatus(page, messages[outcome]);
}

function render(entry: HistoryEntry, page: Page): HTMLElement {
  const item = el("li", "history__item");
  const short = shortUrl(location.origin, entry.id);

  const link = el("a", "history__short", short);
  link.href = short;
  item.append(link);

  item.append(meta("Cel", entry.url));
  if (entry.createdAt !== "") item.append(meta("Utworzono", formatDate(entry.createdAt)));
  item.append(meta("Wygasa", entry.expire === "never" ? "nigdy" : formatDate(entry.expire)));

  const actions = el("div", "history__actions");
  actions.append(copyButton(short, page));
  const stats = el("a", "button button--ghost button--small", "Statystyki");
  stats.href = statsPath(entry.id);
  actions.append(stats);
  if (canDelete(entry)) {
    const del = el("button", "button button--danger button--small", "Usuń");
    del.type = "button";
    del.setAttribute("aria-label", `Usuń link ${entry.id}`);
    del.addEventListener("click", () => remove(entry, item, del, page));
    actions.append(del);
  } else {
    actions.append(el("span", "history__readonly", "Tylko do odczytu (brak klucza)"));
  }
  item.append(actions);
  return item;
}

function init(): void {
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  const status = document.getElementById("history-status");
  if (!list || !empty || !status) return;
  const page: Page = { list, empty, status };

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
