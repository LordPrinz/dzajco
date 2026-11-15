import { expect, it } from "vitest";
import { isBot } from "../../src/domain/bots";

// The pattern uses a lookbehind; this proves workerd compiles it like Bun does.
it("isBot spares CUBOT and still flags crawlers in workerd", () => {
  expect(isBot("Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG 5 Pro) Chrome/120.0 Mobile")).toBe(
    false,
  );
  expect(isBot("Googlebot/2.1")).toBe(true);
  expect(isBot("SomeBot/1.0")).toBe(true);
});
