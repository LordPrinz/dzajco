import { expect, it } from "bun:test";
import worker from "./index.ts";

it("GET /healthz responds with ok", async () => {
  const res = await worker.fetch(new Request("http://localhost/healthz"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
