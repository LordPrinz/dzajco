// Shared by the server-rendered form and the browser script, so keep it free of runtime imports.

import type { SharedText } from "./text";

/** Labels live in `SharedText.expiry` under the same `value`. */
export const EXPIRY_PRESETS = [
  { value: "never", ms: null },
  { value: "1h", ms: 3_600_000 },
  { value: "1d", ms: 86_400_000 },
  { value: "1w", ms: 604_800_000 },
  { value: "1m", ms: 2_592_000_000 },
] as const;

export const CUSTOM_EXPIRY = "custom";

export type ExpiryChoice = { expiry: string; customDate: string };

/**
 * Turns the form's expiry choice into the `expiresAt` of the API. A date typed into a
 * `datetime-local` field has no zone, so `zone` says how to read it: `"Z"` on the server (the field is
 * labelled UTC), `""` in the browser (the local zone applies), or a fixed offset such as `"+02:00"`.
 */
export function expiresAtFrom(
  { expiry, customDate }: ExpiryChoice,
  now: number,
  zone: string,
): string | null {
  if (expiry === "" || expiry === "never") return null;
  if (expiry === CUSTOM_EXPIRY) {
    // An empty string would read as "no expiry" to the form schema, so pass a value the API rejects.
    if (customDate === "") return `invalid:${CUSTOM_EXPIRY}`;
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(customDate)
      ? `${customDate}:00${zone}`
      : customDate;
    if (zone === "Z") return withSeconds;
    const at = new Date(withSeconds);
    return Number.isNaN(at.getTime()) ? withSeconds : at.toISOString();
  }
  const preset = EXPIRY_PRESETS.find((p) => p.value === expiry);
  // An unknown preset is passed on as a value the API rejects.
  return preset?.ms ? new Date(now + preset.ms).toISOString() : `invalid:${expiry}`;
}

/** `host:port` looks like a scheme to the check below, so it is told apart by a dotted host or `localhost` before the colon and digits after it. */
const HOST_WITH_PORT = /^(?:localhost|[^\s/?#:@.]+(?:\.[^\s/?#:@.]+)+):\d+(?:[/?#]|$)/i;

/** `example.com` is accepted as `https://example.com`; anything that already has a scheme is left alone. */
export function normalizeUrlInput(input: string): string {
  const trimmed = input.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !HOST_WITH_PORT.test(trimmed);
  return trimmed === "" || hasScheme ? trimmed : `https://${trimmed}`;
}

/**
 * Errors the form can name before the URL policy runs. Typing a single word adds `https://` in front
 * and makes a host without a dot, which the policy would call private; for someone who typed
 * `notaurl` that is the wrong message, so the form says the link is not valid instead. A word with a
 * scheme (`https://intranet`) still goes to the policy.
 */
export function formUrlError(input: string): "empty_url" | "invalid_url" | null {
  const trimmed = input.trim();
  if (trimmed === "") return "empty_url";
  // An IPv6 literal such as `[::1]` has no dot either; the URL policy names it properly.
  if (normalizeUrlInput(trimmed) === trimmed || trimmed.startsWith("[")) return null;
  const host = trimmed.split(/[/?#:]/, 1)[0] ?? "";
  return host.includes(".") || host.toLowerCase() === "localhost" ? null : "invalid_url";
}

export const FIELD_OF_ERROR: Record<string, "url" | "customName" | "expiry"> = {
  empty_url: "url",
  invalid_url: "url",
  url_too_long: "url",
  unsupported_scheme: "url",
  credentials_not_allowed: "url",
  own_host: "url",
  private_target: "url",
  blocked_target: "url",
  invalid_body: "url",
  invalid_name: "customName",
  name_too_long: "customName",
  reserved_name: "customName",
  mixed_script: "customName",
  id_taken: "customName",
  invalid_expiry: "expiry",
  expiry_in_past: "expiry",
  expiry_too_far: "expiry",
};

/** The message for an error code in the page language; unknown codes get the generic one. */
export function errorText(code: string, text: SharedText): string {
  return (text.errors as Record<string, string | undefined>)[code] ?? text.fallbackError;
}

/** `links-history` entry, same shape as v2 (`createdAt` is the ISO form of v2's `Date`). */
export interface HistoryEntry {
  id: string;
  url: string;
  expire: string;
  createdAt: string;
  secretKey?: string;
}

export const HISTORY_KEY = "links-history";
