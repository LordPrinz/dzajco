import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { startCursor } from "../../src/analytics/day";
import { freshCacheKey } from "../../src/analytics/fresh";
import { blockHost, insertLink } from "../../src/db/queries";
import worker from "../../src/index";

const ORIGIN = "https://dzaj.co";
const allowAll: RateLimit = { limit: async () => ({ success: true }) };
const SECRET = "OwnerKeyOwnerKeyOwnerKey0";
const CITY_A = "Qwertyville";
const CITY_B = "Zxcvburg";

function testEnv(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return {
    ...env,
    SECRET_PEPPER_V1: "stats-page-pepper",
    RL_CREATE: allowAll,
    RL_REDIRECT: allowAll,
    RL_STATS: allowAll,
    ...overrides,
  };
}

async function call(path: string, bindings: Cloudflare.Env = testEnv(), init?: RequestInit) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, init), bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

let counter = 0;
function freshId(): string {
  counter += 1;
  return `sp${Date.now().toString(36)}${counter}`;
}

async function seed(
  id: string,
  extra: { expiresAt?: number | null; blocked?: boolean } = {},
): Promise<void> {
  await insertLink(env.DB, {
    id,
    target: "https://example.com/stats-target",
    secretHash: null,
    expiresAt: extra.expiresAt ?? null,
    createdAt: Date.now(),
    isCustom: true,
  });
  await env.DB.prepare(
    "INSERT INTO link_stats (link_id, country, city, lat, lon, visits) VALUES (?1, 'PL', ?2, 52.23, 21.01, 3), (?1, 'PL', ?3, 50.06, 19.94, 2), (?1, 'DE', '', NULL, NULL, 4)",
  )
    .bind(id, CITY_A, CITY_B)
    .run();
}

describe("GET /:id/stats", () => {
  it("serves HTML with the right totals and countries, and no city names", async () => {
    const id = freshId();
    await seed(id);
    const res = await call(`/${id}/stats`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain(`>9</span>`);
    expect(html).toContain("Polska");
    expect(html).toContain("Niemcy");
    expect(html).toContain('<meter class="bars__meter" min="0" max="5" value="5"');
    expect(html).toContain('<meter class="bars__meter" min="0" max="5" value="4"');
    expect(html).not.toContain(CITY_A);
    expect(html).not.toContain(CITY_B);
    expect(html).not.toContain("52.23");
  });

  it("returns the same numbers and no cities from the JSON endpoint without a key", async () => {
    const id = freshId();
    await seed(id);
    const res = await call(`/api/v1/links/${id}/stats`);
    const body = (await res.json()) as { visits: number; cities?: unknown };
    expect(body.visits).toBe(9);
    expect("cities" in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain(CITY_A);
  });

  it("uses nonce scripts only and no inline style", async () => {
    const id = freshId();
    await seed(id);
    const res = await call(`/${id}/stats`);
    const html = await res.text();
    const nonce = /nonce-([^';\s]+)/.exec(res.headers.get("content-security-policy") ?? "")?.[1];
    expect(nonce).toBeTruthy();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toContain('src="/assets/stats.js"');
    expect(html).toContain('href="/css/stats.css"');
    expect(res.headers.get("content-security-policy")).toContain("style-src 'self'");
    expect(res.headers.get("content-security-policy")).toContain(
      "img-src 'self' data: https://tile.openstreetmap.org",
    );
  });

  it("carries og:image and never mentions leaflet", async () => {
    const id = freshId();
    await seed(id);
    const html = await (await call(`/${id}/stats`)).text();
    expect(html).toContain('property="og:image" content="/img/og.jpg"');
    expect(html.toLowerCase()).not.toContain("leaflet");
    const home = await (await call("/")).text();
    expect(home.toLowerCase()).not.toContain("leaflet");
  });

  it("links to the abuse report when ABUSE_EMAIL is set and omits it otherwise", async () => {
    const id = freshId();
    await seed(id);
    const withMail = await (
      await call(`/${id}/stats`, testEnv({ ABUSE_EMAIL: "abuse@example.com" as "" }))
    ).text();
    expect(withMail).toContain("Zgłoś nadużycie");
    expect(withMail).toContain("mailto:abuse@example.com");
    const without = await (await call(`/${id}/stats`, testEnv({ ABUSE_EMAIL: "" }))).text();
    expect(without).not.toContain("Zgłoś nadużycie");
  });

  it("answers 404 for an unknown id", async () => {
    const res = await call(`/${freshId()}/stats`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Nie znaleziono linku");
  });

  it("answers 410 for an expired link", async () => {
    const id = freshId();
    await seed(id, { expiresAt: Date.now() - 1000 });
    const res = await call(`/${id}/stats`);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("Ten link wygasł");
  });

  it("answers 410 for a blocked link", async () => {
    const id = freshId();
    await seed(id);
    await blockHost(env.DB, "example.com", null, Date.now());
    try {
      const res = await call(`/${id}/stats`);
      expect(res.status).toBe(410);
      expect(await res.text()).toContain("Ten link został wyłączony");
    } finally {
      await env.DB.prepare("DELETE FROM blocked_hosts WHERE host = 'example.com'").run();
    }
  });

  it("still serves the page, with the partial notice, when CF_ACCOUNT_ID is malformed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = freshId();
    await seed(id);
    // The fresh rows are cached per cursor, so an earlier test's answer would hide the failure.
    await caches.default.delete(freshCacheKey(startCursor(Date.now())));
    const bindings = testEnv({ CF_ACCOUNT_ID: "not-an-account-id" as "", CF_AE_TOKEN: "tok" });
    const res = await call(`/${id}/stats`, bindings);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Najnowsze wejścia mogą jeszcze nie być widoczne.");
  });

  it("answers 429 when the stats limiter refuses", async () => {
    const id = freshId();
    await seed(id);
    const res = await call(
      `/${id}/stats`,
      testEnv({ RL_STATS: { limit: async () => ({ success: false }) } }),
    );
    expect(res.status).toBe(429);
  });

  it("keeps /:id/info redirecting to /:id/stats", async () => {
    const id = freshId();
    const res = await call(`/${id}/info`, testEnv(), { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/${id}/stats`);
  });
});

describe("owner stats request", () => {
  it("returns the cities only with the key, as no-store, and the wrong key is 403", async () => {
    const id = freshId();
    const create = await call("/api/v1/links", testEnv(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/owner", customName: id }),
    });
    const { secretKey } = (await create.json()) as { secretKey: string };
    await env.DB.prepare(
      "INSERT INTO link_stats (link_id, country, city, lat, lon, visits) VALUES (?1, 'PL', ?2, 52.23, 21.01, 3)",
    )
      .bind(id, CITY_A)
      .run();

    const ok = await call(`/api/v1/links/${id}/stats`, testEnv(), {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const body = (await ok.json()) as { cities: { city: string; lat: number }[] };
    expect(body.cities[0]).toMatchObject({ city: CITY_A, lat: 52.23 });

    const wrong = await call(`/api/v1/links/${id}/stats`, testEnv(), {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    expect(wrong.status).toBe(403);
  });
});
