import { describe, expect, it } from "bun:test";
import { parseTheme, themeOrNull } from "./theme";

describe("parseTheme", () => {
  it.each(["system", "light", "dark"] as const)("accepts %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each([undefined, null, "", "Dark", "blue"])("reads %p as system", (value) => {
    expect(parseTheme(value)).toBe("system");
  });
});

describe("themeOrNull", () => {
  it("returns null for an unknown theme instead of a default", () => {
    expect(themeOrNull("dark")).toBe("dark");
    expect(themeOrNull("purple")).toBeNull();
    expect(themeOrNull(null)).toBeNull();
  });
});
