import { env } from "cloudflare:workers";
import { expect, it } from "vitest";

it("does not load legacy .env files into the Worker env", () => {
  expect(Object.keys(env)).not.toContain("LEGACY_DOTENV_VALUE");
  expect("token" in env).toBe(false);
});
