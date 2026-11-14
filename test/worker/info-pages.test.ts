import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../../src/index";
import { ENDPOINTS, ERROR_CODES } from "../../src/views/ApiDocs";

const ORIGIN = "https://dzaj.co";

async function get(path: string, bindings: Cloudflare.Env = env): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`), bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function page(path: string, bindings?: Cloudflare.Env) {
  const res = await get(path, bindings);
  return { res, html: await res.text() };
}

describe.each(["/history", "/about", "/docs/api", "/privacy-policy"])("GET %s", (path) => {
  it("is an HTML page with nonce scripts only, no inline style, and not cached", async () => {
    const { res, html } = await page(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain('href="/css/pages.css"');

    const nonce = /nonce-([^';\s]+)/.exec(res.headers.get("content-security-policy") ?? "")?.[1];
    expect(nonce).toBeTruthy();
    for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
      expect(tag).toContain(`nonce="${nonce}"`);
      expect(tag).toMatch(/\bsrc="\/assets\//);
    }
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("GET /history", () => {
  it("ships the shell and loads history.js", async () => {
    const { html } = await page("/history");
    expect(html).toContain('id="history-list"');
    expect(html).toContain('id="history-empty"');
    expect(html).toContain('src="/assets/history.js"');
  });
});

describe("GET /about", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      `INSERT INTO global_stats (id, links, visits, countries, updated_at) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET links = excluded.links, visits = excluded.visits,
         countries = excluded.countries, updated_at = excluded.updated_at`,
    )
      .bind(
        1234,
        56789,
        JSON.stringify([
          { code: "PL", visits: 40000 },
          { code: "DE", visits: 9000 },
        ]),
        Date.parse("2026-11-13T02:30:00Z"),
      )
      .run();
  });

  it("renders the global stats from the global_stats row", async () => {
    const { html } = await page("/about");
    expect(html).toMatch(/data-stat="links">1\s*234</);
    expect(html).toMatch(/data-stat="visits">56\s*789</);
    expect(html).toContain("Polska");
    expect(html).toContain("Niemcy");
    expect(html.indexOf("Polska")).toBeLessThan(html.indexOf("Niemcy"));
    expect(html).toContain('datetime="2026-11-13T02:30:00.000Z"');
    expect(html).toContain("24 godzin");
  });

  it("embeds the sponsor button without an inline style", async () => {
    const { res, html } = await page("/about");
    expect(html).toContain('src="https://github.com/sponsors/LordPrinz/button"');
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-src https://github.com/sponsors/",
    );
  });

  it("says stats are pending when the row does not exist", async () => {
    await env.DB.prepare("DELETE FROM global_stats").run();
    const { res, html } = await page("/about");
    expect(res.status).toBe(200);
    expect(html).toContain("po pierwszym codziennym przeliczeniu");
    expect(html).not.toContain("data-stat=");
  });
});

describe("GET /docs/api", () => {
  it("lists every endpoint of API v1 and the contract details", async () => {
    const { html } = await page("/docs/api");
    expect(ENDPOINTS).toHaveLength(5);
    for (const endpoint of ENDPOINTS) {
      expect(html).toContain(`method--${endpoint.method.toLowerCase()}`);
      expect(html).toContain(`<code>${endpoint.path}</code>`);
    }
    for (const path of [
      "/api/v1/links",
      "/api/v1/links/:id",
      "/api/v1/links/:id/stats",
      "/api/v1/stats",
    ]) {
      expect(html).toContain(path);
    }
    expect(html).toContain("{ id, shortUrl, url, secretKey, expiresAt }");
    expect(html).toContain("Authorization: Bearer");
    expect(html).toContain("Access-Control-Allow-Origin: *");
    expect(html).toContain("Retry-After");
    expect(html).toContain("curl -X POST");
    expect(html).toContain("default-src &#39;none&#39;");
  });

  it("lists every error code", async () => {
    const { html } = await page("/docs/api");
    for (const { code } of ERROR_CODES) expect(html).toContain(`<code>${code}</code>`);
    // The codes the design names must all be there.
    for (const code of [
      "invalid_json",
      "invalid_body",
      "invalid_url",
      "url_too_long",
      "credentials_not_allowed",
      "own_host",
      "private_target",
      "blocked_target",
      "invalid_name",
      "reserved_name",
      "mixed_script",
      "invalid_expiry",
      "id_taken",
      "payload_too_large",
      "service_unavailable",
      "invalid_key",
      "forbidden",
      "not_found",
      "expired",
      "link_disabled",
      "rate_limited",
    ]) {
      expect(html).toContain(`<code>${code}</code>`);
    }
  });

  it("has a migration section that maps every v2 endpoint", async () => {
    const { html } = await page("/docs/api");
    expect(html).toContain("Migracja z v2");
    for (const old of [
      "GET /api/urls/{shortUrl}",
      "GET /api/urls/{shortUrl}/info",
      "POST /api/urls",
      "DELETE /api/urls/{shortUrl}",
    ]) {
      expect(html).toContain(old);
    }
  });

  it("builds the examples from PUBLIC_ORIGIN", async () => {
    const custom = { ...env, PUBLIC_ORIGIN: "https://dzaj.co" } as unknown as Cloudflare.Env;
    const { html } = await page("/docs/api", custom);
    expect(html).toContain("curl -X POST https://dzaj.co/api/v1/links");
  });
});

describe("GET /privacy-policy", () => {
  it("states what is stored and where client IPs appear", async () => {
    const { html } = await page("/privacy-policy");
    expect(html).toContain("Linki.");
    expect(html).toContain("skrót kryptograficzny");
    expect(html).toContain("Zagregowane liczniki wejść");
    expect(html).toContain("kraj i miasto");
    expect(html).toContain("tylko w logach samego Cloudflare");
    expect(html).toContain("Cloudflare Web Analytics bez plików cookie");
    expect(html).toContain("tile.openstreetmap.org");
    expect(html).toContain("links-history");
    expect(html).toContain("nie trafia na nasz serwer");
  });

  it("links the contact address only when ABUSE_EMAIL is set", async () => {
    expect((await page("/privacy-policy")).html).not.toContain("mailto:");
    const withMail = { ...env, ABUSE_EMAIL: "abuse@dzaj.co" } as unknown as Cloudflare.Env;
    expect((await page("/privacy-policy", withMail)).html).toContain('href="mailto:abuse@dzaj.co');
  });
});

describe("404 and 410 pages", () => {
  it("use the shared layout and keep no-store, nosniff and the abuse link", async () => {
    const withMail = { ...env, ABUSE_EMAIL: "abuse@dzaj.co" } as unknown as Cloudflare.Env;
    const { res, html } = await page("/no-such-link-xyz", withMail);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html).toContain('href="/css/app.css"');
    expect(html).toContain("Nie znaleziono linku");
    expect(html).toContain('href="mailto:abuse@dzaj.co?subject=Report%20abuse"');
    expect(html).not.toMatch(/\sstyle=/i);
  });
});

describe("global 404", () => {
  it("renders an HTML page in the shared layout for non-API paths and JSON for /api", async () => {
    const html = await get("/docs/missing");
    expect(html.status).toBe(404);
    const body = await html.text();
    expect(body).toContain('href="/css/app.css"');
    expect(body).toContain("Nie znaleziono strony");
    const api = await get("/api/v1/nope");
    expect(api.status).toBe(404);
    expect(api.headers.get("content-type")).toContain("application/json");
  });
});
