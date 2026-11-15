import type { MiddlewareHandler } from "hono";
import { activeEvent } from "../shared/events";
import { OG_IMAGE_PATH } from "../views/Layout";
import type { NonceVariables } from "./security-headers";

/** CF Web Analytics tokens: 32 hex characters, or the same as a dashed UUID. */
const TOKEN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

/**
 * Markup for the pieces every HTML page may carry: the seasonal event script and the CF Web Analytics
 * beacon. Both carry the per-request nonce. The clock is `new Date()`; tests freeze it with fake timers.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function extrasMarkup(nonce: string, token: string, now: Date): string {
  let html = "";
  const event = activeEvent(now);
  if (event) {
    html += `<script type="module" nonce="${nonce}" src="/assets/events.js" data-event="${event}"></script>`;
  }
  if (TOKEN.test(token)) {
    const beacon = JSON.stringify({ token });
    html += `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${escapeAttr(beacon)}' nonce="${nonce}"></script>`;
  }
  return html;
}

/** Open Graph wants an absolute image URL, and several crawlers do not resolve a relative one. */
function absoluteOgImage(html: string, origin: string): string {
  const relative = `property="og:image" content="${OG_IMAGE_PATH}"`;
  return html.replace(
    relative,
    `property="og:image" content="${escapeAttr(new URL(OG_IMAGE_PATH, origin).href)}"`,
  );
}

/**
 * Injects `extrasMarkup` before `</body>` and makes the `og:image` URL absolute in every HTML
 * response; other responses pass untouched.
 */
export function siteExtras(): MiddlewareHandler<{
  Bindings: Cloudflare.Env;
  Variables: NonceVariables;
}> {
  return async (c, next) => {
    await next();
    const type = c.res.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!type.startsWith("text/html")) return;
    const extras = extrasMarkup(c.var.nonce, c.env.CF_ANALYTICS_TOKEN, new Date());
    const html = absoluteOgImage(await c.res.text(), c.env.PUBLIC_ORIGIN);
    const at = html.lastIndexOf("</body>");
    const body = at === -1 ? html + extras : html.slice(0, at) + extras + html.slice(at);
    c.res = new Response(body, c.res);
    c.res.headers.delete("Content-Length");
    c.res.headers.delete("ETag");
  };
}
