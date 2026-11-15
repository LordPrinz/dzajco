import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../../src/index";

const ORIGIN = "https://dzaj.co";
const allowAll: RateLimit = { limit: async () => ({ success: true }) };
const denyAll: RateLimit = { limit: async () => ({ success: false }) };

function testEnv(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return {
    ...env,
    SECRET_PEPPER_V1: "pages-test-pepper",
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

function submit(
  fields: Record<string, string>,
  headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin" },
): Request {
  return new Request(`${ORIGIN}/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

let counter = 0;
function freshName(): string {
  counter += 1;
  return `pg${Date.now().toString(36)}${counter}`;
}

describe("GET /", () => {
  it("serves the form as HTML with a nonce on every script and no inline style", async () => {
    const res = await call(new Request(`${ORIGIN}/`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain('property="og:image" content="/img/og.jpg"');
    expect(html).toContain('<form class="shorten"');

    const nonce = /nonce-([^';\s]+)/.exec(res.headers.get("content-security-policy") ?? "")?.[1];
    expect(nonce).toBeTruthy();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) {
      expect(tag).toContain(`nonce="${nonce}"`);
      expect(tag).toContain('type="module"');
      expect(tag).toMatch(/\bsrc="\/assets\//);
    }
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("uses a fresh nonce per request and the CSP from the design", async () => {
    const a = await call(new Request(`${ORIGIN}/`));
    const b = await call(new Request(`${ORIGIN}/`));
    const csp = a.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toBe(b.headers.get("content-security-policy"));
  });
});

describe("POST / without JavaScript", () => {
  it("creates a link and shows the secretKey with a warning, uncached", async () => {
    const name = freshName();
    const res = await call(
      submit({ url: "https://example.com/a?b=1", customName: name, expiry: "1d", customDate: "" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    const key = /data-field="secretKey">([A-Za-z0-9_-]{22})</.exec(html)?.[1];
    expect(key).toBeTruthy();
    expect(html).toContain("Zapisz go, nie pokażemy go ponownie");
    expect(html).toContain(`${env.PUBLIC_ORIGIN}/${name}`);
    expect(html).toContain("Wygasa:");

    const row = await env.DB.prepare(
      "SELECT target, expires_at, secret_hash FROM links WHERE id = ?",
    )
      .bind(name)
      .first<{ target: string; expires_at: number | null; secret_hash: string }>();
    expect(row?.target).toBe("https://example.com/a?b=1");
    expect(row?.expires_at).toBeGreaterThan(Date.now() + 86_000_000);
    expect(row?.secret_hash).not.toContain(key ?? "?");
    expect(html).not.toContain(row?.secret_hash ?? "?");
  });

  it("adds https:// to a bare host and keeps never-expiring links unexpiring", async () => {
    const res = await call(submit({ url: "example.org", expiry: "never" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("https://example.org/");
  });

  it("reads a custom date as UTC", async () => {
    const name = freshName();
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16);
    const res = await call(
      submit({
        url: "https://example.com",
        customName: name,
        expiry: "custom",
        customDate: future,
      }),
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT expires_at FROM links WHERE id = ?")
      .bind(name)
      .first<{ expires_at: number }>();
    expect(row?.expires_at).toBe(Date.parse(`${future}:00Z`));
  });

  it("shows the punycode host when the target is an IDN", async () => {
    const res = await call(submit({ url: "https://bücher.example/książka" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("xn--bcher-kva.example");
    expect(html).toMatch(/data-field="idn"(?![^>]*\bhidden)/);
  });

  it("keeps the punycode note hidden for an ASCII host", async () => {
    const res = await call(submit({ url: "https://example.com" }));
    expect(await res.text()).toMatch(/data-field="idn"[^>]*\bhidden/);
  });
});

describe("POST / validation", () => {
  it("re-renders the form with the entered values and a Polish message", async () => {
    const res = await call(submit({ url: "ftp://example.com/file", customName: "moja" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Dozwolone są tylko adresy http i https.");
    expect(html).toContain('value="ftp://example.com/file"');
    expect(html).toContain('value="moja"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toMatch(/data-field="secretKey">[A-Za-z0-9_-]{22}</);
  });

  it("points at the custom name field for a bad name", async () => {
    const res = await call(submit({ url: "https://example.com", customName: "a" }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Własna nazwa ma mieć od 3 do 32");
    expect(html).toMatch(/id="customName"[^>]*aria-invalid="true"/);
  });

  it("rejects a custom expiry in the past", async () => {
    const res = await call(
      submit({ url: "https://example.com", expiry: "custom", customDate: "2001-01-01T00:00" }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Data wygaśnięcia musi być w przyszłości.");
  });

  it("rejects a custom expiry with an empty date", async () => {
    const res = await call(
      submit({ url: "https://example.com", expiry: "custom", customDate: "" }),
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Podaj istniejącą datę wygaśnięcia.");
    expect(html).toMatch(/id="expiry"[^>]*aria-invalid="true"/);
  });

  it("answers 409 for a taken name", async () => {
    const name = freshName();
    await call(submit({ url: "https://example.com", customName: name }));
    const res = await call(submit({ url: "https://example.com", customName: name }));
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("Ta nazwa jest już zajęta.");
  });

  it("rejects an empty url", async () => {
    const res = await call(submit({ url: "" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("To nie wygląda na poprawny adres URL.");
  });

  it("answers 415 to another content type", async () => {
    const res = await call(
      new Request(`${ORIGIN}/`, {
        method: "POST",
        headers: { "content-type": "application/json", "Sec-Fetch-Site": "same-origin" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(415);
  });
});

describe("POST / origin check", () => {
  it("returns 403 for a foreign Origin", async () => {
    const res = await call(
      submit({ url: "https://example.com" }, { Origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("returns 403 for Sec-Fetch-Site cross-site", async () => {
    const res = await call(
      submit({ url: "https://example.com" }, { "Sec-Fetch-Site": "cross-site" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for same-site, even with a matching Origin", async () => {
    const res = await call(
      submit({ url: "https://example.com" }, { "Sec-Fetch-Site": "same-site", Origin: ORIGIN }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when neither header is present", async () => {
    const res = await call(submit({ url: "https://example.com" }, {}));
    expect(res.status).toBe(403);
  });

  it("does not create a link on a refused post", async () => {
    const name = freshName();
    await call(
      submit({ url: "https://example.com", customName: name }, { Origin: "https://evil.example" }),
    );
    const row = await env.DB.prepare("SELECT id FROM links WHERE id = ?").bind(name).first();
    expect(row).toBeNull();
  });

  it("accepts an Origin equal to the own host when Sec-Fetch-Site is missing", async () => {
    const res = await call(submit({ url: "https://example.com" }, { Origin: ORIGIN }));
    expect(res.status).toBe(200);
  });

  it("returns 403 for Origin: null", async () => {
    const res = await call(submit({ url: "https://example.com" }, { Origin: "null" }));
    expect(res.status).toBe(403);
  });

  it("accepts the configured public origin", async () => {
    const res = await call(submit({ url: "https://example.com" }, { Origin: env.PUBLIC_ORIGIN }));
    expect(res.status).toBe(200);
  });
});

describe("POST / rate limit", () => {
  it("returns an HTML 429 with Retry-After over the limit", async () => {
    const res = await call(submit({ url: "https://example.com" }), testEnv({ RL_CREATE: denyAll }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Za dużo żądań");
    expect(html).toContain("Utworzono za dużo linków w krótkim czasie.");
  });

  it("checks the origin before spending the limit", async () => {
    let calls = 0;
    const counting: RateLimit = {
      limit: async () => {
        calls += 1;
        return { success: true };
      },
    };
    await call(
      submit({ url: "https://example.com" }, { Origin: "https://evil.example" }),
      testEnv({ RL_CREATE: counting }),
    );
    expect(calls).toBe(0);
  });
});

describe("POST / failures", () => {
  it("answers 413 for an oversized form", async () => {
    const res = await call(submit({ url: "https://example.com", customName: "a".repeat(9000) }));
    expect(res.status).toBe(413);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Formularz jest za duży");
  });

  it("answers a Polish HTML 500 and logs only the error class", async () => {
    const failing = {
      ...env.DB,
      prepare: (sql: string) => {
        if (/insert/i.test(sql)) throw new Error("secret detail https://example.com");
        return env.DB.prepare(sql);
      },
    } as unknown as D1Database;
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.join(" "));
    };
    let res: Response;
    try {
      res = await call(submit({ url: "https://example.com" }), testEnv({ DB: failing }));
    } finally {
      console.error = original;
    }
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('lang="pl"');
    expect(html).toContain("Coś poszło nie tak");
    expect(logged.join("\n")).toContain("failed: Error");
    expect(logged.join("\n")).not.toContain("secret detail");
  });
});

describe("POST / escaping", () => {
  it("escapes the entered values when the form is re-rendered", async () => {
    const res = await call(submit({ url: '"><script>x</script>', customName: '"><b>' }));
    const html = await res.text();
    expect(html).not.toContain("<script>x");
    expect(html).not.toContain('"><b>');
    expect(html).toContain("&lt;script&gt;x");
  });
});
