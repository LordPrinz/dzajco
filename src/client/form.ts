// Progressive enhancement of the home form and the result page. Without this script the form posts
// to `/` and the server renders the result.

import {
  CUSTOM_EXPIRY,
  errorText,
  expiresAtFrom,
  HISTORY_KEY,
  type HistoryEntry,
  hostIsIdn,
  normalizeUrlInput,
} from "../shared/form";

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

/** Appends an entry unless the id is already there; storage can be blocked, so failures are silent. */
function saveToHistory(entry: HistoryEntry): void {
  try {
    const history = readHistory();
    if (history.some((item) => item.id === entry.id)) return;
    history.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private mode or a full quota: the result stays on screen, only the history misses it.
  }
}

function setField(root: ParentNode, name: string, text: string): void {
  const el = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}

function enableCopy(root: ParentNode): void {
  const status = root.querySelector<HTMLElement>('[data-field="copied"]');
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const source = root.querySelector<HTMLElement>(`[data-field="${button.dataset.copy}"]`);
      try {
        await navigator.clipboard.writeText(source?.textContent ?? "");
        button.textContent = "Skopiowano";
        if (status) status.textContent = "Skopiowano do schowka";
      } catch {
        button.textContent = "Nie udało się";
      }
      setTimeout(() => {
        button.textContent = "Kopiuj";
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
    time.textContent = new Date(link.expiresAt).toLocaleString("pl-PL", {
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
  slot.querySelector<HTMLElement>("#result-title")?.focus();
}

function setupShortenForm(form: HTMLFormElement): void {
  const error = byId<HTMLElement>("form-error");
  const status = byId<HTMLElement>("form-status");
  const expiry = byId<HTMLSelectElement>("expiry");
  const customDate = byId<HTMLElement>("custom-date");
  // The script reads the date in the browser's zone; the no-JS form keeps UTC.
  const dateLabel = byId<HTMLElement>("custom-date-label");
  if (dateLabel) dateLabel.textContent = "Własna data wygaśnięcia (czas lokalny)";
  const dateHint = byId<HTMLElement>("custom-date-hint");
  if (dateHint) dateHint.textContent = "Czas lokalny. Używana tylko przy wyborze „Własna data”.";
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const syncCustomDate = () => {
    if (customDate && expiry) customDate.hidden = expiry.value !== CUSTOM_EXPIRY;
  };
  expiry?.addEventListener("change", syncCustomDate);
  syncCustomDate();

  const fail = (message: string) => {
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (error) error.hidden = true;
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
    if (status) status.textContent = "Skracanie…";
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
        fail(errorText(json.error?.code ?? "unknown"));
        if (status) status.textContent = "";
      }
    } catch {
      fail(errorText("unknown"));
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
