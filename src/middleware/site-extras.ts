import type { MiddlewareHandler } from "hono";
import { escapeHtml } from "../lib/html";
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
  let absolute: string;
  try {
    absolute = new URL(OG_IMAGE_PATH, origin).href;
  } catch {
    // A broken PUBLIC_ORIGIN must not take every page down; the image stays relative.
    return html;
  }
  // A function replacer, because a string would expand `$&` and `` $` `` from the origin.
  return html.replace(
    `property="og:image" content="${OG_IMAGE_PATH}"`,
    () => `property="og:image" content="${escapeHtml(absolute)}"`,
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
