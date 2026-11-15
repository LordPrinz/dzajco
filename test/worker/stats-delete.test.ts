import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshCacheKey } from "../../src/analytics/fresh";
import type { RollupCursor } from "../../src/analytics/ports";
import { blockHost, insertLink } from "../../src/db/queries";
import { hashSecret } from "../../src/domain/secret";
import worker from "../../src/index";
import { FakeAe, type FakePoint } from "./fake-ae";

const PEPPER = "stats-test-pepper";
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const allowAll: RateLimit = { limit: async () => ({ success: true }) };
const D = "2026-11-10";
const AT_D = Date.parse(`${D}T12:00:00Z`);
const AT_D1 = Date.parse("2026-11-11T08:00:00Z");
const CURSOR: RollupCursor = { day: D, offset: 0 };
const WRONG_KEY = "AAAAAAAAAAAAAAAAAAAAAA";

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

function testEnv(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return {
    ...env,
    SECRET_PEPPER_V1: PEPPER,
    CF_ACCOUNT_ID: ACCOUNT as "",
    CF_AE_TOKEN: "ae-token",
    RL_CREATE: allowAll,
    RL_REDIRECT: allowAll,
    RL_DELETE: allowAll,
    RL_STATS: allowAll,
    ...overrides,
  };
}

async function call(req: Request, bindings: Cloudflare.Env = testEnv()): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://dzaj.co${path}`, { redirect: "manual", ...init });
}

function del(id: string, headers: Record<string, string> = {}, body?: string): Request {
  return request(`/api/v1/links/${encodeURIComponent(id)}`, { method: "DELETE", headers, body });
}

function stats(id: string, headers: Record<string, string> = {}): Request {
  return request(`/api/v1/links/${encodeURIComponent(id)}/stats`, { headers });
}

async function create(
  url = "https://example.com/stats",
): Promise<{ id: string; key: string; createdAt: number }> {
  const res = await call(
    request("/api/v1/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string; secretKey: string };
  const row = await env.DB.prepare("SELECT created_at AS createdAt FROM links WHERE id = ?")
    .bind(body.id)
    .first<{ createdAt: number }>();
  return { id: body.id, key: body.secretKey, createdAt: row?.createdAt ?? 0 };
}

async function linkExists(id: string): Promise<boolean> {
  return (await env.DB.prepare("SELECT 1 FROM links WHERE id = ?").bind(id).first()) !== null;
}

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

async function setCursor(cursor: RollupCursor): Promise<void> {
  await env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('rollup_cursor', ?)")
    .bind(JSON.stringify(cursor))
    .run();
  await caches.default.delete(freshCacheKey(cursor));
}

async function addStats(
  id: string,
  rows: { country: string; city: string; lat?: number; lon?: number; visits: number }[],
): Promise<void> {
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        "INSERT INTO link_stats (link_id, country, city, lat, lon, visits) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(id, r.country, r.city, r.lat ?? null, r.lon ?? null, r.visits),
    ),
  );
}

function point(
  link: { id: string; createdAt: number },
  p: Omit<FakePoint, "linkId" | "createdAt">,
): FakePoint {
  return { linkId: link.id, createdAt: link.createdAt, ...p };
}

type StatsBody = {
  visits: number;
  countries: { code: string; visits: number }[];
  cities?: {
    country: string;
    city: string;
    lat: number | null;
    lon: number | null;
    visits: number;
  }[];
  partial: boolean;
};

let ae: FakeAe;

beforeEach(async () => {
  ae = new FakeAe();
  vi.spyOn(globalThis, "fetch").mockImplementation(ae.fetch);
  await setCursor(CURSOR);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DELETE /api/v1/links/:id", () => {
  it("returns 400 without an Authorization header and the link stays", async () => {
    const { id } = await create();
    const res = await call(del(id));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_key");
    expect(await linkExists(id)).toBe(true);
  });

  it("S1: an object as key returns 400 and the link stays", async () => {
    const { id } = await create();
    const body = JSON.stringify({ secretKey: { $ne: null } });
    const asBody = await call(del(id, { "content-type": "application/json" }, body));
    expect(asBody.status).toBe(400);
    const asHeader = await call(del(id, { authorization: "Bearer [object Object]" }));
    expect(asHeader.status).toBe(400);
    const asJsonHeader = await call(del(id, { authorization: `Bearer {"$ne":null}` }));
    expect(asJsonHeader.status).toBe(400);
    expect(await linkExists(id)).toBe(true);
  });

  it("deletes a link imported from v2 whose key is a 12 char nanoid", async () => {
    const id = `legacy${Date.now().toString(36)}`;
    const legacyKey = "Ab3_-xYz09Qw";
    expect(legacyKey).toHaveLength(12);
    await insertLink(env.DB, {
      id,
      target: "https://example.com/legacy",
      secretHash: await hashSecret(legacyKey, { version: 1, peppers: { 1: PEPPER } }),
      expiresAt: null,
      createdAt: Date.now(),
      isCustom: true,
    });
    const wrong = await call(del(id, { authorization: "Bearer Ab3_-xYz09Qx" }));
    expect(wrong.status).toBe(403);
    expect(await linkExists(id)).toBe(true);
    const ok = await call(del(id, { authorization: `Bearer ${legacyKey}` }));
    expect(ok.status).toBe(204);
    expect(await linkExists(id)).toBe(false);
  });

  it("returns 403 for a wrong key and the link stays", async () => {
    const { id } = await create();
    const res = await call(del(id, { authorization: `Bearer ${WRONG_KEY}` }));
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("forbidden");
    expect(await linkExists(id)).toBe(true);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await call(del("nope-unknown-id", { authorization: `Bearer ${WRONG_KEY}` }));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("deletes with the right key: 204, then GET /:id is 404 in the same colo (cache purged)", async () => {
    const { id, key } = await create();
    expect((await call(request(`/${id}`))).status).toBe(302);

    const res = await call(del(id, { authorization: `Bearer ${key}` }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await linkExists(id)).toBe(false);

    expect((await call(request(`/${id}`))).status).toBe(404);
    expect((await call(request(`/api/v1/links/${id}`))).status).toBe(404);
  });

  it("still answers 204 when the cache purge throws", async () => {
    const { id, key } = await create();
    const purge = vi.spyOn(caches.default, "delete").mockRejectedValue(new Error("cache down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await call(del(id, { authorization: `Bearer ${key}` }));
      expect(res.status).toBe(204);
      expect(await linkExists(id)).toBe(false);
    } finally {
      purge.mockRestore();
      warn.mockRestore();
    }
  });

  it("accepts the Bearer scheme in any case", async () => {
    const { id, key } = await create();
    expect((await call(del(id, { authorization: `bEaReR ${key}` }))).status).toBe(204);
  });

  it("deletes the link's stats with it", async () => {
    const { id, key } = await create();
    await addStats(id, [{ country: "PL", city: "Warsaw", visits: 3 }]);
    expect((await call(del(id, { authorization: `Bearer ${key}` }))).status).toBe(204);
    const row = await env.DB.prepare("SELECT 1 FROM link_stats WHERE link_id = ?").bind(id).first();
    expect(row).toBeNull();
  });

  it("does not answer a cross-origin preflight for DELETE", async () => {
    const res = await call(
      request("/api/v1/links/abc", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "DELETE" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("the 11th DELETE from one IP returns 429 with Retry-After (RL_DELETE)", async () => {
    const bindings = testEnv({ RL_DELETE: fakeLimiter(10) });
    const headers = { authorization: `Bearer ${WRONG_KEY}`, "cf-connecting-ip": "198.51.100.7" };
    for (let i = 0; i < 10; i += 1) {
      expect((await call(del("nope-unknown-id", headers), bindings)).status).toBe(404);
    }
    const limited = await call(del("nope-unknown-id", headers), bindings);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});

describe("GET /api/v1/links/:id/stats", () => {
  async function linkWithStats(): Promise<{ id: string; key: string; createdAt: number }> {
    const link = await create();
    await addStats(link.id, [
      { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 2 },
      { country: "DE", city: "Berlin", lat: 52.52, lon: 13.4, visits: 4 },
      { country: "US", city: "", visits: 1 },
    ]);
    ae.points = [
      point(link, {
        country: "PL",
        city: "Warsaw",
        lat: 52.2297,
        lon: 21.0122,
        at: AT_D,
        sample: 3,
      }),
      point(link, { country: "PL", city: "Krakow", lat: 50.06143, lon: 19.93658, at: AT_D1 }),
      point(
        { id: "other-link", createdAt: 1 },
        { country: "FR", city: "Paris", lat: 48.85, lon: 2.35, at: AT_D1 },
      ),
    ];
    return link;
  }

  it("without a key: visits, countries and partial only, never a city or coordinate", async () => {
    const { id } = await linkWithStats();
    const res = await call(stats(id));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    const text = await res.text();
    const body = JSON.parse(text) as StatsBody;
    expect(Object.keys(body).sort()).toEqual(["countries", "partial", "visits"]);
    expect(body).toEqual({
      visits: 11,
      countries: [
        { code: "PL", visits: 6 },
        { code: "DE", visits: 4 },
        { code: "US", visits: 1 },
      ],
      partial: false,
    });
    for (const leak of ["Warsaw", "Krakow", "Berlin", "Paris", "lat", "lon", "cities", "52."]) {
      expect(text).not.toContain(leak);
    }
  });

  it("with the right key: cities with coordinates rounded to at most 2 decimals, no-store", async () => {
    const { id, key } = await linkWithStats();
    const res = await call(stats(id, { authorization: `Bearer ${key}` }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as StatsBody;
    expect(body.visits).toBe(11);
    expect(body.partial).toBe(false);
    expect(body.cities).toEqual([
      { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 5 },
      { country: "DE", city: "Berlin", lat: 52.52, lon: 13.4, visits: 4 },
      { country: "PL", city: "Krakow", lat: 50.06, lon: 19.94, visits: 1 },
    ]);
    for (const city of body.cities ?? []) {
      for (const coord of [city.lat, city.lon]) {
        expect(String(coord).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
      }
    }
  });

  it("accepts the Bearer scheme in any case", async () => {
    const { id, key } = await linkWithStats();
    const body = (await (
      await call(stats(id, { authorization: `bearer ${key}` }))
    ).json()) as StatsBody;
    expect(body.cities).toBeDefined();
  });

  it.each([
    ["a wrong key", `Bearer ${WRONG_KEY}`],
    ["a malformed key", "Bearer [object Object]"],
    ["another scheme", "Basic dXNlcjpwYXNz"],
    ["an empty header", ""],
  ])("returns 403 for %s and never falls back to the public view", async (_name, header) => {
    const { id } = await linkWithStats();
    const res = await call(stats(id, { authorization: header }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: { code: "forbidden", message: expect.any(String) } });
    expect(body).not.toHaveProperty("visits");
    expect(body).not.toHaveProperty("countries");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await call(stats("nope-unknown-id"));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("returns 410 expired for an expired link", async () => {
    const id = `exp${Date.now().toString(36)}`;
    await insertLink(env.DB, {
      id,
      target: "https://example.com",
      secretHash: null,
      expiresAt: Date.now() - 1000,
      createdAt: Date.now() - 5000,
      isCustom: true,
    });
    const res = await call(stats(id));
    expect(res.status).toBe(410);
    expect(await errorCode(res)).toBe("expired");
  });

  it("returns 410 link_disabled when the target host is blocked", async () => {
    const { id } = await create("https://stats-blocked.example/x");
    await blockHost(env.DB, "stats-blocked.example", null, Date.now());
    const res = await call(stats(id));
    expect(res.status).toBe(410);
    expect(await errorCode(res)).toBe("link_disabled");
  });

  it("adds only fresh rows after the cursor offset, so nothing is counted twice", async () => {
    const link = await create();
    const { id, key } = link;
    // The rollup already wrote the first group of day D (offset 1): it is in D1 and must not be added again.
    await addStats(id, [{ country: "DE", city: "Berlin", lat: 52.52, lon: 13.4, visits: 5 }]);
    const cursor = { day: D, offset: 1 };
    await setCursor(cursor);
    ae.points = [
      point(link, { country: "DE", city: "Berlin", lat: 52.52, lon: 13.4, at: AT_D, sample: 5 }),
      point(link, { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, at: AT_D, sample: 2 }),
      point(link, { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, at: AT_D1, sample: 3 }),
    ];
    const body = (await (
      await call(stats(id, { authorization: `Bearer ${key}` }))
    ).json()) as StatsBody;
    expect(ae.queries[0]).toContain("OFFSET 1");
    expect(body.visits).toBe(10);
    expect(body.countries).toEqual([
      { code: "DE", visits: 5 },
      { code: "PL", visits: 5 },
    ]);
    expect(body.cities).toEqual([
      { country: "DE", city: "Berlin", lat: 52.52, lon: 13.4, visits: 5 },
      { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 5 },
    ]);
  });

  it("a re-created id shows zero for the earlier link's un-rolled visits, then counts its own", async () => {
    const id = `again${Date.now().toString(36)}`;
    const make = (createdAt: number) =>
      insertLink(env.DB, {
        id,
        target: "https://example.com/again",
        secretHash: null,
        expiresAt: null,
        createdAt,
        isCustom: true,
      });
    await make(AT_D - 1000);
    await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    await make(AT_D);
    await setCursor(CURSOR);
    const earlier = { id, createdAt: AT_D - 1000 };
    ae.points = [point(earlier, { country: "PL", city: "Warsaw", at: AT_D, sample: 4 })];
    const empty = (await (await call(stats(id))).json()) as StatsBody;
    expect(empty.visits).toBe(0);
    expect(empty.countries).toEqual([]);

    ae.points.push(point({ id, createdAt: AT_D }, { country: "DE", city: "Berlin", at: AT_D }));
    await caches.default.delete(freshCacheKey(CURSOR));
    const counted = (await (await call(stats(id))).json()) as StatsBody;
    expect(counted.countries).toEqual([{ code: "DE", visits: 1 }]);
  });

  it("answers from D1 with partial: true when the SQL API fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { id } = await linkWithStats();
    ae.failWith = 500;
    const res = await call(stats(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      visits: 7,
      countries: [
        { code: "DE", visits: 4 },
        { code: "PL", visits: 2 },
        { code: "US", visits: 1 },
      ],
      partial: true,
    });
  });

  it("the 61st stats request from one IP returns 429 with Retry-After (RL_STATS)", async () => {
    const { id } = await create();
    const bindings = testEnv({ RL_STATS: fakeLimiter(60), RL_REDIRECT: fakeLimiter(0) });
    const headers = { "cf-connecting-ip": "198.51.100.8" };
    for (let i = 0; i < 60; i += 1) {
      expect((await call(stats(id, headers), bindings)).status).toBe(200);
    }
    const limited = await call(stats(id, headers), bindings);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});

describe("GET /api/v1/stats", () => {
  function countingDb(): { db: D1Database; sql: string[] } {
    const sql: string[] = [];
    const db = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (query: string) => {
            sql.push(query);
            return target.prepare(query);
          };
        }
        if (prop === "batch" || prop === "exec") {
          return () => {
            throw new Error(`unexpected D1 ${String(prop)}`);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return { db, sql };
  }

  it("reads only the global_stats row (one D1 query, no SQL API call)", async () => {
    const countries = Array.from({ length: 20 }, (_, i) => ({ code: `C${i}`, visits: 100 - i }));
    const updatedAt = Date.parse("2026-11-13T01:05:00Z");
    await env.DB.prepare(
      "INSERT OR REPLACE INTO global_stats (id, links, visits, countries, updated_at) VALUES (1, ?, ?, ?, ?)",
    )
      .bind(42, 1810, JSON.stringify(countries), updatedAt)
      .run();
    const { db, sql } = countingDb();

    const res = await call(request("/api/v1/stats"), testEnv({ DB: db }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({
      links: 42,
      visits: 1810,
      countries,
      updatedAt: "2026-11-13T01:05:00.000Z",
    });
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("FROM global_stats");
    expect(ae.queries).toEqual([]);
  });

  it("returns zeros before the first daily recompute", async () => {
    await env.DB.prepare("DELETE FROM global_stats").run();
    const res = await call(request("/api/v1/stats"));
    expect(await res.json()).toEqual({ links: 0, visits: 0, countries: [], updatedAt: null });
  });

  it("the 61st request from one IP returns 429 (RL_STATS)", async () => {
    const bindings = testEnv({ RL_STATS: fakeLimiter(60) });
    const headers = { "cf-connecting-ip": "198.51.100.9" };
    for (let i = 0; i < 60; i += 1) {
      expect((await call(request("/api/v1/stats", { headers }), bindings)).status).toBe(200);
    }
    const limited = await call(request("/api/v1/stats", { headers }), bindings);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
