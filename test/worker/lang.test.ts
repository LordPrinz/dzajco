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

function get(
  path: string,
  headers: Record<string, string> = {},
  cf?: { country: string },
): Promise<Response> {
  return call(new Request(`${ORIGIN}${path}`, { headers, ...(cf ? { cf } : {}) }));
}

async function langOf(res: Response): Promise<string | undefined> {
  return /<html lang="([a-z]+)"/.exec(await res.text())?.[1];
}

describe("page language", () => {
  it("is English with no hints at all", async () => {
    const res = await get("/");
    expect(res.headers.get("content-language")).toBe("en");
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(">Shorten<");
    expect(html).not.toContain("Dżajcuj");
  });

  it("is Polish for visitors in Poland, whatever the browser asks for", async () => {
    const res = await get("/", { "Accept-Language": "en-US,en;q=0.9" }, { country: "PL" });
    const html = await res.text();
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain(">Dżajcuj<");
  });

  it("follows Accept-Language outside Poland", async () => {
    expect(
      await langOf(await get("/", { "Accept-Language": "pl-PL,pl;q=0.9" }, { country: "DE" })),
    ).toBe("pl");
    expect(await langOf(await get("/", { "Accept-Language": "de-DE" }, { country: "DE" }))).toBe(
      "en",
    );
  });

  it("lets the cookie overrule the country and the browser", async () => {
    const res = await get("/", { Cookie: "lang=en", "Accept-Language": "pl" }, { country: "PL" });
    expect(await langOf(res)).toBe("en");
  });

  it("lets ?lang= overrule the cookie, for the hreflang links", async () => {
    expect(await langOf(await get("/about?lang=pl", { Cookie: "lang=en" }))).toBe("pl");
  });

  it("names the inputs in Vary even though pages are never stored", async () => {
    const res = await get("/about");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("vary")).toContain("Cookie");
    expect(res.headers.get("vary")).toContain("Accept-Language");
  });

  it("links every language version with hreflang and an x-default", async () => {
    const html = await (await get("/docs/api?lang=en")).text();
    const origin = new URL(env.PUBLIC_ORIGIN).origin;
    expect(html).toContain(`hreflang="pl" href="${origin}/docs/api?lang=pl"`);
    expect(html).toContain(`hreflang="en" href="${origin}/docs/api?lang=en"`);
    expect(html).toContain(`hreflang="x-default" href="${origin}/docs/api"`);
  });

  it("marks the current language in the switch and sends the switch back without ?lang=", async () => {
    const html = await (await get("/about?lang=en")).text();
    expect(html).toMatch(/value="en"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/value="pl"[^>]*aria-pressed="false"/);
    expect(html).toContain('name="back" value="/about"');
  });

  it.each([
    ["/about", "Why <span"],
    ["/history", "Link history"],
    ["/docs/api", "Every error has the same shape"],
    ["/privacy-policy", "What we store"],
    ["/no/such/page", "Page not found"],
  ])("renders %s in English", async (path, text) => {
    const html = await (await get(path, { "Accept-Language": "en" })).text();
    expect(html).toContain(text);
  });
});

describe("POST /prefs/lang", () => {
  function choose(
    fields: Record<string, string>,
    headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin" },
  ): Promise<Response> {
    return call(
      new Request(`${ORIGIN}/prefs/lang`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
        body: new URLSearchParams(fields).toString(),
      }),
    );
  }

  it("stores the language and returns to the page without ?lang=", async () => {
    const res = await choose({ lang: "en", back: "/about?lang=pl&x=1" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/about?x=1");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^lang=en;/);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toMatch(/Max-Age=\d{8}/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores a language it does not know", async () => {
    const res = await choose({ lang: "de", back: "/" });
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses cross-site posts", async () => {
    const res = await choose({ lang: "en" }, { "Sec-Fetch-Site": "cross-site" });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
