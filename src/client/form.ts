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
import { withoutProtocol } from "../shared/short-url";
import { enableCopy } from "./lib/copy";
import { pageLocale, pageText } from "./lib/lang";
import { dismissAll, REANNOUNCE_MS, toast } from "./lib/toast";

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

/** Stores the entry, replacing one with the same id. False when storage is blocked or full. */
function saveToHistory(entry: HistoryEntry): boolean {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(upsertEntry(readHistory(), entry)));
    return true;
  } catch {
    // Private mode or a full quota: the result stays on screen, only the history misses it.
    return false;
  }
}

/** Once the key is in History, the warning becomes a quiet note; it stays loud if saving failed. */
function markKeySaved(root: ParentNode): void {
  const box = root.querySelector<HTMLElement>("[data-key-box]");
  if (!box) return;
  box.classList.replace("notice--warning", "notice--quiet");
  setField(box, "keyTitle", text.savedKey.title);
  setField(box, "keyText", text.savedKey.text);
}

/** Share opens the system share sheet where the browser has one (mostly phones). */
function enableShare(root: ParentNode): void {
  const button = root.querySelector<HTMLButtonElement>("[data-share]");
  const link = root.querySelector<HTMLElement>('[data-field="shortUrl"]');
  if (!button || !link || typeof navigator.share !== "function") return;
  button.hidden = false;
  button.addEventListener("click", () => {
    // A closed share sheet rejects too; there is nothing to report then.
    navigator.share({ url: link.dataset.value ?? link.textContent ?? "" }).catch(() => {});
  });
}

function setField(root: ParentNode, name: string, text: string): void {
  const el = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}

function showResult(
  link: CreatedLink,
  target: string,
  host: string,
  isIdn: boolean,
  saved: boolean,
): void {
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
    short.dataset.value = link.shortUrl;
    short.textContent = withoutProtocol(link.shortUrl);
    // The template's label ends with "Short link: "; the full URL completes it.
    short.setAttribute("aria-label", `${short.getAttribute("aria-label") ?? ""}${link.shortUrl}`);
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
  enableShare(section);
  if (saved) markKeySaved(section);
  slot.replaceChildren(card);
  // The result takes the place of the form: the forms go, the card shows right under the hero.
  for (const id of ["shorten-form", "lookup-form"]) byId(id)?.setAttribute("hidden", "");
  for (const el of document.querySelectorAll("[data-hide-on-result]"))
    el.setAttribute("hidden", "");
  slot.querySelector<HTMLElement>("#result-title")?.focus({ preventScroll: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
}

function setupShortenForm(form: HTMLFormElement): void {
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
  const errorBoxes = [byId("form-error"), byId("options-error")];
  const clearInvalid = () => {
    for (const name of fields) {
      byId(name)?.removeAttribute("aria-invalid");
      byId(name)?.removeAttribute("aria-describedby");
    }
    for (const box of errorBoxes) if (box) box.hidden = true;
  };
  // Network and server errors have no field to point at, so they go to a toast.
  const fail = (code: string) => {
    const message = errorText(code, text);
    const fieldName = FIELD_OF_ERROR[code];
    const box = byId(fieldName === "url" ? "form-error" : "options-error");
    if (fieldName === undefined || !box) {
      // The submit button is disabled while the request runs, so focus returns to the link field.
      toast(message, "error", { returnFocus: byId("url") });
      return;
    }
    const field = byId(fieldName);
    // A field inside the closed options panel cannot take focus.
    const panel = field?.closest("details");
    if (panel) panel.open = true;
    // Cleared first so a repeated message is read out again.
    box.textContent = "";
    box.hidden = false;
    setTimeout(() => {
      box.textContent = message;
    }, REANNOUNCE_MS);
    field?.setAttribute("aria-invalid", "true");
    field?.setAttribute("aria-describedby", box.id);
    field?.focus();
  };
  for (const name of fields) byId(name)?.addEventListener("input", clearInvalid);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // Also clears an error the server rendered for a no-JS attempt.
    clearInvalid();
    dismissAll("error");
    const data = new FormData(form);
    const early = formUrlError(String(data.get("url") ?? ""));
    if (early) {
      fail(early);
      return;
    }
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
        const saved = saveToHistory({
          id: link.id,
          url: link.url,
          expire: link.expiresAt ?? "never",
          createdAt: new Date().toISOString(),
          secretKey: link.secretKey,
        });
        const target = new URL(link.url);
        showResult(link, target.href, target.hostname, hostIsIdn(target.hostname), saved);
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
    const saved = saveToHistory({
      id,
      url,
      expire: expire ?? "never",
      createdAt: new Date().toISOString(),
      secretKey,
    });
    if (saved) markKeySaved(section);
  }
  enableCopy(section);
  enableShare(section);
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
