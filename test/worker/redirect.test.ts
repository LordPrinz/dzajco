import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { VisitPoint, VisitSink } from "../../src/analytics/ports";
import { blockHost, insertLink } from "../../src/db/queries";
import { linkCacheKey, purgeLinkCache, redirectRoutes } from "../../src/routes/redirect";

const TARGET = "https://example.com/landing?x=1";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const CF = { country: "PL", city: "Warsaw", latitude: "52.22977", longitude: "21.01178" };

let counter = 0;
function freshId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter}`.slice(0, 32);
}

async function seedLink(id: string, extra: { target?: string; expiresAt?: number | null } = {}) {
  await insertLink(env.DB, {
    id,
    target: extra.target ?? TARGET,
    secretHash: null,
    expiresAt: extra.expiresAt ?? null,
    createdAt: Date.now(),
    isCustom: true,
  });
}

class RecordingSink implements VisitSink {
  points: VisitPoint[] = [];
  write(point: VisitPoint): void {
    this.points.push(point);
  }
}

function appWith(sink: VisitSink) {
  return new Hono<{ Bindings: Cloudflare.Env }>().route("/", redirectRoutes({ sink: () => sink }));
}

function request(
  path: string,
  init: { method?: string; ua?: string | null; ip?: string; cf?: object } = {},
): Request {
  const headers = new Headers();
  if (init.ua !== null) headers.set("user-agent", init.ua ?? BROWSER_UA);
  if (init.ip) headers.set("cf-connecting-ip", init.ip);
  return new Request(`https://dzaj.co${path}`, {
    method: init.method ?? "GET",
    headers,
    redirect: "manual",
    cf: (init.cf ?? CF) as IncomingRequestCfProperties,
  });
}

async function run(app: Hono<{ Bindings: Cloudflare.Env }>, req: Request, bindings = env) {
  const ctx = createExecutionContext();
  const res = await app.fetch(req, bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** In-memory stand-in for a Rate Limiting binding with `limit` calls per key. */
function fakeLimiter(limit: number): RateLimit {
  const counts = new Map<string, number>();
  return {
    async limit({ key }: RateLimitOptions) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= limit };
    },
  };
}

describe("GET /:id", () => {
  it("returns 302 with Location = target and no-cache, referrer headers", async () => {
    const id = freshId();
    await seedLink(id);
    const res = await run(appWith(new RecordingSink()), request(`/${id}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(TARGET);
    expect(res.headers.get("cache-control")).toBe("private, max-age=0");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("records one visit with the request.cf geo data", async () => {
    const id = freshId();
    await seedLink(id);
    const sink = new RecordingSink();
    await run(appWith(sink), request(`/${id}`));
    expect(sink.points).toEqual([
      {
        linkId: id,
        createdAt: expect.any(Number),
        country: "PL",
        city: "Warsaw",
        lat: 52.22977,
        lon: 21.01178,
      },
    ]);
  });

  it("resolves the response before the sink promise settles", async () => {
    const id = freshId();
    await seedLink(id);
    let release!: () => void;
    let settled = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    }).then(() => {
      settled = true;
    });
    const app = appWith({ write: () => pending });
    const ctx = createExecutionContext();
    const res = await app.fetch(request(`/${id}`), env, ctx);
    expect(res.status).toBe(302);
    expect(settled).toBe(false);
    release();
    await waitOnExecutionContext(ctx);
    expect(settled).toBe(true);
  });

  it("still returns 302 when the sink throws or rejects", async () => {
    const id = freshId();
    await seedLink(id);
    const throwing = appWith({
      write: () => {
        throw new Error("boom");
      },
    });
    const rejecting = appWith({ write: () => Promise.reject(new Error("boom")) });
    expect((await run(throwing, request(`/${id}`))).status).toBe(302);
    expect((await run(rejecting, request(`/${id}`))).status).toBe(302);
  });

  it("writes 0 visits for a bot User-Agent, a missing User-Agent and HEAD", async () => {
    const id = freshId();
    await seedLink(id);
    const sink = new RecordingSink();
    const app = appWith(sink);
    const bot = await run(app, request(`/${id}`, { ua: "Googlebot/2.1" }));
    const noUa = await run(app, request(`/${id}`, { ua: null }));
    const head = await run(app, request(`/${id}`, { method: "HEAD" }));
    expect([bot.status, noUa.status, head.status]).toEqual([302, 302, 302]);
    expect(head.headers.get("location")).toBe(TARGET);
    expect(sink.points).toHaveLength(0);
  });

  it("returns 404 for an unknown id and for ids that cannot be links", async () => {
    const app = appWith(new RecordingSink());
    expect((await run(app, request(`/${freshId()}`))).status).toBe(404);
    expect((await run(app, request(`/${"a".repeat(65)}`))).status).toBe(404);
    expect((await run(app, request("/a%2Fb"))).status).toBe(404);
    expect((await run(app, request("/a%07b"))).status).toBe(404);
  });

  it("404 and 410 pages are not cached and carry nosniff", async () => {
    const expired = freshId();
    await seedLink(expired, { expiresAt: Date.now() - 1000 });
    const app = appWith(new RecordingSink());
    for (const res of [
      await run(app, request(`/${freshId()}`)),
      await run(app, request(`/${expired}`)),
    ]) {
      expect([404, 410]).toContain(res.status);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("redirects an imported v2 name outside the new name policy (space)", async () => {
    await seedLink("my link");
    const res = await run(appWith(new RecordingSink()), request("/my%20link"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(TARGET);
  });

  it("answers 404, not a redirect, for a stored non-http(s) target", async () => {
    const id = freshId();
    await seedLink(id, { target: "javascript:alert(1)" });
    const sink = new RecordingSink();
    const res = await run(appWith(sink), request(`/${id}`));
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(sink.points).toHaveLength(0);
  });

  it("never puts CR or LF from a stored target into Location", async () => {
    const id = freshId();
    await seedLink(id, { target: "https://example.com/a\r\nSet-Cookie: x=1" });
    const res = await run(appWith(new RecordingSink()), request(`/${id}`));
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toMatch(/[\r\n]/);
    expect(location.startsWith("https://example.com/")).toBe(true);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("does not cache 404s: a link created after a miss redirects at once", async () => {
    const id = freshId();
    const app = appWith(new RecordingSink());
    expect((await run(app, request(`/${id}`))).status).toBe(404);
    await seedLink(id);
    expect((await run(app, request(`/${id}`))).status).toBe(302);
  });

  it("returns 410 for an expired link and removes it lazily", async () => {
    const id = freshId();
    await seedLink(id, { expiresAt: Date.now() - 1000 });
    const sink = new RecordingSink();
    const res = await run(appWith(sink), request(`/${id}`));
    expect(res.status).toBe(410);
    expect(sink.points).toHaveLength(0);
    const row = await env.DB.prepare("SELECT id FROM links WHERE id = ?").bind(id).first();
    expect(row).toBeNull();
  });

  it("returns 410 for an expired record also on a cache hit (record carries expiresAt)", async () => {
    const id = freshId();
    // Only the cache knows this link: a 410 proves the cached record was read and checked.
    await caches.default.put(
      linkCacheKey(id),
      Response.json(
        { id, target: TARGET, expiresAt: Date.now() - 1000, createdAt: 1700, blocked: false },
        { headers: { "cache-control": "max-age=60" } },
      ),
    );
    const res = await run(appWith(new RecordingSink()), request(`/${id}`));
    expect(res.status).toBe(410);
  });

  it("writes the link's created_at into the visit", async () => {
    const id = freshId();
    await seedLink(id);
    const row = await env.DB.prepare("SELECT created_at AS createdAt FROM links WHERE id = ?")
      .bind(id)
      .first<{ createdAt: number }>();
    const sink = new RecordingSink();
    await run(appWith(sink), request(`/${id}`));
    expect(sink.points[0]?.createdAt).toBe(row?.createdAt);
  });

  it("treats a cached record without createdAt as a miss and reads D1", async () => {
    const id = freshId();
    await seedLink(id);
    await caches.default.put(
      linkCacheKey(id),
      Response.json(
        { id, target: "https://stale.example/", expiresAt: null, blocked: false },
        { headers: { "cache-control": "max-age=60" } },
      ),
    );
    const res = await run(appWith(new RecordingSink()), request(`/${id}`));
    expect(res.headers.get("location")).toBe(TARGET);
  });

  it("serves a cache hit with 0 D1 reads, blocked flag included", async () => {
    const id = freshId();
    await caches.default.put(
      linkCacheKey(id),
      Response.json(
        { id, target: TARGET, expiresAt: null, createdAt: 1700, blocked: true },
        { headers: { "cache-control": "max-age=60" } },
      ),
    );
    const failingDb = {
      prepare() {
        throw new Error("D1 must not be read on a cache hit");
      },
    } as unknown as D1Database;
    const res = await run(appWith(new RecordingSink()), request(`/${id}`), {
      ...env,
      DB: failingDb,
    });
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("Ten link został wyłączony");
  });

  it("returns 410 'link disabled' for a target on a blocked host", async () => {
    const id = freshId();
    const host = `${id.toLowerCase()}.example.net`;
    await seedLink(id, { target: `https://sub.${host}/x` });
    await blockHost(env.DB, host, "test", Date.now());
    const sink = new RecordingSink();
    const res = await run(appWith(sink), request(`/${id}`));
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("Ten link został wyłączony");
    expect(sink.points).toHaveLength(0);
  });

  it("returns 410 for a link whose host is blocked after creation, once the cache entry is gone", async () => {
    const id = freshId();
    const host = `${id.toLowerCase()}.example.org`;
    await seedLink(id, { target: `https://${host}/x` });
    const app = appWith(new RecordingSink());
    expect((await run(app, request(`/${id}`))).status).toBe(302);

    await blockHost(env.DB, host, "abuse", Date.now());
    // The 302 is still cached (at most 60 s); purging stands in for the TTL running out.
    expect((await run(app, request(`/${id}`))).status).toBe(302);
    await purgeLinkCache(id);
    const res = await run(app, request(`/${id}`));
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("Ten link został wyłączony");
  });

  it("shows an escaped report-abuse link on 404 and 410 pages only when ABUSE_EMAIL is set", async () => {
    const app = appWith(new RecordingSink());
    const id = freshId();
    await seedLink(id, { expiresAt: Date.now() - 1000 });
    const withMail = { ...env, ABUSE_EMAIL: "abuse@dzaj.co" } as unknown as typeof env;

    const gone = await (await run(app, request(`/${id}`), withMail)).text();
    expect(gone).toContain(`href="mailto:abuse@dzaj.co?subject=Report%20abuse%3A%20link%20${id}"`);
    const missing = await (await run(app, request("/nope-missing"), withMail)).text();
    expect(missing).toContain('href="mailto:abuse@dzaj.co?subject=Report%20abuse"');

    const id2 = freshId();
    await seedLink(id2, { expiresAt: Date.now() - 1000 });
    expect(await (await run(app, request(`/${id2}`))).text()).not.toContain("mailto:");
  });

  it("caches the record, and purgeLinkCache clears it in this colo", async () => {
    const id = freshId();
    await seedLink(id);
    const app = appWith(new RecordingSink());
    expect((await run(app, request(`/${id}`))).status).toBe(302);
    await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    // Still cached: the record is served without D1.
    expect((await run(app, request(`/${id}`))).status).toBe(302);
    await purgeLinkCache(id);
    expect((await run(app, request(`/${id}`))).status).toBe(404);
  });

  it("caches a record no longer than the time left until expiry", async () => {
    const id = freshId();
    await seedLink(id, { expiresAt: Date.now() + 1500 });
    const app = appWith(new RecordingSink());
    expect((await run(app, request(`/${id}`))).status).toBe(302);
    const cached = await caches.default.match(linkCacheKey(id));
    const maxAge = Number(/max-age=(\d+)/.exec(cached?.headers.get("cache-control") ?? "")?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(1);
    expect(maxAge).toBeLessThanOrEqual(2);
  });

  it("caps the cache TTL at 60 s", async () => {
    const id = freshId();
    await seedLink(id);
    await run(appWith(new RecordingSink()), request(`/${id}`));
    const cached = await caches.default.match(linkCacheKey(id));
    expect(cached?.headers.get("cache-control")).toBe("max-age=60");
  });
});

describe("rate limit (RL_REDIRECT)", () => {
  it("answers the 121st GET from one IP with 429 and Retry-After; another IP still gets 302", async () => {
    const id = freshId();
    await seedLink(id);
    const app = appWith(new RecordingSink());
    const bindings = { ...env, RL_REDIRECT: fakeLimiter(120) };
    for (let i = 0; i < 120; i += 1) {
      const res = await run(app, request(`/${id}`, { ip: "203.0.113.9" }), bindings);
      expect(res.status).toBe(302);
    }
    const limited = await run(app, request(`/${id}`, { ip: "203.0.113.9" }), bindings);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    const other = await run(app, request(`/${id}`, { ip: "198.51.100.1" }), bindings);
    expect(other.status).toBe(302);
  });

  it("limits requests without a usable cf-connecting-ip together under one key", async () => {
    const id = freshId();
    await seedLink(id);
    const app = appWith(new RecordingSink());
    const bindings = { ...env, RL_REDIRECT: fakeLimiter(1) };
    expect((await run(app, request(`/${id}`), bindings)).status).toBe(302);
    const second = await run(app, request(`/${id}`, { ip: "garbage" }), bindings);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
  });

  it("is a no-op when the binding is missing", async () => {
    const id = freshId();
    await seedLink(id);
    const { RL_REDIRECT: _unused, ...withoutLimiter } = env;
    const res = await run(
      appWith(new RecordingSink()),
      request(`/${id}`, { ip: "203.0.113.9" }),
      withoutLimiter as Cloudflare.Env,
    );
    expect(res.status).toBe(302);
  });
});

describe("legacy redirects", () => {
  it("GET /dzajapi returns 301 to /docs/api", async () => {
    const res = await run(appWith(new RecordingSink()), request("/dzajapi"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/docs/api");
  });

  it("GET /:id/info returns 301 to /:id/stats", async () => {
    const res = await run(appWith(new RecordingSink()), request("/abc1234/info"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/abc1234/stats");
  });

  it("GET /:id/info keeps a non-ASCII name encoded", async () => {
    const res = await run(appWith(new RecordingSink()), request("/%C5%BCaba/info"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/%C5%BCaba/stats");
  });
});

describe("mounted worker", () => {
  it("keeps /healthz ahead of /:id", async () => {
    const res = await exports.default.fetch("https://dzaj.co/healthz");
    expect(res.status).toBe(200);
  });

  it("serves GET /:id through the default export", async () => {
    const id = freshId();
    await seedLink(id);
    const res = await exports.default.fetch(
      new Request(`https://dzaj.co/${id}`, { redirect: "manual" }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(TARGET);
  });

  it("does not treat reserved names as link ids", async () => {
    const res = await exports.default.fetch("https://dzaj.co/api");
    expect(res.status).toBe(404);
  });
});
