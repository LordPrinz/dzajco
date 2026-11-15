// The history page: lists the links this browser created or added with their key (`links-history`
// in localStorage, the v2 shape) and deletes the ones saved with their secret key. All text goes in
// through textContent.

import {
  type AddOutcome,
  addOutcome,
  buildDeleteRequest,
  canDelete,
  deleteOutcome,
  entryFromLink,
  HISTORY_KEY,
  type HistoryEntry,
  isExpired,
  isLinkId,
  parseHistory,
  removeEntry,
  shortUrl,
  statsPath,
  upsertEntry,
  visibleEntries,
  withKey,
} from "../shared/history";
import { codeFromInput } from "../shared/short-url";
import { ownerRequest } from "../shared/stats";
import { pageLocale, pageText } from "./lib/lang";
import { formatLocal } from "./lib/local-time";
import { REANNOUNCE_MS, toast } from "./lib/toast";

const text = pageText();

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
  return formatLocal(iso, pageLocale(), iso);
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
  dialog.setAttribute("aria-labelledby", "confirm-title");
  dialog.setAttribute("aria-describedby", "confirm-body");
  const title = el("h2", "confirm__title", text.history.confirmTitle);
  title.id = "confirm-title";
  const actions = el("div", "confirm__actions");
  const cancel = el("button", "button button--ghost button--small", text.history.cancel);
  cancel.type = "button";
  cancel.autofocus = true;
  cancel.addEventListener("click", () => dialog.close("cancel"));
  const confirmButton = el("button", "button button--danger button--small", text.history.delete);
  confirmButton.type = "button";
  confirmButton.addEventListener("click", () => dialog.close("confirm"));
  actions.append(cancel, confirmButton);
  const body = el("p", "confirm__body", text.history.confirmBody(short));
  body.id = "confirm-body";
  dialog.append(title, body, actions);
  document.body.append(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      dialog.remove();
      const confirmed = dialog.returnValue === "confirm";
      if (!confirmed) opener.focus();
      resolve(confirmed);
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
    const neighbour = item.nextElementSibling ?? item.previousElementSibling;
    item.remove();
    toast(text.history.deleted(entry.id), "success");
    if (neighbour) {
      neighbour.querySelector<HTMLElement>(".button--danger, a")?.focus();
    } else {
      page.empty.hidden = false;
      page.empty.focus();
    }
    return;
  }
  button.disabled = false;
  button.focus();
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

function show(entries: readonly HistoryEntry[], page: Page): void {
  page.list.replaceChildren(...visibleEntries(entries).map((entry) => render(entry, page)));
  page.empty.hidden = entries.length > 0;
  const note = document.getElementById("history-note");
  if (note) note.hidden = !visibleEntries(entries).some((entry) => !canDelete(entry));
}

type Added = { outcome: Exclude<AddOutcome, "ok"> } | { outcome: "ok"; entry: HistoryEntry };
type AddError = keyof typeof text.history.addErrors;

/** Checks the key with the owner stats, then reads the link to build its entry. */
async function addLink(id: string, secretKey: string): Promise<Added> {
  try {
    const { url, init } = ownerRequest(id, secretKey);
    const checked = addOutcome((await fetch(url, init)).status);
    if (checked !== "ok") return { outcome: checked };
    const response = await fetch(`/api/v1/links/${encodeURIComponent(id)}`);
    const found = addOutcome(response.status);
    if (found !== "ok") return { outcome: found };
    const entry = entryFromLink(await response.json(), id, secretKey);
    return entry ? { outcome: "ok", entry } : { outcome: "failed" };
  } catch {
    return { outcome: "failed" };
  }
}

function setupAddForm(page: Page): void {
  const form = document.getElementById("add-key-form") as HTMLFormElement | null;
  const code = document.getElementById("add-key-code") as HTMLInputElement | null;
  const key = document.getElementById("add-key-secret") as HTMLInputElement | null;
  const title = document.getElementById("add-key-title");
  const error = document.getElementById("add-key-error");
  const status = document.getElementById("add-key-status");
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !code || !key || !title || !error || !status || !submit) return;

  const fieldOf: Partial<Record<AddError, HTMLInputElement>> = {
    key_rejected: key,
    not_found: code,
    empty_code: code,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    error.hidden = true;
    error.textContent = "";
    for (const field of [code, key]) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }
  };
  const fail = (reason: AddError) => {
    clearTimeout(timer);
    error.hidden = false;
    // Set after a moment, so a repeated message is read out again.
    timer = setTimeout(() => {
      error.textContent = text.history.addErrors[reason];
    }, REANNOUNCE_MS);
    const field = fieldOf[reason];
    if (!field) {
      // The form was inert during the request, which dropped focus to the page.
      submit.focus();
      return;
    }
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
    field.focus();
  };
  code.addEventListener("input", clear);
  key.addEventListener("input", clear);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clear();
    const id = codeFromInput(code.value).normalize("NFC");
    if (id === "") {
      fail("empty_code");
      return;
    }
    if (!isLinkId(id)) {
      fail("not_found");
      return;
    }
    const secretKey = key.value.trim();
    form.inert = true;
    status.textContent = text.history.adding;
    const added = await addLink(id, secretKey);
    form.inert = false;
    status.textContent = "";
    if (added.outcome !== "ok") {
      fail(added.outcome);
      return;
    }
    const { entry } = added;
    const entries = load();
    const updated = withKey(entries, entry.id, secretKey);
    const next = updated ?? upsertEntry(entries, entry);
    save(next);
    show(next, page);
    form.reset();
    toast(updated ? text.history.keyUpdated(entry.id) : text.history.added(entry.id), "success");
    const short = shortUrl(location.origin, entry.id);
    const links = Array.from(page.list.querySelectorAll<HTMLAnchorElement>(".history__short"));
    // Past MAX_RENDERED the new entry is not drawn, so focus goes back to the form.
    (links.find((link) => link.href === short) ?? title).focus();
  });
  form.hidden = false;
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

  show(live, page);
  setupAddForm(page);
}

init();
