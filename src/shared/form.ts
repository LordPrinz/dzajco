// Shared by the server-rendered form and the browser script, so keep it free of runtime imports.

export const EXPIRY_PRESETS = [
  { value: "never", label: "Nigdy", ms: null },
  { value: "1h", label: "1 godzina", ms: 3_600_000 },
  { value: "1d", label: "1 dzień", ms: 86_400_000 },
  { value: "1w", label: "1 tydzień", ms: 604_800_000 },
  { value: "1m", label: "30 dni", ms: 2_592_000_000 },
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

/** True when a (punycode) host has an internationalised label; the server and the browser share this rule. */
export function hostIsIdn(hostname: string): boolean {
  return hostname.split(".").some((label) => label.startsWith("xn--"));
}

/** `example.com` is accepted as `https://example.com`; anything that already has a scheme is left alone. */
export function normalizeUrlInput(input: string): string {
  const trimmed = input.trim();
  return trimmed === "" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const FIELD_OF_ERROR: Record<string, "url" | "customName" | "expiry"> = {
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

export const ERROR_TEXT: Record<string, string> = {
  invalid_url: "To nie wygląda na poprawny adres URL.",
  url_too_long: "Adres jest za długi (maksymalnie 2048 znaków).",
  unsupported_scheme: "Dozwolone są tylko adresy http i https.",
  credentials_not_allowed: "Adres nie może zawierać nazwy użytkownika ani hasła.",
  own_host: "Nie skracamy linków do tego serwisu.",
  private_target: "Adresy prywatne i lokalne są niedozwolone.",
  blocked_target: "Ten adres jest niedozwolony.",
  invalid_body: "Formularz zawiera nieprawidłowe dane.",
  invalid_name: "Własna nazwa ma mieć od 3 do 32 liter, cyfr, znaków _ lub -.",
  name_too_long: "Własna nazwa jest za długa.",
  reserved_name: "Ta nazwa jest zarezerwowana.",
  mixed_script: "Nazwa miesza litery łacińskie z innym alfabetem.",
  id_taken: "Ta nazwa jest już zajęta.",
  invalid_expiry: "Podaj istniejącą datę wygaśnięcia.",
  expiry_in_past: "Data wygaśnięcia musi być w przyszłości.",
  expiry_too_far: "Link może wygasać najpóźniej za rok.",
  rate_limited: "Za dużo żądań. Spróbuj ponownie za minutę.",
  service_unavailable: "Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
};

export const FALLBACK_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? FALLBACK_ERROR;
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
