const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|fetch|monitor|uptime|headless|lighthouse|curl\/|wget|python-requests|python-urllib|go-http-client|java\/|okhttp|axios|libwww|scrapy|httpclient|postmanruntime/i;

/** An empty or missing User-Agent counts as a bot: real browsers always send one. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}
