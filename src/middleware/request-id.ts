import type { MiddlewareHandler } from "hono";

export type RequestIdVariables = { requestId: string };

/** Gives every request a fresh id (never taken from the client) in `c.var.requestId` and `X-Request-Id`. */
export function requestId(): MiddlewareHandler<{ Variables: RequestIdVariables }> {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    await next();
    c.res.headers.set("X-Request-Id", id);
  };
}
