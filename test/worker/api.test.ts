import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blockHost, insertLink } from "../../src/db/queries";
import worker from "../../src/index";
import { requestId } from "../../src/middleware/request-id";
import { securityHeaders } from "../../src/middleware/security-headers";

const PEPPER = "api-test-pepper";
const allowAll: RateLimit = { limit: async () => ({ success: true }) };

/** In-memory stand-in for a Rate Limiting binding that records keys and allows `limit` calls per key. */
function fakeLimiter(limit: number) {
  const counts = new Map<string, number>();
  const binding: RateLimit = {
    async limit({ key }: RateLimitOptions) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= limit };
    },
  };
  return { binding, counts };
}

function testEnv(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return {
    ...env,
    SECRET_PEPPER_V1: PEPPER,
    RL_CREATE: allowAll,
    RL_REDIRECT: allowAll,
    ...overrides,
  };
}

async function call(req: Request, bindings: Cloudflare.Env = testEnv()): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function post(
  body: unknown,
  headers: Record<string, string> = {},
  origin = "https://dzaj.co",
): Request {
  return new Request(`${origin}/api/v1/links`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://dzaj.co${path}`, { headers, redirect: "manual" });
}

let counter = 0;
function freshName(): string {
  counter += 1;
  return `api${Date.now().toString(36)}${counter}`;
}

type Created = { id: string; shortUrl: string; secretKey: string; expiresAt: string | null };

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/v1/links", () => {
  it("creates a link: 201 with id, shortUrl, secretKey, expiresAt and no-store", async () => {
    const res = await call(post({ url: "https://example.com/a?b=1" }));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Created;
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{7}$/);
    expect(body.shortUrl).toBe(`${env.PUBLIC_ORIGIN}/${body.id}`);
    expect(body.secretKey).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(body.expiresAt).toBeNull();

    const row = await env.DB.prepare(
      "SELECT target, target_host, secret_hash FROM links WHERE id = ?",
    )
      .bind(body.id)
      .first<{ target: string; target_host: string; secret_hash: string }>();
    expect(row?.target).toBe("https://example.com/a?b=1");
    expect(row?.target_host).toBe("example.com");
    expect(row?.secret_hash).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(row?.secret_hash).not.toContain(body.secretKey);
  });

  it("returns the normalised target as url, matching what is stored", async () => {
    const cases: [string, string][] = [
      ["https://Bücher.example/Pfad?q=1", "https://xn--bcher-kva.example/Pfad?q=1"],
      ["https://EXAMPLE.com", "https://example.com/"],
    ];
    for (const [input, expected] of cases) {
      const res = await call(post({ url: input }));
      expect(res.status).toBe(201);
      const body = (await res.json()) as Created & { url: string };
      expect(body.url).toBe(expected);
      const row = await env.DB.prepare("SELECT target FROM links WHERE id = ?")
        .bind(body.id)
        .first<{ target: string }>();
      expect(row?.target).toBe(expected);
    }
  });

  it("creates a link with a custom name and an expiry", async () => {
    const name = freshName();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const res = await call(post({ url: "https://example.com", customName: name, expiresAt }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Created;
    expect(body.id).toBe(name);
    expect(body.expiresAt).toBe(expiresAt);
  });

  it("accepts expiresAt: null as never expiring", async () => {
    const res = await call(post({ url: "https://example.com", expiresAt: null }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as Created).expiresAt).toBeNull();
  });

  it("the created link redirects through GET /:id", async () => {
    const created = (await (await call(post({ url: "https://example.org/x" }))).json()) as Created;
    const res = await call(get(`/${created.id}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.org/x");
  });

  it.each([
    "text/plain",
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "application/jsonp",
  ])("returns 415 for content type %s", async (type) => {
    const res = await call(post({ url: "https://example.com" }, { "content-type": type }));
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("unsupported_media_type");
  });

  it("returns 415 without a content type", async () => {
    const req = new Request("https://dzaj.co/api/v1/links", {
      method: "POST",
      body: new Blob(['{"url":"https://example.com"}']),
    });
    const res = await call(req);
    expect(res.status).toBe(415);
  });

  it("accepts application/json with a charset parameter", async () => {
    const res = await call(
      post({ url: "https://example.com" }, { "content-type": "Application/JSON; charset=utf-8" }),
    );
    expect(res.status).toBe(201);
  });

  it.each(["{", "", "not json", '{"url":'])("returns 400 invalid_json for %j", async (raw) => {
    const res = await call(post(raw));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_json");
  });

  it.each([
    ["a non-object body", [1, 2]],
    ["a missing url", {}],
    ["an object as url", { url: { $ne: null } }],
    ["an object as customName", { url: "https://example.com", customName: { $ne: null } }],
    [
      "an unknown field such as secretKey",
      { url: "https://example.com", secretKey: { $ne: null } },
    ],
    ["a number as expiresAt", { url: "https://example.com", expiresAt: 5 }],
  ])("returns 400 invalid_body for %s", async (_label, body) => {
    const res = await call(post(body));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_body");
  });

  it("returns 413 for a body over the size cap", async () => {
    const res = await call(post({ url: `https://example.com/${"a".repeat(10_000)}` }));
    expect(res.status).toBe(413);
    expect(await errorCode(res)).toBe("payload_too_large");
  });

  it("returns 413 for a streamed body over the cap without Content-Length, never parsing it", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const chunk = new TextEncoder().encode(`{"url":"https://example.com/${"a".repeat(1000)}`);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 100) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const req = new Request("https://dzaj.co/api/v1/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(req.headers.get("content-length")).toBeNull();
    const res = await call(req);
    expect(res.status).toBe(413);
    expect(parse).not.toHaveBeenCalled();
    // The reader stops right after the cap instead of draining the whole stream.
    expect(sent).toBeLessThan(20);
  });

  it("returns 413 when the body is longer than its declared Content-Length, never parsing it", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const req = post(
      { url: `https://example.com/${"a".repeat(10_000)}` },
      { "content-length": "20" },
    );
    const res = await call(req);
    expect(res.status).toBe(413);
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns 413 straight away for a declared Content-Length over the cap", async () => {
    const res = await call(post({ url: "https://example.com" }, { "content-length": "100000" }));
    expect(res.status).toBe(413);
  });

  it("returns 503 service_unavailable when the blocked-host lookup fails", async () => {
    const db = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("blocked_hosts")) throw new Error("D1 down");
            return target.prepare(sql);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(post({ url: "https://example.com" }), testEnv({ DB: db }));
    expect(res.status).toBe(503);
    expect(await errorCode(res)).toBe("service_unavailable");
  });

  it("rejects a target on the workers.dev host the request came in on", async () => {
    const res = await call(post({ url: "https://x.workers.dev/abc" }, {}, "https://x.workers.dev"));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("own_host");
  });

  it.each(["https://dzajco.acct.workers.dev/x", "https://other.acct.workers.dev/"])(
    "from a version preview host rejects %s as own_host",
    async (url) => {
      const res = await call(post({ url }, {}, "https://abc123-dzajco.acct.workers.dev"));
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("own_host");
    },
  );

  it("allows a workers.dev target of another account", async () => {
    const res = await call(
      post(
        { url: "https://site.someone-else.workers.dev/" },
        {},
        "https://abc123-dzajco.acct.workers.dev",
      ),
    );
    expect(res.status).toBe(201);
  });

  it.each([
    ["ftp://example.com", "unsupported_scheme"],
    ["https://user:pw@example.com", "credentials_not_allowed"],
    ["http://127.0.0.1/", "private_target"],
    ["http://[ff02::1]/", "private_target"],
    ["http://[2001:db8::1]/", "private_target"],
    ["http://198.18.0.1/", "private_target"],
    ["https://bit.ly/x", "blocked_target"],
    ["https://dzaj.co/abc", "own_host"],
    ["http://localhost:8787/abc", "own_host"],
    ["not a url", "invalid_url"],
  ])("rejects target %s with 400 %s", async (url, code) => {
    const res = await call(post({ url }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe(code);
  });

  it("creates a link to a public IPv6 literal", async () => {
    const res = await call(post({ url: "http://[2606:4700:4700::1111]/x" }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as Created;
    const redirect = await call(get(`/${id}`));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("http://[2606:4700:4700::1111]/x");
  });

  it("rejects an IPv6 literal on the blocklist and marks its existing links blocked", async () => {
    await insertLink(env.DB, {
      id: "v6blocked",
      target: "http://[2606:4700:4700::1001]/",
      secretHash: null,
      expiresAt: null,
      createdAt: Date.now(),
      isCustom: true,
    });
    await blockHost(env.DB, "[2606:4700:4700:0::1001]", null, Date.now());
    const res = await call(post({ url: "http://[2606:4700:4700::1001]/y" }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("blocked_target");
    expect((await call(get("/v6blocked"))).status).toBe(410);
  });

  it("rejects a target on a blocked host with 400 blocked_target", async () => {
    await blockHost(env.DB, "blocked-api.example", "test", Date.now());
    const res = await call(post({ url: "https://sub.blocked-api.example/x" }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("blocked_target");
  });

  it.each([
    ["ab", "invalid_name"],
    ["history", "reserved_name"],
    ["abcдеф", "mixed_script"],
  ])("rejects custom name %s with 400 %s", async (customName, code) => {
    const res = await call(post({ url: "https://example.com", customName }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe(code);
  });

  it.each([
    ["2020-01-01T00:00:00Z", "expiry_in_past"],
    ["2026-02-30T00:00:00Z", "invalid_expiry"],
    ["tomorrow", "invalid_expiry"],
  ])("rejects expiresAt %s with 400 %s", async (expiresAt, code) => {
    const res = await call(post({ url: "https://example.com", expiresAt }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe(code);
  });

  it("returns 409 id_taken for a custom name that exists", async () => {
    const name = freshName();
    expect((await call(post({ url: "https://example.com", customName: name }))).status).toBe(201);
    const res = await call(post({ url: "https://example.org", customName: name }));
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("id_taken");
  });

  it("reuses a custom name whose link has expired", async () => {
    const name = freshName();
    await insertLink(env.DB, {
      id: name,
      target: "https://example.com/old",
      secretHash: "v1:old",
      expiresAt: Date.now() - 1000,
      createdAt: Date.now() - 5000,
      isCustom: true,
    });
    const res = await call(post({ url: "https://example.org/new", customName: name }));
    expect(res.status).toBe(201);
    const row = await env.DB.prepare("SELECT target FROM links WHERE id = ?")
      .bind(name)
      .first<{ target: string }>();
    expect(row?.target).toBe("https://example.org/new");
  });

  it("keeps 409 for a custom name whose link has not expired yet", async () => {
    const name = freshName();
    await insertLink(env.DB, {
      id: name,
      target: "https://example.com/old",
      secretHash: "v1:old",
      expiresAt: Date.now() + 3_600_000,
      createdAt: Date.now(),
      isCustom: true,
    });
    const res = await call(post({ url: "https://example.org/new", customName: name }));
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("id_taken");
  });

  it.each([
    ["customName", { customName: "a" }],
    ["expiresAt", { expiresAt: "not-a-date" }],
  ])("rejects an invalid %s without a D1 query", async (_field, extra) => {
    const prepare = vi.spyOn(env.DB, "prepare");
    const res = await call(post({ url: "https://example.com", ...extra }));
    expect(res.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("gives exactly one 201 and one 409 when the same name is created in parallel", async () => {
    const name = freshName();
    const results = await Promise.all([
      call(post({ url: "https://example.com/1", customName: name })),
      call(post({ url: "https://example.com/2", customName: name })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("the 11th POST from one IP returns 429 with Retry-After, another IP is not limited", async () => {
    const limiter = fakeLimiter(10);
    const bindings = testEnv({ RL_CREATE: limiter.binding });
    const fromOneIp = () =>
      call(post({ url: "https://example.com" }, { "cf-connecting-ip": "203.0.113.7" }), bindings);
    for (let i = 0; i < 10; i += 1) {
      expect((await fromOneIp()).status).toBe(201);
    }
    const limited = await fromOneIp();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await errorCode(limited)).toBe("rate_limited");
    const other = await call(
      post({ url: "https://example.com" }, { "cf-connecting-ip": "203.0.113.8" }),
      bindings,
    );
    expect(other.status).toBe(201);
  });

  it("keys the limit by cf-connecting-ip (IPv6 /64) and ignores x-forwarded-for", async () => {
    const limiter = fakeLimiter(100);
    const bindings = testEnv({ RL_CREATE: limiter.binding });
    for (const xff of ["1.1.1.1", "2.2.2.2"]) {
      await call(
        post(
          { url: "https://example.com" },
          { "cf-connecting-ip": "2001:db8:1:2:3:4:5:6", "x-forwarded-for": xff },
        ),
        bindings,
      );
    }
    await call(
      post({ url: "https://example.com" }, { "cf-connecting-ip": "2001:db8:1:2:ffff::1" }),
      bindings,
    );
    expect([...limiter.counts.entries()]).toEqual([["2001:db8:1:2::/64", 3]]);
  });

  it("never logs the Authorization header, the body or the created secret key", async () => {
    const logged: unknown[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(...args);
      });
    }
    const auth = "Bearer AAAAAAAAAAAAAAAAAAAAAA";
    const ok = await call(post({ url: "https://example.com/logged" }, { authorization: auth }));
    const created = (await ok.json()) as Created;
    await call(post("{bad json", { authorization: auth }));
    await call(
      post({ url: "https://example.com", customName: "history" }, { authorization: auth }),
    );
    // A failing request still logs only the request id and error class.
    await call(post({ url: "https://example.com/oops" }, { authorization: auth }), {
      ...testEnv(),
      SECRET_PEPPER_V1: "",
    });

    const text = logged
      .map((a) => (a instanceof Error ? `${a.name} ${a.message}` : String(a)))
      .join("\n");
    expect(text).not.toContain(created.secretKey);
    expect(text).not.toContain("AAAAAAAAAAAAAAAAAAAAAA");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("bad json");
  });
});

describe("GET /api/v1/links/:id", () => {
  async function seed(id: string, extra: { expiresAt?: number | null; target?: string } = {}) {
    await insertLink(env.DB, {
      id,
      target: extra.target ?? "https://example.com/seeded",
      secretHash: null,
      expiresAt: extra.expiresAt ?? null,
      createdAt: Date.now(),
      isCustom: true,
    });
  }

  it("returns 200 {id, url, expiresAt}", async () => {
    const id = freshName();
    const expiresAt = Date.now() + 3_600_000;
    await seed(id, { expiresAt });
    const res = await call(get(`/api/v1/links/${id}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id,
      url: "https://example.com/seeded",
      expiresAt: new Date(expiresAt).toISOString(),
    });
  });

  it("returns 404 not_found for an unknown id", async () => {
    const res = await call(get("/api/v1/links/nope-unknown"));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("returns 410 expired for an expired link and deletes it lazily", async () => {
    const id = freshName();
    await seed(id, { expiresAt: Date.now() - 1000 });
    const res = await call(get(`/api/v1/links/${id}`));
    expect(res.status).toBe(410);
    expect(await errorCode(res)).toBe("expired");
    const row = await env.DB.prepare("SELECT id FROM links WHERE id = ?").bind(id).first();
    expect(row).toBeNull();
  });

  it("serves the record from the redirect cache shared with GET /:id", async () => {
    const id = freshName();
    await seed(id);
    expect((await call(get(`/${id}`))).status).toBe(302);
    await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    const res = await call(get(`/api/v1/links/${id}`));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(id);
  });

  it("returns 410 link_disabled for a link on a blocked host", async () => {
    const id = freshName();
    await seed(id, { target: "https://get-blocked.example/x" });
    await blockHost(env.DB, "get-blocked.example", null, Date.now());
    const res = await call(get(`/api/v1/links/${id}`));
    expect(res.status).toBe(410);
    expect(await errorCode(res)).toBe("link_disabled");
  });

  it("the 121st GET from one IP returns 429 with Retry-After, another IP is not limited", async () => {
    const id = freshName();
    await seed(id);
    const bindings = testEnv({ RL_REDIRECT: fakeLimiter(120).binding });
    for (let i = 0; i < 120; i += 1) {
      const res = await call(
        get(`/api/v1/links/${id}`, { "cf-connecting-ip": "198.51.100.1" }),
        bindings,
      );
      expect(res.status).toBe(200);
    }
    const limited = await call(
      get(`/api/v1/links/${id}`, {
        "cf-connecting-ip": "198.51.100.1",
        "x-forwarded-for": "9.9.9.9",
      }),
      bindings,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    const other = await call(
      get(`/api/v1/links/${id}`, { "cf-connecting-ip": "198.51.100.2" }),
      bindings,
    );
    expect(other.status).toBe(200);
  });
});

describe("CORS", () => {
  it("GET sends Access-Control-Allow-Origin * and never reflects Origin or allows credentials", async () => {
    const id = freshName();
    await insertLink(env.DB, {
      id,
      target: "https://example.com",
      secretHash: null,
      expiresAt: null,
      createdAt: Date.now(),
      isCustom: true,
    });
    for (const path of [`/api/v1/links/${id}`, "/api/v1/links/nope-unknown"]) {
      const res = await call(get(path, { origin: "https://evil.example" }));
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    }
  });

  it("answers a preflight for GET and refuses one for POST or DELETE", async () => {
    const preflight = (method: string) =>
      new Request("https://dzaj.co/api/v1/links/abc", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": method },
      });
    const ok = await call(preflight("GET"));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("*");
    expect(ok.headers.get("access-control-allow-methods")).toBe("GET");
    for (const method of ["POST", "DELETE"]) {
      const res = await call(preflight(method));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-methods")).toBeNull();
    }
  });

  it("POST has no CORS headers", async () => {
    const res = await call(
      post({ url: "https://example.com" }, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("headers", () => {
  it("JSON responses carry default-src 'none', nosniff and a request id", async () => {
    for (const res of [
      await call(post({ url: "https://example.com" })),
      await call(post("{")),
      await call(get("/api/v1/links/nope-unknown")),
      await call(get("/api/v1/unknown/route/here")),
      await call(get("/healthz")),
    ]) {
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("strict-transport-security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
      expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("header middleware works on responses with immutable headers", async () => {
    const app = new Hono()
      .use("*", requestId(), securityHeaders())
      .get("/r", () => Response.redirect("https://example.com/", 302));
    const immutable = Response.redirect("https://example.com/", 302);
    expect(() => immutable.headers.set("x", "y")).toThrow();
    const res = await app.fetch(new Request("https://dzaj.co/r"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("unknown /api paths get a JSON 404", async () => {
    const res = await call(get("/api/v1/unknown/route/here"));
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("HTML responses carry the security headers from DESIGN.md", async () => {
    const res = await call(get("/no-such-link-html"));
    expect(res.headers.get("content-type")).toContain("text/html");
    const csp = res.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(csp)?.[1];
    expect(nonce).toBeDefined();
    expect(csp).toBe(
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com/beacon.min.js; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self'; frame-src https://github.com/sponsors/; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`,
    );
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("geolocation=(), camera=(), microphone=()");
  });

  it("the CSP nonce changes on every request", async () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const csp = (await call(get("/no-such-link-html"))).headers.get("content-security-policy");
      nonces.add(/'nonce-([^']+)'/.exec(csp ?? "")?.[1] ?? "");
    }
    expect(nonces.size).toBe(5);
    expect(nonces.has("")).toBe(false);
  });

  it("an unexpected error gives a generic JSON 500 under /api", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(post({ url: "https://example.com" }), {
      ...testEnv(),
      SECRET_PEPPER_V1: "",
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal_error", message: "Internal error" },
    });
  });
});
