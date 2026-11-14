import type { MiddlewareHandler } from "hono";

/**
 * CORS for the public read API: `GET` and `HEAD` get `Access-Control-Allow-Origin: *`, the `Origin`
 * header is never reflected and credentials are never allowed. A preflight is answered only for `GET`,
 * so browsers on other sites cannot send `POST` or `DELETE`.
 */
export function readOnlyCors(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") {
      if (c.req.header("Access-Control-Request-Method") !== "GET") {
        return c.body(null, 204);
      }
      return c.body(null, 204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Max-Age": "86400",
      });
    }
    await next();
    // Sets the header in place: every API response is built with c.json, so its headers are mutable.
    if (c.req.method === "GET" || c.req.method === "HEAD") {
      c.res.headers.set("Access-Control-Allow-Origin", "*");
    }
  };
}
