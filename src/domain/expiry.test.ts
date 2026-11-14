import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { parseExpiry } from "./expiry.ts";

const now = Date.parse("2026-06-01T12:00:00Z");

describe("parseExpiry", () => {
  it("null is never an error and stays null", () => {
    expect(parseExpiry(null, now)).toEqual({ ok: true, expiresAt: null });
  });

  it("accepts a future date and returns unix ms", () => {
    expect(parseExpiry("2026-06-02T12:00:00Z", now)).toEqual({
      ok: true,
      expiresAt: Date.parse("2026-06-02T12:00:00Z"),
    });
  });

  it("accepts an offset and minute precision", () => {
    expect(parseExpiry("2026-06-02T12:00+02:00", now).ok).toBe(true);
  });

  it("rejects the past and the present", () => {
    expect(parseExpiry("2026-05-31T12:00:00Z", now)).toEqual({ ok: false, code: "expiry_in_past" });
    expect(parseExpiry("2026-06-01T12:00:00Z", now)).toEqual({ ok: false, code: "expiry_in_past" });
  });

  it("accepts exactly 1 year and rejects 1 ms over", () => {
    expect(parseExpiry("2027-06-01T12:00:00.000Z", now).ok).toBe(true);
    expect(parseExpiry("2027-06-01T12:00:00.001Z", now)).toEqual({
      ok: false,
      code: "expiry_too_far",
    });
  });

  it.each(["", "tomorrow", "2026-13-40T00:00:00Z", "2026-06-02", "never", "1e12"])(
    "rejects invalid input %p",
    (input) => {
      expect(parseExpiry(input, now)).toEqual({ ok: false, code: "invalid_expiry" });
    },
  );

  it.each(["2027-02-30T00:00Z", "2026-06-02T24:00:00Z", "2026-06-31T10:00Z", "2026-06-02T10:60Z"])(
    "rejects a date that does not exist as written: %p",
    (input) => {
      expect(parseExpiry(input, now)).toEqual({ ok: false, code: "invalid_expiry" });
    },
  );

  it("property: any date more than a year away is rejected", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2028-01-01"), max: new Date("2100-01-01"), noInvalidDate: true }),
        (d) => {
          expect(parseExpiry(d.toISOString(), now).ok).toBe(false);
        },
      ),
    );
  });
});
