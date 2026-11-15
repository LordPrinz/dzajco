import { describe, expect, it } from "bun:test";
import { shortUrlFor } from "./short-url";

describe("shortUrlFor", () => {
  it("joins the public origin and the encoded id", () => {
    expect(shortUrlFor({ PUBLIC_ORIGIN: "https://dzaj.de" }, "abc")).toBe("https://dzaj.de/abc");
    expect(shortUrlFor({ PUBLIC_ORIGIN: "https://dzaj.de/" }, "zażółć")).toBe(
      "https://dzaj.de/za%C5%BC%C3%B3%C5%82%C4%87",
    );
  });

  it("falls back to the path when the origin is broken", () => {
    expect(shortUrlFor({ PUBLIC_ORIGIN: "not a url" }, "abc")).toBe("/abc");
  });
});
