import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { expect, it } from "vitest";
import { rateLimit } from "../../src/middleware/rate-limit";

const denyAll: RateLimit = { limit: async () => ({ success: false }) };

it("answers with a JSON rate_limited error and Retry-After by default", async () => {
  const app = new Hono<{ Bindings: Cloudflare.Env }>().get(
    "/x",
    rateLimit("RL_STATS", () => "k"),
    (c) => c.text("ok"),
  );
  const res = await app.fetch(new Request("https://dzaj.co/x"), { ...env, RL_STATS: denyAll });
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("60");
  expect(await res.json()).toEqual({
    error: { code: "rate_limited", message: "Too many requests" },
  });
});
