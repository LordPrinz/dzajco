import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("GET /healthz returns 200", async () => {
  const res = await exports.default.fetch("http://example.com/healthz");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
