import { describe, expect, it } from "bun:test";
import { smoke } from "./smoke.ts";

function fakeFetch(overrides: { create?: number; redirect?: number; location?: string } = {}) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/healthz")) return new Response('{"ok":true}');
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ id: "abc" }), { status: overrides.create ?? 201 });
    }
    return new Response(null, {
      status: overrides.redirect ?? 302,
      headers: { Location: overrides.location ?? "https://example.com/smoke" },
    });
  }) as typeof fetch;
}

describe("smoke", () => {
  it("fails clearly when a request hangs", async () => {
    let healthy = false;
    const hanging = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/healthz") && !healthy) {
        healthy = true;
        return new Response("{}");
      }
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    }) as typeof fetch;
    await expect(smoke("http://x", hanging)).rejects.toThrow();
  }, 10_000);

  it("passes when health, create and redirect behave", async () => {
    const log = await smoke("http://x", fakeFetch());
    expect(log).toHaveLength(3);
  });

  it("fails when the link is not created", async () => {
    await expect(smoke("http://x", fakeFetch({ create: 500 }))).rejects.toThrow("expected 201");
  });

  it("fails when the redirect is not a 302", async () => {
    await expect(smoke("http://x", fakeFetch({ redirect: 200 }))).rejects.toThrow("expected 302");
  });

  it("fails when the redirect goes elsewhere", async () => {
    await expect(smoke("http://x", fakeFetch({ location: "https://evil.test" }))).rejects.toThrow(
      "redirected to",
    );
  });
});
