import { describe, expect, it } from "bun:test";
import { expiresAtFrom, hostIsIdn, normalizeUrlInput } from "./form";

const NOW = Date.parse("2026-01-01T00:00:00Z");

describe("expiresAtFrom with a custom date", () => {
  const choice = { expiry: "custom", customDate: "2026-12-01T10:00" };

  it("reads the date at a fixed offset and converts it to UTC", () => {
    expect(expiresAtFrom(choice, NOW, "+02:00")).toBe("2026-12-01T08:00:00.000Z");
    expect(expiresAtFrom(choice, NOW, "-05:00")).toBe("2026-12-01T15:00:00.000Z");
  });

  it("reads the date as the browser's local time with an empty zone", () => {
    expect(expiresAtFrom(choice, NOW, "")).toBe(new Date("2026-12-01T10:00:00").toISOString());
  });

  it("keeps the date as UTC for the server", () => {
    expect(expiresAtFrom(choice, NOW, "Z")).toBe("2026-12-01T10:00:00Z");
  });

  it("passes an unparsable date on for the API to reject", () => {
    expect(expiresAtFrom({ expiry: "custom", customDate: "nope" }, NOW, "")).toBe("nope");
  });
});

describe("hostIsIdn", () => {
  it("detects a punycode label anywhere in the host", () => {
    expect(hostIsIdn("xn--pnk-qma.pl")).toBe(true);
    expect(hostIsIdn("www.xn--pnk-qma.pl")).toBe(true);
    expect(hostIsIdn("example.com")).toBe(false);
    expect(hostIsIdn("notxn--example.com")).toBe(false);
  });
});

describe("normalizeUrlInput", () => {
  it("adds https to a host with a port", () => {
    expect(normalizeUrlInput("example.com:8080/path")).toBe("https://example.com:8080/path");
    expect(normalizeUrlInput("localhost:3000")).toBe("https://localhost:3000");
  });

  it("adds https to a bare host", () => {
    expect(normalizeUrlInput(" example.com/path ")).toBe("https://example.com/path");
  });

  it("leaves real schemes alone so the URL policy rejects them", () => {
    for (const input of [
      "ftp://example.com",
      "mailto:a@b.c",
      "javascript:alert(1)",
      "http://a.b",
      "HTTPS://A.B",
    ]) {
      expect(normalizeUrlInput(input)).toBe(input);
    }
  });
});
