import { DEFAULT_LANG, type Lang, LOCALE, parseLang } from "../../shared/lang";
import { SHARED_TEXT, type SharedText } from "../../shared/text";

/** The language the server rendered the page in, from `<html lang>`. */
export function pageLang(): Lang {
  return parseLang(document.documentElement.lang) ?? DEFAULT_LANG;
}

export function pageText(): SharedText {
  return SHARED_TEXT[pageLang()];
}

export function pageLocale(): string {
  return LOCALE[pageLang()];
}
