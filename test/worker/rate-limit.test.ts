import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { expect, it, vi } from "vitest";
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

const throwing: RateLimit = {
  limit: async () => {
    throw new Error("binding down");
  },
};

it("propagates a binding error by default", async () => {
  const app = new Hono<{ Bindings: Cloudflare.Env }>().get(
    "/x",
    rateLimit("RL_STATS", () => "k"),
    (c) => c.text("ok"),
  );
  const res = await app.fetch(new Request("https://dzaj.co/x"), { ...env, RL_STATS: throwing });
  expect(res.status).toBe(500);
});

it("with failOpen warns per failure without the key and lets the request through", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const app = new Hono<{ Bindings: Cloudflare.Env }>().get(
      "/x",
      rateLimit("RL_REDIRECT", () => "secret-client-key", { failOpen: true }),
      (c) => c.text("ok"),
    );
    const res = await app.fetch(new Request("https://dzaj.co/x"), {
      ...env,
      RL_REDIRECT: throwing,
    });
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-client-key");
  } finally {
    warn.mockRestore();
  }
});

it("with failOpen still limits when the binding answers", async () => {
  const app = new Hono<{ Bindings: Cloudflare.Env }>().get(
    "/x",
    rateLimit("RL_REDIRECT", () => "k", { failOpen: true }),
    (c) => c.text("ok"),
  );
  const res = await app.fetch(new Request("https://dzaj.co/x"), { ...env, RL_REDIRECT: denyAll });
  expect(res.status).toBe(429);
});
