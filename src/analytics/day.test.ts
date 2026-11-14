import { describe, expect, it } from "bun:test";
import { dayOf, dayStart, isDayClosed, nextDay, startCursor } from "./day.ts";

describe("day helpers", () => {
  it("dayStart parses only real ISO dates", () => {
    expect(dayStart("2026-11-13")).toBe(Date.UTC(2026, 10, 13));
    expect(() => dayStart("2026-02-29")).toThrow();
    expect(() => dayStart("2026-11-13T00:00:00Z")).toThrow();
  });

  it("nextDay and dayOf work in UTC", () => {
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(dayOf(Date.parse("2026-11-13T23:59:59.999Z"))).toBe("2026-11-13");
  });

  it("closes day D only at D+1 01:00 UTC", () => {
    expect(isDayClosed("2026-11-13", Date.parse("2026-11-14T00:59:59.999Z"))).toBe(false);
    expect(isDayClosed("2026-11-13", Date.parse("2026-11-14T01:00:00.000Z"))).toBe(true);
  });

  it("starts an empty cursor at the previous UTC day", () => {
    expect(startCursor(Date.parse("2026-11-14T00:30:00Z"))).toEqual({
      day: "2026-11-13",
      offset: 0,
    });
  });
});
