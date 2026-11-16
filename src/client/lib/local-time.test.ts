import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { formatLocal, localizeTimes } from "./local-time";

const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Europe/Warsaw";
});

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("formatLocal", () => {
  it("formats in the local time zone without a UTC label", () => {
    const text = formatLocal("2026-11-15T20:57:00Z", "pl-PL");
    expect(text).toContain("21:57");
    expect(text).not.toContain("UTC");
  });

  it("follows daylight saving time", () => {
    expect(formatLocal("2026-07-15T20:57:00Z", "pl-PL")).toContain("22:57");
  });

  it("returns the fallback for an invalid date", () => {
    expect(formatLocal("nope", "pl-PL", "raw")).toBe("raw");
  });
});

describe("localizeTimes", () => {
  it("rewrites every time element and leaves the rest alone", () => {
    const created = {
      dateTime: "2026-11-15T20:57:00Z",
      textContent: "15 listopada 2026 20:57 UTC",
    };
    const broken = { dateTime: "nope", textContent: "kept" };
    const root = { querySelectorAll: () => [created, broken] };

    localizeTimes(root, "pl-PL");

    expect(created.textContent).toContain("21:57");
    expect(created.textContent).not.toContain("UTC");
    expect(broken.textContent).toBe("kept");
  });
});
