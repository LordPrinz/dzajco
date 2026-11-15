import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../../src/index";

const ORIGIN = "https://dzaj.co";

async function call(req: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function html(path: string, cookie?: string): Promise<string> {
  const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};
  return (await call(new Request(`${ORIGIN}${path}`, { headers }))).text();
}

function setTheme(
  fields: Record<string, string>,
  headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin" },
): Request {
  return new Request(`${ORIGIN}/prefs/theme`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("theme on pages", () => {
  it.each(["/", "/about", "/history", "/docs/api", "/privacy-policy", "/no/such/page"])(
    "%s renders the cookie's theme on <html> and marks it in the switch",
    async (path) => {
      const page = await html(path, "theme=dark");
      expect(page).toMatch(/<html lang="pl" data-theme="dark">/);
      expect(page).toMatch(/value="dark"[^>]*aria-pressed="true"/);
      expect(page).toMatch(/value="system"[^>]*aria-pressed="false"/);
      expect(page).toContain(`name="back" value="${path}"`);
    },
  );

  it("leaves data-theme off for the system theme and for unknown cookie values", async () => {
    for (const cookie of [undefined, "theme=system", "theme=purple"]) {
      const page = await html("/", cookie);
      expect(page).toContain('<html lang="pl">');
      expect(page).toMatch(/value="system"[^>]*aria-pressed="true"/);
    }
  });

  it("serves themed pages with no-store, so a cache never mixes them", async () => {
    const res = await call(new Request(`${ORIGIN}/about`, { headers: { Cookie: "theme=light" } }));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /prefs/theme", () => {
  it("stores the choice in a year-long cookie and sends the visitor back", async () => {
    const res = await call(setTheme({ theme: "light", back: "/about" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/about");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^theme=light;/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/Max-Age=\d{8}/);
    expect(cookie).toContain("HttpOnly");
  });

  it("keeps the current cookie for an unknown theme", async () => {
    const res = await call(setTheme({ theme: "purple", back: "/" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("clears the cookie for the system theme", async () => {
    const res = await call(setTheme({ theme: "system", back: "/" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toMatch(/^theme=;.*Max-Age=0/);
  });

  it.each(["https://evil.example/", "//evil.example", "/\\evil.example", "", "/.//evil.example"])(
    "never redirects off the site (back=%p)",
    async (back) => {
      const res = await call(setTheme({ theme: "dark", back }));
      expect(res.headers.get("location")).toBe("/");
    },
  );

  it("refuses cross-site posts without setting a cookie", async () => {
    const res = await call(setTheme({ theme: "dark" }, { "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
