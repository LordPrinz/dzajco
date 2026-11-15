// Shared by the server and the browser scripts, so keep it free of runtime imports.

export const LANGS = ["pl", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";
export const LANG_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** Locale for dates and numbers. British English writes dates day first, closer to Polish habits. */
export const LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-GB" };

export function parseLang(value: string | null | undefined): Lang | null {
  return LANGS.find((lang) => lang === value?.trim().toLowerCase()) ?? null;
}

/**
 * The supported language the visitor ranks highest in `Accept-Language`, or null. `pl-PL` counts as
 * `pl`; entries with `q=0` are refused, and ties keep the header's order.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q === undefined ? 1 : Number(q.slice(2));
      return {
        lang: parseLang(tag.split("-")[0]),
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((entry) => entry.lang !== null && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked[0]?.lang ?? null;
}

export interface LangHints {
  /** `?lang=` on the URL: a link that names its language, used by the `hreflang` alternates. */
  query?: string | null;
  /** The `lang` cookie set by the language switch. */
  cookie?: string | null;
  /** `request.cf.country`, two letters. */
  country?: string | null;
  acceptLanguage?: string | null;
}

/**
 * Picks the page language: the URL's `?lang=`, then the visitor's own choice (cookie), then Polish for
 * visitors in Poland, then `Accept-Language`, then English.
 */
export function resolveLang({ query, cookie, country, acceptLanguage }: LangHints): Lang {
  return (
    parseLang(query) ??
    parseLang(cookie) ??
    (country?.toUpperCase() === "PL" ? "pl" : null) ??
    langFromAcceptLanguage(acceptLanguage) ??
    DEFAULT_LANG
  );
}
