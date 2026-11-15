// Progressive enhancement of the home form and the result page. Without this script the form posts
// to `/` and the server renders the result.

import { hostIsIdn } from "../domain/host";
import {
  CUSTOM_EXPIRY,
  errorText,
  expiresAtFrom,
  FIELD_OF_ERROR,
  formUrlError,
  HISTORY_KEY,
  type HistoryEntry,
  normalizeUrlInput,
} from "../shared/form";
import { upsertEntry } from "../shared/history";
import { pageLocale, pageText } from "./lib/lang";
import { dismissAll, toast } from "./lib/toast";

const text = pageText();

interface CreatedLink {
  id: string;
  /** Target as the server normalised it. */
  url: string;
  shortUrl: string;
  secretKey: string;
  expiresAt: string | null;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Stores the entry, replacing one with the same id; storage can be blocked, so failures are silent. */
function saveToHistory(entry: HistoryEntry): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(upsertEntry(readHistory(), entry)));
  } catch {
    // Private mode or a full quota: the result stays on screen, only the history misses it.
  }
}

function setField(root: ParentNode, name: string, text: string): void {
  const el = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}

function enableCopy(root: ParentNode): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const source = root.querySelector<HTMLElement>(`[data-field="${button.dataset.copy}"]`);
      try {
        await navigator.clipboard.writeText(source?.textContent ?? "");
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
  }
}

function showResult(link: CreatedLink, target: string, host: string, isIdn: boolean): void {
  const template = byId<HTMLTemplateElement>("result-template");
  const slot = byId("result-slot");
  if (!template || !slot) return;
  const card = template.content.cloneNode(true) as DocumentFragment;
  const section = card.querySelector<HTMLElement>("[data-created]");
  if (!section) return;
  section.dataset.id = link.id;
  section.dataset.url = target;
  section.dataset.expire = link.expiresAt ?? "never";

  const short = card.querySelector<HTMLAnchorElement>('[data-field="shortUrl"]');
  if (short) {
    short.href = link.shortUrl;
    short.textContent = link.shortUrl;
  }
  setField(card, "target", target);
  setField(card, "secretKey", link.secretKey);
  setField(card, "host", host);
  const idn = card.querySelector<HTMLElement>('[data-field="idn"]');
  if (idn) idn.hidden = !isIdn;
  const expiry = card.querySelector<HTMLElement>('[data-field="expiry"]');
  const time = card.querySelector<HTMLTimeElement>("time");
  if (expiry && time && link.expiresAt) {
    time.dateTime = link.expiresAt;
    time.textContent = new Date(link.expiresAt).toLocaleString(pageLocale(), {
      dateStyle: "long",
      timeStyle: "short",
    });
    expiry.hidden = false;
  }
  const stats = card.querySelector<HTMLAnchorElement>('[data-field="stats"]');
  if (stats) stats.href = `/${encodeURIComponent(link.id)}/stats`;

  // The fragment is empty once its children move into the slot, so the copy handlers need the section.
  enableCopy(section);
  slot.replaceChildren(card);
  // The result takes the place of the form: the forms go, the card shows right under the hero.
  for (const id of ["shorten-form", "lookup-form"]) byId(id)?.setAttribute("hidden", "");
  slot.querySelector<HTMLElement>("#result-title")?.focus({ preventScroll: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
}

function setupShortenForm(form: HTMLFormElement): void {
  const serverError = byId<HTMLElement>("form-error");
  const status = byId<HTMLElement>("form-status");
  const expiry = byId<HTMLSelectElement>("expiry");
  const customDate = byId<HTMLElement>("custom-date");
  // The script reads the date in the browser's zone; the no-JS form keeps UTC.
  const dateLabel = byId<HTMLElement>("custom-date-label");
  if (dateLabel) dateLabel.textContent = text.form.localDateLabel;
  const dateHint = byId<HTMLElement>("custom-date-hint");
  if (dateHint) dateHint.textContent = text.form.localDateHint;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const syncCustomDate = () => {
    if (customDate && expiry) customDate.hidden = expiry.value !== CUSTOM_EXPIRY;
  };
  expiry?.addEventListener("change", syncCustomDate);
  syncCustomDate();

  const fields = ["url", "customName", "expiry"] as const;
  const clearInvalid = () => {
    for (const name of fields) {
      byId(name)?.removeAttribute("aria-invalid");
      byId(name)?.removeAttribute("aria-describedby");
    }
    if (serverError) serverError.hidden = true;
  };
  // Errors about a field show under the pill in #form-error (role=alert), next to what needs fixing.
  // Network and server errors have no field to point at, so they go to a toast.
  const fail = (code: string) => {
    const message = errorText(code, text);
    const fieldName = FIELD_OF_ERROR[code];
    if (fieldName === undefined || !serverError) {
      // The submit button is disabled while the request runs, so focus returns to the link field.
      toast(message, "error", { returnFocus: byId("url") });
      return;
    }
    const field = byId(fieldName);
    // Cleared first and filled a moment later, so the same message is read out again on a retry.
    serverError.textContent = "";
    serverError.hidden = false;
    setTimeout(() => {
      serverError.textContent = message;
    }, 50);
    field?.setAttribute("aria-invalid", "true");
    field?.setAttribute("aria-describedby", serverError.id);
    field?.focus();
  };
  // The red state goes as soon as the visitor starts fixing the field.
  for (const name of fields) byId(name)?.addEventListener("input", clearInvalid);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // Also hides a server-rendered error from a no-JS attempt: it is stale once the script runs.
    clearInvalid();
    dismissAll("error");
    const early = formUrlError(String(new FormData(form).get("url") ?? ""));
    if (early) {
      fail(early);
      return;
    }
    const data = new FormData(form);
    const url = normalizeUrlInput(String(data.get("url") ?? ""));
    const customName = String(data.get("customName") ?? "").trim();
    const choice = {
      expiry: String(data.get("expiry") ?? "never"),
      customDate: String(data.get("customDate") ?? ""),
    };
    const expiresAt = expiresAtFrom(choice, Date.now(), "");

    const body: Record<string, string | null> = { url, expiresAt };
    if (customName !== "") body.customName = customName;

    if (submit) submit.disabled = true;
    if (status) status.textContent = text.form.sending;
    try {
      const response = await fetch("/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { error?: { code?: string } } & Partial<CreatedLink>;
      if (response.status === 201 && json.id && json.shortUrl && json.secretKey && json.url) {
        const link = json as CreatedLink;
        saveToHistory({
          id: link.id,
          url: link.url,
          expire: link.expiresAt ?? "never",
          createdAt: new Date().toISOString(),
          secretKey: link.secretKey,
        });
        const target = new URL(link.url);
        showResult(link, target.href, target.hostname, hostIsIdn(target.hostname));
        form.reset();
        syncCustomDate();
        if (status) status.textContent = "";
      } else {
        fail(json.error?.code ?? "unknown");
        if (status) status.textContent = "";
      }
    } catch {
      fail("unknown");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

/** The no-JS result page: save the key to the history and offer the copy buttons. */
function setupResultPage(section: HTMLElement): void {
  const secretKey = section.querySelector<HTMLElement>('[data-field="secretKey"]')?.textContent;
  const { id, url, expire } = section.dataset;
  if (id && url && secretKey) {
    saveToHistory({
      id,
      url,
      expire: expire ?? "never",
      createdAt: new Date().toISOString(),
      secretKey,
    });
  }
  enableCopy(section);
}

function codeFromInput(input: string): string {
  const value = input.trim();
  if (!URL.canParse(value)) return value;
  const segment = new URL(value).pathname.split("/")[1] ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function setupLookup(form: HTMLFormElement): void {
  form.hidden = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = codeFromInput(byId<HTMLInputElement>("lookup-code")?.value ?? "");
    if (code !== "") location.assign(`/${encodeURIComponent(code)}/stats`);
  });
}

const shortenForm = byId<HTMLFormElement>("shorten-form");
if (shortenForm) setupShortenForm(shortenForm);
const lookupForm = byId<HTMLFormElement>("lookup-form");
if (lookupForm) setupLookup(lookupForm);
const created = document.querySelector<HTMLElement>("main > [data-created]");
if (created) setupResultPage(created);
