const FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" };

/** A date and time in the viewer's time zone. Returns `fallback` when `value` is not a date. */
export function formatLocal(value: Date | number | string, locale: string, fallback = ""): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? fallback : at.toLocaleString(locale, FORMAT);
}

interface TimeLike {
  dateTime: string;
  textContent: string | null;
}

/** Rewrites the server's UTC text of every `<time datetime>` under `root` into the viewer's local time. */
export function localizeTimes(
  root: { querySelectorAll(selector: string): Iterable<TimeLike> },
  locale: string,
): void {
  for (const time of root.querySelectorAll("time[datetime]")) {
    time.textContent = formatLocal(time.dateTime, locale, time.textContent ?? "");
  }
}
