import { type Lang, LOCALE } from "../shared/lang";

/** A date and time in the page language, always in UTC and labelled so. */
export function formatUtc(date: Date | number | string, lang: Lang): string {
  return `${new Date(date).toLocaleString(LOCALE[lang], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}
