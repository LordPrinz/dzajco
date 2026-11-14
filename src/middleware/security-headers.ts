import type { MiddlewareHandler } from "hono";

export type NonceVariables = { nonce: string };

export function htmlCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com/beacon.min.js`,
    "connect-src 'self' https://cloudflareinsights.com",
    "img-src 'self' data: https://tile.openstreetmap.org",
    "style-src 'self'",
    "frame-src https://github.com/sponsors/",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Sets the security headers from DESIGN.md by response type. HTML gets the full CSP with a fresh nonce
 * (exposed as `c.var.nonce` for inline scripts), Referrer-Policy and Permissions-Policy. JSON gets
 * `default-src 'none'`. Every response gets HSTS and `nosniff`.
 */
export function securityHeaders(): MiddlewareHandler<{ Variables: NonceVariables }> {
  return async (c, next) => {
    const nonce = newNonce();
    c.set("nonce", nonce);
    await next();
    // Responses from fetch or the cache have immutable headers; copy once so every outer layer can set them.
    c.res = new Response(c.res.body, c.res);
    const headers = c.res.headers;
    const type = headers.get("Content-Type")?.toLowerCase() ?? "";
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (type.startsWith("text/html")) {
      headers.set("Content-Security-Policy", htmlCsp(nonce));
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    } else if (type.startsWith("application/json")) {
      headers.set("Content-Security-Policy", "default-src 'none'");
    }
  };
}
