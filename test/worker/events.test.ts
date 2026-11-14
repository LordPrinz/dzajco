import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/index";

const TOKEN = "0123456789abcdef0123456789abcdef";

async function home(token = "", at?: string): Promise<Response> {
  if (at) vi.useFakeTimers({ now: new Date(at), toFake: ["Date"] });
  const bindings = { ...env, CF_ANALYTICS_TOKEN: token } as unknown as Cloudflare.Env;
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request("https://dzaj.co/"), bindings, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

afterEach(() => vi.useRealTimers());

describe("seasonal event script", () => {
  it("is added with the nonce inside a window", async () => {
    const res = await home("", "2026-12-10T10:00:00Z");
    const html = await res.text();
    const nonce = /nonce-([^ ';]+)/.exec(res.headers.get("Content-Security-Policy") ?? "")?.[1];
    expect(nonce).toBeTruthy();
    expect(html).toContain(
      `<script type="module" nonce="${nonce}" src="/assets/events.js" data-event="snow"></script>`,
    );
  });

  it("is absent outside every window", async () => {
    const html = await (await home("", "2026-06-15T10:00:00Z")).text();
    expect(html).not.toContain("events.js");
    expect(html).not.toContain("data-event");
  });
});

describe("CF Web Analytics beacon", () => {
  it("is added with the nonce when the token is set", async () => {
    const res = await home(TOKEN, "2026-06-15T10:00:00Z");
    const html = await res.text();
    const nonce = /nonce-([^ ';]+)/.exec(res.headers.get("Content-Security-Policy") ?? "")?.[1];
    expect(html).toContain(
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{&quot;token&quot;:&quot;${TOKEN}&quot;}' nonce="${nonce}"></script>`,
    );
  });

  it("is omitted when the token is empty or malformed", async () => {
    expect(await (await home("", "2026-06-15T10:00:00Z")).text()).not.toContain(
      "cloudflareinsights",
    );
    const bad = await (await home(`x'"><script>`, "2026-06-15T10:00:00Z")).text();
    expect(bad).not.toContain("cloudflareinsights");
  });

  it("keeps the CSP hosts from the design", async () => {
    const csp = (await home(TOKEN)).headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com");
    expect(csp).toMatch(
      /script-src 'self' 'nonce-[^']+' https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js;/,
    );
  });
});
