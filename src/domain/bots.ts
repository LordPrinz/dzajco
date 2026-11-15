// `(?<!cu)bot` keeps the broad `bot` match but spares CUBOT phones. Word boundaries would not
// help, since CUBOT is followed by a space like any crawler name. Lookbehind runs in V8 and JSC.
const BOT_PATTERN =
  /(?<!cu)bot|crawl|spider|slurp|facebookexternalhit|preview|fetch|monitor|uptime|headless|lighthouse|curl\/|wget|python-requests|python-urllib|go-http-client|java\/|okhttp|axios|libwww|scrapy|httpclient|postmanruntime/i;

/** An empty or missing User-Agent counts as a bot: real browsers always send one. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}
