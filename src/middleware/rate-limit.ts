import type { Context, MiddlewareHandler } from "hono";
import { apiError } from "./errors";

type RateLimitBinding = {
  [K in keyof Cloudflare.Env]: Cloudflare.Env[K] extends RateLimit ? K : never;
}[keyof Cloudflare.Env];

export const RETRY_AFTER_SECONDS = 60;

export interface RateLimitOptions<E extends { Bindings: Cloudflare.Env }> {
  /** Builds the 429 response. `Retry-After` is added when the response lacks it. */
  onLimited?: (c: Context<E>) => Response | Promise<Response>;
  /**
   * When the binding throws, warn once (without the client key) and let the request through.
   * Only for `RL_REDIRECT`: a redirect must not break because a side system fails.
   */
  failOpen?: boolean;
}

/**
 * Limits requests per key with a Rate Limiting binding. Over the limit the response is 429 with
 * `Retry-After`, a JSON `rate_limited` error unless `onLimited` builds another body. A missing
 * binding lets every request pass.
 */
export function rateLimit<E extends { Bindings: Cloudflare.Env }>(
  binding: RateLimitBinding,
  key: (c: Context<E>) => string,
  options: RateLimitOptions<E> = {},
): MiddlewareHandler<E> {
  return async (c, next) => {
    const limiter = c.env[binding] as RateLimit | undefined;
    if (limiter) {
      let success: boolean;
      try {
        ({ success } = await limiter.limit({ key: key(c) }));
      } catch (error) {
        if (!options.failOpen) throw error;
        console.warn(
          `rate limit binding ${binding} failed, letting the request through`,
          error instanceof Error ? error.message : error,
        );
        await next();
        return;
      }
      if (!success) {
        const res = options.onLimited
          ? await options.onLimited(c)
          : apiError(c, 429, "rate_limited", "Too many requests");
        if (!res.headers.has("Retry-After")) {
          res.headers.set("Retry-After", String(RETRY_AFTER_SECONDS));
        }
        return res;
      }
    }
    await next();
  };
}
