import { describe, expect, it } from "bun:test";
import { parseTheme } from "./theme";

describe("parseTheme", () => {
  it.each(["system", "light", "dark"] as const)("accepts %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each([undefined, null, "", "Dark", "blue"])("reads %p as system", (value) => {
    expect(parseTheme(value)).toBe("system");
  });
});
