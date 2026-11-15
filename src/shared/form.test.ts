import { describe, expect, it } from "bun:test";
import { parseExpiry } from "../domain/expiry.ts";
import { expiresAtFrom, hostIsIdn } from "./form";

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

  it("turns an empty date into a value the expiry check rejects", () => {
    for (const zone of ["Z", ""]) {
      const value = expiresAtFrom({ expiry: "custom", customDate: "" }, NOW, zone);
      expect(parseExpiry(value, NOW)).toEqual({ ok: false, code: "invalid_expiry" });
    }
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
