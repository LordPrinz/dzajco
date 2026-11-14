// Pure logic of the history page, shared by the browser script and the bun tests. Keep it free of
// DOM and runtime imports.

import { HISTORY_KEY, type HistoryEntry } from "./form";

export { HISTORY_KEY, type HistoryEntry };

export interface DeleteRequest {
  path: string;
  init: { method: "DELETE"; headers: { Authorization: string } };
}

/** What to do with a history entry after `DELETE /api/v1/links/:id` answered with `status`. */
export type DeleteOutcome = "removed" | "rate_limited" | "key_rejected" | "failed";

/** The page renders at most this many entries; storage keeps all of them. */
export const MAX_RENDERED = 1000;

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Reads the stored `links-history` (the v2 shape: id, url, expire, createdAt and an optional
 * secretKey). Anything that is not valid JSON, not an array or not an entry shape is dropped, so a
 * damaged value never breaks the page.
 */
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: HistoryEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = text(record.id);
    const url = text(record.url);
    if (id === null || url === null) continue;
    const entry: HistoryEntry = {
      id,
      url,
      expire: text(record.expire) ?? "never",
      createdAt: text(record.createdAt) ?? "",
    };
    const secretKey = text(record.secretKey);
    if (secretKey !== null) entry.secretKey = secretKey;
    entries.push(entry);
  }
  return entries;
}

/** An entry expires when its `expire` is a date in the past; `"never"` and unreadable dates do not. */
export function isExpired(entry: HistoryEntry, now: number): boolean {
  if (entry.expire === "never") return false;
  const at = Date.parse(entry.expire);
  return !Number.isNaN(at) && at <= now;
}

/** Newest first. Entries without a readable date keep their order at the end. */
export function newestFirst(entries: readonly HistoryEntry[]): HistoryEntry[] {
  const time = (entry: HistoryEntry) => {
    const at = Date.parse(entry.createdAt);
    return Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at;
  };
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => time(b.entry) - time(a.entry) || b.index - a.index)
    .map(({ entry }) => entry);
}

/** Only entries saved with their secret key can be deleted; the others are read-only. */
export function canDelete(entry: HistoryEntry): boolean {
  return entry.secretKey !== undefined && entry.secretKey !== "";
}

/** The request that deletes the link of `entry`; null for a read-only entry. The key goes in the header only. */
export function buildDeleteRequest(entry: HistoryEntry): DeleteRequest | null {
  if (entry.secretKey === undefined || entry.secretKey === "") return null;
  return {
    path: `/api/v1/links/${encodeURIComponent(entry.id)}`,
    init: { method: "DELETE", headers: { Authorization: `Bearer ${entry.secretKey}` } },
  };
}

/** 204 means deleted and 404 means it is already gone (expired or removed elsewhere): both drop the entry. */
export function deleteOutcome(status: number): DeleteOutcome {
  if (status === 204 || status === 404) return "removed";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 403) return "key_rejected";
  return "failed";
}

/** The entries to draw: newest first, at most `MAX_RENDERED`. */
export function visibleEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return newestFirst(entries).slice(0, MAX_RENDERED);
}

export function removeEntry(entries: readonly HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function shortUrl(origin: string, id: string): string {
  return `${origin}/${encodeURIComponent(id)}`;
}

export function statsPath(id: string): string {
  return `/${encodeURIComponent(id)}/stats`;
}
